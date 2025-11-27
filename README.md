# WIF Finance Mobile App

A premium React Native mobile application for WIF Finance - Enterprise Financial Document Management & Tour Booking System.

## Tech Stack

- **Framework**: React Native with Expo SDK 54
- **UI Library**: Tamagui (compile-time optimized)
- **Navigation**: Expo Router (file-based routing)
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **Backend**: Supabase (PostgreSQL)
- **Offline Storage**: expo-sqlite
- **Authentication**: Face ID / Touch ID + Supabase Auth

## Features

### Core Features
- 📄 **Document Management** - Invoices, Receipts, Payment Vouchers, Statements
- 💱 **Multi-Currency** - MYR and JPY support
- ✈️ **Tour Bookings** - Full cost breakdown and profit calculation
- 💰 **Account Ledger** - Real-time balance tracking
- 🔐 **Role-Based Access** - Viewer, Accountant, Manager, Admin

### Premium UX
- 🔒 Face ID / Touch ID authentication
- 📱 Haptic feedback throughout
- 🎨 Dark/Light theme support
- ⚡ 60fps smooth animations
- 📴 Offline-first architecture
- 🔄 Background sync

## Project Structure

```
wif-finance/
├── app/                          # Expo Router screens
│   ├── (auth)/                   # Authentication flow
│   │   ├── login.tsx
│   │   └── biometric.tsx
│   ├── (tabs)/                   # Main tab screens
│   │   ├── index.tsx             # Dashboard
│   │   ├── documents.tsx
│   │   ├── bookings.tsx
│   │   ├── ledger.tsx
│   │   └── settings.tsx
│   ├── document/[id].tsx         # Document detail
│   ├── booking/[id].tsx          # Booking detail
│   └── _layout.tsx               # Root layout
├── src/
│   ├── components/
│   │   └── ui/                   # Tamagui components
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       └── Input.tsx
│   ├── services/
│   │   ├── api/supabaseClient.ts # Supabase setup
│   │   ├── auth/biometricAuth.ts # Face ID/Touch ID
│   │   └── sync/offlineSync.ts   # Offline sync
│   ├── store/
│   │   └── authStore.ts          # Zustand auth store
│   ├── config/
│   │   └── tamagui.config.ts     # Tamagui theme
│   └── constants/
│       └── theme.ts              # Design tokens
└── assets/                       # Images, fonts, icons
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Xcode (for iOS)
- Android Studio (for Android)
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`

### Installation

```bash
# Navigate to project
cd wif-finance

# Install dependencies
npm install

# Start development server
npx expo start

# Run on iOS simulator
npx expo start --ios

# Run on Android emulator
npx expo start --android
```

### Environment Setup

Create a `.env` file:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Building for Production

### iOS

```bash
# Configure EAS
eas build:configure

# Development build (for testing)
eas build --profile development --platform ios

# Production build
eas build --profile production --platform ios

# Submit to App Store
eas submit --platform ios
```

### Android

```bash
# Production build
eas build --profile production --platform android

# Submit to Play Store
eas submit --platform android
```

## Key Components

### Tamagui UI Components

```tsx
import { Button, Card, Input } from '@/components/ui'

// Button with haptic feedback
<Button variant="primary" hapticFeedback="medium">
  Save Document
</Button>

// Document card with animations
<DocumentCard
  title="Invoice #001"
  status="paid"
  animation="bouncy"
/>

// Password input with visibility toggle
<PasswordInput label="Password" />
```

### Biometric Authentication

```tsx
import { BiometricAuthService } from '@/services/auth/biometricAuth'

// Check if available
const isAvailable = await BiometricAuthService.isAvailable()

// Authenticate
const result = await BiometricAuthService.authenticate('Sign in')

// Get stored credentials
const credentials = await BiometricAuthService.getStoredCredentials()
```

### Offline Sync

```tsx
import { OfflineSyncService } from '@/services/sync/offlineSync'

// Initialize
await OfflineSyncService.initialize()

// Queue sync operation
await OfflineSyncService.queueSync('documents', docId, 'create', documentData)

// Get cached data
const documents = await OfflineSyncService.getAllCached('documents')

// Sync all pending
await OfflineSyncService.syncAll()
```

## Design System

### Brand Colors
- **Navy**: `#1a2b4a` (Primary brand)
- **Blue**: `#0066cc` (Primary action)
- **Success**: `#34C759`
- **Warning**: `#FF9500`
- **Error**: `#FF3B30`

### Typography
- iOS system font (SF Pro)
- Sizes: 11px - 34px scale
- Weights: 400, 500, 600, 700

### Spacing
- Base unit: 4px
- Scale: 4, 8, 12, 16, 20, 24, 32, 48

## Testing

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Unit tests
npm test
```

## Deployment Checklist

- [ ] Update version in app.json
- [ ] Test on physical devices
- [ ] Test Face ID / Touch ID
- [ ] Test offline mode
- [ ] Verify all API endpoints
- [ ] Check App Store assets
- [ ] Submit for review

## Documentation

- [iOS Architecture Guide](../IOS_ARCHITECTURE_GUIDE.md)
- [iOS Code Examples](../IOS_CODE_EXAMPLES.md)
- [Configuration Files](../IOS_CONFIGURATION_FILES.md)

## Support

For issues and feature requests, contact the development team.

---

© 2024 WIF JAPAN SDN BHD
