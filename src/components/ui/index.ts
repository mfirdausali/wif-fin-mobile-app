// Core UI Components
export { Button, IconButton, type ButtonProps } from './Button'
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  DocumentCard,
  StatCard,
} from './Card'
export {
  Input,
  PasswordInput,
  SearchInput,
  CurrencyInput,
  type InputProps,
  type PasswordInputProps,
  type SearchInputProps,
  type CurrencyInputProps,
} from './Input'
export { InvoiceSkeletonLoader, DocumentSkeletonLoader, DashboardSkeletonLoader, InvoiceDetailSkeletonLoader } from './SkeletonLoader'
export { DocumentContextMenu, type DocumentContextMenuProps } from './DocumentContextMenu'

// Re-export commonly used Tamagui components
export {
  // Layout
  YStack,
  XStack,
  Stack,
  ZStack,
  // Text
  Text,
  Paragraph,
  Heading,
  // Interactive
  ScrollView,
  // Feedback
  Spinner,
  // Utility
  Separator,
  Spacer,
  // Theme
  Theme,
  useTheme,
} from 'tamagui'

// Re-export icons
export * from '@tamagui/lucide-icons'
