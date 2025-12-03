/**
 * Booking Form Print Dialog
 *
 * Modal dialog for selecting booking form print options.
 * Allows choosing pricing display, notes, and other print settings.
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
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Booking } from '../../types'

export interface BookingFormPrintOptions {
  pricingDisplay: 'none' | 'internal' | 'b2b' | 'both'
  includeNotes: boolean
  includeEmptyCategories: boolean
  showProfitMargin: boolean
  showExchangeRate: boolean
}

interface BookingFormPrintDialogProps {
  visible: boolean
  booking: Booking | null
  onDismiss: () => void
  onPrint: (options: BookingFormPrintOptions) => Promise<void>
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

interface PricingOptionProps {
  value: 'none' | 'internal' | 'b2b' | 'both'
  selected: boolean
  title: string
  description: string
  onSelect: () => void
}

const PricingOption = memo(function PricingOption({
  selected,
  title,
  description,
  onSelect,
}: PricingOptionProps) {
  return (
    <Pressable
      onPress={onSelect}
      style={[styles.pricingOption, selected && styles.pricingOptionSelected]}
    >
      <View style={styles.radioOuter}>
        {selected && <View style={styles.radioInner} />}
      </View>
      <View style={styles.pricingOptionContent}>
        <Text style={styles.pricingOptionTitle}>{title}</Text>
        <Text style={styles.pricingOptionDesc}>{description}</Text>
      </View>
    </Pressable>
  )
})

interface OptionToggleProps {
  label: string
  value: boolean
  disabled?: boolean
  onToggle: () => void
}

const OptionToggle = memo(function OptionToggle({
  label,
  value,
  disabled = false,
  onToggle,
}: OptionToggleProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onToggle}
      style={[styles.optionToggle, disabled && styles.optionToggleDisabled]}
    >
      <View style={[styles.checkbox, value && !disabled && styles.checkboxChecked]}>
        {value && !disabled && (
          <Ionicons name="checkmark" size={16} color={COLORS.kinGold} />
        )}
      </View>
      <Text style={[styles.optionLabel, disabled && styles.optionLabelDisabled]}>
        {label}
      </Text>
    </Pressable>
  )
})

export const BookingFormPrintDialog = memo(function BookingFormPrintDialog({
  visible,
  booking,
  onDismiss,
  onPrint,
}: BookingFormPrintDialogProps) {
  const [pricingDisplay, setPricingDisplay] = useState<'none' | 'internal' | 'b2b' | 'both'>('none')
  const [includeNotes, setIncludeNotes] = useState(true)
  const [includeEmptyCategories, setIncludeEmptyCategories] = useState(false)
  const [showExchangeRate, setShowExchangeRate] = useState(true)
  const [showProfitMargin, setShowProfitMargin] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isPrinting, setIsPrinting] = useState(false)

  const requiresConfirmation = pricingDisplay !== 'none'
  const canPrint = !isPrinting && (!requiresConfirmation || confirmText.toUpperCase() === 'CONFIRM')

  const handlePricingChange = useCallback((value: 'none' | 'internal' | 'b2b' | 'both') => {
    setPricingDisplay(value)
    // Reset profit margin if not "both"
    if (value !== 'both') {
      setShowProfitMargin(false)
    }
    // Show confirmation if switching to a pricing option
    if (value !== 'none' && confirmText.toUpperCase() !== 'CONFIRM') {
      setShowConfirmation(true)
    } else {
      setShowConfirmation(false)
    }
  }, [confirmText])

  const handlePrint = useCallback(async () => {
    if (!canPrint) return

    setIsPrinting(true)
    try {
      await onPrint({
        pricingDisplay,
        includeNotes,
        includeEmptyCategories,
        showProfitMargin: pricingDisplay === 'both' ? showProfitMargin : false,
        showExchangeRate,
      })
      // Reset state on success
      setPricingDisplay('none')
      setIncludeNotes(true)
      setIncludeEmptyCategories(false)
      setShowExchangeRate(true)
      setShowProfitMargin(false)
      setConfirmText('')
      setShowConfirmation(false)
      onDismiss()
    } catch (error) {
      console.error('Print failed:', error)
    } finally {
      setIsPrinting(false)
    }
  }, [
    canPrint,
    pricingDisplay,
    includeNotes,
    includeEmptyCategories,
    showProfitMargin,
    showExchangeRate,
    onPrint,
    onDismiss,
  ])

  const handleDismiss = useCallback(() => {
    if (!isPrinting) {
      setPricingDisplay('none')
      setIncludeNotes(true)
      setIncludeEmptyCategories(false)
      setShowExchangeRate(true)
      setShowProfitMargin(false)
      setConfirmText('')
      setShowConfirmation(false)
      onDismiss()
    }
  }, [isPrinting, onDismiss])

  if (!booking) return null

  return (
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
              <Ionicons name="document-text-outline" size={24} color={COLORS.sumiInk} />
              <Text style={styles.headerTitle}>Print Booking Form</Text>
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
            {/* Pricing Display Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pricing Display</Text>
              <View style={styles.pricingOptions}>
                <PricingOption
                  value="none"
                  selected={pricingDisplay === 'none'}
                  title="No Pricing (Vendor-facing)"
                  description="Hide all prices - for external vendors"
                  onSelect={() => handlePricingChange('none')}
                />
                <PricingOption
                  value="internal"
                  selected={pricingDisplay === 'internal'}
                  title="Internal Cost Only"
                  description="Show WIF's vendor costs"
                  onSelect={() => handlePricingChange('internal')}
                />
                <PricingOption
                  value="b2b"
                  selected={pricingDisplay === 'b2b'}
                  title="B2B Price Only"
                  description="Show partner pricing"
                  onSelect={() => handlePricingChange('b2b')}
                />
                <PricingOption
                  value="both"
                  selected={pricingDisplay === 'both'}
                  title="Both (Internal + B2B)"
                  description="Show all pricing - internal use only"
                  onSelect={() => handlePricingChange('both')}
                />
              </View>
            </View>

            {/* Options Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Print Options</Text>
              <View style={styles.optionsList}>
                <OptionToggle
                  label="Include notes"
                  value={includeNotes}
                  onToggle={() => setIncludeNotes(!includeNotes)}
                />
                <OptionToggle
                  label="Show empty categories"
                  value={includeEmptyCategories}
                  onToggle={() => setIncludeEmptyCategories(!includeEmptyCategories)}
                />
                <OptionToggle
                  label="Show exchange rate"
                  value={showExchangeRate}
                  onToggle={() => setShowExchangeRate(!showExchangeRate)}
                />
                <OptionToggle
                  label="Show profit margin"
                  value={showProfitMargin}
                  disabled={pricingDisplay !== 'both'}
                  onToggle={() => setShowProfitMargin(!showProfitMargin)}
                />
              </View>
            </View>

            {/* Confirmation Section - Only if pricing is selected */}
            {requiresConfirmation && (
              <View style={styles.confirmationSection}>
                <View style={styles.confirmationHeader}>
                  <Ionicons name="warning" size={16} color={COLORS.shuVermillion} />
                  <Text style={styles.confirmationTitle}>Confidential Information</Text>
                </View>
                <Text style={styles.confirmationWarning}>
                  You are about to include sensitive pricing information. This document should only
                  be used for internal review and must never be shared with external vendors or
                  customers.
                </Text>
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
                    editable={!isPrinting}
                  />
                </View>
              </View>
            )}
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
                {isPrinting ? 'Generating...' : 'Print Form'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.sumiInk,
    marginBottom: 12,
  },
  pricingOptions: {
    gap: 10,
  },
  pricingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  pricingOptionSelected: {
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
  pricingOptionContent: {
    flex: 1,
  },
  pricingOptionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.sumiInk,
  },
  pricingOptionDesc: {
    fontSize: 12,
    color: COLORS.warmGray,
    marginTop: 2,
  },
  optionsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    overflow: 'hidden',
  },
  optionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  optionToggleDisabled: {
    opacity: 0.5,
  },
  checkbox: {
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
  checkboxChecked: {
    borderColor: COLORS.kinGold,
    backgroundColor: 'rgba(184, 150, 63, 0.08)',
  },
  optionLabel: {
    fontSize: 14,
    color: COLORS.sumiInk,
  },
  optionLabelDisabled: {
    color: COLORS.warmGray,
  },
  confirmationSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: 'rgba(209, 75, 75, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.shuVermillion,
  },
  confirmationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  confirmationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.shuVermillion,
  },
  confirmationWarning: {
    fontSize: 13,
    color: COLORS.warmGray,
    lineHeight: 20,
    marginBottom: 12,
  },
  confirmInputGroup: {
    marginTop: 4,
  },
  confirmInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.sumiInk,
    marginBottom: 8,
  },
  confirmCode: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.sumiInk,
    backgroundColor: 'rgba(245, 243, 239, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confirmTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.lightGray,
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
    borderColor: COLORS.kinGold,
    backgroundColor: 'rgba(184, 150, 63, 0.08)',
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
})
