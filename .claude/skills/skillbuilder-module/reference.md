# Reference: site structure, content format, fixing gaps

## Site structure (as of 2026-11, AWS Cloud Practitioner Essentials)

**Outline page** — `courses/<slug>.json` → `url` (e.g. `https://skillbuilder.aws/learn/94T2BEN85A/aws-cloud-practitioner-essentials/8D79F3AVR7`)
- Cookie banner: button "Decline" (essential cookies only).
- Left stepper: `[data-testid=stepLabel]` = "Module N - Title"; status in `[data-testid=stepEyebrowDescription]`
  (Completed / Not started / View only). Non-module steps: "Feedback", "Achievements".
- **All** module detail panels are in the DOM (hidden). Each: `<h2>` with the module label, a Start/Resume/Review
  button (nearest ancestor of the h2 that contains a button), and `[data-testid=moduleSection]` (h3 + p items).
  A "Jump back in" card has another visible "Resume" button — always scope the button to the module's h2.

**Module player** — same tab: `https://skillbuilder.aws/renderer/?module_id=<ID>:<ver>&product_id=…&registration_id=…`
- Content iframe `#renderer_iframe` → `https://skillbuilder.aws/cds/CONTENT_<ID>_<ver>/index.html` (same origin,
  after a 302 via `/cds/auth`). Player name: "Levitate Learning Experience".
- The iframe fetches **`course.json`** = the whole module. This is the content source (`src/skillbuilder.js → openModule`).
- `#focus_rm_button` ("Enter reader mode") renders every lesson in `#MainDivUR`; used only for the coverage check.
  Exit button: `button[aria-label="disable accessibility mode"]`.
- Reader-mode DOM (for orientation): section `h2` → `div.Lesson` → `div.LessonTitle h1` → blocks; text in
  `span.SafeHTMLSpan`; video in `div.MaxWidthVid`, transcript in `.SideTranscript`; flip cards `ul.rowOfCards >
  div.flippy_cardN` with `.fcard_front` / `.fcard_back .SafeHTML`; hotspots `div[aria-label="unrolled image with hot spots"]`;
  questions `fieldset.nullfieldset` with `div.Answer`.

## course.json format

```
{ id, title: "Module 1: …", sections: [ { id, title, lessons: [ { id, title, topics: [ { id, title, blocks: [ … ] } ] } ] } ] }
```

| Block type | Fields | Rendered as (`src/convert.js` → `RENDERERS`) |
|---|---|---|
| `SafeHTMLSpan`, `SafeHTML` | `content` (HTML) | Markdown via turndown; h3→level below lesson, tables → GFM |
| `Video` | `media` (mp4 + vtt captions) | skipped |
| `Image` | `name`, `alt` | image dropped; descriptive alt kept as `*[Image: alt]*` (junk alts like "End of tab" → `JUNK_ALT`) |
| `ImageWithHotSpots` | `image{alt}`, `hotspots[{marker,title,text}]` | `*[Image: alt]*`, then **title** + text per hotspot |
| `TabSet`, `Accordion` | `sections[{title, blocks[]}]` | **title**, then the section's blocks (recursive) — added for Module 2 |
| `FlippyCards` | `cards[{title (front: img/name), text (back: bold name + description)}]` | back side; front alt as title if the back has no bold title |
| `Carousel` | `slides[{title, text, image}]` | **title** + text (+ image alt), or a numbered list when all titles are empty |
| `Columns` | `cols[[blocks]]` | each column's blocks in order |
| `Question` | `question` (HTML), `answers[{answer, correct, feedback}]`, `rightFeedback`, `wrongFeedback`, `block_title` | "**Question n**", text, *Choose k.*, `- A. …`; answer key at module end |

Known quirks (already handled):
- `<b><strong>` / `<i><em>` double wrapping → nested rules avoid `****x****`.
- One italic sentence split into adjacent runs (`<i>With </i><i><b>GraphQL</b></i><i>, …</i>`) and bold around
  punctuation only (`<b>.</b>`) → `tidyHtml` merges adjacent em/strong runs and unwraps punctuation-only ones
  (Modules 9, 13). Lint renders the Markdown and flags leftover literal `**` / `*.` ("unrendered emphasis").
- Tables start with `<colgroup>` and carry inline colours → stripped; custom table rule.
- Single-answer questions: per-option `feedback`; `rightFeedback` is an authoring placeholder
  ("That's correct! Paragraph text = 17pt…") → ignored. Multi-select: per-option feedback empty, explanation in `rightFeedback`.
- Paragraphs glued together in source ("launch.Which") → `unglue()` for questions/feedback.
- Carousel slide titles can be empty (the benefit names only exist in the video) → numbered list.
- Player navigation text ("Choose the **Return to outline** link…") and the "Congratulations on completing this
  module!" line → paragraphs dropped via `NAV_PATTERNS` in `src/convert.js`; the coverage check ignores the same
  patterns. Add new navigation/filler phrases there (user's choice; the copyright line stays).
- A nearly empty page after a section's last question is expected and fine (user-approved).
- Whole non-content lessons are dropped via `DROP_LESSONS` in `src/convert.js` (currently "Contact Us": support-form
  instructions + "Congratulations on completing this course!" at the end of the course). Their text is passed to the
  coverage check as accounted for (`droppedText`), so it is not reported as missing.

## Layout decisions (user-approved)

- Combined document levels: course `#`, module `##`, section `###`, lesson `####`, topic/content headings below.
- PDF: every module (`h2.module`) and every section (`h3`, incl. "Answer key") starts on a new page; the first section
  follows the module title on the same page (`src/pdf.js` CSS). Questions and answer-key entries never split across pages.

## Fixing gaps

1. Look at the saved JSON with `probe` (offline, no ad-hoc code needed):
   ```sh
   npm run -s probe -- <N> --find "<distinctive phrase of a missing line>"   # JSON path + block type holding it
   npm run -s probe -- <N> --type <Type> [--max 3000] [--all]               # sample of an unknown block type
   npm run -s probe -- <N> --types                                          # block type counts (incl. nested)
   ```
   The full build report (all `!` lines, block stats, section start pages) is in `build/<course>/report.txt`.
2. Add or adjust a renderer in `RENDERERS` (`src/convert.js`). Keep output plain: text, lists, tables, links, bold titles.
   No images, no colours.
3. If the missing line is player chrome rather than content (a button label, widget caption), add a regex to
   `IGNORE` in `src/check.js` instead.
4. `npm run -s build` again until coverage is `Y/Y` and there are no warnings; commit the code change.

If the site itself changed (selectors fail, no course.json): `npm run inspect -- [url] [steps.js]` opens a page with the
saved session; a steps file exports `async ({ page, context, dump }) => {}` and `dump(name)` writes
`debug/<name>.html|.txt|.png` (scripts stripped; `debug/` is git-ignored). Put throwaway steps files in the scratchpad.

## Automatic checks (`npm run build`)

- Coverage (`src/check.js → coverage`): every reader-mode line (minus `IGNORE`, `NAV_PATTERNS`, `JUNK_ALT`) is in the Markdown.
- Lint (`src/check.js → lint`): leftover HTML tags (except `<br>` in table cells), `****`, HTML entities, empty headings.
- Converter warnings (`src/convert.js`): unknown block types, questions without a correct answer or explanation.
- PDF (`src/pdfcheck.js`, via `unpdf`): page count, module/section start pages from the bookmarks
  (`--verbose` prints sections), question labels stranded at a page bottom.

Visual check is not needed routinely. If a layout problem is suspected: the Read tool cannot render PDFs here
(no poppler) — create a venv in the scratchpad, `pip install pymupdf`, render with
`pymupdf.open(pdf)[i].get_pixmap(dpi=80).save('pageNN.png')` and Read the PNGs.

## Adding another course

Create `courses/<slug>.json` with `{ "name": "<Course name>", "url": "<outline URL>" }` and pass `--course <slug>` to
`outline`, `extract` and `build` (`login`/`verify` take the slug as first argument). Expect the same player; if the
outline or player differs, investigate with `npm run inspect`.
