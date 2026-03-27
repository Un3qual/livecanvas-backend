import { colors } from './colors';

/** Spacing scale in logical pixels. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/** Border radius presets. */
export const radius = {
  sm: 8,
  md: 14,
  lg: 24,
  pill: 999,
} as const;

/** Typography presets for use in StyleSheet.create. */
export const typography = {
  eyebrow: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  heading: {
    fontSize: 30,
    fontWeight: '700' as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
} as const;

/** Minimum touch-target size following Apple HIG. */
export const touchTarget = {
  min: 44,
} as const;

export { colors };
