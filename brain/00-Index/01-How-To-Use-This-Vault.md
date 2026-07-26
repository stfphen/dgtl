---
title: 01 · How To Use This Vault
type: guide
tags: [meta, conventions]
status: living
updated: 2026-07-02
---

# How To Use This Vault

This note defines the conventions so the vault stays consistent and machine-navigable.

## Audience
Primary reader is **a future Claude session** picking up this project cold. Secondary reader is
FAYELLA (the owner) and any human collaborator. Notes are written to be skimmable and link-rich.

## Numbering scheme
Top-level folders are numbered in tens so categories sort predictably and new ones can slot
between. Within a folder, the `N0` note is the **MOC (Map of Content)** hub; `N1+` are leaves.

| Range | Domain |
|---|---|
| `00–09` | Index / hub / glossary |
| `10–19` | Architecture |
| `20–2F` | Modules (hex-style suffix once past 9) |
| `30–39` | Roadmap |
| `40–49` | Operations |
| `50–59` | Audit log |
| `60–69` | Reference |
| `99` | Templates |

## Frontmatter (every note)
```yaml
---
title: <human title>
type: moc | module | guide | runbook | reference | log | template
tags: [ ... ]
status: living | stable | snapshot | deprecated
updated: YYYY-MM-DD
---
```
- `status: snapshot` marks notes that capture a point-in-time state (these can go stale — verify against the repo).
- `status: living` marks notes meant to be updated continuously.

## Linking
- Use `[[Note-Title]]` wikilinks by **basename** (basenames are unique across the vault).
- Every leaf note links **back up** to its MOC. Every MOC lists **all** its leaves.
- Cross-link liberally between modules, ops, and audit notes.

## Tags
`#moc` `#module` `#architecture` `#ops` `#roadmap` `#audit` `#security` `#funding`
`#telephony` `#enrichment` `#leads` `#tenancy` `#ai` `#payments` `#meta` `#snapshot`

## How Claude should maintain it
1. **Read before write.** Open [[00-Home]] → relevant MOC → leaf note.
2. **After meaningful work,** append a dated bullet to [[51-Timeline]] and, if a choice was made, to [[52-Decision-Log]].
3. **When code changes** a documented fact, update the note's body and bump `updated:`.
4. **New subsystem?** Copy [[Module-Note-Template]] into `20-Modules`, link it from [[20-Modules-MOC]].
5. **Never** let a `snapshot` note masquerade as current truth — re-verify against the repo.

## Relationship to repo docs
The repo's own `*.md` files (README, GO_LIVE_PLAN, DEPLOY_HOSTINGER, etc.) are the **raw sources**.
This vault **distills, cross-links, and dedupes** them. Pointers back to the source file are given
in each note so you can drill into the original. See [[Repo-Docs-Index]] for the full mapping.

Up: [[00-Home]]
