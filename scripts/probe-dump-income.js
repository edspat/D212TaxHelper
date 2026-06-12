// Dump Income Details (Detalii Venituri) tab.
'use strict';
const wsUrl = process.argv[2];
const ws = new WebSocket(wsUrl);
let nextId = 1; const pending = {};
const send = (m, p) => new Promise(r => { const id = nextId++; pending[id] = r; ws.send(JSON.stringify({ id, method: m, params: p || {} })); });
ws.addEventListener('message', e => { const m = JSON.parse(e.data.toString()); if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; } });
ws.addEventListener('open', async () => {
  await send('Runtime.enable'); await send('Page.enable'); await send('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 4000));
  await send('Runtime.evaluate', {
    expression: `(async () => {
      document.querySelector('[data-tab="calc"]').click();
      await new Promise(r => setTimeout(r, 300));
      document.querySelector('.subtab-btn[data-subtab="income"]').click();
      await new Promise(r => setTimeout(r, 500));
    })()`,
    awaitPromise: true,
  });
  const r = await send('Runtime.evaluate', {
    expression: `document.getElementById('tab-income').innerText.replace(/\\s+/g, ' ').substring(0, 4000)`,
    returnByValue: true,
  });
  console.log('--- INCOME TAB TEXT ---');
  console.log(r.result.result.value);
  process.exit(0);
});
