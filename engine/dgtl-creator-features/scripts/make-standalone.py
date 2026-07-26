#!/usr/bin/env python3
"""
make-standalone.py — bake a Journal/pitch page into a single self-contained .html.

This is the DGTL **deploy artifact**: the VPS portal at deploy.dgtlmedia.io hosts one
self-contained HTML per slug at pitch.dgtlmedia.io/<slug>, so the file must carry its own
styles, scripts and images (no sibling folders), and its cross-page links must be ABSOLUTE
pitch.dgtlmedia.io URLs so the pages index and connect to each other.

What it does:
- Inlines <link rel="stylesheet">, <script src>, favicons and every local <img>/asset as
  <style>/<script>/data-URIs.  (Google Fonts stays a link — loads online, falls back to
  system sans offline.)
- With --page-url, rewrites every local *.html cross-link to an absolute URL, resolved against
  the page's live URL — turning relative nav/related/"See the Full Pitch" links into the real
  pitch.dgtlmedia.io links that make the build graph connect.

Usage:
  # preview-ready (assets inlined, links left relative)
  python3 make-standalone.py --file creators/shane-boyer.html --out creators/shane-boyer.standalone.html

  # deploy-ready (also absolutizes cross-links to the live slug graph).
  # --page-url is this page's FILE-style live URL — it must mirror the page's path under the
  # site root (end in the real filename, not a trailing slash), so relative links like
  # "../index.html" and "peter-mckinnon.html" resolve to the correct absolute targets.
  python3 make-standalone.py --file creators/shane-boyer.html \
      --out creators/shane-boyer.standalone.html \
      --page-url https://pitch.dgtlmedia.io/journal/creators/shane-boyer.html
"""
import argparse, base64, re
from pathlib import Path
from urllib.parse import urljoin

MIME = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml"}


def data_uri(path: Path) -> str:
    b = path.read_bytes()
    return f"data:{MIME.get(path.suffix.lower(),'application/octet-stream')};base64," + base64.b64encode(b).decode()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--page-url", default=None,
                    help="This page's FILE-style live URL, mirroring its path under the site root "
                         "(e.g. https://pitch.dgtlmedia.io/journal/creators/<slug>.html). If set, local "
                         ".html cross-links are resolved against it into absolute URLs for connectivity.")
    args = ap.parse_args()
    src = Path(args.file); base = src.parent
    html = src.read_text(encoding="utf-8")

    def local(ref): return not ref.startswith(("http://", "https://", "data:", "#", "mailto:"))

    # 1. inline stylesheets
    def css_sub(m):
        ref = m.group(1)
        if not local(ref): return m.group(0)
        p = (base / ref.split("?")[0]).resolve()
        return f"<style>\n{p.read_text(encoding='utf-8')}\n</style>" if p.exists() else m.group(0)
    html = re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)"\s*/?>', css_sub, html)

    # 2. inline scripts
    def js_sub(m):
        ref = m.group(1)
        if not local(ref): return m.group(0)
        p = (base / ref.split("?")[0]).resolve()
        return f"<script>\n{p.read_text(encoding='utf-8')}\n</script>" if p.exists() else m.group(0)
    html = re.sub(r'<script\s+src="([^"]+)"[^>]*>\s*</script>', js_sub, html)

    # 3. favicon → data URI
    def icon_sub(m):
        ref = m.group(2)
        if not local(ref): return m.group(0)
        p = (base / ref.split("?")[0]).resolve()
        return m.group(0).replace(f'href="{ref}"', f'href="{data_uri(p)}"') if p.exists() else m.group(0)
    html = re.sub(r'(<link\s+rel="icon"[^>]*href=")([^"]+)("[^>]*>)', icon_sub, html)

    # 4. inline every local src="..." image
    def src_sub(m):
        pre, ref, post = m.group(1), m.group(2), m.group(3)
        if not local(ref): return m.group(0)
        p = (base / ref.split("?")[0]).resolve()
        if p.exists() and p.suffix.lower() in MIME:
            return f'{pre}{data_uri(p)}{post}'
        return m.group(0)
    html = re.sub(r'(\ssrc=")([^"]+)(")', src_sub, html)

    # 5. absolutize cross-page links for connectivity/indexing
    rewrites = 0
    if args.page_url:
        def href_sub(m):
            nonlocal rewrites
            ref = m.group(1)
            if not local(ref) or ".html" not in ref: return m.group(0)
            rewrites += 1
            return f'href="{urljoin(args.page_url, ref)}"'
        html = re.sub(r'href="([^"]+)"', href_sub, html)

    out = Path(args.out)
    out.write_text(html, encoding="utf-8")
    remaining = len(re.findall(r'(?:src|href)="(?:\.\.?/|assets/)[^"]+"', html))
    kb = len(html.encode()) // 1024
    note = f" · absolutised {rewrites} cross-links" if args.page_url else ""
    print(f"✓ {out}  ({kb} KB){note}  · remaining local refs: {remaining}")
    if remaining and args.page_url:
        print("  (remaining local refs are non-.html assets that weren't found — check them)")


if __name__ == "__main__":
    main()
