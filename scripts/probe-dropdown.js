// Probe the document-type dropdown structure (optgroups + count per group).
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
  await new Promise(r => setTimeout(r, 4000));
  // Click Date → Import subtab.
  await send('Runtime.evaluate', {
    expression: `(async () => {
      document.querySelector('[data-tab="data"]').click();
      await new Promise(r => setTimeout(r, 300));
      document.querySelector('.subtab-btn[data-subtab="import"]').click();
      await new Promise(r => setTimeout(r, 500));
    })()`,
    awaitPromise: true,
  });
  const r = await send('Runtime.evaluate', {
    expression: `(function(){
      const sel = document.getElementById('upload-type');
      if (!sel) return 'no dropdown';
      const groups = Array.from(sel.querySelectorAll('optgroup')).map(g => ({
        label: g.label,
        options: Array.from(g.querySelectorAll('option')).map(o => o.textContent.trim().substring(0, 60))
      }));
      return JSON.stringify({groupCount: groups.length, groups});
    })()`,
    returnByValue: true,
  });
  console.log(r.result.result.value);
  process.exit(0);
});
