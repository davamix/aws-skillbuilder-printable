// Builds the printable course from the extracted modules (offline, no browser session needed):
//   output/<Course name>/Markdown/<Course name>.md
//   output/<Course name>/PDF/<Course name>.pdf
// and checks the result: coverage against reader-mode text, Markdown lint,
// answer key completeness, PDF layout. Prints one line per healthy module and
// details only for problems ("!" lines). Full report: build/<course>/report.txt.
//
// Usage: npm run build [-- --course <slug>] [--no-pdf] [--verbose]
// Exit code: 0 = OK, 2 = built but issues to review, 1 = error.
const fs = require('fs');
const path = require('path');
const { loadCourse, courseBuildDir, ensureDir, safeName, OUTPUT_DIR } = require('../src/lib');
const { convertModule } = require('../src/convert');
const { coverage, lint } = require('../src/check');
const { slugify, writePdf } = require('../src/pdf');
const { checkPdf } = require('../src/pdfcheck');
const { parseArgs } = require('../src/args');

const MAX_LINES_PER_MODULE = 12; // console cap; report.txt has everything

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const course = loadCourse(args.course);
  const buildDir = courseBuildDir(course);
  const modDir = path.join(buildDir, 'modules');
  const files = fs.existsSync(modDir) ? fs.readdirSync(modDir).filter((f) => /^\d+\.course\.json$/.test(f)).sort() : [];
  if (!files.length) throw new Error('No extracted modules. Run `npm run module -- <N>` first.');

  const report = [];
  const out = (line, { console: show = true } = {}) => { report.push(line); if (show) console.log(line); };
  let issues = 0;
  const modules = [];

  for (const f of files) {
    const nn = f.slice(0, 2);
    const json = JSON.parse(fs.readFileSync(path.join(modDir, f), 'utf8'));
    const { markdown, warnings, stats } = convertModule(json, { level: 2 });
    fs.writeFileSync(path.join(modDir, `${nn}.md`), markdown);

    const problems = [];
    const counts = {};
    for (const w of warnings) counts[w] = (counts[w] || 0) + 1;
    for (const [w, c] of Object.entries(counts)) problems.push(`${w}${c > 1 ? ` (×${c})` : ''}`);
    for (const l of lint(markdown)) problems.push(l);
    const readerFile = path.join(modDir, `${nn}.reader.txt`);
    const cov = fs.existsSync(readerFile) ? coverage(fs.readFileSync(readerFile, 'utf8'), markdown) : null;
    if (cov) for (const m of cov.missing) problems.push(`missing: ${m.slice(0, 140)}`);

    const covText = cov ? `coverage ${cov.checked - cov.missing.length}/${cov.checked}` : 'coverage n/a (no reader text)';
    out(`${problems.length ? '✗' : '✓'} ${json.title} — ${covText}, ${stats.Question || 0} questions`);
    const statLine = `    blocks: ${Object.entries(stats).map(([k, v]) => `${k}×${v}`).join(' ')}`;
    out(statLine, { console: !!args.verbose });
    problems.forEach((p, i) => out(`    ! ${p}`, { console: i < MAX_LINES_PER_MODULE }));
    if (problems.length > MAX_LINES_PER_MODULE) console.log(`    … ${problems.length - MAX_LINES_PER_MODULE} more in build/${course.slug}/report.txt`);
    issues += problems.length;
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
  out(`Markdown: ${path.relative(process.cwd(), mdPath)}`);

  if (!args['no-pdf']) {
    const pdfPath = path.join(ensureDir(path.join(OUTPUT_DIR, name, 'PDF')), `${name}.pdf`);
    await writePdf(doc, course.name, pdfPath);
    const pdf = await checkPdf(fs.readFileSync(pdfPath), { footerText: course.name });
    const starts = pdf.modules.map((m) => `M${(m.title.match(/\d+/) || ['?'])[0]} p${m.page}`).join(', ');
    out(`PDF:      ${path.relative(process.cwd(), pdfPath)} — ${pdf.pages} pages (${starts})`);
    for (const m of pdf.modules) {
      out(`    ${m.title}: ${m.sections.map((s) => `${s.title} p${s.page}`).join(' · ')}`, { console: !!args.verbose });
    }
    for (const s of pdf.stranded) { out(`    ! "${s.label}" stranded at the bottom of page ${s.page}`); issues++; }
  }

  out(issues ? `RESULT: ${issues} issue(s) — see "!" lines` : 'RESULT: OK');
  fs.writeFileSync(path.join(buildDir, 'report.txt'), `${report.join('\n')}\n`);
  process.exit(issues ? 2 : 0);
})().catch((err) => { console.error(err.message); process.exit(1); });
