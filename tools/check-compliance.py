#!/usr/bin/env python3
"""
Securities-language and disclaimer gate for DGTL Pay surfaces.

Every DGTL Pay deliverable — strategy doc, project webpage, pitch page, teaser — passes this
before it is called done. The banned list is the compliance perimeter from `_kit/BRIEF.md`;
the disclaimer must appear verbatim on every HTML page.

    python3 tools/check-compliance.py                 # check the default DGTL Pay surface set
    python3 tools/check-compliance.py path [path ...] # check specific files

Exit 0 = clean. Exit 1 = at least one violation.

Why this exists: the most common way an early token concept acquires regulatory risk is through
its own marketing. Audit finding F-03 recorded that risk as "controlled by process rather than by
luck" and recommended keeping the sweep as a release gate. This is that gate.
"""
import glob
import html as H
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 22-term prohibited list. Matched case-insensitively on word boundaries against visible text
# only (script/style stripped, tags removed, entities unescaped).
BANNED = [
    "investment", "invest", "shares", "equity", "stake in DGTL", "profit share",
    "revenue share", "price support", "presale", "pre-sale", "get in early",
    "guaranteed", "will be worth", "ROI", "returns", "moon", "buy now",
    "token sale", "market cap", "appreciate", "upside",
]

DISCLAIMER = (
    "$DGTL is a proposed utility token. It has not been minted, issued, offered, or sold. "
    "Nothing on this page is an offer to sell or a solicitation to buy any asset or security. "
    "Phase dates are targets, not commitments."
)

# Files that must carry the disclaimer verbatim. Markdown strategy docs are swept for banned
# language but are internal documents, not published pages, so they carry no page disclaimer.
DEFAULT_TARGETS = [
    "sites/dgtl-pay/*.html",
    "pitches/dgtl-pay-for-brands/*.html",
    "pitches/dgtl-pay-for-creators/*.html",
    "docs/DGTL-Pay-Strategy-v4.md",
]


def visible_text(raw, is_html):
    """Strip to what a reader actually sees, so a banned word in a CSS class can't false-positive."""
    if not is_html:
        return re.sub(r"\s+", " ", raw)
    text = re.sub(r"<script.*?</script>|<style.*?</style>", " ", raw, flags=re.S | re.I)
    text = re.sub(r"<!--.*?-->", " ", text, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", H.unescape(text))


# The one legitimate exemption: a document whose PURPOSE is to enumerate the banned terms will
# contain them, and obfuscating the list would make it useless as a reference. Exempt by exact
# basename only -- never by directory or glob, or the gate becomes bypassable by filename.
# Structural checks (disclaimer, storage APIs, placeholders) still run on these files.
DEFINITIONAL = {"COMPLIANCE-PERIMETER.md"}


def check(path):
    """Return a list of failure strings for one file."""
    rel = os.path.relpath(path, REPO)
    fails = []
    raw = open(path, encoding="utf-8").read()
    is_html = path.endswith(".html")
    text = visible_text(raw, is_html)

    if os.path.basename(path) in DEFINITIONAL:
        print(f"       (banned-term sweep skipped: {os.path.basename(path)} defines the list)")
        return fails

    for term in BANNED:
        for m in re.finditer(r"\b" + re.escape(term) + r"\b", text, re.I):
            lo = max(0, m.start() - 45)
            fails.append(f"{rel}: BANNED '{m.group(0)}' — …{text[lo:m.end() + 45].strip()}…")

    if is_html:
        if DISCLAIMER not in text:
            fails.append(f"{rel}: DISCLAIMER missing or not verbatim")
        # Structural checks that matter for a single-file self-contained page.
        for api in ("localStorage", "sessionStorage", "indexedDB"):
            if re.search(r"\b" + api + r"\b", raw):
                fails.append(f"{rel}: STORAGE API '{api}' used — banned on every surface")
        for bad in re.finditer(r'href\s*=\s*"#"', raw):
            fails.append(f"{rel}: PLACEHOLDER href=\"#\" at offset {bad.start()}")
        for word in ("lorem ipsum", "TODO", "TKTK", "FIXME"):
            if re.search(r"\b" + re.escape(word) + r"\b", text, re.I):
                fails.append(f"{rel}: PLACEHOLDER text '{word}'")
        for tag in ("html", "head", "body", "main", "section", "footer", "nav"):
            o = len(re.findall(r"<" + tag + r"[\s>]", raw, re.I))
            c = len(re.findall(r"</" + tag + r"\s*>", raw, re.I))
            if o != c:
                fails.append(f"{rel}: UNBALANCED <{tag}> — {o} open, {c} close")
    return fails


def main():
    args = sys.argv[1:]
    if args:
        paths = [p for p in args if os.path.isfile(p)]
    else:
        paths = []
        for pat in DEFAULT_TARGETS:
            paths.extend(sorted(glob.glob(os.path.join(REPO, pat))))

    if not paths:
        print("check-compliance: no files matched", file=sys.stderr)
        return 1

    all_fails = []
    for p in paths:
        f = check(p)
        all_fails.extend(f)
        print(f"  {'FAIL' if f else 'ok  '}  {os.path.relpath(p, REPO)}")

    print()
    if all_fails:
        for f in all_fails:
            print(f"  ✕ {f}")
        print(f"\ncheck-compliance: {len(all_fails)} violation(s) across {len(paths)} file(s)")
        return 1
    print(f"check-compliance: {len(paths)} file(s) clean — 0 banned terms, disclaimer verbatim")
    return 0


if __name__ == "__main__":
    sys.exit(main())
