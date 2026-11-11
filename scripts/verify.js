// Checks the saved session still works (headless). Exit code 3 = expired.
// Usage: npm run verify [-- <course-slug>]
const { loadCourse, launch, sessionContext, isAuthUrl, dumpPage } = require('../src/lib');

(async () => {
  const course = loadCourse(process.argv[2]);
  const browser = await launch();
  const context = await sessionContext(browser);
  const page = await context.newPage();
  await page.goto(course.url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const url = page.url();
  const signInVisible = await page.getByRole('button', { name: /^sign in$/i }).or(page.getByRole('link', { name: /^sign in$/i }))
    .first().isVisible().catch(() => false);
  await dumpPage(page, 'verify');
  console.log('Final URL host/path:', new URL(url).host + new URL(url).pathname);
  console.log('Title:', await page.title());
  const ok = !isAuthUrl(url) && !signInVisible;
  console.log(ok ? 'RESULT: LOGGED_IN' : 'RESULT: NOT_LOGGED_IN (run `npm run login`)');
  await browser.close();
  process.exit(ok ? 0 : 3);
})().catch((err) => { console.error(err.message); process.exit(1); });
