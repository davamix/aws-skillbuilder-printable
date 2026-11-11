// Shared helpers: paths, browser/session handling, debug dumps.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const AUTH_DIR = path.join(ROOT, '.auth');
const AUTH_FILE = path.join(AUTH_DIR, 'skillbuilder-state.json');
const AUTH_META = path.join(AUTH_DIR, 'meta.json');
const DEBUG_DIR = path.join(ROOT, 'debug');
const BUILD_DIR = path.join(ROOT, 'build');
const OUTPUT_DIR = path.join(ROOT, 'output');
const COURSES_DIR = path.join(ROOT, 'courses');

// Real installed browser by default (fewer bot checks on the login page).
// Override with BROWSER_CHANNEL=chrome | msedge | chromium (bundled).
const CHANNEL = process.env.BROWSER_CHANNEL || 'msedge';

function loadCourse(slug) {
  const files = fs.readdirSync(COURSES_DIR).filter((f) => f.endsWith('.json'));
  if (!slug) {
    if (files.length !== 1) throw new Error(`Pass a course slug. Available: ${files.map((f) => f.replace('.json', '')).join(', ')}`);
    slug = files[0].replace('.json', '');
  }
  const file = path.join(COURSES_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) throw new Error(`Unknown course "${slug}" (no ${path.relative(ROOT, file)})`);
  return { slug, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
}

async function launch({ headless = true } = {}) {
  const opts = { headless, args: ['--disable-blink-features=AutomationControlled'] };
  if (CHANNEL !== 'chromium') opts.channel = CHANNEL;
  return chromium.launch(opts);
}

/** Browser context that reuses the saved session. Throws if there is none. */
async function sessionContext(browser, extra = {}) {
  if (!fs.existsSync(AUTH_FILE)) {
    throw new Error('No saved session. Run `npm run login` first.');
  }
  const meta = fs.existsSync(AUTH_META) ? JSON.parse(fs.readFileSync(AUTH_META, 'utf8')) : {};
  return browser.newContext({
    storageState: AUTH_FILE,
    userAgent: meta.userAgent, // same UA as the login, so the session looks consistent
    viewport: { width: 1440, height: 1000 },
    ...extra,
  });
}

/** True when the browser was bounced to a sign-in page. */
function isAuthUrl(url) {
  const u = new URL(url);
  if (u.hostname !== 'skillbuilder.aws') return true;
  return /(^|\/)(login|signin|sign-in|auth|oauth)(\/|$)/i.test(u.pathname);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Save a page snapshot for analysis: HTML without scripts/styles (so no
 * tokens embedded in inline JSON), visible text, and a full-page screenshot.
 * Everything goes to debug/ which is git-ignored.
 */
async function dumpPage(target, name, { screenshot = true } = {}) {
  ensureDir(DEBUG_DIR);
  const base = path.join(DEBUG_DIR, name);
  const html = await target.evaluate(() => {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script, style, noscript, link, meta, template').forEach((n) => n.remove());
    clone.querySelectorAll('svg').forEach((n) => { n.innerHTML = ''; });
    clone.querySelectorAll('*').forEach((el) => {
      for (const a of [...el.attributes]) {
        if (a.name === 'style' || a.value.startsWith('data:') || a.value.length > 300) el.removeAttribute(a.name);
      }
    });
    return clone.outerHTML;
  });
  fs.writeFileSync(`${base}.html`, html);
  const text = await target.evaluate(() => document.body.innerText);
  fs.writeFileSync(`${base}.txt`, text);
  if (screenshot && target.screenshot) await target.screenshot({ path: `${base}.png`, fullPage: true });
  return base;
}

module.exports = {
  ROOT, AUTH_DIR, AUTH_FILE, AUTH_META, DEBUG_DIR, BUILD_DIR, OUTPUT_DIR, COURSES_DIR, CHANNEL,
  loadCourse, launch, sessionContext, isAuthUrl, ensureDir, dumpPage,
};
