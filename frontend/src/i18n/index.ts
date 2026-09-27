import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import rw from './locales/rw.json';
import fr from './locales/fr.json';
import sw from './locales/sw.json';
import ln from './locales/ln.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      rw: { translation: rw },
      fr: { translation: fr },
      sw: { translation: sw },
      ln: { translation: ln },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      // ?lang=rw first: the hreflang alternates in index.html (and shared
      // links) point at ?lang=…, so that URL must really show that language.
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lang',
      caches: ['localStorage'],
    },
  });

// Search engines read <html lang>; keep it in step with the visible language.
const syncHtmlLang = (lng: string) => { document.documentElement.lang = (lng || 'en').split('-')[0]; };
syncHtmlLang(i18n.language);
i18n.on('languageChanged', syncHtmlLang);

export default i18n;
