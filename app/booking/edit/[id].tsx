/**
 * Edit Booking Screen - Full Cost Management
 *
 * Edit an existing booking with trip details, cost breakdown by category,
 * and automatic profit calculation.
 */

import { useState, useEffect, useCallback, memo } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import {
  YStack,
  XStack,
  Text,
  ScrollView,
  TextArea,
} from 'tamagui'
import {
  ArrowLeft,
  Plane,
  Calendar,
  Users,
  User,
  FileText,
  AlertCircle,
  Plus,
  X,
  Car,
  Utensils,
  Ticket,
  UserCheck,
  PlaneTakeoff,
  Building2,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  DollarSign,
} from '@tamagui/lucide-icons'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'

import {
  Card,
  Button,
  IconButton,
  Input,
} from '../../../src/components/ui'
import { getBooking, updateBooking } from '../../../src/services/bookings/bookingService'
import { logBookingEvent } from '../../../src/services/activity/activityLogService'
import { useAuthStore } from '../../../src/store/authStore'
import { getAppTheme } from '../../../src/constants/theme'
import { useThemeStore } from '../../../src/store/themeStore'
import type {
  Booking,
  BookingStatus,
  BookingCostItem,
  CostCategory,
} from '../../../src/types'
import {
  calculateItemTotals,
  calculateBookingTotals,
  createEmptyCostItem,
  COST_CATEGORY_LABELS,
} from '../../../src/types/booking'

// Status options
const statusOptions: { value: BookingStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'planning', label: 'Planning' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

// Category icons
const categoryIcons: Record<CostCategory, any> = {
  transportation: Car,
  meals: Utensils,
  entrance_fees: Ticket,
  tour_guides: UserCheck,
  flights: PlaneTakeoff,
  accommodation: Building2,
  other: MoreHorizontal,
}

// Helper functions
const formatDate = (dateStr: string) => {
  if (!dateStr) return 'Select date'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatCurrency = (amount: number, currency: 'JPY' | 'MYR' = 'JPY') => {
  if (currency === 'MYR') {
    return `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`
  }
  return `¥${amount.toLocaleString()}`
}

// Form field wrapper
function FormField({
  label,
  icon: Icon,
  children,
  required,
  theme,
}: {
  label: string
  icon?: any
  children: React.ReactNode
  required?: boolean
  theme: any
}) {
  return (
    <YStack marginBottom="$4">
      <XStack alignItems="center" gap="$2" marginBottom="$2">
        {Icon && <Icon size={16} color={theme.textSecondary} />}
        <Text fontSize={13} fontWeight="500" color={theme.textSecondary}>
          {label}
          {required && <Text color={theme.vermillion}> *</Text>}
        </Text>
      </XStack>
      {children}
    </YStack>
  )
}

// Section header
function SectionHeader({
  title,
  badge,
  theme,
}: {
  title: string
  badge?: string
  theme: any
}) {
  return (
    <XStack alignItems="center" justifyContent="space-between" marginBottom="$3">
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
  )
}

// Cost item editor - extracted as proper component for correct key handling
interface CostItemEditorProps {
  item: BookingCostItem
  index: number
  category: CostCategory
  theme: any
  onUpdate: (category: CostCategory, itemId: string, field: keyof BookingCostItem, value: any) => void
  onRemove: (category: CostCategory, itemId: string) => void
  formatCurrency: (amount: number) => string
}

const CostItemEditor = memo(function CostItemEditor({
  item,
  index,
  category,
  theme,
  onUpdate,
  onRemove,
  formatCurrency,
}: CostItemEditorProps) {
  return (
    <View
      style={[styles.costItem, { backgroundColor: theme.bgSecondary, borderColor: theme.borderSubtle }]}
    >
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
        <Text fontSize={12} fontWeight="600" color={theme.textMuted}>
          Item {String(index + 1).padStart(2, '0')}
        </Text>
        <Pressable
          onPress={() => onRemove(category, item.id)}
          style={[styles.deleteBtn, { backgroundColor: theme.vermillionSoft }]}
        >
          <X size={14} color={theme.vermillion} />
        </Pressable>
      </XStack>

      <Input
        value={item.description}
        onChangeText={(val) => onUpdate(category, item.id, 'description', val)}
        placeholder="Description"
        inputSize="sm"
      />

      <XStack gap="$2" marginTop="$2">
        <YStack flex={1}>
          <Text fontSize={11} color={theme.textMuted} marginBottom="$1">Qty</Text>
          <Input
            value={item.quantity.toString()}
            onChangeText={(val) => onUpdate(category, item.id, 'quantity', parseInt(val) || 0)}
            keyboardType="number-pad"
            inputSize="sm"
          />
        </YStack>
        <YStack flex={1}>
          <Text fontSize={11} color={theme.textMuted} marginBottom="$1">WIF Cost (¥)</Text>
          <Input
            value={item.internalPrice.toString()}
            onChangeText={(val) => onUpdate(category, item.id, 'internalPrice', parseFloat(val) || 0)}
            keyboardType="decimal-pad"
            inputSize="sm"
          />
        </YStack>
        <YStack flex={1}>
          <Text fontSize={11} color={theme.textMuted} marginBottom="$1">B2B Price (¥)</Text>
          <Input
            value={item.b2bPrice.toString()}
            onChangeText={(val) => onUpdate(category, item.id, 'b2bPrice', parseFloat(val) || 0)}
            keyboardType="decimal-pad"
            inputSize="sm"
          />
        </YStack>
      </XStack>

      {/* Item profit display */}
      <XStack justifyContent="flex-end" marginTop="$2" gap="$3">
        <Text fontSize={11} color={theme.textMuted}>
          Total: {formatCurrency(item.b2bTotal)}
        </Text>
        <Text
          fontSize={11}
          fontWeight="600"
          color={item.profit >= 0 ? theme.jade : theme.vermillion}
        >
          Profit: {formatCurrency(item.profit)}
        </Text>
      </XStack>
    </View>
  )
})

export default function BookingEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const isDark = useThemeStore((state) => state.isDarkMode)
  const theme = getAppTheme(isDark)
  const user = useAuthStore((state) => state.user)

  const [booking, setBooking] = useState<Booking | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showStartDatePicker, setShowStartDatePicker] = useState(false)
  const [showEndDatePicker, setShowEndDatePicker] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<CostCategory | null>(null)

  // Form state
  const [tripName, setTripName] = useState('')
  const [guestName, setGuestName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [pax, setPax] = useState('1')
  const [status, setStatus] = useState<BookingStatus>('draft')
  const [exchangeRate, setExchangeRate] = useState('0.0385')
  const [notes, setNotes] = useState('')

  // Cost items by category
  const [transportation, setTransportation] = useState<BookingCostItem[]>([])
  const [meals, setMeals] = useState<BookingCostItem[]>([])
  const [entranceFees, setEntranceFees] = useState<BookingCostItem[]>([])
  const [tourGuides, setTourGuides] = useState<BookingCostItem[]>([])
  const [flights, setFlights] = useState<BookingCostItem[]>([])
  const [accommodation, setAccommodation] = useState<BookingCostItem[]>([])
  const [other, setOther] = useState<BookingCostItem[]>([])

  // Category setters map
  const categorySetters: Record<CostCategory, React.Dispatch<React.SetStateAction<BookingCostItem[]>>> = {
    transportation: setTransportation,
    meals: setMeals,
    entrance_fees: setEntranceFees,
    tour_guides: setTourGuides,
    flights: setFlights,
    accommodation: setAccommodation,
    other: setOther,
  }

  const categoryItems: Record<CostCategory, BookingCostItem[]> = {
    transportation,
    meals,
    entrance_fees: entranceFees,
    tour_guides: tourGuides,
    flights,
    accommodation,
    other,
  }

  // Calculate totals
  const bookingData: Partial<Booking> = {
    transportation,
    meals,
    entranceFees,
    tourGuides,
    flights,
    accommodation,
    other,
    exchangeRate: parseFloat(exchangeRate) || 0,
  }
  const totals = calculateBookingTotals(bookingData)

  const loadBooking = useCallback(async () => {
    if (!id) return

    setIsLoading(true)
    setError(null)

    try {
      const data = await getBooking(id)
      if (data) {
        setBooking(data)
        // Populate form
        setTripName(data.tripName || '')
        setGuestName(data.guestName || '')
        setStartDate(data.startDate || '')
        setEndDate(data.endDate || '')
        setPax(data.pax?.toString() || '1')
        setStatus(data.status || 'draft')
        setExchangeRate(data.exchangeRate?.toString() || '0.0385')
        setNotes(data.notes || '')

        // Populate cost items
        setTransportation(data.transportation || [])
        setMeals(data.meals || [])
        setEntranceFees(data.entranceFees || [])
        setTourGuides(data.tourGuides || [])
        setFlights(data.flights || [])
        setAccommodation(data.accommodation || [])
        setOther(data.other || [])
      } else {
        setError('Booking not found')
      }
    } catch (err) {
      console.error('Error loading booking:', err)
      setError('Failed to load booking')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadBooking()
  }, [loadBooking])

  const handleBack = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.back()
  }

  const handleStartDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowStartDatePicker(false)
    if (selectedDate) {
      setStartDate(selectedDate.toISOString().split('T')[0])
    }
  }

  const handleEndDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowEndDatePicker(false)
    if (selectedDate) {
      setEndDate(selectedDate.toISOString().split('T')[0])
    }
  }

  // Cost item handlers
  const addCostItem = async (category: CostCategory) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const setter = categorySetters[category]
    setter(prev => [...prev, createEmptyCostItem()])
  }

  const removeCostItem = async (category: CostCategory, itemId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const setter = categorySetters[category]
    setter(prev => prev.filter(item => item.id !== itemId))
  }

  const updateCostItem = (
    category: CostCategory,
    itemId: string,
    field: keyof BookingCostItem,
    value: any
  ) => {
    const setter = categorySetters[category]
    setter(prev =>
      prev.map(item => {
        if (item.id !== itemId) return item
        const updated = { ...item, [field]: value }
        // Recalculate totals when prices/quantity change
        if (field === 'quantity' || field === 'internalPrice' || field === 'b2bPrice') {
          return calculateItemTotals(updated)
        }
        return updated
      })
    )
  }

  const toggleCategory = async (category: CostCategory) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setExpandedCategory(prev => (prev === category ? null : category))
  }

  const handleSave = async () => {
    if (!booking) return

    // Validation
    if (!tripName.trim()) {
      Alert.alert('Validation Error', 'Trip name is required')
      return
    }
    if (!guestName.trim()) {
      Alert.alert('Validation Error', 'Guest name is required')
      return
    }

    setIsSaving(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const updates: Partial<Booking> = {
        tripName: tripName.trim(),
        guestName: guestName.trim(),
        startDate,
        endDate: endDate || startDate,
        pax: parseInt(pax) || 1,
        status,
        exchangeRate: parseFloat(exchangeRate) || 0.0385,
        transportation,
        meals,
        entranceFees,
        tourGuides,
        flights,
        accommodation,
        other,
        totalInternalCostJPY: totals.totalInternalCostJPY,
        totalB2BCostJPY: totals.totalB2BCostJPY,
        totalProfitJPY: totals.totalProfitJPY,
        totalInternalCostMYR: totals.totalInternalCostMYR,
        totalB2BCostMYR: totals.totalB2BCostMYR,
        totalProfitMYR: totals.totalProfitMYR,
        profitMargin: totals.profitMargin,
        notes: notes.trim() || undefined,
      }

      const updatedBooking = await updateBooking(booking.id, updates)

      if (updatedBooking) {
        // Log activity
        if (user) {
          // Check if status changed
          const previousStatus = booking.status
          if (previousStatus !== status) {
            logBookingEvent(
              'booking:status_changed',
              { id: user.id, username: user.username, name: user.name },
              {
                id: updatedBooking.id,
                bookingNumber: updatedBooking.bookingNumber,
                guestName: updatedBooking.guestName,
                status: updatedBooking.status,
              },
              {
                previousStatus,
                newStatus: status,
              }
            )
          }

          // Log general update
          logBookingEvent(
            'booking:updated',
            { id: user.id, username: user.username, name: user.name },
            {
              id: updatedBooking.id,
              bookingNumber: updatedBooking.bookingNumber,
              guestName: updatedBooking.guestName,
              status: updatedBooking.status,
            },
            {
              tripName: updatedBooking.tripName,
              startDate: updatedBooking.startDate,
              endDate: updatedBooking.endDate,
              pax: updatedBooking.pax,
              totalB2BCostJPY: totals.totalB2BCostJPY,
              totalProfitJPY: totals.totalProfitJPY,
            }
          )
        }

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        Alert.alert(
          'Success',
          'Booking updated successfully.',
          [{ text: 'OK', onPress: () => router.back() }]
        )
      } else {
        throw new Error('Failed to update booking')
      }
    } catch (err) {
      console.error('Error saving booking:', err)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to save booking. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Render category section
  const renderCategorySection = (category: CostCategory) => {
    const items = categoryItems[category]
    const Icon = categoryIcons[category]
    const isExpanded = expandedCategory === category
    const categoryTotals = items.reduce(
      (acc, item) => ({
        internal: acc.internal + item.internalTotal,
        b2b: acc.b2b + item.b2bTotal,
        profit: acc.profit + item.profit,
      }),
      { internal: 0, b2b: 0, profit: 0 }
    )

    return (
      <Card
        key={category}
        marginBottom="$3"
        padding="$0"
        style={{ overflow: 'hidden' }}
      >
        <Pressable
          onPress={() => toggleCategory(category)}
          style={[styles.categoryHeader, { backgroundColor: theme.bgCard }]}
        >
          <XStack alignItems="center" gap="$3">
            <View style={[styles.categoryIcon, { backgroundColor: theme.goldSoft }]}>
              <Icon size={18} color={theme.gold} />
            </View>
            <YStack>
              <Text fontSize={14} fontWeight="600" color={theme.textPrimary}>
                {COST_CATEGORY_LABELS[category]}
              </Text>
              <Text fontSize={12} color={theme.textMuted}>
                {items.length} item{items.length !== 1 ? 's' : ''} • {formatCurrency(categoryTotals.b2b)}
              </Text>
            </YStack>
          </XStack>
          <XStack alignItems="center" gap="$2">
            {categoryTotals.profit !== 0 && (
              <XStack alignItems="center" gap="$1">
                {categoryTotals.profit >= 0 ? (
                  <TrendingUp size={14} color={theme.jade} />
                ) : (
                  <TrendingDown size={14} color={theme.vermillion} />
                )}
                <Text
                  fontSize={12}
                  fontWeight="600"
                  color={categoryTotals.profit >= 0 ? theme.jade : theme.vermillion}
                >
                  {formatCurrency(categoryTotals.profit)}
                </Text>
              </XStack>
            )}
            <Plus
              size={20}
              color={theme.textMuted}
              style={{ transform: [{ rotate: isExpanded ? '45deg' : '0deg' }] }}
            />
          </XStack>
        </Pressable>

        {isExpanded && (
          <YStack padding="$3" backgroundColor={theme.bgSecondary}>
            {items.map((item, index) => (
              <CostItemEditor
                key={item.id}
                item={item}
                index={index}
                category={category}
                theme={theme}
                onUpdate={updateCostItem}
                onRemove={removeCostItem}
                formatCurrency={formatCurrency}
              />
            ))}

            <Pressable
              onPress={() => addCostItem(category)}
              style={[styles.addItemBtn, { borderColor: theme.borderMedium }]}
            >
              <Plus size={16} color={theme.gold} />
              <Text fontSize={13} fontWeight="500" color={theme.gold}>
                Add {COST_CATEGORY_LABELS[category]} Item
              </Text>
            </Pressable>
          </YStack>
        )}
      </Card>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <YStack flex={1} backgroundColor={theme.bgPrimary} justifyContent="center" alignItems="center">
        <ActivityIndicator size="large" color={theme.gold} />
        <Text marginTop="$3" color={theme.textMuted}>Loading booking...</Text>
      </YStack>
    )
  }

  // Error state
  if (error || !booking) {
    return (
      <YStack flex={1} backgroundColor={theme.bgPrimary}>
        <YStack
          paddingTop={insets.top}
          backgroundColor={theme.bgCard}
          borderBottomWidth={1}
          borderBottomColor={theme.borderSubtle}
        >
          <XStack
            paddingHorizontal="$4"
            paddingVertical="$3"
            justifyContent="space-between"
            alignItems="center"
          >
            <IconButton variant="ghost" onPress={handleBack}>
              <ArrowLeft size={24} color={theme.textPrimary} />
            </IconButton>
            <Text fontSize={17} fontWeight="600" color={theme.textPrimary}>
              Edit Booking
            </Text>
            <YStack width={44} />
          </XStack>
        </YStack>
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
          <AlertCircle size={48} color={theme.vermillion} />
          <Text fontSize={17} fontWeight="600" color={theme.textPrimary} marginTop="$3">
            {error || 'Booking not found'}
          </Text>
          <Pressable
            onPress={handleBack}
            style={[styles.backBtn, { backgroundColor: theme.gold }]}
          >
            <Text fontSize={15} fontWeight="600" color="#FFFFFF">
              Go Back
            </Text>
          </Pressable>
        </YStack>
      </YStack>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <YStack flex={1} backgroundColor={theme.bgPrimary}>
        {/* Header */}
        <YStack
          paddingTop={insets.top}
          backgroundColor={theme.bgCard}
          borderBottomWidth={1}
          borderBottomColor={theme.borderSubtle}
        >
          <XStack
            paddingHorizontal="$4"
            paddingVertical="$3"
            justifyContent="space-between"
            alignItems="center"
          >
            <IconButton variant="ghost" onPress={handleBack}>
              <ArrowLeft size={24} color={theme.textPrimary} />
            </IconButton>

            <Text fontSize={17} fontWeight="600" color={theme.textPrimary}>
              Edit Booking
            </Text>

            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              style={{ opacity: isSaving ? 0.6 : 1 }}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={theme.gold} />
              ) : (
                <Text fontSize={15} fontWeight="600" color={theme.gold}>
                  Save
                </Text>
              )}
            </Pressable>
          </XStack>
        </YStack>

        <ScrollView
          flex={1}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 100,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Booking Number */}
          <Card marginBottom="$4">
            <XStack alignItems="center" gap="$2">
              <Plane size={16} color={theme.gold} />
              <Text fontSize={14} fontWeight="600" color={theme.textPrimary}>
                {booking.bookingNumber}
              </Text>
            </XStack>
          </Card>

          {/* Trip Details */}
          <Card marginBottom="$4">
            <SectionHeader title="Trip Details" theme={theme} />

            <FormField label="Trip Name" icon={Plane} required theme={theme}>
              <Input
                value={tripName}
                onChangeText={setTripName}
                placeholder="e.g., Kuala Lumpur City Experience"
              />
            </FormField>

            <FormField label="Guest / Customer Name" icon={User} required theme={theme}>
              <Input
                value={guestName}
                onChangeText={setGuestName}
                placeholder="e.g., ABC Travel Agency"
              />
            </FormField>

            <XStack gap="$3">
              <YStack flex={1}>
                <FormField label="Start Date" icon={Calendar} required theme={theme}>
                  <Pressable
                    onPress={() => setShowStartDatePicker(true)}
                    style={[styles.dateInput, { backgroundColor: theme.bgSecondary, borderColor: theme.borderSubtle }]}
                  >
                    <Text color={startDate ? theme.textPrimary : theme.textMuted}>
                      {formatDate(startDate)}
                    </Text>
                    <Calendar size={16} color={theme.textMuted} />
                  </Pressable>
                </FormField>
              </YStack>
              <YStack flex={1}>
                <FormField label="End Date" icon={Calendar} theme={theme}>
                  <Pressable
                    onPress={() => setShowEndDatePicker(true)}
                    style={[styles.dateInput, { backgroundColor: theme.bgSecondary, borderColor: theme.borderSubtle }]}
                  >
                    <Text color={endDate ? theme.textPrimary : theme.textMuted}>
                      {formatDate(endDate)}
                    </Text>
                    <Calendar size={16} color={theme.textMuted} />
                  </Pressable>
                </FormField>
              </YStack>
            </XStack>

            <XStack gap="$3">
              <YStack flex={1}>
                <FormField label="Participants" icon={Users} theme={theme}>
                  <Input
                    value={pax}
                    onChangeText={setPax}
                    placeholder="e.g., 15"
                    keyboardType="number-pad"
                  />
                </FormField>
              </YStack>
              <YStack flex={1}>
                <FormField label="Exchange Rate (JPY→MYR)" icon={DollarSign} theme={theme}>
                  <Input
                    value={exchangeRate}
                    onChangeText={setExchangeRate}
                    placeholder="0.0385"
                    keyboardType="decimal-pad"
                  />
                </FormField>
              </YStack>
            </XStack>
          </Card>

          {/* Status */}
          <Card marginBottom="$4">
            <SectionHeader title="Status" theme={theme} />
            <XStack flexWrap="wrap" gap="$2">
              {statusOptions.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setStatus(option.value)
                  }}
                  style={[
                    styles.statusBtn,
                    status === option.value
                      ? { backgroundColor: theme.textPrimary, borderColor: theme.textPrimary }
                      : { backgroundColor: theme.bgSecondary, borderColor: theme.borderSubtle },
                  ]}
                >
                  <Text
                    fontSize={13}
                    fontWeight="500"
                    color={status === option.value ? '#FFFFFF' : theme.textSecondary}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </XStack>
          </Card>

          {/* Cost Breakdown */}
          <SectionHeader title="Cost Breakdown" badge="7 Categories" theme={theme} />

          {(['transportation', 'meals', 'entrance_fees', 'tour_guides', 'flights', 'accommodation', 'other'] as CostCategory[]).map(
            renderCategorySection
          )}

          {/* Notes */}
          <Card marginBottom="$4">
            <SectionHeader title="Additional Notes" theme={theme} />
            <TextArea
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional notes about this booking..."
              backgroundColor={theme.bgSecondary}
              borderColor={theme.borderSubtle}
              borderRadius={10}
              minHeight={100}
              color={theme.textPrimary}
              placeholderTextColor={theme.textMuted}
            />
          </Card>

          {/* Summary */}
          <Card marginBottom="$4" style={[styles.summaryCard, { backgroundColor: theme.textPrimary }]}>
            <SectionHeader title="Booking Summary" theme={{ ...theme, gold: '#C9A962', textMuted: 'rgba(255,255,255,0.6)' }} />

            <XStack justifyContent="space-between" marginBottom="$2">
              <Text fontSize={13} color="rgba(255,255,255,0.7)">WIF Cost (Internal)</Text>
              <Text fontSize={13} fontWeight="500" color="#FFFFFF">
                {formatCurrency(totals.totalInternalCostJPY)}
              </Text>
            </XStack>

            <XStack justifyContent="space-between" marginBottom="$2">
              <Text fontSize={13} color="rgba(255,255,255,0.7)">B2B Price</Text>
              <Text fontSize={13} fontWeight="500" color="#FFFFFF">
                {formatCurrency(totals.totalB2BCostJPY)}
              </Text>
            </XStack>

            <View style={[styles.divider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />

            <XStack justifyContent="space-between" marginTop="$2">
              <Text fontSize={14} fontWeight="600" color="#FFFFFF">Expected Profit</Text>
              <XStack alignItems="center" gap="$2">
                {totals.totalProfitJPY >= 0 ? (
                  <TrendingUp size={16} color="#4ADE80" />
                ) : (
                  <TrendingDown size={16} color="#F87171" />
                )}
                <Text
                  fontSize={16}
                  fontWeight="700"
                  color={totals.totalProfitJPY >= 0 ? '#4ADE80' : '#F87171'}
                >
                  {formatCurrency(totals.totalProfitJPY)}
                </Text>
              </XStack>
            </XStack>

            {totals.profitMargin > 0 && (
              <Text fontSize={12} color="rgba(255,255,255,0.5)" textAlign="right" marginTop="$1">
                {totals.profitMargin.toFixed(1)}% margin
              </Text>
            )}

            {totals.totalInternalCostMYR && (
              <>
                <View style={[styles.divider, { backgroundColor: 'rgba(255,255,255,0.1)', marginTop: 12 }]} />
                <XStack justifyContent="space-between" marginTop="$2">
                  <Text fontSize={12} color="rgba(255,255,255,0.5)">MYR Equivalent</Text>
                  <Text fontSize={12} color="rgba(255,255,255,0.5)">
                    {formatCurrency(totals.totalProfitMYR || 0, 'MYR')}
                  </Text>
                </XStack>
              </>
            )}
          </Card>

          {/* Save Button */}
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={[styles.saveBtn, { backgroundColor: theme.gold, opacity: isSaving ? 0.7 : 1 }]}
          >
            <Text fontSize={15} fontWeight="600" color="#FFFFFF">
              {isSaving ? 'Saving Changes...' : 'Save Changes'}
            </Text>
          </Pressable>
        </ScrollView>

        {/* Date Pickers */}
        {showStartDatePicker && Platform.OS === 'ios' && (
          <View style={styles.datePickerOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowStartDatePicker(false)} />
            <View style={[styles.datePickerContainer, { backgroundColor: theme.bgCard }]}>
              <XStack justifyContent="space-between" alignItems="center" padding="$4">
                <Text fontSize={17} fontWeight="600" color={theme.textPrimary}>Start Date</Text>
                <Pressable onPress={() => setShowStartDatePicker(false)}>
                  <Text fontSize={17} fontWeight="600" color={theme.gold}>Done</Text>
                </Pressable>
              </XStack>
              <DateTimePicker
                value={startDate ? new Date(startDate) : new Date()}
                mode="date"
                display="spinner"
                onChange={handleStartDateChange}
                style={{ height: 200 }}
              />
            </View>
          </View>
        )}

        {showStartDatePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={startDate ? new Date(startDate) : new Date()}
            mode="date"
            display="default"
            onChange={handleStartDateChange}
          />
        )}

        {showEndDatePicker && Platform.OS === 'ios' && (
          <View style={styles.datePickerOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowEndDatePicker(false)} />
            <View style={[styles.datePickerContainer, { backgroundColor: theme.bgCard }]}>
              <XStack justifyContent="space-between" alignItems="center" padding="$4">
                <Text fontSize={17} fontWeight="600" color={theme.textPrimary}>End Date</Text>
                <Pressable onPress={() => setShowEndDatePicker(false)}>
                  <Text fontSize={17} fontWeight="600" color={theme.gold}>Done</Text>
                </Pressable>
              </XStack>
              <DateTimePicker
                value={endDate ? new Date(endDate) : new Date(startDate || new Date())}
                mode="date"
                display="spinner"
                onChange={handleEndDateChange}
                minimumDate={startDate ? new Date(startDate) : undefined}
                style={{ height: 200 }}
              />
            </View>
          </View>
        )}

        {showEndDatePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={endDate ? new Date(endDate) : new Date(startDate || new Date())}
            mode="date"
            display="default"
            onChange={handleEndDateChange}
            minimumDate={startDate ? new Date(startDate) : undefined}
          />
        )}
      </YStack>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  sectionAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  costItem: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  deleteBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addItemBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  summaryCard: {
    padding: 20,
    borderRadius: 16,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  backBtn: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  datePickerOverlay: {
    ...StyleSheet.absoluteFillObject,
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
})
