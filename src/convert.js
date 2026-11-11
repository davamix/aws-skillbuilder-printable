// course.json (Skill Builder "Levitate" player) -> printable Markdown.
//
// course.json shape: { title, sections: [{ title, lessons: [{ title, topics: [{ title, blocks: [...] }] }] }] }
// Block types seen so far are handled in RENDERERS below; anything else is
// rendered by a generic fallback and reported as a warning so it can be added.
const TurndownService = require('turndown');
const { strikethrough } = require('turndown-plugin-gfm');

const SKIPPED = new Set(['Video', 'Image', 'Audio']); // printable = text only

// Player navigation instructions and end-of-module filler that mean nothing on
// paper. Paragraphs matching these are dropped (and ignored by the coverage
// check in src/check.js).
const NAV_PATTERNS = [
  /\breturn to outline\b/i, // "Choose the Return to outline link at the top of this page to continue…"
  /^\s*congratulations on completing this module!?\s*$/i,
];
const isNavigation = (text) => NAV_PATTERNS.some((re) => re.test(text.replace(/[*_]/g, '')));
const dropNavigation = (md) => md.split(/\n{2,}/).filter((p) => !isNavigation(p)).join('\n\n');

function hasAncestor(node, re) {
  for (let p = node.parentNode; p; p = p.parentNode) if (re.test(p.nodeName)) return true;
  return false;
}
function elementChildren(node, re) {
  const out = [];
  for (let c = node.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && re.test(c.nodeName)) out.push(c);
  return out;
}

function makeTurndown(ctx) {
  const td = new TurndownService({
    headingStyle: 'atx', bulletListMarker: '-', emDelimiter: '*', strongDelimiter: '**',
  });
  td.use(strikethrough);
  td.remove(['script', 'style', 'img', 'video', 'audio', 'iframe', 'colgroup', 'svg']);

  // The authoring tool wraps text as <b><strong>…</strong></b> and <i><em>…</em></i>;
  // only the outer element should produce markdown delimiters.
  td.addRule('nestedStrong', { filter: (n) => /^(B|STRONG)$/.test(n.nodeName) && hasAncestor(n, /^(B|STRONG)$/), replacement: (c) => c });
  td.addRule('nestedEm', { filter: (n) => /^(I|EM)$/.test(n.nodeName) && hasAncestor(n, /^(I|EM)$/), replacement: (c) => c });

  // "- item" instead of turndown's "-   item".
  td.addRule('listItem', {
    filter: 'li',
    replacement: (content, node) => {
      const parent = node.parentNode;
      let prefix = '- ';
      if (parent.nodeName === 'OL') {
        const start = Number(parent.getAttribute('start') || 1);
        prefix = `${start + elementChildren(parent, /^LI$/).indexOf(node)}. `;
      }
      const body = content.replace(/^\n+/, '').replace(/\n+$/, '\n').replace(/\n/gm, `\n${' '.repeat(prefix.length)}`);
      return prefix + body + (node.nextSibling && !/\n$/.test(body) ? '\n' : '');
    },
  });

  // Tables: always a GFM table (first row = header), one line per cell, no styling.
  td.addRule('table', {
    filter: 'table',
    replacement: (_content, node) => {
      const rows = [];
      (function collect(el) {
        for (const c of elementChildren(el, /^(THEAD|TBODY|TFOOT|TR)$/)) {
          if (c.nodeName === 'TR') rows.push(elementChildren(c, /^(TD|TH)$/));
          else collect(c);
        }
      })(node);
      if (!rows.length) return '';
      const cellMd = (cell) => tidyMd(td.turndown(cell.innerHTML)).replace(/\n+/g, '<br>').replace(/\|/g, '\\|') || ' ';
      const grid = rows.map((r) => r.map(cellMd));
      const width = Math.max(...grid.map((r) => r.length));
      const line = (r) => `| ${Array.from({ length: width }, (_, i) => r[i] ?? ' ').join(' | ')} |`;
      const [head, ...body] = grid;
      return `\n\n${[line(head), line(Array(width).fill('---')), ...body.map(line)].join('\n')}\n\n`;
    },
  });

  // Headings inside content are nested under the current lesson/topic heading.
  td.addRule('nestedHeading', {
    filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    replacement: (content, n) => {
      const text = clean(content.replace(/\*\*|__/g, '').replace(/\s*\n\s*/g, ' '));
      if (!text) return '';
      const level = Math.min(6, Math.max(ctx.base, ctx.base + Number(n.nodeName[1]) - 3));
      return `\n\n${'#'.repeat(level)} ${text}\n\n`;
    },
  });
  return td;
}

function clean(s) {
  return String(s ?? '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();
}

/** The source sometimes glues paragraphs together: "users.Ease of use" -> "users. Ease of use". */
function unglue(s) {
  return s.replace(/([a-z)])([.?!])([A-Z][a-z])/g, '$1$2 $3');
}

/** Question-level feedback is often an authoring placeholder ("That's correct! Paragraph text = 17pt…"). */
function meaningfulFeedback(s) {
  const t = clean(s);
  if (!t || /paragraph text\s*=|^that.s (in)?correct[.!]?$/i.test(t)) return '';
  return t;
}

/** Strip empty paragraphs and leading <br>s that the authoring tool leaves around. */
function tidyHtml(html) {
  return String(html ?? '')
    .replace(/<\/?(html|body)[^>]*>/gi, '')
    .replace(/<colgroup[\s\S]*?<\/colgroup>/gi, '')
    .replace(/\s(style|class|dir|target|rel|width|height|caption|assetid|isdecorative|data-[\w-]+)="[^"]*"/gi, '')
    .replace(/<p[^>]*>\s*(<br\s*\/?>\s*)*<\/p>/gi, '')
    .replace(/(<p[^>]*>)\s*(<br\s*\/?>\s*)+/gi, '$1');
}

function tidyMd(md) {
  return md
    .replace(/ /g, ' ')
    .replace(/[ \t]+$/gm, (m) => (m === '  ' ? m : '')) // keep markdown hard breaks only
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function indent(md, spaces) {
  const pad = ' '.repeat(spaces);
  return md.split('\n').map((l, i) => (i === 0 || !l ? l : pad + l)).join('\n');
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Convert one module's course.json to Markdown.
 * @param {object} course parsed course.json
 * @param {object} opts { level: heading level of the module title (1 standalone, 2 inside a course doc) }
 * @returns {{ markdown: string, warnings: string[], stats: object }}
 */
function convertModule(course, { level = 1 } = {}) {
  const ctx = { base: level + 3 };
  const td = makeTurndown(ctx);
  const html = (h) => tidyMd(td.turndown(tidyHtml(h) || ''));
  const H = (n) => '#'.repeat(Math.min(6, n));
  const out = [];
  const answers = [];
  const warnings = [];
  const stats = {};

  const RENDERERS = {
    SafeHTMLSpan: (b) => html(b.content),
    SafeHTML: (b) => html(b.content),

    ImageWithHotSpots: (b) => {
      const parts = [];
      if (clean(b.image?.alt)) parts.push(clean(b.image.alt));
      for (const h of b.hotspots || []) {
        if (clean(h.title)) parts.push(`**${clean(h.title)}**`);
        parts.push(html(h.text));
      }
      return parts.filter(Boolean).join('\n\n');
    },

    // Flip cards: front = image/name, back = name + description. Keep the back.
    FlippyCards: (b) => (b.cards || []).map((c) => {
      const back = html(c.text);
      if (/^\*\*[^*]+\*\*/.test(back)) return back;
      const front = clean(c.title?.replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, ' $1 ').replace(/<[^>]+>/g, ' '));
      return [front && `**${front}**`, back].filter(Boolean).join('\n\n');
    }).join('\n\n'),

    Carousel: (b) => {
      const slides = (b.slides || []).filter((s) => clean(s.title) || clean(s.text));
      if (slides.some((s) => clean(s.title))) {
        return slides.map((s) => [clean(s.title) && `**${clean(s.title)}**`, html(s.text)].filter(Boolean).join('\n\n')).join('\n\n');
      }
      return slides.map((s, i) => `${i + 1}. ${indent(html(s.text), 3)}`).join('\n\n');
    },

    Columns: (b) => (b.cols || []).flat().map(renderBlock).filter(Boolean).join('\n\n'),

    Question: (b) => {
      const n = answers.length + 1;
      const opts = b.answers || [];
      const correct = opts.map((a, i) => (a.correct ? LETTERS[i] : null)).filter(Boolean);
      answers.push({ n, b, correct });
      const lines = [`**Question ${n}**`, unglue(html(b.question))];
      lines.push(`*Choose ${correct.length || 1}.*`);
      lines.push(opts.map((a, i) => `- ${LETTERS[i]}. ${clean(/</.test(a.answer) ? html(a.answer) : a.answer)}`).join('\n'));
      return lines.join('\n\n');
    },
  };

  function renderBlock(block) {
    if (!block || typeof block !== 'object') return '';
    stats[block.type] = (stats[block.type] || 0) + 1;
    if (SKIPPED.has(block.type)) return '';
    const r = RENDERERS[block.type];
    if (r) return dropNavigation(r(block));
    warnings.push(`Unknown block type "${block.type}" (keys: ${Object.keys(block).join(', ')}) — rendered with generic fallback`);
    return dropNavigation(fallback(block));
  }

  // Unknown component: render every text-ish string field in document order.
  function fallback(obj) {
    const parts = [];
    (function walk(o, key) {
      if (typeof o === 'string') {
        if (/^(title|text|content|html|question|answer|caption|label|description|body|heading)$/i.test(key) && clean(o)) {
          parts.push(/<[a-z]/i.test(o) ? html(o) : clean(o));
        }
      } else if (Array.isArray(o)) o.forEach((x) => walk(x, key));
      else if (o && typeof o === 'object') {
        if (o.type && o !== obj) { parts.push(renderBlock(o)); return; }
        for (const [k, v] of Object.entries(o)) walk(v, k);
      }
    })(obj, '');
    return parts.filter(Boolean).join('\n\n');
  }

  out.push(`${H(level)} ${clean(course.title)}`);
  for (const section of course.sections || []) {
    out.push(`${H(level + 1)} ${clean(section.title)}`);
    for (const lesson of section.lessons || []) {
      out.push(`${H(level + 2)} ${clean(lesson.title)}`);
      for (const topic of lesson.topics || []) {
        const sameAsLesson = clean(topic.title).toLowerCase() === clean(lesson.title).toLowerCase();
        if (!sameAsLesson && clean(topic.title)) out.push(`${H(level + 3)} ${clean(topic.title)}`);
        ctx.base = sameAsLesson ? level + 3 : level + 4;
        for (const block of topic.blocks || []) {
          const md = renderBlock(block);
          if (md) out.push(md);
        }
      }
    }
  }

  if (answers.length) {
    out.push(`${H(level + 1)} Answer key`);
    for (const { n, b, correct } of answers) {
      const lines = [`**Question ${n} — ${correct.join(', ') || '?'}**`];
      const notes = (b.answers || []).map((a, i) => {
        const fb = unglue(clean(/</.test(a.feedback || '') ? html(a.feedback) : a.feedback));
        if (!fb) return null;
        return a.correct ? `- **${LETTERS[i]} (correct):** ${fb}` : `- ${LETTERS[i]}: ${fb}`;
      }).filter(Boolean);
      // correct answers first
      notes.sort((x, y) => (y.includes('(correct)') ? 1 : 0) - (x.includes('(correct)') ? 1 : 0));
      if (notes.length) lines.push(notes.join('\n'));
      else {
        // Multi-select questions carry one explanation for the whole question.
        const fb = meaningfulFeedback(/</.test(b.rightFeedback || '') ? html(b.rightFeedback) : b.rightFeedback);
        if (fb) lines.push(`- ${unglue(fb)}`);
      }
      out.push(lines.join('\n\n'));
    }
  }

  return { markdown: tidyMd(out.join('\n\n')) + '\n', warnings, stats };
}

module.exports = { convertModule, NAV_PATTERNS };
