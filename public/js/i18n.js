// i18n - Internationalization module
const I18n = (() => {
  let currentLang = localStorage.getItem('lang') || 'ro';
  let translations = {};

  async function loadLanguage(lang) {
    try {
      const resp = await fetch(`/locales/${lang}.json`);
      if (!resp.ok) throw new Error(`Failed to load ${lang}`);
      translations = await resp.json();
      currentLang = lang;
      localStorage.setItem('lang', lang);
      applyTranslations();
    } catch (err) {
      console.error('i18n load error:', err);
    }
  }

  function t(key, replacements) {
    const keys = key.split('.');
    let val = translations;
    for (const k of keys) {
      if (val && typeof val === 'object' && k in val) {
        val = val[k];
      } else {
        return key; // fallback to key
      }
    }
    if (typeof val === 'string' && replacements) {
      for (const [rk, rv] of Object.entries(replacements)) {
        val = val.replace(new RegExp(`\\{${rk}\\}`, 'g'), rv);
      }
    }
    return val;
  }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translated = t(key);
      if (translated !== key) {
        el.textContent = translated;
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const translated = t(key);
      if (translated !== key) {
        el.placeholder = translated;
      }
    });
    // <optgroup label="..."> elements don't have textContent — translate
    // via the `label` attribute when annotated with data-i18n-label.
    document.querySelectorAll('[data-i18n-label]').forEach(el => {
      const key = el.getAttribute('data-i18n-label');
      const translated = t(key);
      if (translated !== key) {
        el.label = translated;
      }
    });
  }

  function getLang() { return currentLang; }

  return { loadLanguage, t, applyTranslations, getLang };
})();
