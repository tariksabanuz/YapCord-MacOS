'use strict';

const assert = require('assert');
const { openSite } = require('./lib/site');

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(true); console.log('  ok   ' + name); }
  catch (e) { results.push(false); console.log('  FAIL ' + name + '\n       ' + String((e && e.stack) || e).split('\n').slice(0, 7).join('\n       ')); }
}

(async () => {
  const site = await openSite({ initial: { settings: { plugins: {} } } });
  const { page } = site;
  await page.goto('https://www.yapper.website/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.YapperMod && window.YapperMod.Store.isReady, null, { timeout: 15000 });
  const sleep = (ms) => page.waitForTimeout(ms);

  await page.evaluate(() => {
    document.querySelectorAll('body > *').forEach((n) => { n.style.display = 'none'; });
    const questionBlock = (n) => `<div>
        <input placeholder="Question, e.g. What are you here for?">
        <button>Remove</button>
        <label><input type="checkbox"> PEOPLE CAN PICK MORE THAN ONE</label>
        <div><span>🙂</span><input placeholder="Answer"><button>✕</button><div>Gives: <button>OG</button></div></div>
        <div><span>🙂</span><input placeholder="Answer"><button>✕</button><div>Gives: <button>OG</button></div></div>
        <button>Add answer</button>
      </div>`;
    const app = document.createElement('div');
    app.id = 'fxob';
    app.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:900px;z-index:10;background:#111';
    app.innerHTML = `<div id="page">
      <h2>Onboarding</h2>
      <p>New members answer a few questions when they join.</p>
      <div><div>Turn on onboarding</div><input type="checkbox" checked></div>
      <div><div>Must finish before chatting</div><input type="checkbox" checked></div>
      <div>STARTING CHANNEL</div>
      <select><option># welcome</option></select>
      <p>Where people land when they finish.</p>
      <div>QUESTIONS</div>
      ${questionBlock(1)}
      <button>Add question</button>
      <button id="savebtn">Save</button>
    </div>`;
    document.body.append(app);
  });
  await sleep(150);

  const page_ = () => page.evaluate(() => !!document.querySelector('.ym-ob-page'));
  const sectionLabels = () => page.evaluate(() => [...document.querySelectorAll('.ym-ob-section-label')].map((n) => n.textContent));
  const questionCount = () => page.evaluate(() => document.querySelectorAll('.ym-ob-question').length);
  const questionHead = (i) => page.evaluate((i) => { const q = document.querySelectorAll('.ym-ob-question')[i]; return q && q.querySelector('.ym-ob-q-head').textContent; }, i);
  const answerBoxCount = () => page.evaluate(() => document.querySelectorAll('.ym-ob-answer').length);
  const saveStillWorks = () => page.evaluate(() => { let clicked = false; document.getElementById('savebtn').addEventListener('click', () => { clicked = true; }); document.getElementById('savebtn').click(); return clicked; });
  const controlsIntact = () => page.evaluate(() => document.querySelectorAll('input, select, button').length);

  const before = await controlsIntact();

  await test('the page gets grouped into three labelled, numbered sections', async () => {
    assert.strictEqual(await page_(), true, 'page picked up the ym-ob-page marker');
    const labels = await sectionLabels();
    assert.strictEqual(labels.length, 3, 'exactly three sections: toggles, starting channel, questions');
    assert.ok(labels[0].includes('Turn it on'), labels[0]);
    assert.ok(labels[1].includes('Where people land'), labels[1]);
    assert.ok(labels[2].includes('Questions'), labels[2]);
  });

  await test('the question block gets a "Question 1" header and its own box', async () => {
    assert.strictEqual(await questionCount(), 1);
    assert.strictEqual(await questionHead(0), 'Question 1');
  });

  await test('each answer row gets boxed off on its own', async () => {
    assert.strictEqual(await answerBoxCount(), 2, 'both answer rows in the one question got the answer-box class');
  });

  await test('every real control (inputs, the checkbox, the dropdown, every button) is untouched - nothing was rebuilt, only wrapped', async () => {
    const after = await controlsIntact();
    assert.strictEqual(after, before, 'no control gained or lost in the restyle');
    assert.strictEqual(await saveStillWorks(), true, 'the real Save button still fires its own click handler');
  });

  await test('adding a second question gets numbered "Question 2" on the next pass', async () => {
    await page.evaluate(() => {
      const addQBtn = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Add question');
      const q2 = document.createElement('div');
      q2.innerHTML = `<input placeholder="Question"><button>Remove</button><label><input type="checkbox"> PEOPLE CAN PICK MORE THAN ONE</label>
        <div><span>🙂</span><input placeholder="Answer"><button>✕</button></div><button>Add answer</button>`;
      addQBtn.before(q2);
      window.YapperMod.messages && window.YapperMod.messages.refresh && window.YapperMod.messages.refresh();
    });

    await sleep(150);
    assert.strictEqual(await questionCount(), 2);
    assert.strictEqual(await questionHead(1), 'Question 2');
  });

  const fail = results.filter((r) => !r).length;
  console.log(`\n${results.length - fail}/${results.length} passed`);
  await site.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
