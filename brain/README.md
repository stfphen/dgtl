---
title: Brain — Content Checkout Funnel Vault
type: vault-readme
tags: [vault, meta]
updated: 2026-06-27
---

# 🧠 Brain — Content Checkout Funnel Knowledge Vault

This folder is an **Obsidian vault** that holds the durable context, architecture, roadmap,
operations runbooks, and audit history for the **Content Checkout Funnel** project
(DGTL-style white-label B2B marketing + funding-readiness platform).

It exists so that **any future Claude session (or human) can rebuild full project context fast**,
without re-reading the entire codebase. Read [[00-Home]] first.

## How to open it
Open the `brain/` folder as a vault in [Obsidian](https://obsidian.md). All notes use
`[[wikilinks]]`, YAML frontmatter, and `#tags`. The numbered folders form a Map-of-Content (MOC)
hierarchy — start at the top and follow links down.

## Entry points
- [[00-Home]] — the master hub. Start every session here.
- [[01-How-To-Use-This-Vault]] — conventions + how Claude should read/update this vault.
- [[31-Current-Priorities]] — what matters *right now*.
- [[53-Known-Issues]] — open risks, security findings, bugs.

## Folder map
| Folder | Contains | MOC |
|---|---|---|
| `00-Index` | Vault hub, usage rules, glossary | [[00-Home]] |
| `10-Architecture` | Tech stack, repo tree, data model, routes, tenancy, design | [[10-Architecture-MOC]] |
| `20-Modules` | Deep per-feature notes (one per subsystem) | [[20-Modules-MOC]] |
| `30-Roadmap` | Priorities, near-term + Sprint 2 plans, "do not start yet" | [[30-Roadmap-MOC]] |
| `40-Operations` | Deploy, go-live, env vars, secrets, backups, demo, git | [[40-Operations-MOC]] |
| `50-Audit-Log` | Timeline, decision log, known issues, session-log template | [[50-Audit-Log-MOC]] |
| `60-Reference` | Security review, testing, tenants, external services | [[60-Reference-MOC]] |
| `99-Templates` | Reusable note templates | [[Module-Note-Template]] |

> **Source of truth note:** The *code* is always the ultimate truth. This vault is a curated map of
> it. When they disagree, trust the repo and update the relevant note + log it in [[51-Timeline]].
