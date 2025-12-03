import { useState, memo, useEffect } from 'react'
import { YStack, XStack, Text, ScrollView } from 'tamagui'
import { Calendar, FileText, Link, Upload, X, Camera, File } from '@tamagui/lucide-icons'
import { Pressable, StyleSheet, View, Platform, Modal, Image, Alert } from 'react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import * as Haptics from 'expo-haptics'

import { Input, Button, Card } from '../ui'
import type { StatementOfPayment } from '../../types'
import { uploadFile, deleteFile, getPublicUrl } from '../../services/storage/storageService'

// Section Header Component
const SectionHeader = memo(({
  title,
  theme
}: {
  title: string;
  theme: { gold: string; textMuted: string };
}) => (
  <XStack alignItems="center" gap="$2" marginBottom="$4">
    <View style={[styles.sectionAccent, { backgroundColor: theme.gold }]} />
    <Text
      fontSize={11}
      fontWeight="600"
      letterSpacing={1.2}
      textTransform="uppercase"
      color={theme.textMuted}
    >
      {title}
    </Text>
  </XStack>
))

SectionHeader.displayName = 'SectionHeader'

// Form Field Component
const FormField = memo(({
  label,
  required,
  children,
  theme
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  theme: { textSecondary: string; vermillion: string };
}) => (
  <YStack marginBottom="$4">
    <Text fontSize={13} fontWeight="500" color={theme.textSecondary} marginBottom="$2">
      {label}
      {required && <Text color={theme.vermillion}> *</Text>}
    </Text>
    {children}
  </YStack>
))

FormField.displayName = 'FormField'

interface StatementOfPaymentEditFormProps {
  document: StatementOfPayment
  onSave: (updates: Partial<StatementOfPayment>) => Promise<void>
  onCancel: () => void
  isSaving: boolean
  theme: {
    bgPrimary: string
    bgSecondary: string
    bgCard: string
    borderSubtle: string
    borderMedium: string
    textPrimary: string
    textSecondary: string
    textMuted: string
    textFaint: string
    gold: string
    goldSoft: string
    vermillion: string
    vermillionSoft: string
    jade: string
    jadeSoft: string
    error: string
    indigo?: string
    indigoSoft?: string
  }
}

const PAYMENT_METHODS = [
  'Bank Transfer',
  'Wire Transfer',
  'Cheque',
  'Online Payment',
]

const TRANSACTION_FEE_TYPES = [
  'ATM Withdrawal Fee',
  'Wire Transfer Fee',
  'International Transfer Fee',
  'Currency Conversion Fee',
  'Bank Service Charge',
]

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function StatementOfPaymentEditForm({
  document,
  onSave,
  onCancel,
  isSaving,
  theme,
}: StatementOfPaymentEditFormProps) {
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [formData, setFormData] = useState({
    paymentDate: document.paymentDate,
    paymentMethod: document.paymentMethod,
    transactionReference: document.transactionReference,
    confirmedBy: document.confirmedBy,
    transactionFee: document.transactionFee?.toString() || '0',
    transactionFeeType: document.transactionFeeType || '',
    notes: document.notes || '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Transfer proof state
  const [transferProofUri, setTransferProofUri] = useState<string>('')
  const [transferProofFilename, setTransferProofFilename] = useState<string>(
    document.transferProofFilename || ''
  )
  const [transferProofStoragePath, setTransferProofStoragePath] = useState<string>(
    document.transferProofStoragePath || ''
  )
  const [isUploadingFile, setIsUploadingFile] = useState(false)

  // Use indigo colors for linked voucher section, fallback to gold if not provided
  const indigoColor = theme.indigo || '#4A5A7A'
  const indigoSoftColor = theme.indigoSoft || 'rgba(74, 90, 122, 0.1)'

  // Load existing transfer proof on mount
  useEffect(() => {
    if (document.transferProofStoragePath && !transferProofUri) {
      // Get public URL from storage path
      const url = getPublicUrl(document.transferProofStoragePath)
      setTransferProofUri(url)
    }
  }, [document.transferProofStoragePath])

  const calculateTotalDeducted = () => {
    const transactionFee = parseFloat(formData.transactionFee) || 0
    return document.total + transactionFee
  }

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false)
    }
    if (selectedDate) {
      setFormData({ ...formData, paymentDate: selectedDate.toISOString().split('T')[0] })
    }
  }

  const handlePickFromFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        setTransferProofUri(asset.uri)
        setTransferProofFilename(asset.name)
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
    } catch (error) {
      console.error('Error picking document:', error)
      Alert.alert('Error', 'Failed to pick file. Please try again.')
    }
  }

  const handleTakePhoto = async () => {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera permissions to take a photo.')
        return
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        const timestamp = Date.now()
        const filename = `transfer_proof_${timestamp}.jpg`
        setTransferProofUri(asset.uri)
        setTransferProofFilename(filename)
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
    } catch (error) {
      console.error('Error taking photo:', error)
      Alert.alert('Error', 'Failed to take photo. Please try again.')
    }
  }

  const handleRemoveFile = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setTransferProofUri('')
    setTransferProofFilename('')
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.paymentMethod.trim()) {
      newErrors.paymentMethod = 'Payment method is required'
    }
    if (!formData.transactionReference.trim()) {
      newErrors.transactionReference = 'Transaction reference is required'
    }
    if (!formData.confirmedBy.trim()) {
      newErrors.confirmedBy = 'Confirmed by field is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const transactionFee = parseFloat(formData.transactionFee) || 0
    const totalDeducted = document.total + transactionFee

    const updates: Partial<StatementOfPayment> = {
      paymentDate: formData.paymentDate,
      paymentMethod: formData.paymentMethod,
      transactionReference: formData.transactionReference,
      confirmedBy: formData.confirmedBy,
      transactionFee: transactionFee > 0 ? transactionFee : undefined,
      transactionFeeType: formData.transactionFeeType || undefined,
      totalDeducted,
      notes: formData.notes || undefined,
    }

    // Upload transfer proof if a new file was selected
    if (transferProofUri && transferProofFilename) {
      try {
        setIsUploadingFile(true)

        // Delete old file if it exists
        if (transferProofStoragePath) {
          try {
            await deleteFile(transferProofStoragePath)
          } catch (error) {
            console.error('Error deleting old file:', error)
            // Continue with upload even if deletion fails
          }
        }

        // Upload new file
        const timestamp = Date.now()
        const storagePath = `statement_of_payment/${document.id}/${timestamp}_${transferProofFilename}`
        const uploadResult = await uploadFile(transferProofUri, storagePath)

        updates.transferProofFilename = transferProofFilename
        updates.transferProofStoragePath = uploadResult.path

        setIsUploadingFile(false)
      } catch (error) {
        setIsUploadingFile(false)
        console.error('Error uploading file:', error)
        Alert.alert('Upload Error', 'Failed to upload transfer proof. Please try again.')
        return
      }
    }

    await onSave(updates)
  }

  return (
    <YStack flex={1}>
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <YStack padding="$5" gap="$4">
          {/* Linked Voucher Info */}
          <Card backgroundColor={indigoSoftColor} padding="$5" borderRadius={16} style={[styles.formCard, { borderWidth: 2, borderColor: indigoColor + '30' }]}>
            <XStack alignItems="center" gap="$2" marginBottom="$4">
              <View style={[styles.sectionIcon, { backgroundColor: theme.bgCard }]}>
                <Link size={15} color={indigoColor} />
              </View>
              <Text fontSize={11} fontWeight="600" letterSpacing={1.2} textTransform="uppercase" color={theme.textMuted}>
                Linked Payment Voucher
              </Text>
            </XStack>

            <YStack gap="$2">
              <XStack justifyContent="space-between">
                <Text fontSize={13} color={theme.textMuted}>Voucher Number:</Text>
                <Text fontSize={13} fontWeight="600" color={indigoColor}>
                  {document.linkedVoucherNumber || 'N/A'}
                </Text>
              </XStack>

              <XStack justifyContent="space-between">
                <Text fontSize={13} color={theme.textMuted}>Payee:</Text>
                <Text fontSize={13} fontWeight="600" color={theme.textPrimary}>
                  {document.payeeName}
                </Text>
              </XStack>

              <XStack justifyContent="space-between">
                <Text fontSize={13} color={theme.textMuted}>Amount:</Text>
                <Text fontSize={13} fontWeight="600" color={theme.textPrimary}>
                  {document.currency} {document.total.toFixed(2)}
                </Text>
              </XStack>
            </YStack>
          </Card>

          {/* Payment Details */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Payment Details" theme={theme} />

            <FormField label="Payment Date" required theme={theme}>
              <Pressable
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setShowDatePicker(true)
                }}
                style={[styles.dateInput, { borderColor: theme.borderSubtle, backgroundColor: theme.bgCard }]}
              >
                <Text
                  fontSize={14}
                  fontWeight="500"
                  color={formData.paymentDate ? theme.textPrimary : theme.textFaint}
                >
                  {formData.paymentDate ? formatDate(formData.paymentDate) : 'Select date'}
                </Text>
                <Calendar size={18} color={theme.textMuted} />
              </Pressable>
            </FormField>

            {/* iOS Date Picker */}
            {Platform.OS === 'ios' && showDatePicker && (
              <Modal transparent animationType="fade" visible={showDatePicker} onRequestClose={() => setShowDatePicker(false)}>
                <Pressable style={styles.datePickerOverlay} onPress={() => setShowDatePicker(false)}>
                  <Pressable style={[styles.datePickerContainer, { backgroundColor: theme.bgCard }]}>
                    <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$4" paddingVertical="$3" borderBottomWidth={1} borderBottomColor={theme.borderSubtle}>
                      <Text fontSize={17} fontWeight="600" color={theme.textPrimary}>Payment Date</Text>
                      <Pressable onPress={() => setShowDatePicker(false)} hitSlop={8}>
                        <Text fontSize={17} fontWeight="600" color={theme.gold}>Done</Text>
                      </Pressable>
                    </XStack>
                    <DateTimePicker value={new Date(formData.paymentDate || Date.now())} mode="date" display="spinner" onChange={handleDateChange} locale="en-GB" themeVariant="light" style={{ height: 200 }} />
                  </Pressable>
                </Pressable>
              </Modal>
            )}

            {/* Android Date Picker */}
            {Platform.OS === 'android' && showDatePicker && (
              <DateTimePicker value={new Date(formData.paymentDate || Date.now())} mode="date" display="default" onChange={handleDateChange} />
            )}

            <FormField label="Payment Method" required theme={theme}>
              {errors.paymentMethod && (
                <Text fontSize={12} color={theme.vermillion} marginBottom="$2">
                  {errors.paymentMethod}
                </Text>
              )}
              <YStack gap="$2">
                {PAYMENT_METHODS.map((method) => (
                  <Pressable
                    key={method}
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      setFormData({ ...formData, paymentMethod: method })
                    }}
                    style={[
                      styles.methodButton,
                      { borderColor: formData.paymentMethod === method ? theme.gold : theme.borderSubtle },
                      formData.paymentMethod === method && { backgroundColor: theme.goldSoft }
                    ]}
                  >
                    <Text
                      color={formData.paymentMethod === method ? theme.gold : theme.textSecondary}
                      fontWeight={formData.paymentMethod === method ? '600' : '400'}
                      fontSize={14}
                    >
                      {method}
                    </Text>
                  </Pressable>
                ))}
              </YStack>
            </FormField>

            <FormField label="Transaction Reference" required theme={theme}>
              <Input
                value={formData.transactionReference}
                onChangeText={(value) => setFormData({ ...formData, transactionReference: value })}
                placeholder="e.g., TXN123456789"
                error={!!errors.transactionReference}
                errorText={errors.transactionReference}
              />
            </FormField>
          </Card>

          {/* Transaction Fees */}
          <Card backgroundColor={theme.vermillionSoft} padding="$5" borderRadius={16} style={[styles.formCard, { borderWidth: 1, borderColor: theme.vermillion + '30' }]}>
            <SectionHeader title="Transaction Fees (Optional)" theme={theme} />

            <FormField label="Transaction Fee Amount" theme={theme}>
              <Input
                value={formData.transactionFee}
                onChangeText={(value) => setFormData({ ...formData, transactionFee: value })}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
            </FormField>

            {parseFloat(formData.transactionFee) > 0 && (
              <FormField label="Fee Type" theme={theme}>
                <YStack gap="$2">
                  {TRANSACTION_FEE_TYPES.map((feeType) => (
                    <Pressable
                      key={feeType}
                      onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        setFormData({ ...formData, transactionFeeType: feeType })
                      }}
                      style={[
                        styles.methodButton,
                        { borderColor: formData.transactionFeeType === feeType ? theme.vermillion : theme.borderSubtle },
                        formData.transactionFeeType === feeType && { backgroundColor: theme.vermillionSoft }
                      ]}
                    >
                      <Text
                        color={formData.transactionFeeType === feeType ? theme.vermillion : theme.textSecondary}
                        fontWeight={formData.transactionFeeType === feeType ? '600' : '400'}
                        fontSize={13}
                      >
                        {feeType}
                      </Text>
                    </Pressable>
                  ))}
                </YStack>
              </FormField>
            )}

            <View style={[styles.breakdownBox, { backgroundColor: theme.bgCard }]}>
              <Text fontSize={14} fontWeight="600" color={theme.textPrimary} marginBottom="$2">
                Payment Breakdown
              </Text>

              <XStack justifyContent="space-between" marginBottom="$1">
                <Text fontSize={13} color={theme.textMuted}>Voucher Amount:</Text>
                <Text fontSize={13} fontWeight="500" color={theme.textPrimary}>
                  {document.currency} {document.total.toFixed(2)}
                </Text>
              </XStack>

              <XStack justifyContent="space-between" marginBottom="$1">
                <Text fontSize={13} color={theme.textMuted}>Transaction Fee:</Text>
                <Text fontSize={13} fontWeight="500" color={theme.vermillion}>
                  {document.currency} {(parseFloat(formData.transactionFee) || 0).toFixed(2)}
                </Text>
              </XStack>

              <View style={[styles.totalDivider, { borderTopColor: theme.borderMedium }]} />

              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize={15} fontWeight="700" color={theme.textPrimary}>Total Deducted:</Text>
                <Text fontSize={16} fontWeight="700" color={theme.gold}>
                  {document.currency} {calculateTotalDeducted().toFixed(2)}
                </Text>
              </XStack>
            </View>
          </Card>

          {/* Line Items Display */}
          {document.items && document.items.length > 0 && (
            <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
              <SectionHeader title="Payment Items" theme={theme} />

              {document.items.map((item, index) => (
                <XStack
                  key={item.id}
                  justifyContent="space-between"
                  paddingVertical="$2"
                  borderBottomWidth={index < document.items.length - 1 ? 1 : 0}
                  borderBottomColor={theme.borderSubtle}
                >
                  <YStack flex={1}>
                    <Text fontSize={14} color={theme.textPrimary} marginBottom={4}>
                      {item.description}
                    </Text>
                    <Text fontSize={12} color={theme.textMuted}>
                      {item.quantity} × {document.currency} {item.unitPrice.toFixed(2)}
                    </Text>
                  </YStack>
                  <Text fontSize={14} fontWeight="600" color={theme.textPrimary}>
                    {document.currency} {item.amount.toFixed(2)}
                  </Text>
                </XStack>
              ))}
            </Card>
          )}

          {/* Confirmation */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Confirmation" theme={theme} />

            <FormField label="Confirmed By" required theme={theme}>
              <Input
                value={formData.confirmedBy}
                onChangeText={(value) => setFormData({ ...formData, confirmedBy: value })}
                placeholder="Name of person confirming payment"
                error={!!errors.confirmedBy}
                errorText={errors.confirmedBy}
              />
            </FormField>
          </Card>

          {/* Transfer Proof */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Transfer Proof" theme={theme} />

            {transferProofUri || transferProofStoragePath ? (
              <YStack gap="$3">
                {/* Preview */}
                {transferProofUri && (
                  <View style={styles.previewContainer}>
                    <Image
                      source={{ uri: transferProofUri }}
                      style={styles.previewImage}
                      resizeMode="contain"
                    />
                  </View>
                )}
                {!transferProofUri && transferProofStoragePath && (
                  <View style={[styles.existingFileContainer, { backgroundColor: theme.goldSoft, borderColor: theme.gold }]}>
                    <FileText size={24} color={theme.gold} />
                    <Text fontSize={13} color={theme.textPrimary} fontWeight="500">
                      {transferProofFilename || 'Transfer proof attached'}
                    </Text>
                  </View>
                )}

                {/* File info and remove button */}
                <XStack alignItems="center" justifyContent="space-between" gap="$2">
                  <Text fontSize={13} color={theme.textSecondary} numberOfLines={1} flex={1}>
                    {transferProofFilename}
                  </Text>
                  <Pressable
                    onPress={handleRemoveFile}
                    style={[styles.removeButton, { backgroundColor: theme.vermillionSoft }]}
                  >
                    <X size={18} color={theme.vermillion} />
                  </Pressable>
                </XStack>
              </YStack>
            ) : (
              <YStack gap="$2">
                {/* Pick from Files button */}
                <Pressable
                  onPress={handlePickFromFiles}
                  style={[styles.uploadButton, { borderColor: theme.borderMedium, backgroundColor: theme.bgSecondary }]}
                >
                  <File size={20} color={theme.textMuted} />
                  <Text fontSize={14} fontWeight="500" color={theme.textPrimary}>
                    Pick from Files
                  </Text>
                  <Text fontSize={12} color={theme.textMuted}>
                    PDF, JPG, PNG supported
                  </Text>
                </Pressable>

                {/* Take Photo button */}
                <Pressable
                  onPress={handleTakePhoto}
                  style={[styles.uploadButton, { borderColor: theme.borderMedium, backgroundColor: theme.bgSecondary }]}
                >
                  <Camera size={20} color={theme.textMuted} />
                  <Text fontSize={14} fontWeight="500" color={theme.textPrimary}>
                    Take Photo
                  </Text>
                  <Text fontSize={12} color={theme.textMuted}>
                    Use camera to capture transfer proof
                  </Text>
                </Pressable>
              </YStack>
            )}
          </Card>

          {/* Notes */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Notes" theme={theme} />
            <Input
              value={formData.notes}
              onChangeText={(value) => setFormData({ ...formData, notes: value })}
              multiline
              numberOfLines={3}
              placeholder="Additional notes..."
            />
          </Card>
        </YStack>
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actionBar, { backgroundColor: theme.bgCard, borderTopColor: theme.borderSubtle }]}>
        <Pressable onPress={onCancel} style={[styles.cancelButton, { borderColor: theme.borderMedium }]}>
          <Text color={theme.textSecondary} fontWeight="600" fontSize={14}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={isSaving || isUploadingFile}
          style={[styles.saveButton, { backgroundColor: theme.gold, opacity: isSaving || isUploadingFile ? 0.6 : 1 }]}
        >
          <Text color="#FFFFFF" fontWeight="600" fontSize={14}>
            {isUploadingFile ? 'Uploading...' : isSaving ? 'Saving...' : 'Save Changes'}
          </Text>
        </Pressable>
      </View>
    </YStack>
  )
}

const styles = StyleSheet.create({
  formCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 10,
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  datePickerContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  methodButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 10,
  },
  breakdownBox: {
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  totalDivider: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  uploadButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  previewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  previewImage: {
    width: '100%',
    height: 200,
  },
  existingFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
