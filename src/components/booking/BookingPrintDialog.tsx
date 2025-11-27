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
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Text,
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

              {/* Price Options */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons
                    name="warning-outline"
                    size={18}
                    color={COLORS.kinGold}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.sectionTitle}>Pricing Options</Text>
                </View>

                <Pressable
                  onPress={handleIncludePricesToggle}
                  style={[
                    styles.priceOption,
                    includePrices && styles.priceOptionActive,
                  ]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <View style={styles.categoryCheckbox} pointerEvents="none">
                    {includePrices && (
                      <Ionicons name="checkmark" size={16} color={COLORS.shuVermillion} />
                    )}
                  </View>
                  <View style={styles.priceOptionContent} pointerEvents="none">
                    <Text style={styles.priceOptionTitle}>
                      Include Internal & B2B Prices
                    </Text>
                    <Text style={styles.priceOptionDesc}>
                      For internal reference only - requires confirmation
                    </Text>
                    {includePrices && (
                      <Text style={styles.priceWarning}>
                        Pricing information will be included with "INTERNAL USE ONLY" watermark
                      </Text>
                    )}
                  </View>
                </Pressable>
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
        </View>
      </Modal>

      {/* Price Confirmation Dialog */}
      <Modal
        visible={showPriceConfirmation}
        transparent
        animationType="fade"
        onRequestClose={handlePriceCancel}
      >
        <View style={styles.overlay}>
          <View style={styles.confirmDialog}>
            <View style={styles.confirmHeader}>
              <Ionicons
                name="warning"
                size={24}
                color={COLORS.shuVermillion}
              />
              <Text style={styles.confirmTitle}>
                Confidential Information Warning
              </Text>
            </View>

            <ScrollView style={styles.confirmContent}>
              <Text style={styles.confirmText}>
                You are about to include{' '}
                <Text style={styles.confirmBold}>SENSITIVE PRICING INFORMATION</Text>:
              </Text>

              <View style={styles.confirmList}>
                <Text style={styles.confirmListItem}>• Internal Cost (WIF's vendor cost)</Text>
                <Text style={styles.confirmListItem}>• B2B Price (charged to partners)</Text>
              </View>

              <Text style={[styles.confirmText, styles.confirmWarning]}>
                This information should NEVER be shared with:
              </Text>

              <View style={styles.confirmList}>
                <Text style={[styles.confirmListItem, styles.confirmWarning]}>• External vendors</Text>
                <Text style={[styles.confirmListItem, styles.confirmWarning]}>• End customers</Text>
                <Text style={[styles.confirmListItem, styles.confirmWarning]}>• Unauthorized personnel</Text>
              </View>

              <Text style={styles.confirmText}>
                Only proceed if this document is for internal accounting or management review.
              </Text>

              <View style={styles.confirmInput}>
                <Text style={styles.confirmInputLabel}>
                  Type "CONFIRM" to proceed:
                </Text>
                <TextInput
                  value={confirmText}
                  onChangeText={setConfirmText}
                  placeholder="Type CONFIRM"
                  placeholderTextColor={COLORS.warmGray}
                  style={styles.confirmTextInput}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
            </ScrollView>

            <View style={styles.confirmFooter}>
              <Pressable
                onPress={handlePriceCancel}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handlePriceConfirm}
                disabled={confirmText.toUpperCase() !== 'CONFIRM'}
                style={[
                  styles.confirmActionButton,
                  confirmText.toUpperCase() !== 'CONFIRM' && styles.confirmActionButtonDisabled,
                ]}
              >
                <Text style={styles.confirmActionButtonLabel}>Include Prices</Text>
              </Pressable>
            </View>
          </View>
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
  priceOption: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  priceOptionActive: {
    borderColor: COLORS.shuVermillion,
    backgroundColor: 'rgba(209, 75, 75, 0.05)',
  },
  priceOptionContent: {
    flex: 1,
  },
  priceOptionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.sumiInk,
  },
  priceOptionDesc: {
    fontSize: 12,
    color: COLORS.warmGray,
    marginTop: 2,
  },
  priceWarning: {
    fontSize: 12,
    color: COLORS.shuVermillion,
    fontWeight: '500',
    marginTop: 8,
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
  // Confirmation dialog styles
  confirmDialog: {
    backgroundColor: COLORS.shiroWhite,
    borderRadius: 16,
    margin: 20,
    maxHeight: '80%',
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.shuVermillion,
  },
  confirmContent: {
    padding: 20,
  },
  confirmText: {
    fontSize: 14,
    color: COLORS.sumiInk,
    lineHeight: 20,
    marginBottom: 12,
  },
  confirmBold: {
    fontWeight: '700',
  },
  confirmWarning: {
    color: COLORS.shuVermillion,
    fontWeight: '500',
  },
  confirmList: {
    marginBottom: 16,
  },
  confirmListItem: {
    fontSize: 14,
    color: COLORS.sumiInk,
    marginBottom: 4,
  },
  confirmInput: {
    marginTop: 8,
  },
  confirmInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.sumiInk,
    marginBottom: 8,
  },
  confirmTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.sumiInk,
  },
  confirmFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    gap: 12,
  },
  confirmActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.shuVermillion,
  },
  confirmActionButtonDisabled: {
    backgroundColor: COLORS.lightGray,
    opacity: 0.6,
  },
  confirmActionButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
