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
npm run login            # 1. sign in by hand in the browser window, then click "Save session"
npm run verify           # 2. check the saved session still works
npm run outline          # 3. list the course modules and their status (-- --verbose for lessons)
npm run extract -- 1     # 4. extract module 1  (also: -- 2,4  |  -- 2-5  |  -- all)
npm run build            # 5. write the Markdown + PDF from every extracted module
```

Output (one file per format, modules in course order):

```
output/<Course name>/Markdown/<Course name>.md
output/<Course name>/PDF/<Course name>.pdf
```

Courses are configured in [`courses/`](courses/) (name + outline URL). With a
single course file the `--course <slug>` option can be omitted.

## How it works

- **Navigation** — the outline page lists modules (`data-testid="stepLabel"`);
  each module's Start / Resume / Review button opens the player
  (`/renderer/?module_id=…`), whose iframe loads the whole module as
  `cds/CONTENT_<id>/course.json`. That JSON is the content source: it is
  structured (sections → lessons → topics → typed blocks) and includes the
  knowledge-check answers.
- **Conversion** ([`src/convert.js`](src/convert.js)) — text blocks, flip cards
  (back side: title + description), hotspot images (marker titles + text),
  carousels, tabs, accordions, columns, tables and questions become Markdown.
  Videos, transcripts and images are dropped; an image's descriptive alt text
  is kept as one italic `[Image: …]` line. Each module ends with an **answer key**
  (correct option + explanations). Unknown block types are rendered with a
  generic fallback and reported.
- **Coverage check** ([`src/check.js`](src/check.js)) — the extractor also
  saves the player's *reader mode* text (videos/transcripts removed);
  `npm run build` verifies every line of it appears in the Markdown and lists
  anything missing.
- **PDF** ([`src/pdf.js`](src/pdf.js)) — black-on-white print CSS, A4, page
  numbers, PDF bookmarks, each module, each module section and each answer key
  on a new page, link URLs printed next to the link text.
- Player navigation instructions ("Choose the Return to outline link…") are
  dropped (`NAV_PATTERNS` in `src/convert.js`).

Note: opening a module you have not started yet (the button says *Start*)
registers it as started in your Skill Builder progress, exactly as clicking it
yourself would.

Intermediate files live in `build/<course>/` (git-ignored): `outline.json`
and per module `NN.course.json`, `NN.reader.txt`, `NN.meta.json`, `NN.md`.
`npm run build` works offline from these, so the converter can be improved
and re-run without touching the site.

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
