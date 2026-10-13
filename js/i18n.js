/* =============================================================================
   MedicineBank Clinical Portal — Shared Bilingual Localization Engine (i18n)
   English / Arabic Dynamic Dictionary, RTL Directionality, and DOM Attribute Binder
   ============================================================================= */

(function (global, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    const exports = factory();
    Object.assign(global, exports);
    global.MBI_I18N = exports;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LANG_LS_KEY = 'mb_lang';

  const DICT = {
    // General & Navigation
    'brand_name': { en: 'MedicineBank', ar: 'بنك الطب' },
    'clinical_workstation': { en: 'Clinical Flashcards Workstation', ar: 'محطة البطاقات السريرية' },
    'curriculum_hub': { en: 'Curriculum Flashcards Explorer', ar: 'مستكشف مناهج البطاقات الطبية' },
    'deck_maker': { en: 'Flashcards Studio & Compiler', ar: 'استوديو بناء وتجميع البطاقات' },
    'back': { en: 'Back', ar: 'رجوع' },
    'language': { en: 'Language: English', ar: 'اللغة: عربي' },
    'theme': { en: 'Theme', ar: 'المظهر' },

    // Themes
    'theme_dark': { en: 'Dark', ar: 'داكن' },
    'theme_light': { en: 'Light', ar: 'فاتح' },
    'theme_maroon': { en: 'Maroon', ar: 'خمري' },
    'theme_blue': { en: 'Blue', ar: 'أزرق' },
    'theme_orange': { en: 'Orange', ar: 'برتقالي' },
    'theme_champagne': { en: 'Champagne', ar: 'شامبانيا' },
    'theme_brown': { en: 'Brown', ar: 'بني' },

    // Study & Actions
    'study': { en: 'Study', ar: 'دراسة' },
    'resume': { en: 'Resume', ar: 'استئناف' },
    'reveal_answer': { en: 'Show Answer', ar: 'إظهار الإجابة' },
    'rate_again': { en: 'Again', ar: 'إعادة' },
    'rate_hard': { en: 'Hard', ar: 'صعب' },
    'rate_good': { en: 'Good', ar: 'جيد' },
    'rate_easy': { en: 'Easy', ar: 'سهل' },
    'undo': { en: 'Undo', ar: 'تراجع' },
    'cram_mode': { en: 'All Cards', ar: 'كل البطاقات' },
    'due_cards': { en: 'Due', ar: 'مستحق' },
    'new_cards': { en: 'New', ar: 'جديد' },
    'total_cards': { en: 'Total', ar: 'المجموع' },

    // Search & Sorting
    'search_placeholder': { en: 'Search modules, lectures, decks, or notes...', ar: 'ابحث في الموديلات، المحاضرات، البطاقات...' },
    'sort_alpha': { en: 'Alphabetical', ar: 'أبجدي' },
    'sort_count': { en: 'Card Count', ar: 'عدد البطاقات' },
    'sort_date': { en: 'Upload Date', ar: 'تاريخ الإضافة' },

    // Admin & Status
    'admin_portal': { en: 'Admin Studio', ar: 'استوديو الإدارة' },
    'admin_unlocked': { en: 'Admin Unlocked', ar: 'وضع المشرف مفعّل' },
    'admin_locked': { en: 'Admin Locked', ar: 'وضع المشرف مغلق' },
    'upload_deck': { en: 'Upload .apkg', ar: 'رفع ملف .apkg' },
    'offline_ready': { en: 'Offline Vault Active', ar: 'المخزن غير المتصل نشط' }
  };

  function getStoredLang() {
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(LANG_LS_KEY);
        return (val === 'en' || val === 'ar') ? val : 'en';
      }
    } catch (e) {}
    return 'en';
  }

  function setStoredLang(lang) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LANG_LS_KEY, lang);
      }
    } catch (e) {}
  }

  function applyStaticText(lang) {
    if (typeof document === 'undefined') return;
    const isAr = lang === 'ar';

    document.querySelectorAll('[data-en]').forEach(el => {
      const text = isAr ? el.dataset.ar : el.dataset.en;
      if (text != null && text !== '') el.textContent = text;
    });

    document.querySelectorAll('[data-ph-en]').forEach(el => {
      const ph = isAr ? el.dataset.phAr : el.dataset.phEn;
      if (ph != null && ph !== '') el.setAttribute('placeholder', ph);
    });

    document.querySelectorAll('[data-title-en]').forEach(el => {
      const title = isAr ? el.dataset.titleAr : el.dataset.titleEn;
      if (title != null && title !== '') el.setAttribute('title', title);
    });
  }

  function setLang(lang, skipPersist) {
    const targetLang = (lang === 'ar') ? 'ar' : 'en';
    if (!skipPersist) setStoredLang(targetLang);

    if (typeof document !== 'undefined') {
      const htmlEl = document.documentElement;
      htmlEl.setAttribute('lang', targetLang);
      htmlEl.setAttribute('dir', targetLang === 'ar' ? 'rtl' : 'ltr');
      applyStaticText(targetLang);

      try {
        window.dispatchEvent(new CustomEvent('mbi-lang-changed', { detail: { lang: targetLang } }));
      } catch (e) {}
    }
    return targetLang;
  }

  function t(key, lang) {
    const current = lang || getStoredLang();
    if (DICT[key]) {
      return DICT[key][current] || DICT[key]['en'] || key;
    }
    return key;
  }

  return {
    LANG_LS_KEY,
    DICT,
    getStoredLang,
    setStoredLang,
    applyStaticText,
    setLang,
    t
  };
});
