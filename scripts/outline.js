// Lists the course modules (with status and lessons) and saves build/<course>/outline.json.
// Usage: npm run outline [-- --course <slug>] [-- --verbose]
const fs = require('fs');
const path = require('path');
const { loadCourse, launch, sessionContext, saveSession, courseBuildDir } = require('../src/lib');
const { openOutline, readOutline } = require('../src/skillbuilder');
const { parseArgs } = require('../src/args');

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const course = loadCourse(args.course);
  const browser = await launch();
  const context = await sessionContext(browser);
  const page = await context.newPage();
  try {
    await openOutline(page, course);
    const modules = await readOutline(page);
    const file = path.join(courseBuildDir(course), 'outline.json');
    fs.writeFileSync(file, JSON.stringify({ course: course.name, url: course.url, readAt: new Date().toISOString(), modules }, null, 2));
    console.log(`${course.name}\n`);
    for (const m of modules) {
      console.log(`${m.number != null ? String(m.number).padStart(2) : '  '}  ${m.label.padEnd(70)} ${m.status}`);
      if (args.verbose) for (const s of m.sections) console.log(`      - ${s.title}: ${s.items.join(' · ')}`);
    }
    console.log(`\nSaved ${path.relative(process.cwd(), file)}`);
    await saveSession(context, page);
  } finally {
    await browser.close();
  }
})().catch((err) => { console.error(err.message); process.exit(err.code === 'SESSION' ? 3 : 1); });
