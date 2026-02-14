(function() {
  function getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  function applyTheme(theme) {
    const resolvedTheme = theme === 'auto' ? getSystemTheme() : theme;
    
    document.documentElement.classList.remove('dark', 'theme-gray');
    
    if (resolvedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (resolvedTheme === 'gray') {
      document.documentElement.classList.add('theme-gray');
    }
    
    try {
      localStorage.setItem('pos_current_theme', resolvedTheme);
    } catch(_) {}
  }
  
  function cycleTheme() {
    try {
      const current = localStorage.getItem('pos_current_theme') || 'light';
      const themes = ['light', 'gray', 'dark'];
      const currentIndex = themes.indexOf(current);
      const nextIndex = (currentIndex + 1) % themes.length;
      const nextTheme = themes[nextIndex];
      
      applyTheme(nextTheme);
      
      localStorage.setItem('pos_settings_theme', JSON.stringify({ app_theme: nextTheme }));
      
      return nextTheme;
    } catch(_) {
      return 'light';
    }
  }

  async function loadThemeFromSettings() {
    try {
      const stored = localStorage.getItem('pos_settings_theme');
      if (stored) {
        const settings = JSON.parse(stored);
        applyTheme(settings.app_theme || 'light');
        return;
      }
    } catch(_) {}

    try {
      if (window.api && window.api.settings_get) {
        const r = await window.api.settings_get();
        if (r && r.ok && r.item) {
          const theme = r.item.app_theme || 'light';
          applyTheme(theme);
          localStorage.setItem('pos_settings_theme', JSON.stringify({ app_theme: theme }));
          return;
        }
      }
    } catch(_) {}

    applyTheme('light');
  }

  window.applyTheme = applyTheme;

  window.addEventListener('storage', (e) => {
    if (e.key === 'pos_settings_theme' && e.newValue) {
      try {
        const settings = JSON.parse(e.newValue);
        applyTheme(settings.app_theme || 'light');
      } catch(_) {}
    }
  });

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      try {
        const stored = localStorage.getItem('pos_settings_theme');
        if (stored) {
          const settings = JSON.parse(stored);
          if (settings.app_theme === 'auto') {
            applyTheme('auto');
          }
        }
      } catch(_) {}
    });
  }

  loadThemeFromSettings();
})();
