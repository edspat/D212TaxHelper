// Dump the Calcul → Tax tab DOM text to see Revolut treatment.
'use strict';

const wsUrl = process.argv[2];
const ws = new WebSocket(wsUrl);
let nextId = 1;
const pending = {};
const send = (m, p) => new Promise(r => { const id = nextId++; pending[id] = r; ws.send(JSON.stringify({ id, method: m, params: p || {} })); });
ws.addEventListener('message', e => { const m = JSON.parse(e.data.toString()); if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; } });

ws.addEventListener('open', async () => {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });
  for (let i = 0; i < 16; i++) {
    await new Promise(r => setTimeout(r, 500));
    const r = await send('Runtime.evaluate', { expression: `!!(window.appData && window.appData.years && window.appData.years[2025])`, returnByValue: true });
    if (r.result.result.value) break;
  }
  await send('Runtime.evaluate', {
    expression: `(async () => {
      const sel = document.getElementById('year-select');
      if (sel) { sel.value = '2025'; sel.dispatchEvent(new Event('change')); }
      await new Promise(r => setTimeout(r, 800));
      document.querySelector('[data-tab="calc"]').click();
      await new Promise(r => setTimeout(r, 300));
      document.querySelector('.subtab-btn[data-subtab="taxes"]').click();
      await new Promise(r => setTimeout(r, 800));
    })()`,
    awaitPromise: true,
  });
  const r = await send('Runtime.evaluate', {
    expression: `document.getElementById('tab-taxes').innerText.replace(/\\s+/g, ' ').substring(0, 3500)`,
    returnByValue: true,
  });
  console.log('--- TAX TAB TEXT ---');
  console.log(r.result.result.value);
  process.exit(0);
});
