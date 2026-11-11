---
name: skillbuilder-module
description: Extract modules of an AWS Skill Builder course into this repo's printable Markdown + PDF (aws-skillbuilder-printable). Use when the user asks to extract, add, process or print "module N", "the next module(s)", "modules X-Y", "all remaining modules", or to rebuild/regenerate the course Markdown or PDF.
---

# Skill Builder module → printable Markdown + PDF

The pipeline is built, tested and self-checking. Do **not** re-analyse the site or hand-check the output:
run the command and act on its exit code. Open [reference.md](reference.md) only for exit 2 or 1.

## Rules

- Never read, print or commit `.auth/*` (the browser session). Cookie *names* are OK; values never.
- Never ask for or handle the user's password — sign-in is always done by the user in the browser window.
- Commit/push code changes only. `build/`, `debug/`, `output/`, `.auth/` are git-ignored and blocked by the pre-commit hook; course content is © AWS and must not reach the public repo.

## Run

```sh
npm run -s module -- <N | N,M | A-B | all>     # timeout: 3 min + 1 min per module
```

Extracts the modules, rebuilds the single Markdown + PDF with every extracted module, and checks coverage
(vs. the player's reader mode), Markdown leftovers, answer-key completeness and PDF layout. Several modules
in one call is faster (one browser session). Rebuild only, no site access: `npm run -s build`.

| Exit | Output | Do |
|---|---|---|
| 0 | `RESULT: OK` | Report. |
| 2 | `✗` module + `!` lines | Fix per **Fixing gaps** in reference.md, then `npm run -s build` until `RESULT: OK`. |
| 3 | session expired | `npm run login` with `run_in_background`; tell the user *"Sign in in the Edge window and click the green 'Save session' button (bottom-right)."* When it prints `RESULT: SAVED`, run again. |
| 4 | `NEEDS_CONSENT` | Those modules are *Not started*; extracting marks them as started in the user's progress. Ask the user; if yes, run again with `--allow-start`. |
| 1 | error message | Read it; if the site changed, see reference.md. |

## Report to the user

Modules added (the `✓` lines), PDF pages and module start pages, anything fixed or skipped, and the outputs:
`output/<Course name>/Markdown/<Course name>.md`, `output/<Course name>/PDF/<Course name>.pdf`.
If code changed: commit with a clear message and push (`git status` must show no ignored paths staged).
