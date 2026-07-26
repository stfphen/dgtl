#!/usr/bin/env python3
"""Resolve every relative href/src in the publishing HTML and confirm the target exists.

Covers journal/ (packs, cases, templates) and pitches/ (pitch folders + offer templates).
Run from the repo root:  python3 tools/check-links.py

Exit code 1 if any local reference is broken.

Also reports root-absolute local links (href="/full/") separately. Those are not "missing"
in the filesystem sense, but they only resolve if the page is served from the domain root —
which is how the DMTV x Bose teaser's "See the Full Pitch" button silently broke.
"""
import os, re, glob, sys, json

REPO = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
EXT = (".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".mp4", ".webp", ".html", ".json", ".webm")

# Each entry: (label, list of glob patterns relative to the repo root)
SCOPES = [
    ("journal", [
        "journal/packs/**/*.html",
        "journal/*.html",
        "journal/cases/*.html",
        "journal/_templates/*.html",
        "journal/_templates/examples/*.html",
    ]),
    ("pitches", [
        "pitches/*/*.html",
        "pitches/_templates/*.html",
    ]),
]


def pending_assets():
    """Assets a pitch declares as not-yet-supplied, via pendingAssets in its pitch.json.

    Declared gaps are reported as pending, not missing, so a known content gap doesn't leave the
    check permanently red — which is how a red check stops being read at all.
    """
    out = set()
    for mf in glob.glob(os.path.join(REPO, "pitches/*/pitch.json")):
        try:
            data = json.load(open(mf, encoding="utf-8"))
        except (ValueError, OSError):
            continue
        folder = os.path.dirname(mf)
        for a in data.get("pendingAssets") or []:
            out.add(os.path.normpath(os.path.join(folder, a)))
    return out


def main():
    checked = 0
    misses = []
    absolutes = []
    pending_hits = []
    declared = pending_assets()

    for label, patterns in SCOPES:
        files = []
        for pat in patterns:
            files += glob.glob(os.path.join(REPO, pat), recursive=True)
        for f in sorted(set(files)):
            d = os.path.dirname(f)
            rel = os.path.relpath(f, REPO)
            html = open(f, encoding="utf-8", errors="replace").read()
            for _attr, m in re.findall(r'(src|href)="([^"]+)"', html):
                if re.match(r'^(https?:|#|mailto:|tel:|data:|javascript:|//)', m) or m in ('', '…'):
                    continue
                # root-absolute local path: cannot resolve from a subfolder deploy
                if m.startswith('/'):
                    absolutes.append((rel, m))
                    continue
                u = m.split('#')[0].split('?')[0]
                if not u or not u.lower().endswith(EXT):
                    continue
                checked += 1
                tgt = os.path.normpath(os.path.join(d, u))
                if not os.path.exists(tgt):
                    if tgt in declared:
                        pending_hits.append((rel, m))
                    else:
                        misses.append((rel, m))

    print(f"checked={checked} missing={len(misses)} "
          f"pending={len(pending_hits)} root_absolute={len(absolutes)}")
    for f, m in misses:
        print("MISSING:", f, "->", m)
    for f, m in pending_hits:
        print("PENDING (declared in pitch.json):", f, "->", m)
    for f, m in absolutes:
        print("ROOT-ABSOLUTE (only resolves at domain root):", f, "->", m)

    sys.exit(1 if misses else 0)


if __name__ == "__main__":
    main()
