// Markdown -> print-friendly HTML -> PDF (headless Chromium).
const MarkdownIt = require('markdown-it');
const { chromium } = require('playwright');

/** GitHub-style heading slug, shared by the TOC and the HTML heading ids. */
function slugify(text) {
  return text.toLowerCase().trim()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

function headingIds(md) {
  md.core.ruler.push('heading_ids', (state) => {
    const seen = {};
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'heading_open') continue;
      const text = tokens[i + 1].children.filter((t) => t.type === 'text' || t.type === 'code_inline').map((t) => t.content).join('');
      let id = slugify(text);
      if (seen[id] !== undefined) id = `${id}-${++seen[id]}`; else seen[id] = 0;
      tokens[i].attrSet('id', id);
    }
  });
}

const CSS = `
@page { size: A4; margin: 18mm 17mm 20mm 17mm; }
* { color: #000 !important; background: transparent !important; }
html { font-size: 10.5pt; }
body { font-family: "Segoe UI", Calibri, Arial, sans-serif; line-height: 1.45; margin: 0; }
h1, h2, h3, h4, h5, h6 { line-height: 1.2; break-after: avoid; page-break-after: avoid; margin: 1.1em 0 .45em; }
h1 { font-size: 22pt; margin-top: 0; }
h2 { font-size: 17pt; border-bottom: 1.5pt solid #000; padding-bottom: 3pt; }
h3 { font-size: 13.5pt; }
h4 { font-size: 12pt; }
h5 { font-size: 11pt; }
h6 { font-size: 10.5pt; font-style: italic; }
h2.module { break-before: page; page-break-before: always; }
/* Every section (h3) and the answer key start on a new page — except the first
   section, which follows the module title on the module's first page. */
h3 { break-before: page; page-break-before: always; }
h2.module + h3 { break-before: auto; page-break-before: auto; }
p { margin: .45em 0; orphans: 3; widows: 3; }
ul, ol { margin: .35em 0 .6em; padding-left: 1.4em; }
li { margin: .15em 0; break-inside: avoid; }
a { text-decoration: underline; }
a[href^="http"]::after { content: " <" attr(href) ">"; font-size: 8.5pt; word-break: break-all; }
table { border-collapse: collapse; width: 100%; margin: .6em 0; font-size: 9.5pt; }
th, td { border: .75pt solid #000; padding: 3pt 5pt; vertical-align: top; text-align: left; }
th { font-weight: 700; }
tr { break-inside: avoid; }
hr { border: 0; border-top: .75pt solid #000; }
.keep { break-inside: avoid; page-break-inside: avoid; }
p:has(> strong:only-child) { break-after: avoid; page-break-after: avoid; }
.cover-note { font-size: 9pt; font-style: italic; }
nav.toc ul { list-style: none; padding-left: 1.1em; }
nav.toc > ul { padding-left: 0; }
nav.toc a::after { content: none; }
nav.toc a { text-decoration: none; }
`;

function renderHtml(markdown, title) {
  const md = new MarkdownIt({ html: true, linkify: false, typographer: false });
  md.use(headingIds);
  let body = md.render(markdown);
  // Every module starts on a new page; the TOC section ("Contents") does not.
  body = body.replace(/<h2 id="(?!contents")/g, '<h2 class="module" id="');
  // Keep each question (label, text, options) and each answer-key entry on one page.
  body = body.replace(/<p><strong>Question \d+<\/strong><\/p>[\s\S]*?<\/ul>|<p><strong>Question \d+ — [^<]*<\/strong><\/p>\s*<ul>[\s\S]*?<\/ul>/g, (m) => `<div class="keep">${m}</div>`);
  // Wrap the TOC list for styling.
  body = body.replace(/(<h2[^>]*id="contents"[^>]*>.*?<\/h2>\s*)(<ul>[\s\S]*?<\/ul>)(\s*<h2)/, '$1<nav class="toc">$2</nav>$3');
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

async function writePdf(markdown, title, pdfPath) {
  const browser = await chromium.launch(); // bundled headless Chromium
  try {
    const page = await browser.newPage();
    await page.setContent(renderHtml(markdown, title), { waitUntil: 'load' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: false,
      outline: true, // PDF bookmarks from headings
      tagged: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="font-family: Arial, sans-serif; font-size: 8px; width: 100%; padding: 0 17mm; display: flex; justify-content: space-between;"><span>${title.replace(/</g, '&lt;')}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      margin: { top: '18mm', bottom: '20mm', left: '17mm', right: '17mm' },
    });
  } finally {
    await browser.close();
  }
}

module.exports = { slugify, renderHtml, writePdf };
