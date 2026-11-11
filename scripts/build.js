// Builds the printable course from the extracted modules (offline, no browser session needed):
//   output/<Course name>/Markdown/<Course name>.md
//   output/<Course name>/PDF/<Course name>.pdf
// Also runs the coverage check for each module against its reader-mode text.
//
// Usage: npm run build [-- --course <slug>] [--no-pdf]
const fs = require('fs');
const path = require('path');
const { loadCourse, courseBuildDir, ensureDir, safeName, OUTPUT_DIR } = require('../src/lib');
const { convertModule } = require('../src/convert');
const { coverage } = require('../src/check');
const { slugify, writePdf } = require('../src/pdf');
const { parseArgs } = require('../src/args');

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const course = loadCourse(args.course);
  const modDir = path.join(courseBuildDir(course), 'modules');
  const files = fs.existsSync(modDir) ? fs.readdirSync(modDir).filter((f) => /^\d+\.course\.json$/.test(f)).sort() : [];
  if (!files.length) throw new Error('No extracted modules. Run `npm run extract -- <module>` first.');

  const modules = [];
  let problems = 0;
  for (const f of files) {
    const nn = f.slice(0, 2);
    const json = JSON.parse(fs.readFileSync(path.join(modDir, f), 'utf8'));
    const { markdown, warnings, stats } = convertModule(json, { level: 2 });
    fs.writeFileSync(path.join(modDir, `${nn}.md`), markdown);

    const readerFile = path.join(modDir, `${nn}.reader.txt`);
    const cov = fs.existsSync(readerFile) ? coverage(fs.readFileSync(readerFile, 'utf8'), markdown) : null;
    const skipped = ['Video', 'Image'].map((t) => stats[t] && `${stats[t]} ${t.toLowerCase()}${stats[t] > 1 ? 's' : ''}`).filter(Boolean).join(', ');
    console.log(`${json.title}: ${Object.entries(stats).map(([k, v]) => `${k}×${v}`).join(' ')}${skipped ? ` (skipped ${skipped})` : ''}`);
    for (const w of warnings) { console.log(`  ! ${w}`); problems++; }
    if (cov) {
      console.log(`  coverage: ${cov.checked - cov.missing.length}/${cov.checked} reader-mode lines found`);
      for (const m of cov.missing) { console.log(`  ! missing: ${m.slice(0, 140)}`); problems++; }
    } else console.log('  coverage: no reader text (extracted with --no-reader)');
    modules.push({ json, markdown });
  }

  const name = safeName(course.name);
  const date = new Date().toISOString().slice(0, 10);
  const toc = modules.map(({ json }) => {
    const sections = (json.sections || []).map((s) => `  - ${s.title.trim()}`).join('\n');
    return `- [${json.title.trim()}](#${slugify(json.title.trim())})\n${sections}`;
  }).join('\n');
  const doc = [
    `# ${course.name}`,
    `*Printable text-only edition generated from AWS Skill Builder on ${date}. Videos, transcripts and images are omitted. `
      + `Course content © Amazon Web Services, Inc. or its affiliates — for personal study only.*`,
    '## Contents',
    toc,
    ...modules.map((m) => m.markdown.trim()),
  ].join('\n\n') + '\n';

  const mdPath = path.join(ensureDir(path.join(OUTPUT_DIR, name, 'Markdown')), `${name}.md`);
  fs.writeFileSync(mdPath, doc);
  console.log(`\nMarkdown: ${path.relative(process.cwd(), mdPath)}`);

  if (!args['no-pdf']) {
    const pdfPath = path.join(ensureDir(path.join(OUTPUT_DIR, name, 'PDF')), `${name}.pdf`);
    await writePdf(doc, course.name, pdfPath);
    console.log(`PDF:      ${path.relative(process.cwd(), pdfPath)}`);
  }
  if (problems) console.log(`\n${problems} issue(s) to review above.`);
})().catch((err) => { console.error(err.message); process.exit(1); });
