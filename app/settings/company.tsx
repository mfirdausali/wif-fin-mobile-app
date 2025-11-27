import { useState, useEffect, useCallback } from 'react'
import { Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import {
  YStack,
  XStack,
  Text,
  ScrollView,
  Input,
  TextArea,
  Switch,
} from 'tamagui'
import {
  ArrowLeft,
  Building,
  MapPin,
  Phone,
  Mail,
  FileText,
  Home,
  AlertCircle,
  Check,
} from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { IconButton, Button } from '../../src/components/ui'
import { useAuthStore } from '../../src/store/authStore'
import {
  getOrCreateDefaultCompany,
  updateCompanyInfo,
  CompanyInfo,
} from '../../src/services/company/companyService'
import { BRAND } from '../../src/constants/theme'

// iOS Settings colors
const ICON_COLORS = {
  blue: '#007AFF',
  green: '#34C759',
  orange: '#FF9500',
  red: '#FF3B30',
  gray: '#8E8E93',
  navy: BRAND.navy,
}

interface FormFieldProps {
  icon: any
  iconColor: string
  label: string
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  keyboardType?: 'default' | 'email-address' | 'phone-pad'
  multiline?: boolean
  disabled?: boolean
  hint?: string
}

function FormField({
  icon: Icon,
  iconColor,
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
  disabled = false,
  hint,
}: FormFieldProps) {
  return (
    <YStack marginBottom={16}>
      <XStack alignItems="center" gap={8} marginBottom={8}>
        <YStack
          width={24}
          height={24}
          borderRadius={5}
          backgroundColor={iconColor}
          justifyContent="center"
          alignItems="center"
        >
          <Icon size={14} color="#FFFFFF" />
        </YStack>
        <Text fontSize={15} fontWeight="500" color="$color">
          {label}
        </Text>
      </XStack>

      {multiline ? (
        <TextArea
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          backgroundColor="$background"
          borderWidth={1}
          borderColor="$borderColor"
          borderRadius={10}
          paddingHorizontal={12}
          paddingVertical={10}
          fontSize={16}
          minHeight={80}
          disabled={disabled}
          opacity={disabled ? 0.5 : 1}
        />
      ) : (
        <Input
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          backgroundColor="$background"
          borderWidth={1}
          borderColor="$borderColor"
          borderRadius={10}
          paddingHorizontal={12}
          paddingVertical={10}
          fontSize={16}
          disabled={disabled}
          opacity={disabled ? 0.5 : 1}
        />
      )}

      {hint && (
        <Text fontSize={12} color="$colorHover" opacity={0.6} marginTop={4} paddingHorizontal={4}>
          {hint}
        </Text>
      )}
    </YStack>
  )
}

export default function CompanySettingsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'admin'

  const [formData, setFormData] = useState<CompanyInfo>({
    name: '',
    address: '',
    tel: '',
    email: '',
    registrationNo: '',
    registeredOffice: '',
    allowNegativeBalance: false,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const loadCompanyInfo = useCallback(async () => {
    setIsLoading(true)
    try {
      const companyInfo = await getOrCreateDefaultCompany()
      setFormData(companyInfo)
    } catch (error) {
      console.error('Error loading company info:', error)
      Alert.alert('Error', 'Failed to load company information')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCompanyInfo()
  }, [loadCompanyInfo])

  const handleBack = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.back()
  }

  const handleSave = async () => {
    if (!isAdmin) return

    setIsSaving(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      await updateCompanyInfo(formData)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert(
        'Success',
        'Company information saved successfully.',
        [{ text: 'OK', onPress: () => router.back() }]
      )
    } catch (error) {
      console.error('Error saving company info:', error)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to save company information. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const updateField = (field: keyof CompanyInfo, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  if (isLoading) {
    return (
      <YStack flex={1} backgroundColor="$backgroundStrong" justifyContent="center" alignItems="center">
        <ActivityIndicator size="large" color={BRAND.navy} />
        <Text marginTop="$3" color="$colorHover">Loading company info...</Text>
      </YStack>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <YStack flex={1} backgroundColor="$backgroundStrong">
        {/* Header */}
        <YStack
          paddingTop={insets.top}
          backgroundColor="$background"
          borderBottomWidth={0.5}
          borderBottomColor="$borderColor"
        >
          <XStack
            paddingHorizontal={16}
            paddingVertical={12}
            justifyContent="space-between"
            alignItems="center"
          >
            <IconButton variant="ghost" onPress={handleBack}>
              <ArrowLeft size={24} color={BRAND.navy} />
            </IconButton>

            <Text fontSize={17} fontWeight="600" color="$color">
              Company Settings
            </Text>

            {isAdmin ? (
              <Button
                variant="ghost"
                size="sm"
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={BRAND.navy} />
                ) : (
                  <Text fontSize={17} fontWeight="500" color={BRAND.navy}>
                    Save
                  </Text>
                )}
              </Button>
            ) : (
              <YStack width={44} />
            )}
          </XStack>
        </YStack>

        <ScrollView
          flex={1}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 100,
          }}
        >
          {/* Read-only notice for non-admins */}
          {!isAdmin && (
            <XStack
              backgroundColor="#FFF3CD"
              padding={12}
              borderRadius={10}
              marginBottom={16}
              alignItems="center"
              gap={10}
            >
              <AlertCircle size={20} color="#856404" />
              <YStack flex={1}>
                <Text fontSize={14} fontWeight="600" color="#856404">
                  Read-Only Access
                </Text>
                <Text fontSize={13} color="#856404" opacity={0.8}>
                  Only administrators can modify company information.
                </Text>
              </YStack>
            </XStack>
          )}

          {/* Company Information Section */}
          <YStack
            backgroundColor="$background"
            borderRadius={10}
            padding={16}
            marginBottom={16}
          >
            <Text fontSize={13} fontWeight="600" color="$colorHover" opacity={0.6} marginBottom={16}>
              COMPANY INFORMATION
            </Text>

            <FormField
              icon={Building}
              iconColor={ICON_COLORS.navy}
              label="Company Name"
              value={formData.name}
              onChangeText={(text) => updateField('name', text)}
              placeholder="WIF JAPAN SDN BHD"
              disabled={!isAdmin}
            />

            <FormField
              icon={MapPin}
              iconColor={ICON_COLORS.blue}
              label="Address"
              value={formData.address}
              onChangeText={(text) => updateField('address', text)}
              placeholder="Malaysia Office&#10;Kuala Lumpur, Malaysia"
              multiline
              disabled={!isAdmin}
              hint="Use multiple lines for a cleaner appearance on PDFs"
            />

            <FormField
              icon={Phone}
              iconColor={ICON_COLORS.green}
              label="Telephone"
              value={formData.tel}
              onChangeText={(text) => updateField('tel', text)}
              placeholder="+60-XXX-XXXXXXX"
              keyboardType="phone-pad"
              disabled={!isAdmin}
            />

            <FormField
              icon={Mail}
              iconColor={ICON_COLORS.orange}
              label="Email"
              value={formData.email}
              onChangeText={(text) => updateField('email', text)}
              placeholder="info@wifjapan.com"
              keyboardType="email-address"
              disabled={!isAdmin}
            />
          </YStack>

          {/* Registration Section */}
          <YStack
            backgroundColor="$background"
            borderRadius={10}
            padding={16}
            marginBottom={16}
          >
            <Text fontSize={13} fontWeight="600" color="$colorHover" opacity={0.6} marginBottom={16}>
              REGISTRATION DETAILS
            </Text>

            <FormField
              icon={FileText}
              iconColor={ICON_COLORS.gray}
              label="Company Registration No"
              value={formData.registrationNo}
              onChangeText={(text) => updateField('registrationNo', text)}
              placeholder="(1594364-K)"
              disabled={!isAdmin}
              hint="This will appear in the PDF footer"
            />

            <FormField
              icon={Home}
              iconColor={ICON_COLORS.gray}
              label="Registered Office"
              value={formData.registeredOffice}
              onChangeText={(text) => updateField('registeredOffice', text)}
              placeholder="NO.6, LORONG KIRI 10..."
              multiline
              disabled={!isAdmin}
              hint="This will appear in the PDF footer"
            />
          </YStack>

          {/* Account Settings Section */}
          <YStack
            backgroundColor="$background"
            borderRadius={10}
            padding={16}
            marginBottom={16}
          >
            <Text fontSize={13} fontWeight="600" color="$colorHover" opacity={0.6} marginBottom={16}>
              ACCOUNT SETTINGS
            </Text>

            <XStack justifyContent="space-between" alignItems="flex-start">
              <YStack flex={1} marginRight={16}>
                <Text fontSize={15} fontWeight="500" color="$color">
                  Allow Negative Balances
                </Text>
                <Text fontSize={13} color="$colorHover" opacity={0.7} marginTop={4}>
                  When enabled, accounts can have negative balances (overdraft).
                </Text>
                <XStack alignItems="center" gap={4} marginTop={8}>
                  <AlertCircle size={12} color={ICON_COLORS.orange} />
                  <Text fontSize={12} color={ICON_COLORS.orange}>
                    Removes balance validation for payments
                  </Text>
                </XStack>
              </YStack>

              <Switch
                checked={formData.allowNegativeBalance}
                onCheckedChange={(checked) => updateField('allowNegativeBalance', checked)}
                backgroundColor={formData.allowNegativeBalance ? ICON_COLORS.green : '#E9E9EB'}
                disabled={!isAdmin}
                native
              />
            </XStack>
          </YStack>

          {/* Preview Section */}
          <YStack
            backgroundColor="$background"
            borderRadius={10}
            padding={16}
          >
            <Text fontSize={13} fontWeight="600" color="$colorHover" opacity={0.6} marginBottom={16}>
              PDF PREVIEW
            </Text>

            <YStack
              backgroundColor="$backgroundStrong"
              padding={16}
              borderRadius={8}
              borderWidth={1}
              borderColor="$borderColor"
            >
              <Text fontSize={16} fontWeight="600" color="$color" marginBottom={4}>
                {formData.name || 'Company Name'}
              </Text>
              <Text fontSize={14} color="$colorHover" marginBottom={8}>
                {formData.address || 'Address not set'}
              </Text>
              <Text fontSize={14} color="$colorHover">
                Tel: {formData.tel || 'Not set'}
              </Text>
              <Text fontSize={14} color="$colorHover">
                Email: {formData.email || 'Not set'}
              </Text>
            </YStack>
          </YStack>

          {/* Save Button for Admin (alternative placement) */}
          {isAdmin && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleSave}
              disabled={isSaving}
              marginTop={24}
            >
              <XStack alignItems="center" gap={8}>
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Check size={20} color="#FFFFFF" />
                )}
                <Text fontSize={17} fontWeight="600" color="#FFFFFF">
                  {isSaving ? 'Saving...' : 'Save Settings'}
                </Text>
              </XStack>
            </Button>
          )}
        </ScrollView>
      </YStack>
    </KeyboardAvoidingView>
  )
}
