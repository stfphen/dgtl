---
title: Module Note Template
type: template
tags: [template, meta]
updated: 2026-06-27
---

# Module Note Template

> Copy this into `20-Modules/2X-<Name>.md` when documenting a new subsystem. Then add it to
> [[20-Modules-MOC]]. Keep it dense and link-rich.

```markdown
---
title: 2X · <Module Name>
type: module
tags: [module, <domain-tag>]
status: stable
updated: YYYY-MM-DD
---

# <Module Name>

## Purpose
<one paragraph: what this subsystem does and why it exists>

## Key files
- `lib/<...>` — <what it does, key exports>
- API: `<routes>`
- UI: `components/<...>`
- Data: `<tables>` ([[13-Data-Model]])

## Data flow
<how data moves through this module, step by step>

## Config / env
<relevant env vars → [[43-Environment-Variables]]>

## ⚠️ Gotchas / open issues
<known bugs, security notes, edge cases → link [[53-Known-Issues]]>

## Related
[[...]] · [[...]]

Up: [[20-Modules-MOC]]
```
