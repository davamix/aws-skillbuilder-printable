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
| `Image` | `name`, `alt` | skipped |
| `ImageWithHotSpots` | `image{alt}`, `hotspots[{marker,title,text}]` | image alt as a line, then **title** + text per hotspot |
| `FlippyCards` | `cards[{title (front: img/name), text (back: bold name + description)}]` | back side; front alt as title if the back has no bold title |
| `Carousel` | `slides[{title, text, image}]` | **title** + text, or a numbered list when all titles are empty |
| `Columns` | `cols[[blocks]]` | each column's blocks in order |
| `Question` | `question` (HTML), `answers[{answer, correct, feedback}]`, `rightFeedback`, `wrongFeedback`, `block_title` | "**Question n**", text, *Choose k.*, `- A. …`; answer key at module end |

Known quirks (already handled):
- `<b><strong>` / `<i><em>` double wrapping → nested rules avoid `****x****`.
- Tables start with `<colgroup>` and carry inline colours → stripped; custom table rule.
- Single-answer questions: per-option `feedback`; `rightFeedback` is an authoring placeholder
  ("That's correct! Paragraph text = 17pt…") → ignored. Multi-select: per-option feedback empty, explanation in `rightFeedback`.
- Paragraphs glued together in source ("launch.Which") → `unglue()` for questions/feedback.
- Carousel slide titles can be empty (the benefit names only exist in the video) → numbered list.
- Player navigation text ("Choose the **Return to outline** link…") and the "Congratulations on completing this
  module!" line → paragraphs dropped via `NAV_PATTERNS` in `src/convert.js`; the coverage check ignores the same
  patterns. Add new navigation/filler phrases there (user's choice; the copyright line stays).
- A nearly empty page after a section's last question is expected and fine (user-approved).

## Layout decisions (user-approved)

- Combined document levels: course `#`, module `##`, section `###`, lesson `####`, topic/content headings below.
- PDF: every module (`h2.module`) and every section (`h3`, incl. "Answer key") starts on a new page; the first section
  follows the module title on the same page (`src/pdf.js` CSS). Questions and answer-key entries never split across pages.

## Fixing gaps

1. Look at the block in the saved JSON (no browser needed):
   ```sh
   node -e "const j=require('./build/<course>/modules/NN.course.json');JSON.stringify(j,(k,v)=>{if(v&&v.type==='<Type>')console.log(JSON.stringify(v,null,1).slice(0,3000));return v})"
   ```
   For a `! missing:` line, search the JSON for a distinctive phrase of it to find which block/field holds it.
2. Add or adjust a renderer in `RENDERERS` (`src/convert.js`). Keep output plain: text, lists, tables, links, bold titles.
   No images, no colours.
3. If the missing line is player chrome rather than content (a button label, widget caption), add a regex to
   `IGNORE` in `src/check.js` instead.
4. `npm run -s build` again until coverage is `Y/Y` and there are no warnings; commit the code change.

If the site itself changed (selectors fail, no course.json): `npm run inspect -- [url] [steps.js]` opens a page with the
saved session; a steps file exports `async ({ page, context, dump }) => {}` and `dump(name)` writes
`debug/<name>.html|.txt|.png` (scripts stripped; `debug/` is git-ignored). Put throwaway steps files in the scratchpad.

## Checking the PDF visually

The Read tool cannot render PDFs here (no poppler). Optional: create a venv **in the scratchpad**, `pip install pymupdf`,
then render pages with `fitz.open(pdf)[i].get_pixmap(dpi=80).save('pageNN.png')` and Read the PNGs.
Things to look for: a question label stranded at a page bottom (questions are wrapped in `.keep` in `src/pdf.js`),
broken tables, leftover HTML.

## Adding another course

Create `courses/<slug>.json` with `{ "name": "<Course name>", "url": "<outline URL>" }` and pass `--course <slug>` to
`outline`, `extract` and `build` (`login`/`verify` take the slug as first argument). Expect the same player; if the
outline or player differs, investigate with `npm run inspect`.
