#!/usr/bin/env python3
"""Export the skills maintained in engine/ to an installed skills directory, and detect drift.

engine/ is the source of truth (see engine/README.md). The copies inside a Cowork/Claude session
are a read-only cache — editing them there changes nothing. This script pushes repo -> installed,
and tells you when the two have diverged.

Run from anywhere:

    python3 tools/export-skills.py --list
    python3 tools/export-skills.py --check --to ~/path/to/skills
    python3 tools/export-skills.py dgtl-pitch-pages --to ~/path/to/skills
    python3 tools/export-skills.py --all --to ~/path/to/skills

--check exits 1 if any skill differs, so it can gate a commit.
Without --to, the script looks at $DGTL_SKILLS_DIR.
"""
import argparse
import filecmp
import hashlib
import os
import shutil
import sys

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
ENGINE = os.path.join(REPO, "engine")

# Directories under engine/ that are skills. engine/README.md is not one.
def skills():
    return sorted(
        d for d in os.listdir(ENGINE)
        if os.path.isdir(os.path.join(ENGINE, d))
        and os.path.exists(os.path.join(ENGINE, d, "SKILL.md"))
    )


def tree_digest(root):
    """Stable hash of a directory's contents (relative paths + file bytes)."""
    h = hashlib.sha256()
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d != "__pycache__")
        for name in sorted(filenames):
            if name == ".DS_Store":
                continue
            full = os.path.join(dirpath, name)
            h.update(os.path.relpath(full, root).encode())
            with open(full, "rb") as fh:
                for chunk in iter(lambda: fh.read(65536), b""):
                    h.update(chunk)
    return h.hexdigest()[:12]


def diff_report(a, b):
    """Files that differ between two trees, as (only_in_a, only_in_b, changed)."""
    def rel_files(root):
        out = set()
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d != "__pycache__"]
            for name in filenames:
                if name == ".DS_Store":
                    continue
                out.add(os.path.relpath(os.path.join(dirpath, name), root))
        return out

    fa, fb = rel_files(a), rel_files(b)
    changed = sorted(
        f for f in (fa & fb)
        if not filecmp.cmp(os.path.join(a, f), os.path.join(b, f), shallow=False)
    )
    return sorted(fa - fb), sorted(fb - fa), changed


def resolve_target(args):
    target = args.to or os.environ.get("DGTL_SKILLS_DIR")
    if not target:
        sys.exit(
            "No target skills directory. Pass --to <dir> or set DGTL_SKILLS_DIR.\n"
            "In a Cowork session the installed copies are a read-only cache — export to the\n"
            "plugin/marketplace repo you publish from instead."
        )
    return os.path.expanduser(target)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("skill", nargs="?", help="skill name to export (omit with --all/--list)")
    ap.add_argument("--all", action="store_true", help="export every skill in engine/")
    ap.add_argument("--list", action="store_true", help="list skills and their digests")
    ap.add_argument("--check", action="store_true",
                    help="report drift between engine/ and the target; exit 1 if any")
    ap.add_argument("--to", help="installed skills directory")
    args = ap.parse_args()

    names = skills()

    if args.list:
        target = args.to or os.environ.get("DGTL_SKILLS_DIR")
        target = os.path.expanduser(target) if target else None
        for n in names:
            src = os.path.join(ENGINE, n)
            line = f"{n:<24} {tree_digest(src)}"
            if target:
                dst = os.path.join(target, n)
                if not os.path.isdir(dst):
                    line += "  not installed"
                else:
                    d = tree_digest(dst)
                    line += f"  installed={d} " + ("match" if d == tree_digest(src) else "DRIFT")
            print(line)
        return

    if args.check:
        target = resolve_target(args)
        drift = 0
        for n in names:
            src, dst = os.path.join(ENGINE, n), os.path.join(target, n)
            if not os.path.isdir(dst):
                print(f"NOT INSTALLED: {n}")
                drift += 1
                continue
            only_src, only_dst, changed = diff_report(src, dst)
            if only_src or only_dst or changed:
                drift += 1
                print(f"DRIFT: {n}")
                for f in only_src:
                    print(f"    only in engine/:    {f}")
                for f in only_dst:
                    print(f"    only in installed:  {f}")
                for f in changed:
                    print(f"    differs:            {f}")
        print(f"skills={len(names)} drifted={drift}")
        sys.exit(1 if drift else 0)

    if not args.all and not args.skill:
        ap.error("give a skill name, or --all, or --list")

    target = resolve_target(args)
    todo = names if args.all else [args.skill]
    for n in todo:
        src = os.path.join(ENGINE, n)
        if not os.path.isdir(src):
            sys.exit(f"unknown skill: {n} (have: {', '.join(names)})")
        dst = os.path.join(target, n)
        if os.path.isdir(dst):
            shutil.rmtree(dst)
        shutil.copytree(src, dst, ignore=shutil.ignore_patterns("__pycache__", ".DS_Store"))
        print(f"exported {n} -> {dst}  ({tree_digest(dst)})")


if __name__ == "__main__":
    main()
