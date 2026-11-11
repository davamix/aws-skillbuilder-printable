// Opens a visible browser so YOU can sign in to AWS Skill Builder.
// The script never sees or stores your password: once you are signed in,
// click the green "Save session" button that appears on the page and only
// the resulting cookies/localStorage are written to .auth/ (git-ignored).
//
// Usage: npm run login [-- <course-slug>]
const fs = require('fs');
const { AUTH_DIR, AUTH_FILE, AUTH_META, CHANNEL, loadCourse, launch, ensureDir } = require('../src/lib');

const TIMEOUT_MS = 10 * 60 * 1000;

(async () => {
  const course = loadCourse(process.argv[2]);
  const browser = await launch({ headless: false });
  const context = await browser.newContext({ viewport: null });

  let onSave;
  const saveClicked = new Promise((resolve) => { onSave = resolve; });
  await context.exposeBinding('__sbpSaveSession', () => onSave());

  // Floating button, only on skillbuilder.aws itself (not on the sign-in pages).
  await context.addInitScript(() => {
    if (window !== window.top || location.hostname !== 'skillbuilder.aws') return;
    const add = () => {
      if (document.getElementById('__sbp_save')) return;
      const b = document.createElement('button');
      b.id = '__sbp_save';
      b.textContent = '✅ I am signed in — Save session';
      Object.assign(b.style, {
        position: 'fixed', right: '16px', bottom: '16px', zIndex: 2147483647,
        padding: '12px 18px', fontSize: '15px', fontWeight: '600', color: '#fff',
        background: '#1a7f37', border: 'none', borderRadius: '8px', cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(0,0,0,.3)',
      });
      b.onclick = () => { b.textContent = 'Saving…'; window.__sbpSaveSession(); };
      document.body.appendChild(b);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add);
    else add();
    setInterval(add, 1500); // SPA re-renders can drop it
  });

  const page = await context.newPage();
  await page.goto(course.url);
  console.log(`Browser: ${CHANNEL}`);
  console.log('Sign in to AWS Skill Builder in the browser window (complete MFA if asked).');
  console.log('When you can see the course outline, click the green "Save session" button.');

  const closed = new Promise((resolve) => browser.on('disconnected', () => resolve('closed')));
  const timeout = new Promise((resolve) => setTimeout(() => resolve('timeout'), TIMEOUT_MS));
  const result = await Promise.race([saveClicked.then(() => 'saved'), closed, timeout]);

  if (result !== 'saved') {
    console.log(`RESULT: NOT_SAVED (${result})`);
    if (result === 'timeout') await browser.close();
    process.exit(2);
  }

  await page.waitForTimeout(1500);
  ensureDir(AUTH_DIR);
  await context.storageState({ path: AUTH_FILE, indexedDB: true });
  const userAgent = await page.evaluate(() => navigator.userAgent);
  fs.writeFileSync(AUTH_META, JSON.stringify({ userAgent, channel: CHANNEL, savedAt: new Date().toISOString() }, null, 2));

  // Report only cookie names/domains — never values.
  const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  const byDomain = {};
  for (const c of state.cookies) (byDomain[c.domain] ||= []).push(c.name);
  console.log('Cookie names by domain:', JSON.stringify(byDomain));
  console.log('localStorage origins:', state.origins.map((o) => `${o.origin} (${o.localStorage.length} keys)`).join(', '));
  console.log('RESULT: SAVED');
  await browser.close();
})().catch((err) => { console.error(err); process.exit(1); });
