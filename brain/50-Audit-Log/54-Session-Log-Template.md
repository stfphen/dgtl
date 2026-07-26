---
title: 54 · Session Log Template
type: template
tags: [audit, template]
updated: 2026-06-27
---

# Session Log Template

> Copy this note to `50-Audit-Log/55-Session-YYYY-MM-DD.md` (increment the number) to record a
> substantial work session. Keep it short and factual.

```markdown
---
title: Session YYYY-MM-DD — <topic>
type: log
tags: [audit, session]
updated: YYYY-MM-DD
---

# Session YYYY-MM-DD — <topic>

## Goal
<what this session set out to do>

## Branch / starting state
- Branch: `<name>` @ `<sha>`
- `git status` before: <clean / files>

## What changed
- <files + summary>

## Commands run + results
- `npm test` → <pass/fail, counts>
- `npm run build` → <result>
- <other>

## Decisions
- <decision → why>  (also add to [[52-Decision-Log]])

## Issues found / fixed
- <issue> (update [[53-Known-Issues]])

## Follow-ups / next session
- <todo>

## Timeline entry
- Added a bullet to [[51-Timeline]]: <yes/no>
```

Up: [[50-Audit-Log-MOC]]
