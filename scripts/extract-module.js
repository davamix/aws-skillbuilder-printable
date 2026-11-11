// Extracts modules from the course and saves the raw material to build/<course>/modules/:
//   NN.course.json  – the module content as served to the player (source for the Markdown)
//   NN.reader.txt   – reader-mode text without videos/transcripts (for the coverage check)
//   NN.meta.json    – label, content id/version, extraction time
//
// Usage: npm run extract -- <modules> [--course <slug>] [--no-reader]
//   <modules>: 1 | 1,3 | 2-5 | all
const fs = require('fs');
const path = require('path');
const { loadCourse, launch, sessionContext, saveSession, courseBuildDir, ensureDir } = require('../src/lib');
const { openOutline, readOutline, openModule, readReaderText } = require('../src/skillbuilder');
const { parseArgs, parseModuleList } = require('../src/args');

(async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args._.length) throw new Error('Which module(s)? e.g. `npm run extract -- 1` or `-- 2-5` or `-- all`');
  const course = loadCourse(args.course);
  const outDir = ensureDir(path.join(courseBuildDir(course), 'modules'));

  const browser = await launch();
  const context = await sessionContext(browser);
  const page = await context.newPage();
  try {
    await openOutline(page, course);
    const outline = await readOutline(page);
    const max = Math.max(...outline.map((m) => m.number || 0));
    const wanted = parseModuleList(args._, max);

    for (const n of wanted) {
      const nn = String(n).padStart(2, '0');
      process.stdout.write(`Module ${n}: `);
      if (n !== wanted[0]) await openOutline(page, course);
      const { label, action, contentId, course: json } = await openModule(page, n);
      fs.writeFileSync(path.join(outDir, `${nn}.course.json`), JSON.stringify(json, null, 2));
      process.stdout.write(`${json.title} (${contentId}, via "${action}")`);
      if (action === 'Start') process.stdout.write(' [module was not started; it now shows as started in your progress]');

      if (!args['no-reader']) {
        const text = await readReaderText(page);
        fs.writeFileSync(path.join(outDir, `${nn}.reader.txt`), text);
        process.stdout.write(`, reader text ${text.length} chars`);
      }
      fs.writeFileSync(path.join(outDir, `${nn}.meta.json`), JSON.stringify({
        number: n, label, title: json.title, contentId, extractedAt: new Date().toISOString(),
      }, null, 2));
      console.log(' ✓');
    }
    await saveSession(context, page);
    console.log(`\nSaved to ${path.relative(process.cwd(), outDir)}. Next: npm run build`);
  } finally {
    await browser.close();
  }
})().catch((err) => { console.error(`\n${err.message}`); process.exit(err.code === 'SESSION' ? 3 : 1); });
