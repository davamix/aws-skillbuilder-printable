# aws-skillbuilder-printable

Node + Playwright tool that turns AWS Skill Builder courses into a printable Markdown + PDF.
Workflow for adding modules: the `skillbuilder-module` skill (`.claude/skills/skillbuilder-module/`).

## Safety rules (public repo, personal credentials)

- `.auth/` holds the user's live Skill Builder session. Never read, print, copy or commit it; show cookie names only, never values.
- Never ask for or handle the user's password. Sign-in is manual via `npm run login` (user clicks "Save session").
- Never commit `build/`, `debug/`, `output/` (personal data / AWS-copyrighted content). `.gitignore` and the
  `.githooks/pre-commit` hook enforce this — do not bypass them (`--no-verify`, `git add -f`).
- Page dumps and URLs can contain the user's name or `registration_id`; keep them in git-ignored folders.
