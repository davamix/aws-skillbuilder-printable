# aws-skillbuilder-printable

Turn an [AWS Skill Builder](https://skillbuilder.aws) course you are enrolled in
into a **printable, text-only** version: one Markdown file and one PDF per course.
Videos, transcripts, images and colours are dropped; text, lists, tables,
flip-card definitions, knowledge-check questions and links are kept.

Built with Node.js + [Playwright](https://playwright.dev).

## Requirements

- Node.js 18+
- Microsoft Edge or Google Chrome installed (used for the sign-in window)
- An AWS Skill Builder account enrolled in the course

```sh
npm install
npx playwright install chromium   # used to render the PDF
```

## Usage

```sh
npm run login     # 1. sign in by hand in the browser window, then click "Save session"
npm run verify    # 2. check the saved session still works
npm run outline   # 3. list the course modules
npm run extract -- 1   # 4. extract module 1 (repeat for each module)
npm run build     # 5. write output/<Course>/Markdown/*.md and PDF/*.pdf
```

Courses are configured in [`courses/`](courses/) (name + outline URL). With a
single course file the slug can be omitted.

Set `BROWSER_CHANNEL=chrome` to use Chrome instead of Edge, or `chromium` for
Playwright's bundled browser.

## Your credentials and session

- **Your password is never seen or stored.** `npm run login` opens a normal
  browser window; you type your credentials into AWS's own sign-in page.
- After you sign in, only the browser session (cookies + localStorage) is
  saved to `.auth/skillbuilder-state.json`. Treat it like a password: anyone
  holding it is signed in as you. When it expires, run `npm run login` again.
- `.auth/`, `debug/` (raw page dumps), `build/` and `output/` are git-ignored,
  so neither the session nor the course content can be committed.

## Course content

Course material is © Amazon Web Services. This tool is for making a personal,
offline study copy of a course you have access to. Do not redistribute the
generated files.
