import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import {
  Home,
  FileText,
  Plane,
  Wallet,
  Settings,
} from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'
import { getAppTheme } from '../../src/constants/theme'
import { useThemeStore } from '../../src/store/themeStore'

export default function TabsLayout() {
  const isDark = useThemeStore((state) => state.isDarkMode)
  const appTheme = getAppTheme(isDark)

  const handleTabPress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: appTheme.tabActive,
        tabBarInactiveTintColor: appTheme.textMuted,
        tabBarStyle: {
          backgroundColor: isDark ? appTheme.bgSecondary : appTheme.bgCard,
          borderTopColor: appTheme.borderSubtle,
          borderTopWidth: 0.5,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          height: Platform.OS === 'ios' ? 85 : 65,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
        listeners={{
          tabPress: handleTabPress,
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: 'Documents',
          tabBarIcon: ({ color, size }) => <FileText size={size} color={color} />,
        }}
        listeners={{
          tabPress: handleTabPress,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color, size }) => <Plane size={size} color={color} />,
        }}
        listeners={{
          tabPress: handleTabPress,
        }}
      />
      <Tabs.Screen
        name="ledger"
        options={{
          title: 'Ledger',
          tabBarIcon: ({ color, size }) => <Wallet size={size} color={color} />,
        }}
        listeners={{
          tabPress: handleTabPress,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
        listeners={{
          tabPress: handleTabPress,
        }}
      />
    </Tabs>
  )
}
