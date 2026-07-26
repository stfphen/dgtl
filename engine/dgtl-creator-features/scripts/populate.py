#!/usr/bin/env python3
"""
Populate the DGTL creator-feature template from a fields.json.

- Replaces every {{TOKEN}} with tokens[TOKEN].
- Injects real images into the hero + 6 portfolio slots (media.hero, media.pf1..pf6),
  replacing the on-brand gradient placeholders. Omitted slots keep their gradient.
- Cleans up unused sameAs schema entries.
- Reports any leftover {{TOKENS}} so nothing ships half-filled.

Usage:
  python3 populate.py --template assets/creator-feature-template.html \
                      --fields <slug>.fields.json \
                      --out /path/to/influence-journal/creators/<slug>.html
"""
import argparse, json, re, sys, html
from pathlib import Path


def inject_hero(text, media):
    slot = media.get("hero")
    if not slot:
        return text
    src = html.escape(slot["src"], quote=True)
    alt = html.escape(slot.get("alt", ""), quote=True)
    # add the <img> and drop the "ph" gradient class on the hero figure
    text = text.replace(
        '<figure class="hero-media reveal ph">',
        f'<figure class="hero-media reveal">\n        <img class="fill" src="{src}" alt="{alt}" loading="eager">',
        1,
    )
    # remove the ghost-metric span (it only reads well over a gradient, not a photo)
    text = re.sub(r'\s*<span class="ghost-metric"[^>]*>.*?</span>', '', text, count=1, flags=re.S)
    return text


def inject_portfolio(text, media):
    # the 6 gallery tiles, in document order, are the <div class="pf ...">
    opens = list(re.finditer(r'<div class="pf [^"]*">', text))
    if not opens:
        return text
    # inject from last to first so earlier match offsets stay valid
    for i in range(min(len(opens), 6), 0, -1):
        slot = media.get(f"pf{i}")
        if not slot:
            continue
        m = opens[i - 1]
        src = html.escape(slot["src"], quote=True)
        alt = html.escape(slot.get("alt", ""), quote=True)
        img = f'<img src="{src}" alt="{alt}" loading="lazy">'
        insert_at = m.end()
        text = text[:insert_at] + img + text[insert_at:]
    return text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--template", required=True)
    ap.add_argument("--fields", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    text = Path(args.template).read_text(encoding="utf-8")
    data = json.loads(Path(args.fields).read_text(encoding="utf-8"))
    tokens = data.get("tokens", {})
    media = data.get("media", {})

    # 1. images first (structural anchors are stable in the raw template)
    text = inject_hero(text, media)
    text = inject_portfolio(text, media)

    # 2. strip the TEMPLATE banner + the leading HOW-TO comment block if present
    text = re.sub(r'<!--\s*Delete this banner.*?-->\s*', '', text, flags=re.S)
    text = re.sub(r'<div style="background:var\(--gold-tint\).*?</div>\s*', '', text, count=1, flags=re.S)

    # 3. token replacement (replaces all occurrences of each token)
    for key, val in tokens.items():
        text = text.replace("{{" + key + "}}", str(val))

    # 4. tidy unused sameAs entries so the JSON-LD stays valid
    text = re.sub(r',\s*"\{\{SAMEAS_[23]\}\}"', "", text)

    # 5. report leftovers
    leftover = sorted(set(re.findall(r"\{\{[A-Z0-9_]+\}\}", text)))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")

    print(f"✓ wrote {out}")
    if media:
        print(f"  injected media: {', '.join(sorted(media.keys()))}")
    if leftover:
        print(f"  ⚠ {len(leftover)} unfilled token(s): {', '.join(leftover)}", file=sys.stderr)
        print("    Fill these in fields.json (or remove the element from the template copy) and re-run.", file=sys.stderr)
        sys.exit(2)
    print("  all tokens filled.")


if __name__ == "__main__":
    main()
