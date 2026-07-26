#!/usr/bin/env python3
"""
bundle-funnel.py — (optional) bundle a DGTL teaser + full pitch into one upload for sub-path hosts.

NOTE: The default DGTL flow deploys the teaser and full pitch as TWO slugs on
one pitch.dgtlmedia.io slug (via deploy.dgtlmedia.io), cross-linked relatively. Use this
bundler only if your host serves both pages from a single upload.

The teaser becomes index.html at the zip root; the full dgtl-pitch-pages page is
placed at full/index.html so the teaser's relative "/full/" button just works.
An `_headers` file is added (X-Content-Type-Options: nosniff).

Usage:
    python3 bundle-funnel.py --teaser teaser.html --full full-page.html --out my-pitch-teaser-netlify.zip
    python3 bundle-funnel.py --teaser teaser.html --full dgtl-<slug>-netlify.zip --out my-pitch-teaser-netlify.zip

--full accepts either a standalone HTML file OR an existing v1 Netlify zip
(the one dgtl-pitch-pages produces); if a zip is given, its index.html is used.

The result: one bundle for a host that serves sub-paths. DGTL's default is instead two
one pitch.dgtlmedia.io slug as teaser.html + index.html, cross-linked relatively.
"""
import argparse
import os
import shutil
import sys
import tempfile
import zipfile

HEADERS = "/*\n  X-Content-Type-Options: nosniff\n"


def read_full_page(full_path: str) -> str:
    """Return the full page's HTML, whether given a .html file or a v1 netlify .zip."""
    if full_path.lower().endswith(".zip"):
        with zipfile.ZipFile(full_path) as z:
            # prefer a root index.html; else the first .html found
            names = z.namelist()
            target = next((n for n in names if n.lower().rstrip("/") == "index.html"), None)
            if target is None:
                target = next((n for n in names if n.lower().endswith(".html")), None)
            if target is None:
                sys.exit(f"error: no HTML file found inside {full_path}")
            return z.read(target).decode("utf-8", "replace")
    with open(full_path, "r", encoding="utf-8") as f:
        return f.read()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--teaser", required=True, help="path to the teaser index.html")
    ap.add_argument("--full", required=True, help="full v1 page: an .html file or a v1 netlify .zip")
    ap.add_argument("--out", required=True, help="output zip path, e.g. <slug>-teaser-netlify.zip")
    args = ap.parse_args()

    for p in (args.teaser, args.full):
        if not os.path.exists(p):
            sys.exit(f"error: not found: {p}")

    with open(args.teaser, "r", encoding="utf-8") as f:
        teaser_html = f.read()
    full_html = read_full_page(args.full)

    if 'href="/full/"' not in teaser_html and "href='/full/'" not in teaser_html:
        print('warning: teaser has no href="/full/" link — the funnel button may not point at the bundled full page.', file=sys.stderr)

    staging = tempfile.mkdtemp(prefix="dgtl-funnel-")
    try:
        with open(os.path.join(staging, "index.html"), "w", encoding="utf-8") as f:
            f.write(teaser_html)
        os.makedirs(os.path.join(staging, "full"), exist_ok=True)
        with open(os.path.join(staging, "full", "index.html"), "w", encoding="utf-8") as f:
            f.write(full_html)
        with open(os.path.join(staging, "_headers"), "w", encoding="utf-8") as f:
            f.write(HEADERS)

        out = os.path.abspath(args.out)
        if os.path.exists(out):
            os.remove(out)
        # zip with paths relative to staging root so index.html sits at the root
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
            for root, _dirs, files in os.walk(staging):
                for name in files:
                    fp = os.path.join(root, name)
                    z.write(fp, os.path.relpath(fp, staging))
        print(f"bundled funnel -> {out}")
        print("  /index.html      (teaser)")
        print("  /full/index.html (full pitch)")
        print("  /_headers")
        print("Deploy: upload to a sub-path host (DGTL default: one slug, teaser.html + index.html)")
    finally:
        shutil.rmtree(staging, ignore_errors=True)


if __name__ == "__main__":
    main()
