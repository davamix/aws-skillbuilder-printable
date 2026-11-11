// Coverage check: every line the player shows in reader mode (videos and
// transcripts removed) must appear somewhere in the generated Markdown.
// Catches content dropped by the converter, e.g. a new component type.

const MarkdownIt = require('markdown-it');
const { NAV_PATTERNS, JUNK_ALT } = require('./convert');

const md = new MarkdownIt({ html: true });

// Player chrome / widget labels that are not course content, plus the
// navigation instructions and marker alt texts the converter drops on purpose.
const IGNORE = [
  ...NAV_PATTERNS,
  JUNK_ALT,
  /^select this button or press alt/i,
  /^transcript$/i,
  /^submit$/i,
  /^choose \d+\.?$/i,
  /^question\s*-?$/i,
  /^knowledge check$/i,
  /^showing (front|back)$/i,
  /^flip card \d+ of \d+$/i,
];

const key = (s) => s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '');

function coverage(readerText, markdown) {
  const plain = markdown.replace(/\]\([^)]*\)/g, ']').replace(/<br>/g, ' ');
  const hay = key(plain);
  const lines = readerText.split('\n').map((l) => l.replace(/ /g, ' ').trim()).filter(Boolean)
    .filter((l) => !IGNORE.some((re) => re.test(l)));
  const checked = lines.filter((l) => key(l).length >= 6);
  const missing = checked.filter((l) => !hay.includes(key(l)));
  return { checked: checked.length, missing };
}

/** Leftovers the converter should never produce. */
function lint(markdown) {
  const issues = [];
  const tags = markdown.match(/<(?!br>)\/?[a-z][a-z0-9]*[^>]*>/gi);
  if (tags) issues.push(`leftover HTML: ${[...new Set(tags)].slice(0, 5).join(' ')}`);
  if (/\*{4,}/.test(markdown)) issues.push('nested bold (****)');
  // Emphasis that markdown-it fails to parse shows up as literal "**" / "*." in the rendered text.
  const rendered = md.render(markdown).replace(/<[^>]+>/g, '');
  const stray = rendered.split('\n').filter((l) => /\*{2,}|(^|\s)\*[.,;:]/.test(l));
  for (const l of stray.slice(0, 3)) issues.push(`unrendered emphasis: ${l.trim().slice(0, 120)}`);
  if (/&(nbsp|amp|lt|gt|quot|#\d+);/.test(markdown)) issues.push('HTML entities left in text');
  if (/^#{1,6}\s*$/m.test(markdown)) issues.push('empty heading');
  return issues;
}

module.exports = { coverage, lint };
