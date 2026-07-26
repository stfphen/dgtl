#!/usr/bin/env python3
"""Resolve every relative href/src in the journal HTML and confirm the target exists.
Run from the repo root:  python3 tools/check-links.py
Exit code 1 if any local reference is broken."""
import os, re, glob, sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "journal")
ROOT = os.path.normpath(ROOT)
EXT = (".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".mp4", ".webp", ".html", ".json", ".webm")

def main():
    files = (glob.glob(os.path.join(ROOT, "packs/**/*.html"), recursive=True)
             + glob.glob(os.path.join(ROOT, "*.html"))
             + glob.glob(os.path.join(ROOT, "_templates/*.html"))
             + glob.glob(os.path.join(ROOT, "_templates/examples/*.html"))
             + glob.glob(os.path.join(ROOT, "cases/*.html")))
    checked = 0; misses = []
    for f in files:
        d = os.path.dirname(f)
        html = open(f, encoding="utf-8").read()
        for attr, m in re.findall(r'(src|href)="([^"]+)"', html):
            if re.match(r'^(https?:|#|mailto:|data:|tel:|//)', m) or m in ('', '…'):
                continue
            u = m.split('#')[0].split('?')[0]
            if not u or not u.lower().endswith(EXT):
                continue
            tgt = os.path.normpath(os.path.join(d, u)); checked += 1
            if not os.path.exists(tgt):
                misses.append((os.path.relpath(f, ROOT), m))
    print(f"checked={checked} missing={len(misses)}")
    for f, m in misses:
        print("MISSING:", f, "->", m)
    sys.exit(1 if misses else 0)

if __name__ == "__main__":
    main()
