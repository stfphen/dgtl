#!/usr/bin/env python3
"""
Validate a populated creator feature before publishing.

Fails on the things that quietly break SEO or the page; warns on soft issues.

Usage:
  python3 validate.py --file journal/packs/<slug>/index.html --name "Creator Name"
"""
import argparse, json, re, sys
from pathlib import Path

FAILS, WARNS, OKS = [], [], []
def fail(m): FAILS.append(m)
def warn(m): WARNS.append(m)
def ok(m): OKS.append(m)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True)
    ap.add_argument("--name", required=True, help="Creator's full name (must appear in title + H1)")
    args = ap.parse_args()

    p = Path(args.file)
    html = p.read_text(encoding="utf-8")
    # for ref/img checks, ignore anything inside HTML comments (guidance snippets etc.)
    live = re.sub(r"<!--.*?-->", "", html, flags=re.S)
    name = args.name.strip()
    name_l = name.lower()

    # 1. leftover tokens
    left = sorted(set(re.findall(r"\{\{[A-Z0-9_]+\}\}", html)))
    if left: fail(f"{len(left)} unfilled token(s): {', '.join(left)}")
    else: ok("no unfilled tokens")

    # 2. JSON-LD parses
    blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
    if not blocks:
        fail("no JSON-LD found")
    for i, b in enumerate(blocks):
        try:
            json.loads(b); ok(f"JSON-LD block {i} valid")
        except Exception as e:
            fail(f"JSON-LD block {i} invalid: {e}")

    # 3. title
    mt = re.search(r"<title>(.*?)</title>", html, re.S)
    if not mt: fail("no <title>")
    else:
        title = re.sub(r"\s+", " ", mt.group(1)).strip()
        tl = len(title)
        if name_l not in title.lower(): fail(f"creator name not in <title>: {title!r}")
        elif tl > 65: warn(f"<title> is {tl} chars (>65 may truncate in results): {title!r}")
        elif tl < 15: warn(f"<title> is short ({tl} chars): {title!r}")
        else: ok(f"<title> ok ({tl} chars)")

    # 4. meta description
    md = re.search(r'<meta name="description" content="(.*?)">', html, re.S)
    if not md: fail("no meta description")
    else:
        dl = len(md.group(1).strip())
        if dl < 110 or dl > 165: warn(f"meta description is {dl} chars (aim 120–160)")
        else: ok(f"meta description ok ({dl} chars)")

    # 5. exactly one H1, contains name
    h1s = re.findall(r"<h1[^>]*>(.*?)</h1>", html, re.S)
    if len(h1s) != 1: fail(f"expected exactly one <h1>, found {len(h1s)}")
    else:
        h1txt = re.sub(r"<[^>]+>", "", h1s[0])
        h1txt = re.sub(r"\s+", " ", h1txt).strip()
        if name_l not in h1txt.lower():
            warn(f"H1 doesn't contain the name (set HEADLINE_A to the name): {h1txt!r}")
        else: ok("H1 contains the creator name")

    # 6. canonical + og:image
    if not re.search(r'<link rel="canonical"', html): fail("no canonical link")
    else: ok("canonical present")
    ogi = re.search(r'<meta property="og:image" content="(.*?)">', html)
    if not ogi or not ogi.group(1).strip(): warn("og:image empty (set OG_IMAGE to the hosted share image)")
    else: ok("og:image present")

    # 7. every <img> has non-empty alt
    imgs = re.findall(r"<img\b[^>]*>", live)
    bad = [t for t in imgs if not re.search(r'\balt="[^"]', t) and 'alt=""' not in t or re.search(r'\balt=""', t)]
    # count imgs with missing or empty alt (allow aria-hidden decorative)
    missing = []
    for t in imgs:
        m = re.search(r'\balt="(.*?)"', t)
        if m is None:
            missing.append(t[:60])
        elif m.group(1).strip() == "" and 'aria-hidden="true"' not in t:
            missing.append(t[:60])
    if missing: fail(f"{len(missing)} <img> with missing/empty alt (first: {missing[0]!r})")
    else: ok(f"all {len(imgs)} images have alt text")

    # 8. Person sameAs are real (not placeholder)
    if re.search(r'"sameAs"\s*:\s*\[', html):
        if re.search(r'\{\{SAMEAS_\d\}\}', html): fail("placeholder sameAs URL left in schema")
        elif re.search(r'"sameAs"\s*:\s*\[\s*""', html): warn("empty sameAs entry")
        else: ok("Person sameAs populated")

    # 9. local links/assets resolve
    base = p.parent
    miss = []
    for ref in re.findall(r'(?:href|src)="([^"]+)"', live):
        if ref.startswith(("http", "#", "mailto:", "data:")): continue
        t = ref.split("#")[0].split("?")[0]
        if not t: continue
        if not (base / t).resolve().exists(): miss.append(ref)
    if miss: fail(f"{len(miss)} broken local ref(s): {', '.join(sorted(set(miss))[:5])}")
    else: ok("all local links/assets resolve")

    # report
    for m in OKS: print(f"  ok   · {m}")
    for m in WARNS: print(f"  warn · {m}")
    for m in FAILS: print(f"  FAIL · {m}")
    print(f"\n{len(OKS)} ok · {len(WARNS)} warnings · {len(FAILS)} failures")
    if FAILS:
        print("Not ready to publish — fix the failures above.")
        sys.exit(1)
    print("Ready to publish." + ("  (review warnings)" if WARNS else ""))


if __name__ == "__main__":
    main()
