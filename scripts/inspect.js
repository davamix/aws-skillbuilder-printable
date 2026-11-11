// Dev helper for analysing Skill Builder pages with the saved session.
//
//   npm run inspect -- <url>                 dump page to debug/inspect.*
//   npm run inspect -- <url> <steps.js>      run custom steps, then exit
//
// steps.js exports: async ({ page, context, dump, course }) => { ... }
// `dump(name)` writes debug/<name>.html|.txt|.png (scripts stripped).
const path = require('path');
const { loadCourse, launch, sessionContext, isAuthUrl, dumpPage } = require('../src/lib');

(async () => {
  const [url, stepsFile] = process.argv.slice(2);
  const course = loadCourse(process.env.COURSE);
  const browser = await launch({ headless: process.env.HEADED !== '1' });
  const context = await sessionContext(browser);
  const page = await context.newPage();
  await page.goto(url || course.url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  if (isAuthUrl(page.url())) {
    console.log('Session expired — run `npm run login`.');
    process.exit(3);
  }
  const dump = (name, opts) => dumpPage(page, name, opts);
  if (stepsFile) {
    await require(path.resolve(stepsFile))({ page, context, dump, course });
  } else {
    await page.waitForTimeout(3000);
    console.log('Saved', await dump('inspect'));
  }
  await browser.close();
})().catch((err) => { console.error(err); process.exit(1); });
