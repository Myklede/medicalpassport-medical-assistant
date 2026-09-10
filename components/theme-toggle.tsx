'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

const storageKey = 'medipass-theme';

function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function applyTheme(theme: Theme, persist = true) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  if (persist) {
    try { localStorage.setItem(storageKey, theme); } catch { /* Theme still works for this page. */ }
  }
  window.dispatchEvent(new CustomEvent('medipass-theme-change', { detail: theme }));
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme(currentTheme());
    const sync = () => setTheme(currentTheme());
    const syncStorage = (event: StorageEvent) => {
      if (event.key !== storageKey || (event.newValue !== 'light' && event.newValue !== 'dark')) return;
      applyTheme(event.newValue, false);
      setTheme(event.newValue);
    };
    window.addEventListener('medipass-theme-change', sync);
    window.addEventListener('storage', syncStorage);
    return () => {
      window.removeEventListener('medipass-theme-change', sync);
      window.removeEventListener('storage', syncStorage);
    };
  }, []);

  const next = theme === 'dark' ? 'light' : 'dark';
  const action = next === 'dark' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng';

  return (
    <button
      type="button"
      className="mp-theme-toggle"
      aria-label={action}
      aria-pressed={theme === 'dark'}
      title={action}
      data-annotation-ui
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
    >
      {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      <span>{theme === 'dark' ? 'Sáng' : 'Tối'}</span>
    </button>
  );
}
