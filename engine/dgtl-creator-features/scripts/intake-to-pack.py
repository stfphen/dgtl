#!/usr/bin/env python3
"""Turn a creator-intake admin export into a journal pack skeleton.

  python3 engine/dgtl-creator-features/scripts/intake-to-pack.py \
      --export dgtl-intake-<id>.json [--slug jane-doe] [--skip-download]

What it does, in order:
  1. creates journal/packs/<slug>/ (hard error on collision unless --rerun)
  2. downloads image media via the export's presigned GETs into media/
     (items with is_owner=false are SKIPPED with a warning — no rights, no page)
  3. writes <slug>.fields.json mapping the application onto the template tokens.
     Mechanical tokens are filled for real; EDITORIAL tokens are drafted with a
     "TODO:" prefix — the script EXITS NONZERO while any TODO remains, so
     auto-copy can never ship. Edit the fields.json in brand voice, re-run with
     --rerun.
  4. runs populate.py -> index.html, then rewrites the template's ../assets/
     paths to the real ../../_shared/ pack layout
  5. writes pack.json (status: draft), sources.md (the rights receipt), and
     backlink-kit.md (their reciprocal-link instructions)
  6. registers the slug in packs.index.json and regenerates the roster
     (drafts are excluded from the roster until you flip status to published)

The intake feeds the editorial pipeline; it does not bypass the writing.
"""
import argparse
import json
import re
import subprocess
import sys
import urllib.request
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
PACKS = REPO / "journal" / "packs"
TEMPLATE = Path(__file__).resolve().parents[1] / "assets" / "creator-feature-template.html"
BASE_URL = "https://dgtlinfluence.com"

CATEGORY_LABELS = {
    "music": "Music", "fashion": "Fashion", "sport": "Sport", "food": "Food",
    "tech": "Tech", "lifestyle": "Lifestyle", "comedy": "Comedy", "other": "Creator",
}
PLATFORM_LABELS = {
    "instagram": "Instagram", "tiktok": "TikTok", "youtube": "YouTube", "x": "X",
    "spotify": "Spotify", "apple_music": "Apple Music", "soundcloud": "SoundCloud",
    "twitch": "Twitch", "linkedin": "LinkedIn", "snapchat": "Snapchat",
    "facebook": "Facebook", "threads": "Threads", "personal_site": "Website",
}


def human_count(n):
    if not n:
        return None
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}".rstrip("0").rstrip(".") + "M"
    if n >= 1_000:
        return f"{n / 1_000:.0f}K"
    return str(n)


def slugify(s):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--export", required=True)
    ap.add_argument("--slug")
    ap.add_argument("--rerun", action="store_true",
                    help="pack dir already exists (editing pass) — reuse it")
    ap.add_argument("--skip-download", action="store_true")
    args = ap.parse_args()

    export = json.loads(Path(args.export).read_text(encoding="utf-8"))
    app = export["application"]
    f = app["fields"]
    media_items = export.get("media", [])
    if app.get("status") != "approved":
        sys.exit("refusing: export is not an approved application")

    slug = slugify(args.slug or export.get("slug_suggestion") or f["public_name"])
    pack_dir = PACKS / slug
    if pack_dir.exists() and not args.rerun:
        sys.exit(f"refusing: journal/packs/{slug}/ already exists (use --rerun for an editing pass)")
    (pack_dir / "media").mkdir(parents=True, exist_ok=True)

    name = f.get("public_name") or "Unknown"
    today = date.today().isoformat()
    canonical = f"{BASE_URL}/packs/{slug}/"
    cat = f.get("primary_category", "other")
    cat_label = CATEGORY_LABELS.get(cat, "Creator")
    city = f.get("city", "")

    # ── media: images only, owner-confirmed only ─────────────────────────────
    images, skipped = [], []
    for m in media_items:
        if m.get("kind") != "upload" or not (m.get("mime") or "").startswith("image/"):
            continue
        if m.get("is_owner") is False:
            skipped.append(m)
            continue
        images.append(m)
    if skipped:
        print(f"⚠ skipped {len(skipped)} item(s) with is_owner=false — no rights, no page:",
              file=sys.stderr)
        for m in skipped:
            print(f"    - {m.get('title')}", file=sys.stderr)

    media_map = {}
    if args.skip_download:
        # Reuse media already on disk from the first pass.
        for existing in sorted((pack_dir / "media").glob("*")):
            stem = existing.stem
            if stem == "hero" or re.fullmatch(r"pf[1-6]", stem):
                media_map[stem] = {"src": f"media/{existing.name}", "alt": name}
    else:
        for i, m in enumerate(images[:7]):
            ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
                   "image/gif": "gif", "image/heic": "heic"}.get(m["mime"], "jpg")
            fname = ("hero" if i == 0 else f"pf{i}") + f".{ext}"
            dest = pack_dir / "media" / fname
            print(f"↓ {m.get('title') or m['r2_key']} -> media/{fname}")
            urllib.request.urlretrieve(m["url"], dest)
            key = "hero" if i == 0 else f"pf{i}"
            media_map[key] = {"src": f"media/{fname}",
                              "alt": m.get("title") or f"{name} — {cat_label}"}

    # ── stats from socials + analytics ───────────────────────────────────────
    socials = sorted(f.get("socials", []), key=lambda s: -(s.get("follower_count") or 0))
    stats = []
    for s in socials:
        hc = human_count(s.get("follower_count"))
        if hc:
            stats.append((hc, f"{PLATFORM_LABELS.get(s['platform'], s['platform'])} followers"))
    if f.get("avg_views_30d"):
        stats.append((human_count(f["avg_views_30d"]), "Avg monthly views"))
    if f.get("avg_engagement_rate"):
        stats.append((f"{f['avg_engagement_rate']}%", "Engagement rate"))
    while len(stats) < 4:
        stats.append(("—", "TODO: stat"))
    primary = next((s for s in f.get("socials", []) if s.get("is_primary")), socials[0] if socials else None)

    same_as = [s["profile_url"] for s in socials if s.get("profile_url")][:3]
    link_labels = [PLATFORM_LABELS.get(s["platform"], s["platform"])
                   for s in socials if s.get("profile_url")][:3]
    site = f.get("website_url") or ""
    anchor = f.get("preferred_anchor_text") or (f"{name} — official site" if site else "")

    todo = lambda text: f"TODO: {text}"

    tokens = {
        "TITLE": f"{name}: {f.get('bio_short', '')}"[:70].rstrip(" .,") or name,
        "META_DESCRIPTION": f.get("bio_short", ""),
        "KEYWORDS": ", ".join(x for x in [name, f.get("public_name"), cat_label, city,
                                          "DGTL Influence", "creator profile"] if x),
        "CANONICAL_URL": canonical,
        "OG_IMAGE": canonical + media_map["hero"]["src"] if "hero" in media_map else "",
        "PUBLISH_ISO": today, "MODIFIED_ISO": today, "SECTION": "Creators",
        "CATEGORY_LABEL": cat_label, "READ_TIME": "5 min",
        "PUBLISH_HUMAN": date.today().strftime("%B %-d, %Y"),
        "PUBLISH_DATE": today,
        "HEADLINE_A": name,
        "HEADLINE_GOLD": todo(f"gold headline phrase for {name}"),
        "DEK": todo(f"dek — draft: {f.get('bio_short', '')}"),
        "HERO_BADGE": f"{cat_label} · {city}" if city else cat_label,
        "HERO_CAPTION": (images[0].get("credit") or images[0].get("title") or name) if images else name,
        "GHOST_METRIC": stats[0][0] if stats[0][0] != "—" else "",
        "STAT_FOOTNOTE": f"Figures self-reported at application, {today}.",
        "LEAD": todo(f"lead paragraph — long bio: {f.get('bio_long') or f.get('bio_short', '')}"),
        "BODY_1": todo("body 1 — origin story"),
        "H2_1": todo("first section heading"),
        "BODY_2": todo("body 2 — highlights: " + "; ".join(f.get("career_highlights", [])[:5])),
        "PULLQUOTE": todo("pullquote"), "PULLQUOTE_CITE": name,
        "H2_2": todo("second section heading"),
        "BODY_3": todo("body 3 — press: " + "; ".join(
            f"{p.get('outlet')} ({p.get('url')})" for p in f.get("notable_press", [])[:5])),
        "CALLOUT_TITLE": todo("callout title"),
        "CALLOUT_1": todo("callout 1"), "CALLOUT_2": todo("callout 2"),
        "CALLOUT_3": todo("callout 3"), "CALLOUT_4": todo("callout 4"),
        "BODY_4": todo("body 4 — where they're going"),
        "STATCALLOUT_NUM": stats[0][0], "STATCALLOUT_CAP": todo("stat callout caption"),
        "GALLERY_INTRO": todo("one-line gallery intro"),
        "FAQ_Q1": f"Who is {name}?", "FAQ_A1": todo("answer from bio"),
        "FAQ_Q2": f"What is {name} known for?", "FAQ_A2": todo("answer from highlights"),
        "FAQ_Q3": f"How can brands work with {name}?",
        "FAQ_A3": todo("answer — via DGTL Influence, campaign briefs"),
        "FAQ_Q4": f"Where can I follow {name}?",
        "FAQ_A4": todo("answer listing platforms"),
        "TAG_1": cat_label, "TAG_2": city or "Creator",
        "TAG_3": "DGTL Influence", "TAG_4": "Creator Profile",
        "PERSON_JOBTITLE": cat_label,
        "PERSON_DESC": f.get("bio_short", ""),
        "PERSON_URL": site or (primary or {}).get("profile_url", ""),
    }
    for i, (num, label) in enumerate(stats[:4], 1):
        tokens[f"STAT{i}_NUM"] = num
        tokens[f"STAT{i}_LABEL"] = label
    for i in range(1, 7):
        img = media_map.get(f"pf{i}")
        src_item = images[i] if i < len(images) else None
        tokens[f"PF{i}_CHIP"] = cat_label
        tokens[f"PF{i}_KICK"] = (src_item.get("date_created") or "Portfolio") if src_item else "Portfolio"
        tokens[f"PF{i}_TITLE"] = (src_item.get("title") or todo("tile title")) if src_item else todo("tile title")
        tokens[f"PF{i}_NOTE"] = (src_item.get("credit") or todo("tile note")) if src_item else todo("tile note")
    # Only supply link tokens that exist — unfilled ones are dropped by populate.py
    for i, (url, label) in enumerate(zip(same_as, link_labels), 1):
        tokens[f"SAMEAS_{i}"] = url
        tokens[f"LINK_{i}_LABEL"] = label
    if site:
        tokens["CREATOR_SITE_URL"] = site
        tokens["PREFERRED_ANCHOR_TEXT"] = anchor

    fields_path = pack_dir / f"{slug}.fields.json"
    if args.rerun and fields_path.exists():
        # Editing pass: the fields.json is the editor's working copy — never clobber it.
        print(f"✓ keeping existing {fields_path.relative_to(REPO)} (editing pass)")
    else:
        fields_path.write_text(json.dumps({"tokens": tokens, "media": media_map},
                                          indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"✓ wrote {fields_path.relative_to(REPO)}")

    # ── populate + path post-pass ────────────────────────────────────────────
    out_html = pack_dir / "index.html"
    r = subprocess.run([sys.executable, str(Path(__file__).parent / "populate.py"),
                        "--template", str(TEMPLATE), "--fields", str(fields_path),
                        "--out", str(out_html)])
    if r.returncode != 0:
        sys.exit("populate.py failed — fix the fields.json and re-run with --rerun")

    html_text = out_html.read_text(encoding="utf-8")
    html_text = (html_text
                 .replace('"../assets/logos/', '"../../_shared/logos/')
                 .replace('"../assets/dgtl-editorial.css"', '"../../_shared/dgtl-editorial.css"')
                 .replace('"../assets/journal.js"', '"../../_shared/journal.js"')
                 .replace('"../cases/', '"../../cases/')
                 .replace('"../index.html', '"../../index.html')
                 .replace('href="peter-mckinnon.html"', 'href="../../_templates/examples/peter-mckinnon.html"'))
    out_html.write_text(html_text, encoding="utf-8")
    print("✓ rewrote template asset paths for the pack layout")

    # ── pack.json, sources.md (rights receipt), backlink-kit.md ─────────────
    pack_json = {
        "slug": slug, "name": name, "type": "creator", "status": "draft",
        "hub": "index.html", "features": [], "cases": [],
        "sources": "sources.md", "backlinkKit": "backlink-kit.md",
        "hasMedia": bool(media_map), "updated": today, "canonicalUrl": canonical,
        "category": cat, "kicker": f"{cat_label} · {city}" if city else cat_label,
        "shortBio": f.get("bio_short", ""),
        **({"avatarImage": media_map["hero"]["src"]} if "hero" in media_map else {"ghost": name[:1]}),
        "handle": (primary or {}).get("handle", ""),
        "primaryPlatform": (primary or {}).get("platform", ""),
        "readTime": "5 min",
    }
    (pack_dir / "pack.json").write_text(
        json.dumps(pack_json, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    consents = app.get("consents", {})
    sig = app.get("signature", {})
    lines = [
        f"# Sources & rights — {name}", "",
        "This pack was generated from a creator-intake application. This file is the rights receipt.", "",
        f"- Application: `{app['public_id']}` (submitted {app.get('submitted_at')})",
        f"- Terms version: `{app.get('terms_version')}`",
        f"- Signature: {sig.get('name')} at {sig.get('at')} from IP {sig.get('ip')}",
        f"- Licence: {f.get('licence_scope')} Territory: {f.get('licence_territory')} Term: {f.get('licence_term')}",
        f"- Derivative edits OK: {f.get('derivative_ok')}",
        f"- Broadcast opt-in: {consents.get('broadcast')}",
        f"- AI-training opt-out: {consents.get('ai_training_optout')}",
        f"- Credit line: {f.get('credit_line')}", "",
        "## Media provenance (r2_key · owner · credit)", "",
    ]
    for m in media_items:
        lines.append(f"- `{m.get('r2_key') or m.get('url')}` · is_owner={m.get('is_owner')} · "
                     f"{m.get('credit') or '—'} · {m.get('title') or ''}")
    if skipped:
        lines += ["", "### Excluded (is_owner=false — do not publish)", ""]
        lines += [f"- {m.get('title')} (`{m.get('r2_key')}`)" for m in skipped]
    media_links = f.get("media_links", [])
    if media_links:
        lines += ["", "## Linked media (not downloaded)", ""]
        lines += [f"- {m.get('label') or 'link'}: {m['url']}" for m in media_links]
    (pack_dir / "sources.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    (pack_dir / "backlink-kit.md").write_text("\n".join([
        f"# Backlink kit — {name}", "",
        f"Profile URL: {canonical}", "",
        "## What we link to you",
        f"- Your profile carries a **followed** link to {site or 'your site (none supplied)'}"
        + (f" with the anchor text “{anchor}”." if site else "."), "",
        "## What we ask you to link back" +
        (" (agreed at application)" if f.get("reciprocal_link_agreed") else " (not yet agreed)"),
        f"- From your site footer or press page: `<a href=\"{canonical}\">{name} — DGTL Influence Journal</a>`",
        f"- From your link-in-bio: {canonical}", "",
        "## Suggested snippet",
        f"> Featured on the DGTL Influence Journal: {canonical}", "",
    ]) + "\n", encoding="utf-8")
    print("✓ wrote pack.json, sources.md, backlink-kit.md")

    # ── register + roster ────────────────────────────────────────────────────
    index_path = PACKS / "packs.index.json"
    index = json.loads(index_path.read_text(encoding="utf-8"))
    if slug not in index["packs"]:
        index["packs"].append(slug)
        index["updated"] = today
        index_path.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"✓ registered {slug} in packs.index.json")
    subprocess.run([sys.executable, str(REPO / "tools" / "build-roster.py")], check=True)

    # ── the editorial gate ───────────────────────────────────────────────────
    todos = len(re.findall(r"TODO:", out_html.read_text(encoding="utf-8")))
    print()
    if todos:
        print(f"✗ {todos} TODO draft(s) remain in the page. This pack must NOT publish as-is.")
        print(f"  1. Rewrite the TODO tokens in {fields_path.relative_to(REPO)} in brand voice")
        print(f"     (or run the dgtl-creator-features skill against this pack)")
        print(f"  2. Re-run: python3 {Path(__file__).relative_to(REPO)} "
              f"--export {args.export} --slug {slug} --rerun --skip-download")
        sys.exit(2)
    print("✓ no TODOs — editorial pass complete. Next:")
    print(f"  1. review journal/packs/{slug}/index.html in a browser")
    print(f"  2. flip pack.json status to \"published\", re-run tools/build-roster.py")
    print(f"  3. python3 tools/check-links.py  (must be missing=0)")


if __name__ == "__main__":
    main()
