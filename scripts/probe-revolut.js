// One-shot probe: verify computeYearData(2025) result includes Revolut.
'use strict';

const wsUrl = process.argv[2];
if (!wsUrl) { console.error('usage: node scripts/probe-revolut.js <ws-url>'); process.exit(2); }

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
  if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; return; }
  if (m.method === 'Runtime.exceptionThrown') {
    const ex = m.params.exceptionDetails;
    console.error('[EXCEPTION]', ex.text, ex.exception && ex.exception.description);
  }
});

ws.addEventListener('open', async () => {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });

  // Wait for app to load + render.
  for (let i = 0; i < 16; i++) {
    await new Promise(r => setTimeout(r, 500));
    const r = await send('Runtime.evaluate', {
      expression: `JSON.stringify({yearsLoaded: !!(window.appData && window.appData.years && window.appData.years[2025])})`,
      returnByValue: true,
    });
    if (JSON.parse(r.result.result.value).yearsLoaded) break;
  }

  // Switch to 2025 + click Calcul → Tax Calculation subtab.
  await send('Runtime.evaluate', {
    expression: `(async () => {
      const sel = document.getElementById('year-select');
      if (sel) { sel.value = '2025'; sel.dispatchEvent(new Event('change')); }
      await new Promise(r => setTimeout(r, 800));
      document.querySelector('[data-tab="calc"]').click();
      await new Promise(r => setTimeout(r, 500));
      document.querySelector('.subtab-btn[data-subtab="taxes"]').click();
      await new Promise(r => setTimeout(r, 800));
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  // Read the cap14 table from the DOM. Look for "Germania" / "DE" + the
  // values we expect from the 2912.61 RON Revolut net gain.
  const r = await send('Runtime.evaluate', {
    expression: `(function(){
      const text = document.body.innerText;
      const cap14Visible = /Germania|cap14|2012/.test(text);
      // Look for the Revolut value (≈2913 RON gross net gain on cap14).
      const has2913 = /2[,.\u00A0\u202F]?913/.test(text) || /2,?912/.test(text);
      // Look for any 'DE' / 'Germania' label appearing alongside a 2012 categ_venit code in the tax block.
      const taxTabActive = document.getElementById('tab-taxes')?.classList?.contains('active');
      return JSON.stringify({ taxTabActive, cap14Visible, has2913 });
    })()`,
    returnByValue: true,
  });
  console.log('PROBE:', r.result.result.value);

  process.exit(0);
});

ws.addEventListener('error', e => { console.error('WS error:', e.message || e); process.exit(1); });
