// Smoke-test the page via Edge / Chrome CDP. Prints any console errors,
// runtime exceptions, and a quick probe of the page state. Used one-shot
// for debugging Phase 3 integration; safe to delete.
//
// Uses the native `WebSocket` available since Node 22 — no extra deps.
const wsUrl = process.argv[2];
if (!wsUrl) {
  console.error('usage: node scripts/smoke-cdp.js <ws-url>');
  process.exit(2);
}

const ws = new WebSocket(wsUrl);
let nextId = 1;
const pending = {};
function send(method, params) {
  return new Promise(resolve => {
    const id = nextId++;
    pending[id] = resolve;
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}

ws.addEventListener('message', event => {
  const m = JSON.parse(event.data.toString());
  if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; return; }
  if (m.method === 'Runtime.consoleAPICalled') {
    const args = (m.params.args || []).map(a => a.value !== undefined ? a.value : (a.description || a.type));
    console.log('[console.' + m.params.type + ']', ...args);
  } else if (m.method === 'Runtime.exceptionThrown') {
    const ex = m.params.exceptionDetails;
    console.error('[EXCEPTION]', ex.text || '', ex.exception && ex.exception.description);
  } else if (m.method === 'Log.entryAdded') {
    const e = m.params.entry;
    console.log('[log.' + e.level + ']', e.text);
  }
});

ws.addEventListener('open', async () => {
  await send('Runtime.enable');
  await send('Log.enable');
  // Reload the page to capture all errors from a clean slate.
  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });
  await new Promise(r => setTimeout(r, 5000));
  const probe = await send('Runtime.evaluate', {
    expression: `(function(){
      try {
        var rows = document.querySelectorAll('#income-tbody tr').length;
        var has = !!window.IncomeResolvers;
        var hasSr = !!window.SourceResolver;
        var yearStored = null;
        try { yearStored = Object.keys((window.appData && window.appData.years) || {}); } catch(e) {}
        var data = null;
        try { data = computeYearData(selectedYear); } catch(e) { data = { _err: e.message + ' | ' + e.stack }; }
        return JSON.stringify({
          hasResolvers: has,
          hasSourceResolver: hasSr,
          incomeRows: rows,
          selectedYear: typeof selectedYear !== 'undefined' ? selectedYear : null,
          yearsInAppData: yearStored,
          form1042s: window.appData && window.appData.years && window.appData.years[selectedYear] && window.appData.years[selectedYear].form1042s,
          dividendsUSD: data && data.dividendsUSD,
          dividendsRON: data && data.dividendsRON,
          interestIncomeRON: data && data.interestIncomeRON,
          usForeignInterestRON: data && data.usForeignInterestRON,
          incomeError: data && data._err,
        });
      } catch (e) { return 'OUTER: ' + e.message + ' | ' + e.stack; }
    })()`,
    returnByValue: true,
  });
  console.log('PROBE:', probe.result && probe.result.result && probe.result.result.value);
  setTimeout(() => process.exit(0), 1500);
});

ws.addEventListener('error', e => { console.error('WS error:', e.message || e); process.exit(1); });
