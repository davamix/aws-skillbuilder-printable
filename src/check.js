// Coverage check: every line the player shows in reader mode (videos and
// transcripts removed) must appear somewhere in the generated Markdown.
// Catches content dropped by the converter, e.g. a new component type.

// Player chrome / widget labels that are not course content.
const IGNORE = [
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
  const lines = readerText.split('\n').map((l) => l.trim()).filter(Boolean)
    .filter((l) => !IGNORE.some((re) => re.test(l)));
  const checked = lines.filter((l) => key(l).length >= 6);
  const missing = checked.filter((l) => !hay.includes(key(l)));
  return { checked: checked.length, missing };
}

module.exports = { coverage };
