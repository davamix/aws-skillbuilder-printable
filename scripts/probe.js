// Investigate an extracted module's course.json without writing ad-hoc code.
//
//   npm run probe -- <N> --find "<text>"   where a phrase lives (JSON path + block type)
//   npm run probe -- <N> --type <Type>     first block of that type (truncated JSON)
//   npm run probe -- <N> --types           block type counts
// Options: --course <slug>, --all (every match for --type), --max <chars> (default 2500)
const fs = require('fs');
const path = require('path');
const { loadCourse, BUILD_DIR } = require('../src/lib');
const { parseArgs } = require('../src/args');

const args = parseArgs(process.argv.slice(2));
const n = args._[0];
if (!n) throw new Error('Usage: npm run probe -- <module number> --find "<text>" | --type <Type> | --types');
const course = loadCourse(args.course);
const file = path.join(BUILD_DIR, course.slug, 'modules', `${String(n).padStart(2, '0')}.course.json`);
if (!fs.existsSync(file)) throw new Error(`Module ${n} not extracted (${path.relative(process.cwd(), file)} missing)`);
const json = JSON.parse(fs.readFileSync(file, 'utf8'));
const max = Number(args.max || 2500);

// Walk every value with a readable path such as sections[2].lessons[0].topics[0].blocks[7]<Carousel>.slides[1].image<Image>.alt
function walk(o, p, visit) {
  if (Array.isArray(o)) return o.forEach((v, i) => walk(v, `${p}[${i}]`, visit));
  if (o && typeof o === 'object') {
    const here = o.type ? `${p}<${o.type}>` : p;
    visit(o, here);
    for (const [k, v] of Object.entries(o)) if (k !== 'type') walk(v, `${here}.${k}`, visit);
  } else visit(o, p);
}

if (args.find) {
  const needle = String(args.find).toLowerCase().replace(/\s+/g, ' ');
  let hits = 0;
  walk(json, '', (v, p) => {
    if (typeof v !== 'string') return;
    const text = v.replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ');
    const i = text.toLowerCase().indexOf(needle);
    if (i >= 0) { hits++; console.log(`${p}\n    …${text.slice(Math.max(0, i - 60), i + needle.length + 80)}…`); }
  });
  if (!hits) console.log('no match');
} else if (args.types) {
  const counts = {};
  walk(json, '', (v) => { if (v && typeof v === 'object' && v.type) counts[v.type] = (counts[v.type] || 0) + 1; });
  console.log(counts);
} else if (args.type) {
  let shown = 0;
  walk(json, '', (v, p) => {
    if (!v || typeof v !== 'object' || v.type !== args.type || (shown && !args.all)) return;
    shown++;
    console.log(`${p}\n${JSON.stringify(v, null, 1).slice(0, max)}\n`);
  });
  if (!shown) console.log(`no block of type ${args.type}`);
} else {
  throw new Error('Pass --find "<text>", --type <Type> or --types');
}
