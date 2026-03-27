import { StatusBar } from 'expo-status-bar';
import {
  createContext,
  useContext,
  type PropsWithChildren,
} from 'react';

import { colors } from '../theme/colors';
import { spacing, radius } from '../theme/tokens';

export type AppTheme = {
  colors: {
    background: string;
    surface: string;
    surfaceMuted: string;
    text: string;
    textMuted: string;
    accent: string;
    accentText: string;
    border: string;
    error: string;
    errorMuted: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    pill: number;
  };
};

const defaultTheme: AppTheme = {
  colors,
  spacing,
  radius,
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
