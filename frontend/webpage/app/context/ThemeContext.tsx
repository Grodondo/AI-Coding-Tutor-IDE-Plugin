import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      // Check if theme is stored in localStorage
      const savedTheme = localStorage.getItem('theme') as Theme;
      // Check system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return savedTheme || (systemPrefersDark ? 'dark' : 'light');
    }
    // Default to light theme during server-side rendering
    return 'light';
  });

  useEffect(() => {
    // Only run in browser environment
    if (typeof window !== 'undefined') {
      // Update localStorage when theme changes
      localStorage.setItem('theme', theme);
      // Update document class for Tailwind dark mode
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 