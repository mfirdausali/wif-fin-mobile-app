import { createAnimations } from '@tamagui/animations-react-native'
import { createMedia } from '@tamagui/react-native-media-driver'
import { shorthands } from '@tamagui/shorthands'
import { themes, tokens } from '@tamagui/themes'
import { createFont, createTamagui, createTokens } from 'tamagui'

// Custom animations for premium feel
const animations = createAnimations({
  bouncy: {
    type: 'spring',
    damping: 10,
    mass: 0.9,
    stiffness: 100,
  },
  lazy: {
    type: 'spring',
    damping: 20,
    stiffness: 60,
  },
  quick: {
    type: 'spring',
    damping: 20,
    mass: 1.2,
    stiffness: 250,
  },
  medium: {
    type: 'spring',
    damping: 15,
    mass: 1,
    stiffness: 150,
  },
  slow: {
    type: 'spring',
    damping: 20,
    stiffness: 80,
  },
  tooltip: {
    type: 'spring',
    damping: 10,
    mass: 0.9,
    stiffness: 100,
  },
})

// WIF Finance brand colors
const wifColors = {
  // Primary Brand Colors
  wifNavy: '#1a2b4a',
  wifBlue: '#0066cc',
  wifLightBlue: '#4d94ff',

  // Semantic Colors
  success: '#34C759',
  successLight: '#30D158',
  warning: '#FF9500',
  warningLight: '#FF9F0A',
  error: '#FF3B30',
  errorLight: '#FF453A',
  info: '#007AFF',
  infoLight: '#0A84FF',

  // Grays (iOS-inspired)
  gray1: '#8E8E93',
  gray2: '#AEAEB2',
  gray3: '#C7C7CC',
  gray4: '#D1D1D6',
  gray5: '#E5E5EA',
  gray6: '#F2F2F7',

  // Dark mode grays
  grayDark1: '#8E8E93',
  grayDark2: '#636366',
  grayDark3: '#48484A',
  grayDark4: '#3A3A3C',
  grayDark5: '#2C2C2E',
  grayDark6: '#1C1C1E',

  // Currency colors
  myr: '#0066cc', // Malaysia blue
  jpy: '#BC002D', // Japan red
}

// Custom tokens
const customTokens = createTokens({
  ...tokens,
  color: {
    ...tokens.color,
    ...wifColors,

    // Light theme
    background: '#FFFFFF',
    backgroundHover: '#F2F2F7',
    backgroundPress: '#E5E5EA',
    backgroundFocus: '#F2F2F7',
    backgroundStrong: '#F2F2F7',
    backgroundTransparent: 'rgba(255,255,255,0)',

    // Text
    color: '#000000',
    colorHover: '#1a2b4a',
    colorPress: '#0066cc',
    colorFocus: '#1a2b4a',
    colorTransparent: 'rgba(0,0,0,0)',

    // Borders
    borderColor: '#C7C7CC',
    borderColorHover: '#8E8E93',
    borderColorPress: '#636366',
    borderColorFocus: '#0066cc',

    // Shadows
    shadowColor: 'rgba(0,0,0,0.15)',
    shadowColorHover: 'rgba(0,0,0,0.2)',

    // Primary
    primary: '#0066cc',
    primaryHover: '#0052a3',
    primaryPress: '#003d7a',

    // Secondary
    secondary: '#1a2b4a',
    secondaryHover: '#2d4a7a',
    secondaryPress: '#0f1a2e',
  },
  space: {
    ...tokens.space,
    0: 0,
    0.5: 2,
    1: 4,
    1.5: 6,
    2: 8,
    2.5: 10,
    3: 12,
    3.5: 14,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    11: 44,
    12: 48,
    14: 56,
    16: 64,
    20: 80,
    24: 96,
    28: 112,
    32: 128,
  },
  size: {
    ...tokens.size,
    0: 0,
    0.5: 2,
    1: 4,
    1.5: 6,
    2: 8,
    2.5: 10,
    3: 12,
    3.5: 14,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    11: 44,
    12: 48,
    14: 56,
    16: 64,
    20: 80,
    // Named sizes for Tamagui components (Button, Input, etc.)
    sm: 36,
    md: 44,
    lg: 52,
    xl: 60,
    true: 44,
  },
  radius: {
    ...tokens.radius,
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    round: 9999,
  },
  zIndex: {
    ...tokens.zIndex,
    0: 0,
    1: 100,
    2: 200,
    3: 300,
    4: 400,
    5: 500,
  },
})

// System font for iOS feel
const systemFont = createFont({
  family: 'System',
  size: {
    1: 11,
    2: 12,
    3: 13,
    4: 14,
    5: 16,
    6: 18,
    7: 20,
    8: 23,
    9: 28,
    10: 34,
    11: 40,
    12: 48,
    13: 56,
    14: 64,
    15: 72,
    16: 80,
    17: 88,
    18: 96,
    19: 104,
    20: 112,
    // Named sizes to match size tokens (used by Button, Input, etc.)
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    true: 14,
  },
  lineHeight: {
    1: 14,
    2: 16,
    3: 17,
    4: 18,
    5: 22,
    6: 24,
    7: 26,
    8: 30,
    9: 34,
    10: 41,
    11: 48,
    12: 58,
    13: 68,
    14: 78,
    15: 86,
    16: 96,
    17: 104,
    18: 112,
    19: 120,
    20: 128,
    // Named sizes to match size tokens
    sm: 18,
    md: 22,
    lg: 24,
    xl: 26,
    true: 18,
  },
  weight: {
    1: '100',
    2: '200',
    3: '300',
    4: '400',
    5: '500',
    6: '600',
    7: '700',
    8: '800',
    9: '900',
  },
  letterSpacing: {
    1: 0,
    2: -0.5,
    3: -0.3,
    4: -0.2,
    5: 0,
    6: 0.25,
    7: 0.5,
    8: 1,
    9: 1.5,
    10: 2,
  },
  face: {
    400: { normal: 'System' },
    500: { normal: 'System' },
    600: { normal: 'System' },
    700: { normal: 'System' },
  },
})

// Light theme
const lightTheme = {
  background: '#FFFFFF',
  backgroundHover: '#F2F2F7',
  backgroundPress: '#E5E5EA',
  backgroundFocus: '#F2F2F7',
  backgroundStrong: '#F2F2F7',
  backgroundTransparent: 'rgba(255,255,255,0)',

  color: '#000000',
  colorHover: wifColors.wifNavy,
  colorPress: wifColors.wifBlue,
  colorFocus: wifColors.wifNavy,
  colorTransparent: 'rgba(0,0,0,0)',

  borderColor: wifColors.gray3,
  borderColorHover: wifColors.gray1,
  borderColorFocus: wifColors.wifBlue,
  borderColorPress: wifColors.gray2,

  placeholderColor: wifColors.gray1,

  // Brand
  primary: wifColors.wifBlue,
  primaryHover: '#0052a3',
  primaryPress: '#003d7a',

  secondary: wifColors.wifNavy,
  secondaryHover: '#2d4a7a',
  secondaryPress: '#0f1a2e',

  // Semantic
  success: wifColors.success,
  warning: wifColors.warning,
  error: wifColors.error,
  info: wifColors.info,

  // Surface
  card: '#FFFFFF',
  cardHover: '#FAFAFA',

  // Shadows
  shadowColor: 'rgba(0,0,0,0.1)',
  shadowColorHover: 'rgba(0,0,0,0.15)',
}

// Dark theme
const darkTheme = {
  background: '#000000',
  backgroundHover: wifColors.grayDark6,
  backgroundPress: wifColors.grayDark5,
  backgroundFocus: wifColors.grayDark6,
  backgroundStrong: wifColors.grayDark6,
  backgroundTransparent: 'rgba(0,0,0,0)',

  color: '#FFFFFF',
  colorHover: '#E5E5EA',
  colorPress: wifColors.infoLight,
  colorFocus: '#E5E5EA',
  colorTransparent: 'rgba(255,255,255,0)',

  borderColor: wifColors.grayDark3,
  borderColorHover: wifColors.grayDark2,
  borderColorFocus: wifColors.infoLight,
  borderColorPress: wifColors.grayDark3,

  placeholderColor: wifColors.grayDark1,

  // Brand
  primary: wifColors.infoLight,
  primaryHover: '#0066cc',
  primaryPress: '#0052a3',

  secondary: '#4d94ff',
  secondaryHover: wifColors.wifBlue,
  secondaryPress: '#0052a3',

  // Semantic
  success: wifColors.successLight,
  warning: wifColors.warningLight,
  error: wifColors.errorLight,
  info: wifColors.infoLight,

  // Surface
  card: wifColors.grayDark6,
  cardHover: wifColors.grayDark5,

  // Shadows
  shadowColor: 'rgba(0,0,0,0.4)',
  shadowColorHover: 'rgba(0,0,0,0.5)',
}

// Media queries
const media = createMedia({
  xs: { maxWidth: 660 },
  sm: { maxWidth: 800 },
  md: { maxWidth: 1020 },
  lg: { maxWidth: 1280 },
  xl: { maxWidth: 1420 },
  xxl: { maxWidth: 1600 },
  gtXs: { minWidth: 660 + 1 },
  gtSm: { minWidth: 800 + 1 },
  gtMd: { minWidth: 1020 + 1 },
  gtLg: { minWidth: 1280 + 1 },
  short: { maxHeight: 820 },
  tall: { minHeight: 820 },
  hoverNone: { hover: 'none' },
  pointerCoarse: { pointer: 'coarse' },
})

const config = createTamagui({
  defaultTheme: 'light',
  shouldAddPrefersColorThemes: true,
  themeClassNameOnRoot: true,
  shorthands,
  fonts: {
    heading: systemFont,
    body: systemFont,
    mono: systemFont,
  },
  themes: {
    ...themes,
    light: {
      ...themes.light,
      ...lightTheme,
    },
    dark: {
      ...themes.dark,
      ...darkTheme,
    },
    light_Button: {
      ...themes.light_Button,
      background: wifColors.wifBlue,
      backgroundHover: '#0052a3',
      backgroundPress: '#003d7a',
      backgroundFocus: '#0052a3',
      color: '#FFFFFF',
    },
    dark_Button: {
      ...themes.dark_Button,
      background: wifColors.infoLight,
      backgroundHover: wifColors.wifBlue,
      backgroundPress: '#0052a3',
      backgroundFocus: wifColors.wifBlue,
      color: '#FFFFFF',
    },
  },
  tokens: customTokens,
  media,
  animations,
})

export type AppConfig = typeof config

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config
