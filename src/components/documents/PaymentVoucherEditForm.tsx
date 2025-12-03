import { useState, memo } from 'react'
import { YStack, XStack, Text, ScrollView } from 'tamagui'
import { Plus, Trash2, Calendar, Upload, FileText, Image as ImageIcon, Camera, X } from '@tamagui/lucide-icons'
import { Pressable, StyleSheet, View, Platform, Modal, Image, Alert, ActivityIndicator } from 'react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import * as Haptics from 'expo-haptics'

import { Input, Button, Card } from '../ui'
import type { PaymentVoucher, LineItem } from '../../types'
import {
  pickDocument,
  pickImageFromGallery,
  takePhoto,
  uploadSupportingDocument,
  deleteSupportingDocument,
  getPublicUrl,
  isImageFile,
  isPdfFile,
  formatFileSize,
  type PickedFile,
} from '../../services/storage/storageService'

// Section Header Component
const SectionHeader = memo(({
  title,
  badge,
  theme
}: {
  title: string;
  badge?: string;
  theme: { gold: string; goldSoft: string; textMuted: string };
}) => (
  <XStack alignItems="center" justifyContent="space-between" marginBottom="$4">
    <XStack alignItems="center" gap="$2">
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
    {badge && (
      <View style={[styles.badge, { backgroundColor: theme.goldSoft }]}>
        <Text fontSize={10} fontWeight="600" color={theme.gold}>
          {badge}
        </Text>
      </View>
    )}
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

interface PaymentVoucherEditFormProps {
  document: PaymentVoucher
  onSave: (updates: Partial<PaymentVoucher>) => Promise<void>
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
  }
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function PaymentVoucherEditForm({
  document,
  onSave,
  onCancel,
  isSaving,
  theme,
}: PaymentVoucherEditFormProps) {
  const [showVoucherDatePicker, setShowVoucherDatePicker] = useState(false)
  const [showDueDatePicker, setShowDueDatePicker] = useState(false)
  const [formData, setFormData] = useState({
    payeeName: document.payeeName,
    payeeAddress: document.payeeAddress || '',
    payeeBankAccount: document.payeeBankAccount || '',
    payeeBankName: document.payeeBankName || '',
    voucherDate: document.voucherDate,
    paymentDueDate: document.paymentDueDate || '',
    requestedBy: document.requestedBy,
    taxRate: document.taxRate?.toString() || '',
    notes: document.notes || '',
  })

  const [items, setItems] = useState<LineItem[]>(document.items || [])
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Supporting document state
  const [selectedFile, setSelectedFile] = useState<PickedFile | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedDoc, setUploadedDoc] = useState<{
    storagePath: string
    filename: string
    url: string
  } | null>(
    document.supportingDocStoragePath && document.supportingDocFilename
      ? {
          storagePath: document.supportingDocStoragePath,
          filename: document.supportingDocFilename,
          url: getPublicUrl(document.supportingDocStoragePath),
        }
      : null
  )

  const addItem = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        description: '',
        quantity: 1,
        unitPrice: 0,
        amount: 0,
      },
    ])
  }

  const removeItem = async (id: string) => {
    if (items.length > 1) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setItems(items.filter((item) => item.id !== id))
    }
  }

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value }
          if (field === 'quantity' || field === 'unitPrice') {
            updated.amount = updated.quantity * updated.unitPrice
          }
          return updated
        }
        return item
      })
    )
  }

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
    const taxRate = parseFloat(formData.taxRate) || 0
    const taxAmount = subtotal * (taxRate / 100)
    const total = subtotal + taxAmount
    return { subtotal, taxAmount, total }
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.payeeName.trim()) {
      newErrors.payeeName = 'Payee name is required'
    }
    if (!formData.requestedBy.trim()) {
      newErrors.requestedBy = 'Requested by field is required'
    }
    if (items.some((item) => !item.description.trim())) {
      newErrors.items = 'All line items must have a description'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleVoucherDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowVoucherDatePicker(false)
    }
    if (selectedDate) {
      setFormData({ ...formData, voucherDate: selectedDate.toISOString().split('T')[0] })
    }
  }

  const handleDueDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDueDatePicker(false)
    }
    if (selectedDate) {
      setFormData({ ...formData, paymentDueDate: selectedDate.toISOString().split('T')[0] })
    }
  }

  // File handling functions
  const handlePickDocument = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      const file = await pickDocument()
      if (file) {
        setSelectedFile(file)
      }
    } catch (error) {
      console.error('Error picking document:', error)
      Alert.alert('Error', 'Failed to pick document. Please try again.')
    }
  }

  const handlePickImage = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      const file = await pickImageFromGallery()
      if (file) {
        setSelectedFile(file)
      }
    } catch (error) {
      console.error('Error picking image:', error)
      Alert.alert('Error', 'Failed to pick image. Please try again.')
    }
  }

  const handleTakePhoto = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      const file = await takePhoto()
      if (file) {
        setSelectedFile(file)
      }
    } catch (error) {
      console.error('Error taking photo:', error)
      Alert.alert('Error', 'Failed to take photo. Please try again.')
    }
  }

  const handleRemoveFile = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setSelectedFile(null)
  }

  const handleRemoveUploadedDoc = async () => {
    if (!uploadedDoc) return

    Alert.alert(
      'Remove Document',
      'Are you sure you want to remove this supporting document?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              setUploadedDoc(null)
            } catch (error) {
              console.error('Error removing document:', error)
              Alert.alert('Error', 'Failed to remove document. Please try again.')
            }
          },
        },
      ]
    )
  }

  const uploadFileIfNeeded = async (): Promise<{
    storagePath?: string
    filename?: string
  }> => {
    // If there's a new file selected, upload it
    if (selectedFile) {
      setIsUploading(true)
      try {
        const result = await uploadSupportingDocument(selectedFile, document.id)
        setIsUploading(false)
        return {
          storagePath: result.path,
          filename: result.filename,
        }
      } catch (error) {
        setIsUploading(false)
        throw error
      }
    }

    // If uploaded doc was removed
    if (!uploadedDoc && document.supportingDocStoragePath) {
      return {
        storagePath: undefined,
        filename: undefined,
      }
    }

    // Keep existing uploaded doc
    if (uploadedDoc) {
      return {
        storagePath: uploadedDoc.storagePath,
        filename: uploadedDoc.filename,
      }
    }

    // No changes
    return {}
  }

  const handleSave = async () => {
    if (!validate()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      // Upload file if needed
      const fileData = await uploadFileIfNeeded()

      const { subtotal, taxAmount, total } = calculateTotals()

      const updates: Partial<PaymentVoucher> = {
        payeeName: formData.payeeName,
        payeeAddress: formData.payeeAddress || undefined,
        payeeBankAccount: formData.payeeBankAccount || undefined,
        payeeBankName: formData.payeeBankName || undefined,
        voucherDate: formData.voucherDate,
        paymentDueDate: formData.paymentDueDate || undefined,
        requestedBy: formData.requestedBy,
        items,
        subtotal,
        taxRate: parseFloat(formData.taxRate) || undefined,
        taxAmount: taxAmount > 0 ? taxAmount : undefined,
        total,
        amount: total,
        notes: formData.notes || undefined,
        supportingDocStoragePath: fileData.storagePath,
        supportingDocFilename: fileData.filename,
      }

      await onSave(updates)
    } catch (error) {
      console.error('Error saving voucher:', error)
      Alert.alert('Error', 'Failed to save payment voucher. Please try again.')
    }
  }

  const { subtotal, taxAmount, total } = calculateTotals()

  return (
    <YStack flex={1}>
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <YStack padding="$5" gap="$4">
          {/* Voucher Details */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Voucher Details" theme={theme} />

            <FormField label="Voucher Date" required theme={theme}>
              <Pressable
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setShowVoucherDatePicker(true)
                }}
                style={[styles.dateInput, { borderColor: theme.borderSubtle, backgroundColor: theme.bgCard }]}
              >
                <Text
                  fontSize={14}
                  fontWeight="500"
                  color={formData.voucherDate ? theme.textPrimary : theme.textFaint}
                >
                  {formData.voucherDate ? formatDate(formData.voucherDate) : 'Select date'}
                </Text>
                <Calendar size={18} color={theme.textMuted} />
              </Pressable>
            </FormField>

            <FormField label="Payment Due Date" theme={theme}>
              <Pressable
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setShowDueDatePicker(true)
                }}
                style={[styles.dateInput, { borderColor: theme.borderSubtle, backgroundColor: theme.bgCard }]}
              >
                <Text
                  fontSize={14}
                  fontWeight="500"
                  color={formData.paymentDueDate ? theme.textPrimary : theme.textFaint}
                >
                  {formData.paymentDueDate ? formatDate(formData.paymentDueDate) : 'Select date'}
                </Text>
                <Calendar size={18} color={theme.textMuted} />
              </Pressable>
            </FormField>

            {/* iOS Date Pickers */}
            {Platform.OS === 'ios' && showVoucherDatePicker && (
              <Modal transparent animationType="fade" visible={showVoucherDatePicker} onRequestClose={() => setShowVoucherDatePicker(false)}>
                <Pressable style={styles.datePickerOverlay} onPress={() => setShowVoucherDatePicker(false)}>
                  <Pressable style={[styles.datePickerContainer, { backgroundColor: theme.bgCard }]}>
                    <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$4" paddingVertical="$3" borderBottomWidth={1} borderBottomColor={theme.borderSubtle}>
                      <Text fontSize={17} fontWeight="600" color={theme.textPrimary}>Voucher Date</Text>
                      <Pressable onPress={() => setShowVoucherDatePicker(false)} hitSlop={8}>
                        <Text fontSize={17} fontWeight="600" color={theme.gold}>Done</Text>
                      </Pressable>
                    </XStack>
                    <DateTimePicker value={new Date(formData.voucherDate || Date.now())} mode="date" display="spinner" onChange={handleVoucherDateChange} locale="en-GB" themeVariant="light" style={{ height: 200 }} />
                  </Pressable>
                </Pressable>
              </Modal>
            )}

            {Platform.OS === 'ios' && showDueDatePicker && (
              <Modal transparent animationType="fade" visible={showDueDatePicker} onRequestClose={() => setShowDueDatePicker(false)}>
                <Pressable style={styles.datePickerOverlay} onPress={() => setShowDueDatePicker(false)}>
                  <Pressable style={[styles.datePickerContainer, { backgroundColor: theme.bgCard }]}>
                    <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$4" paddingVertical="$3" borderBottomWidth={1} borderBottomColor={theme.borderSubtle}>
                      <Text fontSize={17} fontWeight="600" color={theme.textPrimary}>Payment Due Date</Text>
                      <Pressable onPress={() => setShowDueDatePicker(false)} hitSlop={8}>
                        <Text fontSize={17} fontWeight="600" color={theme.gold}>Done</Text>
                      </Pressable>
                    </XStack>
                    <DateTimePicker value={formData.paymentDueDate ? new Date(formData.paymentDueDate) : new Date()} mode="date" display="spinner" onChange={handleDueDateChange} locale="en-GB" themeVariant="light" style={{ height: 200 }} />
                  </Pressable>
                </Pressable>
              </Modal>
            )}

            {/* Android Date Pickers */}
            {Platform.OS === 'android' && showVoucherDatePicker && (
              <DateTimePicker value={new Date(formData.voucherDate || Date.now())} mode="date" display="default" onChange={handleVoucherDateChange} />
            )}
            {Platform.OS === 'android' && showDueDatePicker && (
              <DateTimePicker value={formData.paymentDueDate ? new Date(formData.paymentDueDate) : new Date()} mode="date" display="default" onChange={handleDueDateChange} />
            )}
          </Card>

          {/* Payee Details */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Payee Details" theme={theme} />

            <FormField label="Payee Name" required theme={theme}>
              <Input
                value={formData.payeeName}
                onChangeText={(value) => setFormData({ ...formData, payeeName: value })}
                placeholder="Company or individual name"
                error={!!errors.payeeName}
                errorText={errors.payeeName}
              />
            </FormField>

            <FormField label="Payee Address" theme={theme}>
              <Input
                value={formData.payeeAddress}
                onChangeText={(value) => setFormData({ ...formData, payeeAddress: value })}
                placeholder="Street address, city, postal code"
                multiline
                numberOfLines={2}
              />
            </FormField>

            <FormField label="Bank Name" theme={theme}>
              <Input
                value={formData.payeeBankName}
                onChangeText={(value) => setFormData({ ...formData, payeeBankName: value })}
                placeholder="Bank name"
              />
            </FormField>

            <FormField label="Bank Account Number" theme={theme}>
              <Input
                value={formData.payeeBankAccount}
                onChangeText={(value) => setFormData({ ...formData, payeeBankAccount: value })}
                placeholder="Account number"
              />
            </FormField>
          </Card>

          {/* Payment Items */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <XStack alignItems="center" justifyContent="space-between" marginBottom="$4">
              <XStack alignItems="center" gap="$2">
                <View style={[styles.sectionAccent, { backgroundColor: theme.gold }]} />
                <Text fontSize={11} fontWeight="600" letterSpacing={1.2} textTransform="uppercase" color={theme.textMuted}>
                  Payment Items
                </Text>
              </XStack>
              <Pressable
                onPress={addItem}
                style={[styles.addButton, { backgroundColor: theme.goldSoft }]}
              >
                <Plus size={16} color={theme.gold} />
                <Text fontSize={12} fontWeight="600" color={theme.gold}>Add</Text>
              </Pressable>
            </XStack>

            {errors.items && (
              <Text fontSize={12} color={theme.vermillion} marginBottom="$2">
                {errors.items}
              </Text>
            )}

            {items.map((item, index) => (
              <View key={item.id} style={[styles.lineItem, { backgroundColor: theme.bgSecondary }]}>
                <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
                  <Text fontSize={11} fontWeight="600" letterSpacing={0.5} color={theme.textMuted}>
                    Item {String(index + 1).padStart(2, '0')}
                  </Text>
                  {items.length > 1 && (
                    <Pressable onPress={() => removeItem(item.id)} hitSlop={8}>
                      <Trash2 size={18} color={theme.vermillion} />
                    </Pressable>
                  )}
                </XStack>

                <Input
                  value={item.description}
                  onChangeText={(value) => updateItem(item.id, 'description', value)}
                  placeholder="Item description"
                />

                <XStack gap="$2" marginTop="$2">
                  <YStack flex={1}>
                    <Text fontSize={12} color={theme.textMuted} marginBottom="$1">Qty</Text>
                    <Input
                      value={item.quantity.toString()}
                      onChangeText={(value) => updateItem(item.id, 'quantity', parseFloat(value) || 0)}
                      keyboardType="numeric"
                    />
                  </YStack>

                  <YStack flex={1}>
                    <Text fontSize={12} color={theme.textMuted} marginBottom="$1">Unit Price</Text>
                    <Input
                      value={item.unitPrice.toString()}
                      onChangeText={(value) => updateItem(item.id, 'unitPrice', parseFloat(value) || 0)}
                      keyboardType="decimal-pad"
                    />
                  </YStack>
                </XStack>

                <XStack justifyContent="flex-end" marginTop="$2">
                  <Text fontSize={14} fontWeight="600" color={theme.textPrimary}>
                    {document.currency} {item.amount.toFixed(2)}
                  </Text>
                </XStack>
              </View>
            ))}
          </Card>

          {/* Totals */}
          <Card backgroundColor={theme.goldSoft} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Totals" theme={theme} />

            <XStack justifyContent="space-between" marginBottom="$2">
              <Text fontSize={14} color={theme.textSecondary}>Subtotal:</Text>
              <Text fontSize={14} fontWeight="600" color={theme.textPrimary}>
                {document.currency} {subtotal.toFixed(2)}
              </Text>
            </XStack>

            <FormField label="Tax Rate (%)" theme={theme}>
              <Input
                value={formData.taxRate}
                onChangeText={(value) => setFormData({ ...formData, taxRate: value })}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            </FormField>

            {taxAmount > 0 && (
              <XStack justifyContent="space-between" marginBottom="$2">
                <Text fontSize={14} color={theme.textSecondary}>Tax Amount:</Text>
                <Text fontSize={14} fontWeight="600" color={theme.textPrimary}>
                  {document.currency} {taxAmount.toFixed(2)}
                </Text>
              </XStack>
            )}

            <View style={[styles.totalDivider, { borderTopColor: theme.borderMedium }]} />

            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize={16} fontWeight="700" color={theme.textPrimary}>Total:</Text>
              <Text fontSize={18} fontWeight="700" color={theme.gold}>
                {document.currency} {total.toFixed(2)}
              </Text>
            </XStack>
          </Card>

          {/* Request Details */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Request Details" theme={theme} />

            <FormField label="Requested By" required theme={theme}>
              <Input
                value={formData.requestedBy}
                onChangeText={(value) => setFormData({ ...formData, requestedBy: value })}
                placeholder="Name of person requesting"
                error={!!errors.requestedBy}
                errorText={errors.requestedBy}
              />
            </FormField>

            {document.approvedBy && (
              <View style={[styles.approvalBox, { backgroundColor: theme.jadeSoft, borderColor: theme.jade }]}>
                <Text fontSize={12} color={theme.jade} marginBottom={4}>Approved By</Text>
                <Text fontSize={14} fontWeight="600" color={theme.jade}>
                  {typeof document.approvedBy === 'string' ? document.approvedBy : document.approvedBy?.name}
                </Text>
                {document.approvalDate && (
                  <Text fontSize={12} color={theme.jade} marginTop={4}>
                    on {new Date(document.approvalDate).toLocaleDateString()}
                  </Text>
                )}
              </View>
            )}
          </Card>

          {/* Supporting Document */}
          <Card backgroundColor={theme.bgCard} padding="$5" borderRadius={16} style={styles.formCard}>
            <SectionHeader title="Supporting Document" badge="Optional" theme={theme} />

            {/* Show uploaded document */}
            {uploadedDoc && !selectedFile && (
              <View style={[styles.uploadedDocBox, { backgroundColor: theme.bgSecondary, borderColor: theme.borderSubtle }]}>
                <XStack alignItems="center" gap="$3" flex={1}>
                  <View style={[styles.fileIconBox, { backgroundColor: theme.goldSoft }]}>
                    <FileText size={20} color={theme.gold} />
                  </View>
                  <YStack flex={1}>
                    <Text fontSize={14} fontWeight="600" color={theme.textPrimary} numberOfLines={1}>
                      {uploadedDoc.filename}
                    </Text>
                    <Text fontSize={12} color={theme.textMuted}>
                      Uploaded
                    </Text>
                  </YStack>
                  <Pressable onPress={handleRemoveUploadedDoc} hitSlop={8}>
                    <X size={20} color={theme.vermillion} />
                  </Pressable>
                </XStack>
              </View>
            )}

            {/* Show selected file preview */}
            {selectedFile && (
              <View style={[styles.uploadedDocBox, { backgroundColor: theme.goldSoft, borderColor: theme.gold }]}>
                <XStack alignItems="center" gap="$3" flex={1}>
                  {isImageFile(selectedFile.type) ? (
                    <Image source={{ uri: selectedFile.uri }} style={styles.imageThumbnail} />
                  ) : (
                    <View style={[styles.fileIconBox, { backgroundColor: theme.gold }]}>
                      <FileText size={20} color="#FFFFFF" />
                    </View>
                  )}
                  <YStack flex={1}>
                    <Text fontSize={14} fontWeight="600" color={theme.textPrimary} numberOfLines={1}>
                      {selectedFile.name}
                    </Text>
                    <Text fontSize={12} color={theme.textMuted}>
                      {formatFileSize(selectedFile.size)} • Ready to upload
                    </Text>
                  </YStack>
                  <Pressable onPress={handleRemoveFile} hitSlop={8}>
                    <X size={20} color={theme.vermillion} />
                  </Pressable>
                </XStack>
              </View>
            )}

            {/* Upload buttons */}
            {!selectedFile && !uploadedDoc && (
              <YStack gap="$2">
                <Pressable
                  onPress={handlePickDocument}
                  disabled={isUploading}
                  style={[styles.uploadButton, { borderColor: theme.borderMedium, backgroundColor: theme.bgPrimary }]}
                >
                  <Upload size={18} color={theme.textPrimary} />
                  <Text fontSize={14} fontWeight="500" color={theme.textPrimary}>
                    Choose File (PDF or Image)
                  </Text>
                </Pressable>

                <XStack gap="$2">
                  <Pressable
                    onPress={handlePickImage}
                    disabled={isUploading}
                    style={[styles.uploadButton, { flex: 1, borderColor: theme.borderMedium, backgroundColor: theme.bgPrimary }]}
                  >
                    <ImageIcon size={18} color={theme.textPrimary} />
                    <Text fontSize={13} fontWeight="500" color={theme.textPrimary}>
                      Gallery
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleTakePhoto}
                    disabled={isUploading}
                    style={[styles.uploadButton, { flex: 1, borderColor: theme.borderMedium, backgroundColor: theme.bgPrimary }]}
                  >
                    <Camera size={18} color={theme.textPrimary} />
                    <Text fontSize={13} fontWeight="500" color={theme.textPrimary}>
                      Camera
                    </Text>
                  </Pressable>
                </XStack>
              </YStack>
            )}

            {isUploading && (
              <XStack alignItems="center" justifyContent="center" gap="$2" paddingVertical="$3">
                <ActivityIndicator size="small" color={theme.gold} />
                <Text fontSize={13} color={theme.textMuted}>
                  Uploading...
                </Text>
              </XStack>
            )}

            <Text fontSize={12} color={theme.textMuted} marginTop="$3">
              Attach invoices, receipts, or other supporting documents (Max 10MB)
            </Text>
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
          disabled={isSaving}
          style={[styles.saveButton, { backgroundColor: theme.gold, opacity: isSaving ? 0.6 : 1 }]}
        >
          <Text color="#FFFFFF" fontWeight="600" fontSize={14}>
            {isSaving ? 'Saving...' : 'Save Changes'}
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
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  lineItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  totalDivider: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  approvalBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderRadius: 10,
    borderStyle: 'dashed',
  },
  uploadedDocBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  fileIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
})
