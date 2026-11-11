---
name: skillbuilder-module
description: Extract modules of an AWS Skill Builder course into this repo's printable Markdown + PDF (aws-skillbuilder-printable). Use when the user asks to extract, add, process or print "module N", "the next module(s)", "modules X-Y", "all remaining modules", or to rebuild/regenerate the course Markdown or PDF.
---

# Skill Builder module → printable Markdown + PDF

The pipeline is built and tested (Module 1: 202/202 coverage). Do **not**
re-analyse the site; just run the steps. Only open [reference.md](reference.md)
when a step fails or the build reports a problem.

## Rules

- Never read, print or commit `.auth/*` (the browser session). Cookie *names* are OK; values never.
- Never ask for or handle the user's password — sign-in is always done by the user in the browser window.
- Commit/push code changes only. `build/`, `debug/`, `output/`, `.auth/` are git-ignored and blocked by the pre-commit hook; course content is © AWS and must not reach the public repo.

## Steps

1. **Session** — `npm run -s verify`.
   If it prints `NOT_LOGGED_IN` (exit 3): run `npm run login` with `run_in_background`, tell the user:
   *"Sign in in the Edge window and click the green 'Save session' button (bottom-right)."*
   Wait for the task to finish with `RESULT: SAVED`, then verify again.
2. **Which modules** — if unclear, `npm run -s outline` (numbers + status).
   Modules with status *Not started* become *started* in the user's progress when extracted;
   say so if the user hasn't already accepted that.
3. **Extract** — `npm run -s extract -- <N | N,M | A-B | all>` (≈30 s per module; set a timeout of 5–10 min for several).
4. **Build** — `npm run -s build` (offline; regenerates the single MD + PDF from every extracted module, in order).
5. **Review the build report**, per module:
   - `coverage: X/Y reader-mode lines found` → must be `Y/Y`. Each `! missing:` line is visible course text not in the Markdown.
   - `! Unknown block type "T"` → a new component, rendered by the generic fallback; add a proper renderer.
   To fix either, follow **Fixing gaps** in [reference.md](reference.md), then re-run step 4 only.
6. **Spot-check** `build/<course>/modules/NN.md` (headings, questions, answer key at the end — every question should have explanations).
7. **Report** to the user: modules added, block stats line, coverage, anything skipped/odd, and the two output paths:
   `output/<Course name>/Markdown/<Course name>.md`, `output/<Course name>/PDF/<Course name>.pdf`.
   If code changed: commit with a clear message and push (check `git status` shows no ignored paths staged).
