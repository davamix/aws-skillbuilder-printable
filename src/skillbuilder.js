// Navigation of the Skill Builder course pages (outline -> module player).
//
// Outline page  : https://skillbuilder.aws/learn/<id>/<slug>/<productId>
//   - left stepper: [data-testid=stepLabel] "Module N - Title", status in [data-testid=stepEyebrowDescription]
//   - every module's detail panel is in the DOM (hidden until selected): an <h2> with the
//     module label, a Start / Resume / Review button, and [data-testid=moduleSection] blocks.
// Module player : https://skillbuilder.aws/renderer/?module_id=…  (same tab)
//   - content in iframe#renderer_iframe -> https://skillbuilder.aws/cds/CONTENT_<id>_<ver>/index.html
//   - that iframe loads the whole module as course.json (our content source)
//   - #focus_rm_button switches to reader mode (all lessons on one page; used for the coverage check)
const { isAuthUrl } = require('./lib');

const ACTION_BUTTON = /^(Start|Resume|Review)$/;
const COURSE_JSON = /\/cds\/(CONTENT_[^/]+)\/course\.json(\?|$)/;

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function openOutline(page, course) {
  await page.goto(course.url, { waitUntil: 'domcontentloaded' });
  if (isAuthUrl(page.url())) throw Object.assign(new Error('Session expired — run `npm run login`.'), { code: 'SESSION' });
  // Cookie banner: keep only essential cookies.
  await page.getByRole('button', { name: 'Decline' }).first().click({ timeout: 5000 }).catch(() => {});
  await page.getByTestId('stepLabel').first().waitFor({ timeout: 30000 });
}

/** Read the module list and each module's sections/lessons from the outline page. */
async function readOutline(page) {
  return page.evaluate(() => {
    const steps = [...document.querySelectorAll('[data-testid="stepLabel"]')].map((el) => {
      let box = el;
      while (box && !box.querySelector('[data-testid="stepEyebrowDescription"]')) box = box.parentElement;
      return {
        label: el.innerText.trim(),
        status: box?.querySelector('[data-testid="stepEyebrowDescription"]')?.innerText.trim() || '',
      };
    });
    const panels = {};
    for (const h2 of document.querySelectorAll('h2')) {
      const label = h2.innerText.trim();
      let box = h2;
      while (box && !box.querySelector('[data-testid="moduleSection"]')) box = box.parentElement;
      if (!box) continue;
      panels[label] = [...box.querySelectorAll('[data-testid="moduleSection"]')].map((s) => ({
        title: s.querySelector('h3')?.innerText.trim() || '',
        items: [...s.querySelectorAll('p')].map((p) => p.innerText.trim()).filter(Boolean),
      }));
    }
    return steps.map((s) => {
      const m = s.label.match(/^Module\s+(\d+)\s*-\s*(.*)$/);
      return { number: m ? Number(m[1]) : null, title: m ? m[2] : s.label, ...s, sections: panels[s.label] || [] };
    });
  });
}

/**
 * Open module N from the outline page and capture its course.json.
 * @returns {{ label, contentId, course }}
 */
async function openModule(page, number) {
  const step = page.getByTestId('stepLabel').filter({ hasText: new RegExp(`^Module ${number} - `) });
  if ((await step.count()) !== 1) throw new Error(`Module ${number} not found in the outline`);
  const label = (await step.innerText()).trim();
  await step.click();

  const heading = page.locator('h2:visible').filter({ hasText: new RegExp(`^${escapeRe(label)}$`) });
  const button = heading.locator('xpath=ancestor::*[.//button][1]').locator('button').filter({ hasText: ACTION_BUTTON });
  await button.first().waitFor({ state: 'visible', timeout: 15000 });
  const action = (await button.first().innerText()).trim();

  const courseResponse = page.waitForResponse((r) => COURSE_JSON.test(r.url()) && r.ok(), { timeout: 90000 });
  await button.first().click();
  const res = await courseResponse;
  const course = await res.json();
  const contentId = res.url().match(COURSE_JSON)[1];
  if (!new RegExp(`^Module\\s*${number}\\b`, 'i').test(course.title || '')) {
    console.warn(`  ! course.json title "${course.title}" does not look like Module ${number}`);
  }
  return { label, action, contentId, course };
}

/** Switch the player to reader mode and return the visible text without videos/transcripts. */
async function readReaderText(page) {
  await page.frameLocator('#renderer_iframe').locator('#focus_rm_button').click({ timeout: 60000 });
  const frame = page.frames().find((f) => /\/cds\/CONTENT_/.test(f.url()));
  if (!frame) throw new Error('Content iframe not found');
  await frame.waitForSelector('#MainDivUR', { timeout: 30000 });
  // Scroll through once so anything lazy gets rendered.
  await frame.evaluate(async () => {
    const el = document.scrollingElement;
    for (let y = 0; y < el.scrollHeight; y += 800) { el.scrollTop = y; await new Promise((r) => setTimeout(r, 60)); }
    el.scrollTop = 0;
  });
  const text = await frame.evaluate(() => {
    document.querySelectorAll('.SideTranscript, [aria-label="video and transcript"], video').forEach((e) => e.remove());
    return (document.querySelector('#MainDivUR') || document.body).innerText;
  });
  // Leave the player as we found it.
  await frame.locator('button[aria-label="disable accessibility mode"]').click({ timeout: 5000 }).catch(() => {});
  return text;
}

module.exports = { openOutline, readOutline, openModule, readReaderText };
