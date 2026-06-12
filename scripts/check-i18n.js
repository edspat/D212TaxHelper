const fs = require('fs');
const path = require('path');

const en = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'locales', 'en.json'), 'utf8'));
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');

const keys = new Set();

// data-i18n from HTML
const r1 = /data-i18n="([^"]+)"/g;
let m1;
while ((m1 = r1.exec(html)) !== null) keys.add(m1[1]);

// I18n.t('key') from JS
const r2 = /I18n\.t\('([^']+)'/g;
let m2;
while ((m2 = r2.exec(js)) !== null) keys.add(m2[1]);

function resolve(obj, p) {
  const parts = p.split('.');
  let v = obj;
  for (const k of parts) {
    if (!v || typeof v !== 'object') return undefined;
    v = v[k];
  }
  return v;
}

const missing = [];
for (const k of keys) {
  // Skip dynamic prefixes like 'import.manualFieldLabels.' + variable -
  // those are not real keys.
  if (k.endsWith('.')) continue;
  if (resolve(en, k) === undefined) missing.push(k);
}

console.log('Total i18n keys used:', keys.size);
console.log('Missing in EN locale (' + missing.length + '):');
missing.forEach(k => console.log('  ' + k));
