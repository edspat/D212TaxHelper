// Probe the nav refactor: simulate clicks on each main tab and verify the
// sub-tab bar appears with the right buttons. One-shot debug script, safe
// to delete. Run via:
//   node scripts/probe-nav.js <ws-url>
'use strict';

const wsUrl = process.argv[2];
if (!wsUrl) { console.error('usage: node scripts/probe-nav.js <ws-url>'); process.exit(2); }

const ws = new WebSocket(wsUrl);
let nextId = 1;
const pending = {};
const send = (method, params) => new Promise(r => {
  const id = nextId++;
  pending[id] = r;
  ws.send(JSON.stringify({ id, method, params: params || {} }));
});

ws.addEventListener('message', e => {
  const m = JSON.parse(e.data.toString());
  if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
});

ws.addEventListener('open', async () => {
  await send('Runtime.enable');

  // Snapshot of the top-level nav.
  const nav = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      navButtons: Array.from(document.querySelectorAll('#main-nav .nav-btn[data-tab]')).map(b => ({
        tab: b.dataset.tab, label: b.textContent.trim(), active: b.classList.contains('active')
      }))
    })`,
    returnByValue: true,
  });
  console.log('NAV:', nav.result.result.value);

  // Click "Date" — expect sub-bar with 2 sub-buttons (input + import).
  await send('Runtime.evaluate', { expression: `document.querySelector('[data-tab="data"]').click();` });
  await new Promise(r => setTimeout(r, 500));
  const r2 = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      subBarVisible: document.getElementById('subtab-bar').style.display !== 'none',
      subBarButtons: Array.from(document.querySelectorAll('#subtab-bar .subtab-btn')).map(b => ({
        sub: b.dataset.subtab, label: b.textContent, active: b.classList.contains('active')
      })),
      activeTabSection: document.querySelector('.tab-content.active') && document.querySelector('.tab-content.active').id,
      activeNavBtn: document.querySelector('.nav-btn.active') && document.querySelector('.nav-btn.active').dataset.tab,
    })`,
    returnByValue: true,
  });
  console.log('CLICK Date:', r2.result.result.value);

  // Click "Depunere" — expect sub-bar with 2 sub-buttons (validate + submit).
  await send('Runtime.evaluate', { expression: `document.querySelector('[data-tab="depunere"]').click();` });
  await new Promise(r => setTimeout(r, 500));
  const r3 = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      subBarVisible: document.getElementById('subtab-bar').style.display !== 'none',
      subBarButtons: Array.from(document.querySelectorAll('#subtab-bar .subtab-btn')).map(b => ({sub: b.dataset.subtab, active: b.classList.contains('active')})),
      activeTabSection: document.querySelector('.tab-content.active').id,
    })`,
    returnByValue: true,
  });
  console.log('CLICK Depunere:', r3.result.result.value);

  // Click the second sub-button (Submit Guide) inside Depunere.
  await send('Runtime.evaluate', { expression: `document.querySelector('.subtab-btn[data-subtab="submit"]').click();` });
  await new Promise(r => setTimeout(r, 500));
  const r4 = await send('Runtime.evaluate', {
    expression: `JSON.stringify({activeTab: document.querySelector('.tab-content.active').id, activeSub: document.querySelector('.subtab-btn.active').dataset.subtab})`,
    returnByValue: true,
  });
  console.log('CLICK submit subtab:', r4.result.result.value);

  // Click "Avansat" — only 1 subtab so sub-bar should be HIDDEN (UX choice).
  await send('Runtime.evaluate', { expression: `document.querySelector('[data-tab="advanced"]').click();` });
  await new Promise(r => setTimeout(r, 500));
  const r5 = await send('Runtime.evaluate', {
    expression: `JSON.stringify({subBarVisible: document.getElementById('subtab-bar').style.display !== 'none', activeTab: document.querySelector('.tab-content.active').id})`,
    returnByValue: true,
  });
  console.log('CLICK Avansat:', r5.result.result.value);

  // Switch back to Dashboard — sub-bar hidden.
  await send('Runtime.evaluate', { expression: `document.querySelector('[data-tab="dashboard"]').click();` });
  await new Promise(r => setTimeout(r, 500));
  const r6 = await send('Runtime.evaluate', {
    expression: `JSON.stringify({subBarVisible: document.getElementById('subtab-bar').style.display !== 'none', activeTab: document.querySelector('.tab-content.active').id})`,
    returnByValue: true,
  });
  console.log('CLICK Dashboard:', r6.result.result.value);

  process.exit(0);
});

ws.addEventListener('error', e => { console.error('WS error:', e.message || e); process.exit(1); });
