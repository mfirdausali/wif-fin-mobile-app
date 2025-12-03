/**
 * Booking Detail Screen
 *
 * Matches invoice-details.html design exactly:
 * - Dark sumi-ink header with gold glow accent
 * - Floating booking card overlapping header
 * - Section cards with gold icons
 * - Cost breakdown with WIF/B2B columns
 * - Profit row with jade highlight
 * - Action bar at bottom
 */

import { useState, useEffect, useCallback } from 'react'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  View,
  Pressable,
  Text as RNText,
  Animated,
} from 'react-native'
import { YStack, XStack, Text, ScrollView } from 'tamagui'
import {
  ChevronLeft,
  Plane,
  User,
  Calendar,
  Users,
  DollarSign,
  ChevronRight,
  Edit3,
  FileText,
  Trash2,
  Printer,
  Plus,
  X,
} from '@tamagui/lucide-icons'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  useFonts,
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
  CormorantGaramond_600SemiBold,
} from '@expo-google-fonts/cormorant-garamond'

import { getBooking, deleteBooking } from '../../src/services/bookings/bookingService'
import { useAuthStore } from '../../src/store/authStore'
import { BookingPrintDialog, PrintOptions } from '../../src/components/booking/BookingPrintDialog'
import { BookingFormPrintDialog, BookingFormPrintOptions } from '../../src/components/booking/BookingFormPrintDialog'
import { PdfService, MultiplePDFResult, PDFResult } from '../../src/services/print/pdfService'
import { logBookingEvent } from '../../src/services/activity/activityLogService'
import type { Booking, BookingCostItem } from '../../src/types'
import { BookingDetailSkeletonLoader } from '../../src/components/ui/SkeletonLoader'

// WIF Japan Design System Colors
const COLORS = {
  // Core
  sumiInk: '#1A1815',
  sumiInkLight: '#2D2A26',

  // Accents
  kinGold: '#B8963F',
  kinGoldSoft: 'rgba(184, 150, 63, 0.12)',
  kinGoldGlow: 'rgba(184, 150, 63, 0.15)',

  aiIndigo: '#4A5A7A',
  aiIndigoSoft: 'rgba(74, 90, 122, 0.1)',

  midoriJade: '#4A7A5A',
  midoriJadeSoft: 'rgba(74, 122, 90, 0.1)',

  shuVermillion: '#C75B4A',
  shuVermillionSoft: 'rgba(199, 91, 74, 0.1)',

  // Backgrounds
  bgPrimary: '#FAF8F5',
  bgSecondary: '#F3F0EB',
  bgCard: '#FFFFFF',
  bgSection: '#F7F5F2',

  // Text
  textPrimary: '#1A1815',
  textSecondary: '#5C5650',
  textMuted: '#8C8680',
  textFaint: '#B5B0A8',
  textInverse: '#FFFFFF',

  // Borders
  borderSubtle: 'rgba(26, 24, 21, 0.08)',
  borderMedium: 'rgba(26, 24, 21, 0.12)',
}

// Status badge config
const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  draft: { color: COLORS.textMuted, bg: 'rgba(140, 134, 128, 0.1)', label: 'Draft' },
  planning: { color: COLORS.kinGold, bg: COLORS.kinGoldSoft, label: 'Planning' },
  confirmed: { color: COLORS.midoriJade, bg: COLORS.midoriJadeSoft, label: 'Confirmed' },
  in_progress: { color: COLORS.aiIndigo, bg: COLORS.aiIndigoSoft, label: 'In Progress' },
  completed: { color: COLORS.midoriJade, bg: COLORS.midoriJadeSoft, label: 'Completed' },
  cancelled: { color: COLORS.shuVermillion, bg: COLORS.shuVermillionSoft, label: 'Cancelled' },
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const user = useAuthStore((state) => state.user)

  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
  })

  const [booking, setBooking] = useState<Booking | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [showFormPrintDialog, setShowFormPrintDialog] = useState(false)
  const [fabExpanded, setFabExpanded] = useState(false)

  const fetchBooking = useCallback(async () => {
    if (!id || id === 'new') return

    setIsLoading(true)
    setError(null)

    try {
      const data = await getBooking(id)
      if (data) {
        setBooking(data)
      } else {
        setError('Booking not found')
      }
    } catch (err) {
      console.error('Error fetching booking:', err)
      setError('Failed to load booking')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchBooking()
  }, [fetchBooking])

  const handleBack = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.back()
  }

  const handleEdit = async () => {
    if (!booking) return
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push(`/booking/edit/${booking.id}`)
  }

  const handleDelete = async () => {
    if (!booking) return

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)

    Alert.alert(
      'Delete Booking',
      `Are you sure you want to delete "${booking.guestName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true)
            try {
              const success = await deleteBooking(booking.id)
              if (success) {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                Alert.alert('Deleted', 'Booking has been deleted.', [
                  { text: 'OK', onPress: () => router.back() },
                ])
              } else {
                throw new Error('Failed to delete')
              }
            } catch (err) {
              console.error('Error deleting booking:', err)
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
              Alert.alert('Error', 'Failed to delete booking. Please try again.')
            } finally {
              setIsDeleting(false)
            }
          },
        },
      ]
    )
  }

  const toggleFab = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setFabExpanded(!fabExpanded)
  }

  const handleFabAction = async (action: 'edit' | 'print' | 'printForm' | 'delete') => {
    setFabExpanded(false)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    switch (action) {
      case 'edit':
        handleEdit()
        break
      case 'print':
        handlePrint()
        break
      case 'printForm':
        handlePrintForm()
        break
      case 'delete':
        handleDelete()
        break
    }
  }

  const handlePrint = async () => {
    if (!booking) return
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setShowPrintDialog(true)
  }

  const handlePrintForm = async () => {
    if (!booking) return
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setShowFormPrintDialog(true)
  }

  const handleFormPrint = async (options: BookingFormPrintOptions) => {
    if (!booking || !user) return

    try {
      // Pass user info for "Printed by" in PDF footer
      const printerInfo = {
        userName: user.name || user.username || 'Unknown User',
        printDate: new Date().toISOString(),
      }

      const result = await PdfService.downloadBookingForm(booking, options, undefined, printerInfo)
      if (result.success && result.filePath) {
        await PdfService.sharePDF(result.filePath)
      } else {
        Alert.alert('Error', 'Failed to generate PDF')
      }
    } catch (error) {
      console.error('Failed to print booking form:', error)
      Alert.alert('Error', 'Failed to generate PDF')
    }
  }

  const handlePrintSubmit = async (options: PrintOptions) => {
    if (!booking || !user) return

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

      // Pass user info for "Printed by" in PDF footer
      const printerInfo = {
        userName: user.name || user.username || 'Unknown User',
        printDate: new Date().toISOString(),
      }

      const result = await PdfService.generateBookingCards(
        booking,
        {
          categories: options.categories,
          includePrices: options.includePrices,
          outputFormat: options.outputFormat,
        },
        undefined, // companyInfo - server fetches from Supabase
        printerInfo
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate PDF')
      }

      // Log the print event
      logBookingEvent('booking:card_printed', {
        id: user.id,
        username: user.username,
        name: user.name,
      }, {
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        guestName: booking.guestName,
        status: booking.status,
      }, {
        categories: options.categories,
        includePrices: options.includePrices,
        outputFormat: options.outputFormat,
      })

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

      // Handle sharing based on result type (not output format)
      // When there's only 1 category, API returns a single PDF regardless of outputFormat
      if ('filePath' in result && result.filePath) {
        // Single PDF - share directly
        const shared = await PdfService.sharePDF(result.filePath)
        if (!shared) {
          Alert.alert('Success', 'PDF generated but sharing is not available on this device.')
        }
      } else if ('files' in result && result.files && result.files.length > 0) {
        // Multiple PDFs - ask how to share
        Alert.alert(
          'PDFs Generated',
          `${result.files.length} booking card(s) ready.`,
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Share All',
              onPress: async () => {
                const multiResult = result as MultiplePDFResult
                if (multiResult.files) {
                  await PdfService.shareMultiplePDFs(multiResult.files)
                }
              },
            },
          ]
        )
      }
    } catch (err) {
      console.error('Print error:', err)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert(
        'Print Error',
        err instanceof Error ? err.message : 'Failed to generate booking cards. Please try again.'
      )
      throw err // Re-throw to keep dialog open
    }
  }

  const formatCurrency = (amount: number, currency: string = 'JPY') => {
    if (currency === 'MYR') {
      return { symbol: 'RM', value: amount.toLocaleString('en-MY', { minimumFractionDigits: 2 }) }
    }
    return { symbol: '¥', value: amount.toLocaleString() }
  }

  const formatDate = (dateString: string): string => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return dateString
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    } catch {
      return dateString
    }
  }

  const getInitials = (name: string): string => {
    if (!name) return '??'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }

  // Get cost items for display
  const getCostItems = (booking: Booking): { category: string; description: string; wifCost: number; b2bPrice: number }[] => {
    const items: { category: string; description: string; wifCost: number; b2bPrice: number }[] = []

    const addItems = (categoryName: string, costItems?: BookingCostItem[]) => {
      if (!costItems || costItems.length === 0) return
      costItems.forEach((item) => {
        items.push({
          category: categoryName,
          description: item.description || `${item.quantity || 1}x item`,
          wifCost: item.internalTotal || 0,
          b2bPrice: item.b2bTotal || 0,
        })
      })
    }

    addItems('Transportation', booking.transportation)
    addItems('Accommodation', booking.accommodation)
    addItems('Meals', booking.meals)
    addItems('Entrance Fees', booking.entranceFees)
    addItems('Tour Guide', booking.tourGuides)
    addItems('Flights', booking.flights)
    addItems('Other', booking.other)

    return items
  }

  // Loading state - show skeleton that matches the page structure
  if (isLoading || !fontsLoaded) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <BookingDetailSkeletonLoader paddingTop={insets.top} />
      </>
    )
  }

  // Error state
  if (error || !booking) {
    return (
      <YStack flex={1} backgroundColor={COLORS.bgPrimary}>
        <Stack.Screen options={{ headerShown: false }} />
        <LinearGradient
          colors={[COLORS.sumiInk, COLORS.sumiInkLight]}
          style={[styles.header, { paddingTop: insets.top }]}
        >
          <Pressable onPress={handleBack} style={styles.backButton}>
            <ChevronLeft size={20} color="rgba(255,255,255,0.8)" />
            <RNText style={styles.backText}>Back</RNText>
          </Pressable>
          <RNText style={styles.headerTitle}>Booking</RNText>
          <View style={{ width: 36 }} />
        </LinearGradient>

        <YStack flex={1} justifyContent="center" alignItems="center" padding="$6">
          <Text fontSize={18} fontWeight="600" color={COLORS.textPrimary}>
            {error || 'Booking not found'}
          </Text>
          <Pressable onPress={handleBack} style={styles.goBackButton}>
            <RNText style={styles.goBackText}>Go Back</RNText>
          </Pressable>
        </YStack>
      </YStack>
    )
  }

  // Booking data
  const status = booking.status || 'draft'
  const statusInfo = statusConfig[status] || statusConfig.draft
  const costItems = getCostItems(booking)
  const b2bTotal = formatCurrency(booking.totalB2BCostJPY || 0, 'JPY')
  const wifTotal = formatCurrency(booking.totalInternalCostJPY || 0, 'JPY')
  const profit = formatCurrency(booking.totalProfitJPY || 0, 'JPY')

  return (
    <YStack flex={1} backgroundColor={COLORS.bgSecondary}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Dark Header with Gold Glow */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={[COLORS.sumiInk, COLORS.sumiInkLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top }]}
        >
          {/* Gold glow - true radial gradient using SVG */}
          <View style={styles.goldGlowContainer}>
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient
                  id="goldGlow"
                  cx="85%"
                  cy="35%"
                  rx="70%"
                  ry="60%"
                  fx="85%"
                  fy="35%"
                >
                  <Stop offset="0%" stopColor="#B8963F" stopOpacity="0.15" />
                  <Stop offset="50%" stopColor="#B8963F" stopOpacity="0.06" />
                  <Stop offset="70%" stopColor="#B8963F" stopOpacity="0" />
                  <Stop offset="100%" stopColor="#B8963F" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#goldGlow)" />
            </Svg>
          </View>

          <View style={styles.headerNav}>
            <Pressable onPress={handleBack} style={styles.backButton}>
              <ChevronLeft size={20} color="rgba(255,255,255,0.8)" />
              <RNText style={styles.backText}>Back</RNText>
            </Pressable>

            <RNText style={styles.headerTitle}>Booking Details</RNText>

            <View style={{ width: 80 }} />
          </View>
        </LinearGradient>

        {/* Floating Booking Card - positioned on top of header */}
        <View style={styles.bookingCard}>
          <View style={styles.bookingTop}>
            <View style={styles.bookingIdRow}>
              <Plane size={18} color={COLORS.kinGold} />
              <RNText style={styles.bookingId}>{booking.bookingNumber}</RNText>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
              <RNText style={[styles.statusText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </RNText>
            </View>
          </View>

          <RNText style={styles.guestName}>{booking.guestName}</RNText>

          <View style={styles.bookingMeta}>
            <View style={styles.metaItem}>
              <Calendar size={14} color={COLORS.textMuted} />
              <RNText style={styles.metaText}>
                {formatDate(booking.startDate)} – {formatDate(booking.endDate)}
              </RNText>
            </View>
            <View style={styles.metaItem}>
              <Users size={14} color={COLORS.textMuted} />
              <RNText style={styles.metaText}>{booking.pax} pax</RNText>
            </View>
          </View>

          {/* Linked Invoice Indicator */}
          {booking.linkedDocumentId && (
            <Pressable
              style={styles.linkedInvoice}
              onPress={() => router.push(`/document/${booking.linkedDocumentId}?type=invoice`)}
            >
              <View style={styles.linkedInvoiceLeft}>
                <FileText size={14} color={COLORS.kinGold} />
                <RNText style={styles.linkedInvoiceText}>Invoice linked</RNText>
              </View>
              <ChevronRight size={16} color={COLORS.kinGold} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* Content */}
        <View style={styles.content}>
          {/* Guest Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleGroup}>
                <View style={styles.sectionIcon}>
                  <User size={15} color={COLORS.kinGold} />
                </View>
                <RNText style={styles.sectionTitle}>Guest</RNText>
              </View>
            </View>
            <Pressable style={styles.customerRow}>
              <View style={styles.customerAvatar}>
                <RNText style={styles.customerAvatarText}>{getInitials(booking.guestName)}</RNText>
              </View>
              <View style={styles.customerInfo}>
                <RNText style={styles.customerName}>{booking.guestName}</RNText>
              </View>
              <ChevronRight size={18} color={COLORS.textFaint} />
            </Pressable>
          </View>

          {/* Trip Details Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleGroup}>
                <View style={styles.sectionIcon}>
                  <Calendar size={15} color={COLORS.kinGold} />
                </View>
                <RNText style={styles.sectionTitle}>Trip Details</RNText>
              </View>
            </View>
            <View style={styles.infoRow}>
              <RNText style={styles.infoLabel}>Start Date</RNText>
              <RNText style={styles.infoValue}>{formatDate(booking.startDate)}</RNText>
            </View>
            <View style={styles.infoRow}>
              <RNText style={styles.infoLabel}>End Date</RNText>
              <RNText style={styles.infoValue}>{formatDate(booking.endDate)}</RNText>
            </View>
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <RNText style={styles.infoLabel}>Passengers</RNText>
              <RNText style={styles.infoValue}>{booking.pax} pax</RNText>
            </View>
          </View>

          {/* Cost Breakdown Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleGroup}>
                <View style={styles.sectionIcon}>
                  <DollarSign size={15} color={COLORS.kinGold} />
                </View>
                <RNText style={styles.sectionTitle}>Cost Breakdown</RNText>
              </View>
              <RNText style={styles.sectionCount}>{costItems.length} items</RNText>
            </View>

            {/* Cost Table Header */}
            <View style={styles.costTableHeader}>
              <RNText style={[styles.costHeaderText, { flex: 1 }]}>Category</RNText>
              <RNText style={[styles.costHeaderText, styles.costHeaderRight]}>WIF Cost</RNText>
              <RNText style={[styles.costHeaderText, styles.costHeaderRight]}>B2B Price</RNText>
            </View>

            {/* Cost Items */}
            {costItems.length > 0 ? (
              costItems.map((item, index) => {
                const wif = formatCurrency(item.wifCost, 'JPY')
                const b2b = formatCurrency(item.b2bPrice, 'JPY')
                return (
                  <View
                    key={index}
                    style={[styles.costRow, index === costItems.length - 1 && styles.costRowLast]}
                  >
                    <View style={styles.costRowLeft}>
                      <RNText style={styles.costCategory}>{item.category}</RNText>
                      <RNText style={styles.costDescription} numberOfLines={2}>
                        {item.description}
                      </RNText>
                    </View>
                    <RNText style={styles.costWif}>{wif.symbol} {wif.value}</RNText>
                    <RNText style={styles.costB2b}>{b2b.symbol} {b2b.value}</RNText>
                  </View>
                )
              })
            ) : (
              <View style={styles.emptyState}>
                <RNText style={styles.emptyText}>No cost items added yet</RNText>
              </View>
            )}

            {/* Totals */}
            <View style={styles.totals}>
              <View style={styles.totalRow}>
                <RNText style={styles.totalLabel}>Total</RNText>
                <RNText style={styles.totalWifValue}>{wifTotal.symbol} {wifTotal.value}</RNText>
                <RNText style={styles.totalB2bValue}>{b2bTotal.symbol} {b2bTotal.value}</RNText>
              </View>
            </View>

            {/* Profit Row */}
            <View style={styles.profitRow}>
              <RNText style={styles.profitLabel}>Estimated Profit</RNText>
              <RNText style={styles.profitValue}>
                + {profit.symbol} {profit.value}
                {booking.profitMargin ? ` (${booking.profitMargin.toFixed(1)}%)` : ''}
              </RNText>
            </View>
          </View>

          {/* Notes Section */}
          {booking.notes && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleGroup}>
                  <RNText style={styles.sectionTitle}>Notes</RNText>
                </View>
              </View>
              <View style={styles.notesContent}>
                <RNText style={styles.notesText}>{booking.notes}</RNText>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <View style={[styles.fabContainer, { bottom: insets.bottom + 20 }]}>
        {/* FAB Menu Items - shown when expanded */}
        {fabExpanded && (
          <>
            {/* Backdrop to close FAB */}
            <Pressable
              style={styles.fabBackdrop}
              onPress={() => setFabExpanded(false)}
            />

            {/* Delete Action */}
            <Pressable
              style={[styles.fabAction, styles.fabActionDelete]}
              onPress={() => handleFabAction('delete')}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={COLORS.textInverse} />
              ) : (
                <Trash2 size={18} color={COLORS.textInverse} />
              )}
              <RNText style={styles.fabActionLabel}>Delete</RNText>
            </Pressable>

            {/* Print Form Action */}
            <Pressable
              style={styles.fabAction}
              onPress={() => handleFabAction('printForm')}
              disabled={isDeleting}
            >
              <FileText size={18} color={COLORS.textInverse} />
              <RNText style={styles.fabActionLabel}>Print Form</RNText>
            </Pressable>

            {/* Print Cards Action */}
            <Pressable
              style={styles.fabAction}
              onPress={() => handleFabAction('print')}
              disabled={isDeleting}
            >
              <Printer size={18} color={COLORS.textInverse} />
              <RNText style={styles.fabActionLabel}>Print Cards</RNText>
            </Pressable>

            {/* Edit Action */}
            <Pressable
              style={styles.fabAction}
              onPress={() => handleFabAction('edit')}
              disabled={isDeleting}
            >
              <Edit3 size={18} color={COLORS.textInverse} />
              <RNText style={styles.fabActionLabel}>Edit</RNText>
            </Pressable>
          </>
        )}

        {/* Main FAB Button */}
        <Pressable
          style={[styles.fabMain, fabExpanded && styles.fabMainExpanded]}
          onPress={toggleFab}
        >
          {fabExpanded ? (
            <X size={24} color={COLORS.textInverse} />
          ) : (
            <Plus size={24} color={COLORS.textInverse} />
          )}
        </Pressable>
      </View>

      {/* Print Dialog */}
      <BookingPrintDialog
        visible={showPrintDialog}
        booking={booking}
        onDismiss={() => setShowPrintDialog(false)}
        onPrint={handlePrintSubmit}
      />

      {/* Form Print Dialog */}
      <BookingFormPrintDialog
        visible={showFormPrintDialog}
        booking={booking}
        onDismiss={() => setShowFormPrintDialog(false)}
        onPrint={handleFormPrint}
      />
    </YStack>
  )
}

const styles = StyleSheet.create({
  headerContainer: {
    zIndex: 10,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 80, // Extended padding for card overlap
    position: 'relative',
  },
  goldGlowContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  headerNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    width: 80, // Fixed width for centering
  },
  backText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  headerTitle: {
    fontFamily: 'CormorantGaramond_500Medium',
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.textInverse,
    textAlign: 'center',
    letterSpacing: 0.4,
  },

  // Booking Card - overlaps header significantly like in the design
  bookingCard: {
    backgroundColor: COLORS.bgCard,
    marginHorizontal: 16,
    marginTop: -60, // Pull up significantly into header area
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: COLORS.sumiInk,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 12,
  },
  bookingTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bookingIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bookingId: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textMuted,
    letterSpacing: 0.3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  guestName: {
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 28,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  bookingMeta: {
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  linkedInvoice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  linkedInvoiceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkedInvoiceText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.kinGold,
  },

  // Content
  content: {
    padding: 16,
    paddingTop: 0, // No top padding since card has marginBottom
  },

  // Section Card
  section: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: COLORS.sumiInk,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.bgSection,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    backgroundColor: COLORS.kinGoldSoft,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  sectionCount: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  // Customer Row
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingHorizontal: 16,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    backgroundColor: COLORS.kinGoldSoft,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.kinGold,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },

  // Info Rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },

  // Cost Table
  costTableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.bgSection,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderMedium,
  },
  costHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  costHeaderRight: {
    width: 80,
    textAlign: 'right',
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  costRowLast: {
    borderBottomWidth: 0,
  },
  costRowLeft: {
    flex: 1,
    paddingRight: 8,
  },
  costCategory: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  costDescription: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 15,
  },
  costWif: {
    width: 80,
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
  costB2b: {
    width: 80,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.kinGold,
    textAlign: 'right',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },

  // Totals
  totals: {
    backgroundColor: COLORS.kinGoldSoft,
    borderTopWidth: 2,
    borderTopColor: COLORS.kinGold,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  totalLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  totalWifValue: {
    width: 80,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
  totalB2bValue: {
    width: 80,
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.kinGold,
    textAlign: 'right',
  },

  // Profit Row
  profitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.midoriJadeSoft,
    borderTopWidth: 1,
    borderTopColor: COLORS.midoriJade,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  profitLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.midoriJade,
  },
  profitValue: {
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.midoriJade,
  },

  // Notes
  notesContent: {
    padding: 14,
    paddingHorizontal: 16,
  },
  notesText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },

  // Floating Action Button
  fabContainer: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
    zIndex: 100,
  },
  fabBackdrop: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -100,
    bottom: -100,
    width: 2000,
    height: 2000,
  },
  fabMain: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.kinGold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.sumiInk,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fabMainExpanded: {
    backgroundColor: COLORS.sumiInk,
  },
  fabAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.sumiInk,
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingRight: 20,
    borderRadius: 24,
    marginBottom: 12,
    shadowColor: COLORS.sumiInk,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  fabActionDelete: {
    backgroundColor: COLORS.shuVermillion,
  },
  fabActionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textInverse,
  },

  // Error state
  goBackButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: COLORS.sumiInk,
    borderRadius: 10,
  },
  goBackText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textInverse,
  },
})
