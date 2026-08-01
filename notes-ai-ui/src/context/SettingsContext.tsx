import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface SettingsState {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  setTheme: (t: 'dark' | 'light') => void;
  groqKeyValid: boolean | null;
  assemblyKeyValid: boolean | null;
  checkKeys: () => Promise<void>;
}

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme') as 'dark' | 'light' | null;
      if (saved) return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });
  const [groqKeyValid, setGroqKeyValid] = useState<boolean | null>(null);
  const [assemblyKeyValid, setAssemblyKeyValid] = useState<boolean | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => setThemeState(t => t === 'dark' ? 'light' : 'dark'), []);
  const setTheme = useCallback((t: 'dark' | 'light') => setThemeState(t), []);

  const checkKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data.groq !== undefined) setGroqKeyValid(data.groq);
      if (data.assembly !== undefined) setAssemblyKeyValid(data.assembly);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { checkKeys(); }, [checkKeys]);

  return (
    <SettingsContext.Provider value={{ theme, toggleTheme, setTheme, groqKeyValid, assemblyKeyValid, checkKeys }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}