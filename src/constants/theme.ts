// WIF Finance Theme Constants
// Brand colors and design tokens - Japanese aesthetic inspired

export const BRAND = {
  // Primary Brand
  navy: '#1a2b4a',
  blue: '#0066cc',
  lightBlue: '#4d94ff',

  // Company Info
  name: 'WIF Finance',
  tagline: 'Financial Document Management',
} as const

// Japanese Aesthetic Theme for Login
export const JAPANESE_THEME = {
  // Light Mode - Warm Washi Paper Aesthetic
  light: {
    background: '#FAF8F5',
    backgroundSecondary: '#F5F2ED',
    surface: '#FFFFFF',
    text: '#1A1815',
    textSecondary: '#5C5650',
    textMuted: '#8C8680',
    placeholder: '#B5B0A8',
    gold: '#B8963F',
    goldHover: '#A6873A',
    border: '#E8E4DE',
    borderFocus: '#B8963F',
    inputBackground: '#FAF8F5',
    inputBackgroundFocus: '#FFFFFF',
    inputBorder: 'rgba(26, 24, 21, 0.1)',
    inputFocusGlow: 'rgba(184, 150, 63, 0.15)',
    error: '#C45C5C',
    success: '#5C8A5C',
    // Sign In button - Dark gradient in light mode
    buttonGradientStart: '#1A1815',
    buttonGradientEnd: '#2A2825',
    buttonText: '#F5F4F0',
    buttonShadow: 'rgba(26, 24, 21, 0.2)',
    // Logo circle - Dark in light mode
    logoGradientStart: '#1A1815',
    logoGradientEnd: '#2A2825',
    logoText: '#F5F4F0',
    logoShadow: 'rgba(26, 24, 21, 0.2)',
  },

  // Dark Mode - Refined Ink Aesthetic
  dark: {
    background: '#0D0D0F',
    backgroundSecondary: '#1A1A1D',
    surface: '#1E1E21',
    text: '#F5F4F0',
    textSecondary: '#A8A5A0',
    textMuted: '#6B6965',
    placeholder: '#6B6965',
    gold: '#C9A962',
    goldHover: '#D4B872',
    border: 'rgba(245, 244, 240, 0.1)',
    borderFocus: '#C9A962',
    inputBackground: '#FAF8F5',
    inputBackgroundFocus: '#FFFFFF',
    inputBorder: 'rgba(245, 244, 240, 0.1)',
    inputFocusGlow: 'rgba(184, 150, 63, 0.15)',
    error: '#D47777',
    success: '#77B077',
    // Sign In button - Gold gradient in dark mode
    buttonGradientStart: '#C9A962',
    buttonGradientEnd: '#A88A4D',
    buttonText: '#1A1815',
    buttonShadow: 'rgba(201, 169, 98, 0.25)',
    // Logo circle - Gold in dark mode
    logoGradientStart: '#C9A962',
    logoGradientEnd: '#A88A4D',
    logoText: '#1A1815',
    logoShadow: 'rgba(201, 169, 98, 0.2)',
  },
} as const

/**
 * App-wide Design System - Japanese Aesthetic
 * Based on screens-light.html and screens-dark.html designs
 *
 * Inspired by:
 * 墨 (sumi) - ink black
 * 藍 (ai) - indigo
 * 朱 (shu) - vermillion
 * 金 (kin) - gold
 * 翠 (sui) - jade
 * 和紙 (washi) - paper white
 */
export const APP_THEME = {
  // Light Mode - Warm Washi Paper Aesthetic
  light: {
    // Backgrounds
    bgPrimary: '#FAF8F5',
    bgSecondary: '#F5F2ED',
    bgCard: '#FFFFFF',
    bgCardHover: '#FDFCFA',
    bgElevated: '#FFFFFF',
    bgInset: '#F0EDE8',

    // Text hierarchy
    textPrimary: '#1A1815',
    textSecondary: '#5C5650',
    textMuted: '#8C8680',
    textFaint: '#B5B0A8',

    // Accent colors - slightly muted for light mode
    vermillion: '#C75B4A',
    vermillionSoft: 'rgba(199, 91, 74, 0.1)',
    vermillionBg: '#FDF5F4',

    gold: '#B8963F',
    goldSoft: 'rgba(184, 150, 63, 0.1)',
    goldBg: '#FBF8F0',

    indigo: '#4A5A7A',
    indigoSoft: 'rgba(74, 90, 122, 0.1)',
    indigoBg: '#F4F6F9',

    jade: '#4A7A5A',
    jadeSoft: 'rgba(74, 122, 90, 0.08)',
    jadeBg: '#F3F8F5',

    // Borders
    borderSubtle: 'rgba(26, 24, 21, 0.06)',
    borderMedium: 'rgba(26, 24, 21, 0.1)',
    borderStrong: 'rgba(26, 24, 21, 0.15)',

    // Semantic
    positive: '#4A7A5A',
    negative: '#C75B4A',
    pending: '#B8963F',

    // Tab bar active color
    tabActive: '#C75B4A', // vermillion in light mode

    // Gradients for icons
    invoiceGradient: ['#C75B4A', '#B04A3D'],
    receiptGradient: ['#B8963F', '#9A7A30'],
    voucherGradient: ['#4A7A5A', '#3A6A4A'],
    statementGradient: ['#4A5A7A', '#3A4A65'],

    // Additional semantic colors for forms
    error: '#C75B4A',
    success: '#4A7A5A',
    warning: '#B8963F',
    blue: '#4A5A7A',
  },

  // Dark Mode - Refined Ink Aesthetic
  dark: {
    // Backgrounds
    bgPrimary: '#0D0D0F',
    bgSecondary: '#141417',
    bgCard: '#1A1A1E',
    bgCardHover: '#1F1F24',
    bgElevated: '#222228',
    bgInset: '#141417',

    // Text hierarchy
    textPrimary: '#F5F4F0',
    textSecondary: '#A8A5A0',
    textMuted: '#6B6965',
    textFaint: '#454540',

    // Accent colors - brighter for dark mode
    vermillion: '#C75B4A',
    vermillionSoft: 'rgba(199, 91, 74, 0.15)',
    vermillionBg: 'rgba(199, 91, 74, 0.12)',

    gold: '#C9A962',
    goldSoft: 'rgba(201, 169, 98, 0.12)',
    goldBg: 'rgba(201, 169, 98, 0.1)',

    indigo: '#5B6B8C',
    indigoSoft: 'rgba(91, 107, 140, 0.15)',
    indigoBg: 'rgba(91, 107, 140, 0.12)',

    jade: '#6B8C7A',
    jadeSoft: 'rgba(107, 140, 122, 0.15)',
    jadeBg: 'rgba(107, 140, 122, 0.12)',

    // Borders
    borderSubtle: 'rgba(245, 244, 240, 0.06)',
    borderMedium: 'rgba(245, 244, 240, 0.1)',
    borderStrong: 'rgba(245, 244, 240, 0.15)',

    // Semantic
    positive: '#6B8C7A',
    negative: '#C75B4A',
    pending: '#C9A962',

    // Tab bar active color
    tabActive: '#C9A962', // gold in dark mode

    // Gradients for icons
    invoiceGradient: ['#C75B4A', '#A84A3D'],
    receiptGradient: ['#C9A962', '#A88A4D'],
    voucherGradient: ['#6B8C7A', '#5A7A68'],
    statementGradient: ['#5B6B8C', '#4A5A75'],

    // Additional semantic colors for forms
    error: '#D47777',
    success: '#6B8C7A',
    warning: '#C9A962',
    blue: '#5B6B8C',
  },
} as const

// Helper to get theme based on color scheme
export const getAppTheme = (isDark: boolean) => isDark ? APP_THEME.dark : APP_THEME.light

export const COLORS = {
  // Light Mode
  light: {
    background: '#FFFFFF',
    backgroundSecondary: '#F2F2F7',
    backgroundTertiary: '#E5E5EA',
    text: '#000000',
    textSecondary: '#3C3C43',
    textTertiary: '#8E8E93',
    border: '#C7C7CC',
    separator: '#E5E5EA',
    card: '#FFFFFF',
  },

  // Dark Mode
  dark: {
    background: '#000000',
    backgroundSecondary: '#1C1C1E',
    backgroundTertiary: '#2C2C2E',
    text: '#FFFFFF',
    textSecondary: '#EBEBF5',
    textTertiary: '#8E8E93',
    border: '#38383A',
    separator: '#38383A',
    card: '#1C1C1E',
  },

  // Semantic
  success: '#34C759',
  successDark: '#30D158',
  warning: '#FF9500',
  warningDark: '#FF9F0A',
  error: '#FF3B30',
  errorDark: '#FF453A',
  info: '#007AFF',
  infoDark: '#0A84FF',

  // Currency
  myr: '#0066cc',
  jpy: '#BC002D',

  // Document Types
  invoice: '#007AFF',
  receipt: '#34C759',
  voucher: '#FF9500',
  statement: '#5856D6',

  // Status
  draft: '#8E8E93',
  issued: '#007AFF',
  paid: '#34C759',
  completed: '#30D158',
  cancelled: '#FF3B30',
} as const

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  round: 9999,
} as const

export const FONT_SIZE = {
  caption2: 11,
  caption1: 12,
  footnote: 13,
  subhead: 15,
  callout: 16,
  body: 17,
  headline: 17,
  title3: 20,
  title2: 22,
  title1: 28,
  largeTitle: 34,
} as const

export const FONT_WEIGHT = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
} as const

// Animation durations
export const ANIMATION = {
  fast: 150,
  normal: 250,
  slow: 350,
} as const

// Touch targets (iOS HIG minimum: 44px)
export const TOUCH_TARGET = {
  min: 44,
  comfortable: 48,
  large: 56,
} as const
