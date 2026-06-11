'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'dark' | 'light';

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: 'dark', toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const saved = (localStorage.getItem('cfo-theme') as Theme) || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  function toggle() {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('cfo-theme', next);
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

export function useChartColors() {
  const { theme } = useTheme();
  return {
    tick:   theme === 'light' ? '#64748b' : '#555e73',
    grid:   theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)',
    legend: theme === 'light' ? '#64748b' : '#8b92a8',
  };
}
