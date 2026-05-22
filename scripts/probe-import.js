// Probe the Import subtab "existing imports" panel. One-shot debug script.
'use strict';

const wsUrl = process.argv[2];
if (!wsUrl) { console.error('usage: node scripts/probe-import.js <ws-url>'); process.exit(2); }

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
  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });

  // Wait for appData to load + initial render (up to 8s).
  for (let i = 0; i < 16; i++) {
    await new Promise(r => setTimeout(r, 500));
    const r = await send('Runtime.evaluate', {
      expression: `JSON.stringify({yearsLoaded: !!(window.appData && Object.keys(window.appData.years || {}).length)})`,
      returnByValue: true,
    });
    if (JSON.parse(r.result.result.value).yearsLoaded) break;
  }

  // Click Date tab (group), then Import subtab.
  await send('Runtime.evaluate', { expression: `document.querySelector('[data-tab="data"]').click();` });
  await new Promise(r => setTimeout(r, 500));
  await send('Runtime.evaluate', { expression: `document.querySelector('.subtab-btn[data-subtab="import"]').click();` });
  await new Promise(r => setTimeout(r, 700));

  const r = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      activeTab: document.querySelector('.tab-content.active').id,
      panelVisible: document.getElementById('import-existing-panel').style.display !== 'none',
      panelText: document.getElementById('import-existing-panel').textContent.trim().substring(0, 400),
      rowCount: document.querySelectorAll('#import-existing-panel table tr').length,
      buttonsRaw: document.querySelectorAll('#import-existing-panel .import-action-raw').length,
      buttonsReimport: document.querySelectorAll('#import-existing-panel .import-action-reimport').length,
      buttonsDelete: document.querySelectorAll('#import-existing-panel .import-action-delete').length,
    })`,
    returnByValue: true,
  });
  console.log('IMPORT PANEL:', r.result.result.value);

  process.exit(0);
});

ws.addEventListener('error', e => { console.error('WS error:', e.message || e); process.exit(1); });
