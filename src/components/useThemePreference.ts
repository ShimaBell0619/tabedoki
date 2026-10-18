import { useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
const KEY = 'tabedoki-theme';

function storedPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function useThemePreference() {
  const [preference, setCurrent] = useState<ThemePreference>(storedPreference);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    function applyTheme() {
      const isDark = preference === 'dark' || (preference === 'system' && media.matches);
      const theme = isDark ? 'dark' : 'light';
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#0E1115' : '#354F70');
    }
    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [preference]);

  function setPreference(value: ThemePreference) {
    try {
      if (value === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, value);
    } catch {
      // Keep the session-level appearance even if storage is unavailable.
    }
    setCurrent(value);
  }

  return { preference, setPreference };
}
