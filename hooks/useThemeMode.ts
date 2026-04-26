'use client';
import { useState, useEffect } from 'react';

export function useThemeMode() {
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 0);
  }, []);

  useEffect(() => {
    if (mounted) {
      const saved = localStorage.getItem('muneri-theme') as 'dark' | 'light';
      if (saved && saved !== themeMode) {
        setTimeout(() => setThemeMode(saved), 0);
      }
    }
  }, [mounted, themeMode]);

  const toggleThemeMode = () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    localStorage.setItem('muneri-theme', next);
  };

  return { themeMode, toggleThemeMode, mounted };
}
