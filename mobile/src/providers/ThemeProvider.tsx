import { StatusBar } from 'expo-status-bar';
import {
  createContext,
  useContext,
  type PropsWithChildren,
} from 'react';

export type AppTheme = {
  colors: {
    background: string;
    surface: string;
    surfaceMuted: string;
    text: string;
    textMuted: string;
    accent: string;
    border: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  radius: {
    md: number;
    lg: number;
    pill: number;
  };
};

const defaultTheme: AppTheme = {
  colors: {
    background: '#f4f7fb',
    surface: '#ffffff',
    surfaceMuted: '#e6eef8',
    text: '#112033',
    textMuted: '#5f7188',
    accent: '#2563eb',
    border: '#d7e1ee',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    md: 14,
    lg: 24,
    pill: 999,
  },
};

const ThemeContext = createContext<AppTheme>(defaultTheme);

export function ThemeProvider({ children }: PropsWithChildren) {
  return (
    <ThemeContext.Provider value={defaultTheme}>
      <StatusBar style="dark" />
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme(): AppTheme {
  return useContext(ThemeContext);
}
