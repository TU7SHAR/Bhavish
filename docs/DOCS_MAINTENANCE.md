# Documentation Maintenance Contract

> **This project keeps documentation in lockstep with the code.** Every change /
> iteration MUST update the docs in the *same* change/PR. This file is the
> checklist. It applies to human contributors and AI agents alike.

---

## The rule (short version)

**No code change ships without its doc update.** If you touched behavior, routes,
commands, files, config, or known issues, you update the matching docs before the
PR is opened.

---

## What to update, and when

Work top to bottom; skip a row only if it genuinely doesn't apply.

| If your change… | Then update… |
|-----------------|--------------|
| Adds/removes/changes an **API route** | `commands/api-routes.md` (+ `PROJECT.md` route table if it's a major route) |
| Adds/removes/changes a **`lib/` module** | `commands/lib-modules.md` (+ `docs/architecture.md` lib tree) |
| Adds/removes/changes a **page** or component | `commands/pages.md` and/or the component tree in `docs/architecture.md` |
| Adds/changes a **command, npm script, or migration** | `commands/cli-commands.md` |
| Adds/changes a **cron or operational endpoint** | `commands/cron-and-ops.md` (+ cron block in `PROJECT.md`/`docs/architecture.md`) |
| Changes **architecture / data flow / infra** | `docs/architecture.md` |
| Changes **product scope, pricing, audience, features** | `docs/prd.md` |
| Changes a **non-functional constraint** (limits, perf, security, retention) | `docs/requirements.md` |
| **Fixes or discovers a bug** | `docs/bugs.md` (move to Fixed / add to Open) |
| **Completes a roadmap item** | tick the box in `docs/implementation_plan.md` |
| Affects a **testable behavior** | add/adjust a case in `docs/testing.md` |
| Runs a **security-relevant** change | re-verify the relevant row in `docs/audit.md` |
| **Any change at all** | add an entry to `docs/agent-activity-log.md`; bump the "Last updated" date on every doc you touched |

---

## Every-iteration minimum (always do these)

1. **`docs/agent-activity-log.md`** — add a new top entry using the template
   (Asked → Interpreted → Did → Files → Impact → Branch/PR).
2. **`commands/`** — if a command/route/lib/page/cron changed, correct its file.
3. **"Last updated"** — bump the date on every doc you edited.

---

## Accuracy principles

- **Code is the source of truth.** If a doc and the code disagree, fix the doc.
- **Verify before you write.** Confirm claims against the actual source (read the
  route/file), don't restate old docs.
- **Separate resolved from open.** Don't leave fixed issues described as if open.
- **Docs-only PRs are fine** and encouraged when docs have drifted.

---

## For AI agents specifically

- The hook `.kiro/hooks/docs-maintenance-reminder.json` injects this contract at
  session start. Treat it as a standing instruction, not optional.
- Before opening a PR, re-read this checklist and confirm each applicable row is done.
- Prefer one new activity-log entry per PR (not per file).

*Last updated: September 2026*
