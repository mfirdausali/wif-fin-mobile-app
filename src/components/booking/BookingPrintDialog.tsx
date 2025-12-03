/**
 * Booking Print Dialog
 *
 * Modal dialog for selecting booking card print options.
 * Follows WIF Japan design system.
 */

import React, { useState, useCallback, memo } from 'react'
import {
  Modal,
  View,
  ScrollView,
  Pressable,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Text,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Booking } from '../../types'
import {
  getCategoriesWithCounts,
  CATEGORY_LABELS,
} from '../../services/print/pdfService'

export interface PrintOptions {
  categories: string[]
  includePrices: boolean
  outputFormat: 'combined' | 'separate'
}

interface BookingPrintDialogProps {
  visible: boolean
  booking: Booking | null
  onDismiss: () => void
  onPrint: (options: PrintOptions) => Promise<void>
}

// Category icons mapping
const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  transportation: 'car-outline',
  meals: 'restaurant-outline',
  entrance_fees: 'ticket-outline',
  tour_guides: 'people-outline',
  flights: 'airplane-outline',
  accommodation: 'bed-outline',
  other: 'ellipsis-horizontal-outline',
}

// WIF Japan design colors
const COLORS = {
  sumiInk: '#1A1815',
  kinGold: '#B8963F',
  midoriJade: '#4A7A5A',
  shuVermillion: '#D14B4B',
  shiroWhite: '#F5F3EF',
  warmGray: '#6B6560',
  lightGray: '#E8E6E2',
}

interface CategoryItemProps {
  category: { key: string; label: string; count: number }
  selected: boolean
  onToggle: () => void
}

const CategoryItem = memo(function CategoryItem({
  category,
  selected,
  onToggle,
}: CategoryItemProps) {
  const disabled = category.count === 0
  const iconName = CATEGORY_ICONS[category.key] || 'ellipsis-horizontal-outline'

  return (
    <Pressable
      onPress={disabled ? undefined : onToggle}
      style={[
        styles.categoryItem,
        selected && styles.categoryItemSelected,
        disabled && styles.categoryItemDisabled,
      ]}
    >
      <View style={styles.categoryCheckbox}>
        {selected && !disabled && (
          <Ionicons name="checkmark" size={16} color={COLORS.kinGold} />
        )}
      </View>
      <Ionicons
        name={iconName}
        size={20}
        color={disabled ? COLORS.warmGray : COLORS.sumiInk}
        style={styles.categoryIcon}
      />
      <Text
        style={[
          styles.categoryLabel,
          disabled && styles.categoryLabelDisabled,
        ]}
      >
        {category.label}
      </Text>
      <View
        style={[
          styles.categoryBadge,
          category.count > 0 ? styles.categoryBadgeActive : styles.categoryBadgeInactive,
        ]}
      >
        <Text
          style={[
            styles.categoryBadgeText,
            category.count > 0 ? styles.categoryBadgeTextActive : styles.categoryBadgeTextInactive,
          ]}
        >
          {category.count} {category.count === 1 ? 'item' : 'items'}
        </Text>
      </View>
    </Pressable>
  )
})

interface OutputFormatOptionProps {
  value: 'combined' | 'separate'
  selected: boolean
  title: string
  description: string
  onSelect: () => void
}

const OutputFormatOption = memo(function OutputFormatOption({
  selected,
  title,
  description,
  onSelect,
}: OutputFormatOptionProps) {
  return (
    <Pressable
      onPress={onSelect}
      style={[styles.formatOption, selected && styles.formatOptionSelected]}
    >
      <View style={styles.radioOuter}>
        {selected && <View style={styles.radioInner} />}
      </View>
      <View style={styles.formatOptionContent}>
        <Text style={styles.formatOptionTitle}>{title}</Text>
        <Text style={styles.formatOptionDesc}>{description}</Text>
      </View>
    </Pressable>
  )
})

export const BookingPrintDialog = memo(function BookingPrintDialog({
  visible,
  booking,
  onDismiss,
  onPrint,
}: BookingPrintDialogProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [outputFormat, setOutputFormat] = useState<'combined' | 'separate'>('separate')
  const [includePrices, setIncludePrices] = useState(false)
  const [showPriceConfirmation, setShowPriceConfirmation] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isPrinting, setIsPrinting] = useState(false)

  const categories = booking ? getCategoriesWithCounts(booking) : []
  const hasAnyItems = categories.some((cat) => cat.count > 0)
  const canPrint = selectedCategories.length > 0 && !isPrinting

  const handleCategoryToggle = useCallback((key: string) => {
    setSelectedCategories((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key]
    )
  }, [])

  const handleSelectAll = useCallback(() => {
    const allWithItems = categories.filter((cat) => cat.count > 0).map((cat) => cat.key)
    setSelectedCategories(allWithItems)
  }, [categories])

  const handleDeselectAll = useCallback(() => {
    setSelectedCategories([])
  }, [])

  const handleIncludePricesToggle = useCallback(() => {
    if (!includePrices) {
      setShowPriceConfirmation(true)
    } else {
      setIncludePrices(false)
    }
  }, [includePrices])

  const handlePriceConfirm = useCallback(() => {
    if (confirmText.toUpperCase() === 'CONFIRM') {
      setIncludePrices(true)
      setShowPriceConfirmation(false)
      setConfirmText('')
    }
  }, [confirmText])

  const handlePriceCancel = useCallback(() => {
    setShowPriceConfirmation(false)
    setConfirmText('')
  }, [])

  const handlePrint = useCallback(async () => {
    if (!canPrint) return

    setIsPrinting(true)
    try {
      await onPrint({
        categories: selectedCategories,
        includePrices,
        outputFormat,
      })
      // Reset state on success
      setSelectedCategories([])
      setOutputFormat('separate')
      setIncludePrices(false)
      onDismiss()
    } catch (error) {
      console.error('Print failed:', error)
    } finally {
      setIsPrinting(false)
    }
  }, [canPrint, selectedCategories, includePrices, outputFormat, onPrint, onDismiss])

  const handleDismiss = useCallback(() => {
    if (!isPrinting) {
      setSelectedCategories([])
      setOutputFormat('separate')
      setIncludePrices(false)
      setConfirmText('')
      onDismiss()
    }
  }, [isPrinting, onDismiss])

  if (!booking) return null

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={handleDismiss}
      >
        <View style={styles.overlay}>
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <Ionicons name="print-outline" size={24} color={COLORS.sumiInk} />
                <Text style={styles.headerTitle}>Print Booking Cards</Text>
              </View>
              <Text style={styles.headerSubtitle}>
                {booking.bookingNumber} - {booking.guestName}
              </Text>
              <Pressable
                onPress={handleDismiss}
                style={styles.closeButton}
                disabled={isPrinting}
              >
                <Ionicons name="close" size={24} color={COLORS.warmGray} />
              </Pressable>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Category Selection */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Select Categories to Print</Text>
                  <View style={styles.sectionActions}>
                    <Pressable
                      onPress={handleSelectAll}
                      disabled={!hasAnyItems}
                      style={styles.actionButton}
                    >
                      <Text
                        style={[
                          styles.actionButtonText,
                          !hasAnyItems && styles.actionButtonTextDisabled,
                        ]}
                      >
                        Select All
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={handleDeselectAll}
                      disabled={selectedCategories.length === 0}
                      style={styles.actionButton}
                    >
                      <Text
                        style={[
                          styles.actionButtonText,
                          selectedCategories.length === 0 && styles.actionButtonTextDisabled,
                        ]}
                      >
                        Clear
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.categoriesList}>
                  {categories.map((category) => (
                    <CategoryItem
                      key={category.key}
                      category={category}
                      selected={selectedCategories.includes(category.key)}
                      onToggle={() => handleCategoryToggle(category.key)}
                    />
                  ))}
                </View>
              </View>

              {/* Output Format */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Output Format</Text>
                <View style={styles.formatOptions}>
                  <OutputFormatOption
                    value="separate"
                    selected={outputFormat === 'separate'}
                    title="Separate Documents"
                    description="One PDF per category (recommended for vendors)"
                    onSelect={() => setOutputFormat('separate')}
                  />
                  <OutputFormatOption
                    value="combined"
                    selected={outputFormat === 'combined'}
                    title="Combined Document"
                    description="All categories in one PDF"
                    onSelect={() => setOutputFormat('combined')}
                  />
                </View>
              </View>

              {/* Price Options - Sensitive/Discouraged */}
              <View style={styles.sensitiveSection}>
                <View style={styles.sensitiveSectionHeader}>
                  <Ionicons
                    name="warning"
                    size={16}
                    color={COLORS.warmGray}
                  />
                  <Text style={styles.sensitiveSectionTitle}>Sensitive Options</Text>
                </View>

                <TouchableOpacity
                  onPress={handleIncludePricesToggle}
                  activeOpacity={0.7}
                  style={[
                    styles.sensitiveOption,
                    includePrices && styles.sensitiveOptionActive,
                  ]}
                >
                  <View style={[styles.categoryCheckbox, styles.sensitiveCheckbox]}>
                    {includePrices && (
                      <Ionicons name="checkmark" size={16} color={COLORS.shuVermillion} />
                    )}
                  </View>
                  <View style={styles.priceOptionContent}>
                    <Text style={styles.sensitiveOptionTitle}>
                      Include Internal & B2B Prices
                    </Text>
                    <Text style={styles.sensitiveOptionDesc}>
                      Not recommended - requires confirmation
                    </Text>
                    {includePrices && (
                      <View style={styles.sensitiveWarningBadge}>
                        <Ionicons name="alert-circle" size={12} color={COLORS.shuVermillion} />
                        <Text style={styles.sensitiveWarningText}>
                          INTERNAL USE ONLY watermark will be applied
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <Pressable
                onPress={handleDismiss}
                disabled={isPrinting}
                style={[styles.cancelButton, isPrinting && styles.buttonDisabled]}
              >
                <Text style={styles.cancelButtonLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handlePrint}
                disabled={!canPrint}
                style={[styles.printButton, !canPrint && styles.printButtonDisabled]}
              >
                {isPrinting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="document-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.printButtonLabel}>
                  {isPrinting
                    ? 'Generating...'
                    : `Print${selectedCategories.length > 0 ? ` (${selectedCategories.length})` : ''}`}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Price Confirmation Dialog - Rendered as overlay inside modal */}
          {showPriceConfirmation && (
            <View style={styles.confirmOverlay}>
              <View style={styles.confirmDialog}>
                {/* Structured Header with Icon Container */}
                <View style={styles.confirmHeader}>
                  <View style={styles.confirmIconContainer}>
                    <Ionicons
                      name="warning"
                      size={20}
                      color={COLORS.shuVermillion}
                    />
                  </View>
                  <Text style={styles.confirmTitle}>
                    Confidential Information
                  </Text>
                </View>

                <ScrollView style={styles.confirmContent} showsVerticalScrollIndicator={false}>
                  {/* Intro Text */}
                  <Text style={styles.confirmIntro}>
                    You are about to include{' '}
                    <Text style={styles.confirmBold}>SENSITIVE PRICING INFORMATION</Text>:
                  </Text>

                  {/* Info Items Box */}
                  <View style={styles.infoItemsBox}>
                    <View style={styles.infoItem}>
                      <View style={styles.infoBullet} />
                      <Text style={styles.infoItemText}>Internal Cost (WIF's vendor cost)</Text>
                    </View>
                    <View style={styles.infoItem}>
                      <View style={styles.infoBullet} />
                      <Text style={styles.infoItemText}>B2B Price (charged to partners)</Text>
                    </View>
                  </View>

                  {/* Warning Box */}
                  <View style={styles.warningBox}>
                    <Text style={styles.warningLabel}>NEVER SHARE WITH</Text>
                    <View style={styles.warningList}>
                      <View style={styles.warningItem}>
                        <Ionicons name="close" size={14} color={COLORS.shuVermillion} />
                        <Text style={styles.warningItemText}>External vendors</Text>
                      </View>
                      <View style={styles.warningItem}>
                        <Ionicons name="close" size={14} color={COLORS.shuVermillion} />
                        <Text style={styles.warningItemText}>End customers</Text>
                      </View>
                      <View style={styles.warningItem}>
                        <Ionicons name="close" size={14} color={COLORS.shuVermillion} />
                        <Text style={styles.warningItemText}>Unauthorized personnel</Text>
                      </View>
                    </View>
                  </View>

                  {/* Proceed Note */}
                  <Text style={styles.proceedNote}>
                    Only proceed if this document is for internal accounting or management review.
                  </Text>

                  {/* Confirm Input Group */}
                  <View style={styles.confirmInputGroup}>
                    <Text style={styles.confirmInputLabel}>
                      Type <Text style={styles.confirmCode}>CONFIRM</Text> to proceed:
                    </Text>
                    <TextInput
                      value={confirmText}
                      onChangeText={setConfirmText}
                      placeholder="Type CONFIRM"
                      placeholderTextColor={COLORS.warmGray}
                      style={[
                        styles.confirmTextInput,
                        confirmText.toUpperCase() === 'CONFIRM' && styles.confirmTextInputValid,
                      ]}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                  </View>
                </ScrollView>

                {/* Modal Actions */}
                <View style={styles.confirmFooter}>
                  <Pressable
                    onPress={handlePriceCancel}
                    style={styles.confirmCancelButton}
                  >
                    <Text style={styles.confirmCancelButtonLabel}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handlePriceConfirm}
                    disabled={confirmText.toUpperCase() !== 'CONFIRM'}
                    style={[
                      styles.confirmActionButton,
                      confirmText.toUpperCase() !== 'CONFIRM' && styles.confirmActionButtonDisabled,
                    ]}
                  >
                    <Text style={[
                      styles.confirmActionButtonLabel,
                      confirmText.toUpperCase() !== 'CONFIRM' && styles.confirmActionButtonLabelDisabled,
                    ]}>Include Prices</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </>
  )
})

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    backgroundColor: COLORS.shiroWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    padding: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.sumiInk,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.warmGray,
    marginTop: 4,
    marginLeft: 34,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.sumiInk,
  },
  sectionActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionButtonText: {
    fontSize: 13,
    color: COLORS.kinGold,
    fontWeight: '500',
  },
  actionButtonTextDisabled: {
    color: COLORS.warmGray,
  },
  categoriesList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    overflow: 'hidden',
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  categoryItemSelected: {
    backgroundColor: 'rgba(184, 150, 63, 0.08)',
  },
  categoryItemDisabled: {
    opacity: 0.5,
  },
  categoryCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.lightGray,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  categoryIcon: {
    marginRight: 10,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 14,
    color: COLORS.sumiInk,
  },
  categoryLabelDisabled: {
    color: COLORS.warmGray,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  categoryBadgeActive: {
    backgroundColor: 'rgba(184, 150, 63, 0.15)',
  },
  categoryBadgeInactive: {
    backgroundColor: COLORS.lightGray,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  categoryBadgeTextActive: {
    color: COLORS.kinGold,
  },
  categoryBadgeTextInactive: {
    color: COLORS.warmGray,
  },
  formatOptions: {
    gap: 10,
  },
  formatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  formatOptionSelected: {
    borderColor: COLORS.kinGold,
    backgroundColor: 'rgba(184, 150, 63, 0.05)',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.lightGray,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.kinGold,
  },
  formatOptionContent: {
    flex: 1,
  },
  formatOptionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.sumiInk,
  },
  formatOptionDesc: {
    fontSize: 12,
    color: COLORS.warmGray,
    marginTop: 2,
  },
  // Sensitive/Discouraged section styles
  sensitiveSection: {
    marginBottom: 24,
    opacity: 0.75,
  },
  sensitiveSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sensitiveSectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.warmGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sensitiveOption: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: 'rgba(107, 101, 96, 0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(107, 101, 96, 0.15)',
    borderStyle: 'dashed',
  },
  sensitiveOptionActive: {
    borderColor: COLORS.shuVermillion,
    borderStyle: 'solid',
    backgroundColor: 'rgba(209, 75, 75, 0.08)',
    opacity: 1,
  },
  sensitiveCheckbox: {
    borderColor: 'rgba(107, 101, 96, 0.3)',
  },
  priceOptionContent: {
    flex: 1,
  },
  sensitiveOptionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.warmGray,
  },
  sensitiveOptionDesc: {
    fontSize: 12,
    color: COLORS.warmGray,
    marginTop: 2,
    fontStyle: 'italic',
  },
  sensitiveWarningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(209, 75, 75, 0.1)',
    borderRadius: 6,
  },
  sensitiveWarningText: {
    fontSize: 11,
    color: COLORS.shuVermillion,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.lightGray,
    backgroundColor: '#FFFFFF',
  },
  cancelButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.warmGray,
  },
  printButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.kinGold,
  },
  printButtonDisabled: {
    backgroundColor: COLORS.lightGray,
    opacity: 0.6,
  },
  printButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Confirmation dialog styles - WIF Japan Design System
  confirmDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '90%',
    maxWidth: 340,
    maxHeight: '85%',
    overflow: 'hidden',
    shadowColor: COLORS.sumiInk,
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.25,
    shadowRadius: 50,
    elevation: 25,
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(199, 91, 74, 0.1)',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.shuVermillion,
  },
  confirmIconContainer: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(199, 91, 74, 0.15)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.shuVermillion,
    letterSpacing: -0.2,
  },
  confirmContent: {
    padding: 20,
  },
  confirmIntro: {
    fontSize: 14,
    color: COLORS.sumiInk,
    lineHeight: 21,
    marginBottom: 16,
  },
  confirmBold: {
    fontWeight: '700',
    color: COLORS.sumiInk,
  },
  // Info Items Box
  infoItemsBox: {
    backgroundColor: '#F7F5F2',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
  },
  infoBullet: {
    width: 6,
    height: 6,
    backgroundColor: COLORS.warmGray,
    borderRadius: 3,
    marginTop: 6,
  },
  infoItemText: {
    fontSize: 13,
    color: '#5C5650',
    lineHeight: 18,
    flex: 1,
  },
  // Warning Box
  warningBox: {
    backgroundColor: 'rgba(199, 91, 74, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.shuVermillion,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  warningLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.shuVermillion,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  warningList: {
    gap: 6,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.shuVermillion,
  },
  // Proceed Note
  proceedNote: {
    fontSize: 13,
    color: '#5C5650',
    lineHeight: 20,
    marginBottom: 16,
  },
  // Confirm Input Group
  confirmInputGroup: {
    marginBottom: 4,
  },
  confirmInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5C5650',
    marginBottom: 8,
  },
  confirmCode: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.sumiInk,
    backgroundColor: '#F7F5F2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confirmTextInput: {
    backgroundColor: '#F7F5F2',
    borderWidth: 1.5,
    borderColor: 'rgba(26, 24, 21, 0.12)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontWeight: '500',
    color: COLORS.sumiInk,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  confirmTextInputValid: {
    borderColor: COLORS.shuVermillion,
    backgroundColor: 'rgba(199, 91, 74, 0.1)',
  },
  // Modal Actions
  confirmFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 20,
  },
  confirmCancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#FAF8F5',
    borderWidth: 1.5,
    borderColor: 'rgba(26, 24, 21, 0.12)',
  },
  confirmCancelButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5C5650',
  },
  confirmActionButton: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.shuVermillion,
  },
  confirmActionButtonDisabled: {
    backgroundColor: '#B5B0A8',
  },
  confirmActionButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  confirmActionButtonLabelDisabled: {
    color: '#FFFFFF',
  },
})
