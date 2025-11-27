/**
 * SkeletonLoader Component
 *
 * SUBTLE gold shimmer skeleton loader matching WIF Japan design system.
 * Philosophy: Almost invisible - users should sense activity without
 * the loading state demanding attention.
 *
 * Only the gold accent bar is prominent; everything else whispers.
 */

import React, { useEffect, useRef } from 'react'
import { StyleSheet, View, Animated, Easing, Dimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// Theme colors - STRICT adherence to design spec
const SKELETON_COLORS = {
  // Base skeleton elements — VERY SUBTLE (barely visible)
  base: '#EDEAE4',                          // Light warm gray
  // Alternative: 'rgba(26, 24, 21, 0.06)'  // 6% opacity warm black

  // Shimmer highlight — WHISPER OF GOLD (10% opacity MAX)
  shimmerHighlight: 'rgba(184, 150, 63, 0.10)',

  // Accent bar — ONLY bold element
  accentGold: '#B8963F',                    // Solid gold, this one pops

  // Backgrounds
  cardBg: '#FFFFFF',
  screenBg: '#FAF8F5',                      // Warm cream
}

interface SkeletonProps {
  theme?: {
    bgCard?: string
  }
}

// Shimmer animation component with SUBTLE gold gradient
const ShimmerElement = ({
  width,
  height,
  borderRadius = 6,
  style,
  delay = 0,
}: {
  width: number | string
  height: number
  borderRadius?: number
  style?: any
  delay?: number
}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Start animation after delay
    const timeout = setTimeout(() => {
      Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1800, // 1.8 seconds — slow and smooth
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ).start()
    }, delay)

    return () => clearTimeout(timeout)
  }, [shimmerAnim, delay])

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 300],
  })

  return (
    <View
      style={[
        styles.shimmerContainer,
        {
          width,
          height,
          borderRadius,
          backgroundColor: SKELETON_COLORS.base,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmerWrapper,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        {/* LinearGradient with VERY SUBTLE gold shimmer */}
        <LinearGradient
          colors={[
            'transparent',
            'rgba(184, 150, 63, 0.08)',   // Very soft gold
            'rgba(184, 150, 63, 0.10)',   // Peak (still subtle)
            'rgba(184, 150, 63, 0.08)',   // Ease out
            'transparent',
          ]}
          locations={[0, 0.35, 0.5, 0.65, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </View>
  )
}

// Pulsing gold accent bar — ONLY bold element
const AccentBar = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.35, // Fade to 35% opacity, not invisible
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [pulseAnim])

  return (
    <Animated.View
      style={[
        styles.accentBar,
        { backgroundColor: SKELETON_COLORS.accentGold, opacity: pulseAnim },
      ]}
    />
  )
}

// Section header with accent bar and title skeleton
const SectionHeader = ({ titleWidth = 100, delay = 0 }: { titleWidth?: number; delay?: number }) => (
  <View style={styles.sectionHeader}>
    <AccentBar />
    <ShimmerElement width={titleWidth} height={10} borderRadius={5} delay={delay} />
  </View>
)

// Skeleton card container
const SkeletonCard = ({
  children,
  style,
}: {
  children: React.ReactNode
  style?: any
}) => (
  <View style={[styles.card, style]}>{children}</View>
)

// Skeleton input field
const SkeletonInput = ({ delay = 0 }: { delay?: number }) => (
  <ShimmerElement width="100%" height={50} borderRadius={10} delay={delay} />
)

// Skeleton line (for text)
const SkeletonLine = ({
  width = '100%',
  delay = 0,
}: {
  width?: number | string
  delay?: number
}) => (
  <ShimmerElement
    width={width}
    height={12}
    borderRadius={6}
    style={styles.lineSpacing}
    delay={delay}
  />
)

// Main Invoice Skeleton Loader
export function InvoiceSkeletonLoader({ theme }: SkeletonProps) {
  return (
    <View style={styles.container}>
      {/* Card 1: Invoice Details */}
      <SkeletonCard>
        <SectionHeader titleWidth={100} delay={0} />
        <View style={styles.row}>
          <View style={styles.flexItem}>
            <SkeletonInput delay={0} />
          </View>
          <View style={styles.flexItem}>
            <SkeletonInput delay={100} />
          </View>
        </View>
      </SkeletonCard>

      {/* Card 2: Customer */}
      <SkeletonCard>
        <SectionHeader titleWidth={70} delay={150} />
        <SkeletonLine width="80%" delay={150} />
        <SkeletonLine width="90%" delay={200} />
        <SkeletonLine width="65%" delay={250} />
      </SkeletonCard>

      {/* Card 3: Currency */}
      <SkeletonCard>
        <SectionHeader titleWidth={80} delay={300} />
        <View style={styles.row}>
          <View style={styles.flexItem}>
            <SkeletonInput delay={300} />
          </View>
          <View style={styles.flexItem}>
            <SkeletonInput delay={350} />
          </View>
        </View>
      </SkeletonCard>

      {/* Card 4: Additional */}
      <SkeletonCard>
        <SectionHeader titleWidth={60} delay={400} />
        <SkeletonLine width="50%" delay={400} />
        <SkeletonLine width="65%" delay={450} />
      </SkeletonCard>
    </View>
  )
}

// Generic Skeleton Loader for other document types
export function DocumentSkeletonLoader({ theme }: SkeletonProps) {
  return (
    <View style={styles.container}>
      <SkeletonCard>
        <SectionHeader titleWidth={100} delay={0} />
        <SkeletonLine width="90%" delay={0} />
        <SkeletonLine width="75%" delay={50} />
        <SkeletonLine width="60%" delay={100} />
      </SkeletonCard>

      <SkeletonCard>
        <SectionHeader titleWidth={80} delay={150} />
        <View style={styles.row}>
          <View style={styles.flexItem}>
            <SkeletonInput delay={150} />
          </View>
          <View style={styles.flexItem}>
            <SkeletonInput delay={200} />
          </View>
        </View>
      </SkeletonCard>

      <SkeletonCard>
        <SectionHeader titleWidth={70} delay={300} />
        <SkeletonLine width="85%" delay={300} />
        <SkeletonLine width="70%" delay={350} />
      </SkeletonCard>
    </View>
  )
}

// Dashboard Skeleton Loader - shown after login while data loads
export function DashboardSkeletonLoader({ theme }: SkeletonProps) {
  return (
    <View style={styles.dashboardContainer}>
      {/* Header skeleton */}
      <View style={styles.dashboardHeader}>
        <View style={styles.headerLeft}>
          <ShimmerElement width={80} height={14} borderRadius={4} delay={0} />
          <ShimmerElement width={140} height={28} borderRadius={6} delay={50} style={{ marginTop: 8 }} />
        </View>
        <ShimmerElement width={48} height={48} borderRadius={16} delay={100} />
      </View>

      {/* Account Card skeleton */}
      <View style={styles.accountCardSection}>
        <View style={styles.accountCardHeader}>
          <ShimmerElement width={70} height={12} borderRadius={4} delay={150} />
          <ShimmerElement width={100} height={12} borderRadius={4} delay={200} />
        </View>
        <View style={styles.accountCard}>
          {/* Flag and name */}
          <View style={styles.row}>
            <ShimmerElement width={40} height={40} borderRadius={8} delay={250} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <ShimmerElement width={80} height={10} borderRadius={4} delay={300} />
              <ShimmerElement width={140} height={16} borderRadius={4} delay={350} style={{ marginTop: 6 }} />
            </View>
            <ShimmerElement width={32} height={32} borderRadius={10} delay={400} />
          </View>
          {/* Balance */}
          <ShimmerElement width={180} height={36} borderRadius={6} delay={450} style={{ marginTop: 20 }} />
          {/* Monthly stats */}
          <View style={[styles.row, { marginTop: 20 }]}>
            <View style={styles.flexItem}>
              <View style={styles.row}>
                <ShimmerElement width={24} height={24} borderRadius={6} delay={500} />
                <View style={{ marginLeft: 8 }}>
                  <ShimmerElement width={60} height={10} borderRadius={4} delay={550} />
                  <ShimmerElement width={80} height={14} borderRadius={4} delay={600} style={{ marginTop: 4 }} />
                </View>
              </View>
            </View>
            <View style={styles.flexItem}>
              <View style={styles.row}>
                <ShimmerElement width={24} height={24} borderRadius={6} delay={650} />
                <View style={{ marginLeft: 8 }}>
                  <ShimmerElement width={60} height={10} borderRadius={4} delay={700} />
                  <ShimmerElement width={80} height={14} borderRadius={4} delay={750} style={{ marginTop: 4 }} />
                </View>
              </View>
            </View>
          </View>
        </View>
        {/* Pagination dots */}
        <View style={styles.paginationDots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </View>

      {/* Quick Actions skeleton */}
      <View style={styles.quickActionsSection}>
        <ShimmerElement width={90} height={12} borderRadius={4} delay={800} style={{ marginLeft: 24, marginBottom: 16 }} />
        <View style={styles.quickActionsGrid}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.quickActionItem}>
              <ShimmerElement width={56} height={56} borderRadius={16} delay={850 + i * 50} />
              <ShimmerElement width={50} height={10} borderRadius={4} delay={900 + i * 50} style={{ marginTop: 10 }} />
            </View>
          ))}
        </View>
      </View>

      {/* Recent Documents skeleton */}
      <View style={styles.recentSection}>
        <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 24 }]}>
          <ShimmerElement width={120} height={12} borderRadius={4} delay={1050} />
          <ShimmerElement width={50} height={12} borderRadius={4} delay={1100} />
        </View>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.documentCard}>
            <View style={styles.row}>
              <ShimmerElement width={40} height={40} borderRadius={10} delay={1150 + i * 100} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <ShimmerElement width="70%" height={14} borderRadius={4} delay={1200 + i * 100} />
                <ShimmerElement width="50%" height={10} borderRadius={4} delay={1250 + i * 100} style={{ marginTop: 6 }} />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <ShimmerElement width={80} height={14} borderRadius={4} delay={1300 + i * 100} />
                <ShimmerElement width={50} height={18} borderRadius={9} delay={1350 + i * 100} style={{ marginTop: 6 }} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

// Invoice Detail Skeleton - matches invoice-loading.html design
// Shows full page skeleton with header, amount card, and sections
export function InvoiceDetailSkeletonLoader({
  theme,
  paddingTop = 0,
}: SkeletonProps & { paddingTop?: number }) {
  return (
    <View style={[detailStyles.container, { backgroundColor: SKELETON_COLORS.screenBg }]}>
      {/* Dark Header with Gold Glow */}
      <View style={[detailStyles.header, { paddingTop }]}>
        <View style={detailStyles.headerNav}>
          {/* Back button skeleton */}
          <View style={detailStyles.backButton}>
            <ShimmerElement width={20} height={20} borderRadius={4} delay={0} style={{ opacity: 0.3 }} />
            <ShimmerElement width={36} height={14} borderRadius={4} delay={50} style={{ opacity: 0.3 }} />
          </View>
          {/* Title */}
          <ShimmerElement width={120} height={18} borderRadius={4} delay={100} style={{ opacity: 0.3 }} />
          {/* More button */}
          <View style={detailStyles.moreButton}>
            <ShimmerElement width={36} height={36} borderRadius={18} delay={150} style={{ opacity: 0.2 }} />
          </View>
        </View>
      </View>

      {/* Floating Amount Card Skeleton */}
      <View style={detailStyles.amountCard}>
        {/* Gold accent bar - pulsing */}
        <AccentBar />
        {/* Label skeleton */}
        <ShimmerElement width={90} height={10} borderRadius={4} delay={200} style={{ marginTop: 8, marginBottom: 12 }} />
        {/* Amount skeleton */}
        <ShimmerElement width={180} height={32} borderRadius={6} delay={250} style={{ marginBottom: 12 }} />
        {/* Meta row */}
        <View style={detailStyles.metaRow}>
          <ShimmerElement width={80} height={14} borderRadius={4} delay={300} />
          <ShimmerElement width={130} height={14} borderRadius={4} delay={350} />
        </View>
      </View>

      {/* Content sections */}
      <View style={detailStyles.content}>
        {/* Customer Section Skeleton */}
        <View style={detailStyles.section}>
          <View style={detailStyles.sectionHeader}>
            <View style={detailStyles.sectionIcon}>
              <ShimmerElement width={28} height={28} borderRadius={8} delay={400} />
            </View>
            <ShimmerElement width={80} height={12} borderRadius={4} delay={450} />
          </View>
          <View style={detailStyles.customerRow}>
            {/* Avatar */}
            <View style={detailStyles.customerAvatar}>
              <ShimmerElement width={40} height={40} borderRadius={20} delay={500} />
            </View>
            {/* Info */}
            <View style={detailStyles.customerInfo}>
              <ShimmerElement width={140} height={14} borderRadius={4} delay={550} style={{ marginBottom: 6 }} />
              <ShimmerElement width={100} height={10} borderRadius={4} delay={600} />
            </View>
            {/* Chevron */}
            <ShimmerElement width={18} height={18} borderRadius={4} delay={650} style={{ opacity: 0.3 }} />
          </View>
        </View>

        {/* Details Section Skeleton */}
        <View style={detailStyles.section}>
          <View style={detailStyles.sectionHeader}>
            <View style={detailStyles.sectionIcon}>
              <ShimmerElement width={28} height={28} borderRadius={8} delay={700} />
            </View>
            <ShimmerElement width={60} height={12} borderRadius={4} delay={750} />
          </View>
          <View style={detailStyles.sectionContent}>
            <View style={detailStyles.infoRow}>
              <ShimmerElement width={70} height={12} borderRadius={4} delay={800} />
              <ShimmerElement width={120} height={14} borderRadius={4} delay={850} />
            </View>
            <View style={[detailStyles.infoRow, { borderBottomWidth: 0 }]}>
              <ShimmerElement width={70} height={12} borderRadius={4} delay={900} />
              <ShimmerElement width={120} height={14} borderRadius={4} delay={950} />
            </View>
          </View>
        </View>

        {/* Line Items Section Skeleton */}
        <View style={detailStyles.section}>
          <View style={detailStyles.sectionHeader}>
            <View style={detailStyles.sectionIcon}>
              <ShimmerElement width={28} height={28} borderRadius={8} delay={1000} />
            </View>
            <ShimmerElement width={80} height={12} borderRadius={4} delay={1050} />
            <View style={{ flex: 1 }} />
            <ShimmerElement width={50} height={10} borderRadius={4} delay={1100} />
          </View>
          <View style={detailStyles.sectionContent}>
            {/* Line item 1 */}
            <View style={detailStyles.lineItem}>
              <View style={detailStyles.lineItemMain}>
                <ShimmerElement width={140} height={14} borderRadius={4} delay={1150} />
                <ShimmerElement width={80} height={14} borderRadius={4} delay={1200} />
              </View>
              <ShimmerElement width={70} height={10} borderRadius={4} delay={1250} style={{ marginTop: 6 }} />
            </View>
            {/* Line item 2 */}
            <View style={[detailStyles.lineItem, { borderBottomWidth: 0 }]}>
              <View style={detailStyles.lineItemMain}>
                <ShimmerElement width={120} height={14} borderRadius={4} delay={1300} />
                <ShimmerElement width={70} height={14} borderRadius={4} delay={1350} />
              </View>
              <ShimmerElement width={60} height={10} borderRadius={4} delay={1400} style={{ marginTop: 6 }} />
            </View>
          </View>
          {/* Totals area */}
          <View style={detailStyles.totalsArea}>
            <View style={detailStyles.totalRow}>
              <ShimmerElement width={60} height={12} borderRadius={4} delay={1450} />
              <ShimmerElement width={80} height={12} borderRadius={4} delay={1500} />
            </View>
            <View style={detailStyles.totalRow}>
              <ShimmerElement width={70} height={12} borderRadius={4} delay={1550} />
              <ShimmerElement width={60} height={12} borderRadius={4} delay={1600} />
            </View>
            <View style={detailStyles.grandTotalRow}>
              <ShimmerElement width={50} height={14} borderRadius={4} delay={1650} />
              <ShimmerElement width={100} height={22} borderRadius={4} delay={1700} />
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}

// Booking Detail Skeleton - matches InvoiceDetailSkeletonLoader pattern
// Shows full page skeleton with header, booking card, and sections
export function BookingDetailSkeletonLoader({
  theme,
  paddingTop = 0,
}: SkeletonProps & { paddingTop?: number }) {
  return (
    <View style={[detailStyles.container, { backgroundColor: SKELETON_COLORS.screenBg }]}>
      {/* Dark Header with Gold Glow */}
      <View style={[detailStyles.header, { paddingTop }]}>
        <View style={detailStyles.headerNav}>
          {/* Back button skeleton */}
          <View style={detailStyles.backButton}>
            <ShimmerElement width={20} height={20} borderRadius={4} delay={0} style={{ opacity: 0.3 }} />
            <ShimmerElement width={36} height={14} borderRadius={4} delay={50} style={{ opacity: 0.3 }} />
          </View>
          {/* Title */}
          <ShimmerElement width={120} height={18} borderRadius={4} delay={100} style={{ opacity: 0.3 }} />
          {/* More button */}
          <View style={detailStyles.moreButton}>
            <ShimmerElement width={36} height={36} borderRadius={18} delay={150} style={{ opacity: 0.2 }} />
          </View>
        </View>
      </View>

      {/* Floating Booking Card Skeleton */}
      <View style={detailStyles.amountCard}>
        {/* Booking ID row */}
        <View style={[detailStyles.metaRow, { marginBottom: 8 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ShimmerElement width={18} height={18} borderRadius={4} delay={200} />
            <ShimmerElement width={80} height={12} borderRadius={4} delay={250} />
          </View>
          <ShimmerElement width={70} height={22} borderRadius={11} delay={300} />
        </View>
        {/* Guest name */}
        <ShimmerElement width={200} height={28} borderRadius={6} delay={350} style={{ marginBottom: 16 }} />
        {/* Meta items */}
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ShimmerElement width={14} height={14} borderRadius={4} delay={400} />
            <ShimmerElement width={180} height={12} borderRadius={4} delay={450} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ShimmerElement width={14} height={14} borderRadius={4} delay={500} />
            <ShimmerElement width={60} height={12} borderRadius={4} delay={550} />
          </View>
        </View>
      </View>

      {/* Content sections */}
      <View style={detailStyles.content}>
        {/* Guest Section Skeleton */}
        <View style={detailStyles.section}>
          <View style={detailStyles.sectionHeader}>
            <View style={detailStyles.sectionIcon}>
              <ShimmerElement width={28} height={28} borderRadius={8} delay={600} />
            </View>
            <ShimmerElement width={50} height={12} borderRadius={4} delay={650} />
          </View>
          <View style={detailStyles.customerRow}>
            <View style={detailStyles.customerAvatar}>
              <ShimmerElement width={40} height={40} borderRadius={20} delay={700} />
            </View>
            <View style={detailStyles.customerInfo}>
              <ShimmerElement width={140} height={14} borderRadius={4} delay={750} />
            </View>
            <ShimmerElement width={18} height={18} borderRadius={4} delay={800} style={{ opacity: 0.3 }} />
          </View>
        </View>

        {/* Trip Details Section Skeleton */}
        <View style={detailStyles.section}>
          <View style={detailStyles.sectionHeader}>
            <View style={detailStyles.sectionIcon}>
              <ShimmerElement width={28} height={28} borderRadius={8} delay={850} />
            </View>
            <ShimmerElement width={80} height={12} borderRadius={4} delay={900} />
          </View>
          <View style={detailStyles.sectionContent}>
            <View style={detailStyles.infoRow}>
              <ShimmerElement width={70} height={12} borderRadius={4} delay={950} />
              <ShimmerElement width={140} height={14} borderRadius={4} delay={1000} />
            </View>
            <View style={detailStyles.infoRow}>
              <ShimmerElement width={60} height={12} borderRadius={4} delay={1050} />
              <ShimmerElement width={140} height={14} borderRadius={4} delay={1100} />
            </View>
            <View style={[detailStyles.infoRow, { borderBottomWidth: 0 }]}>
              <ShimmerElement width={80} height={12} borderRadius={4} delay={1150} />
              <ShimmerElement width={60} height={14} borderRadius={4} delay={1200} />
            </View>
          </View>
        </View>

        {/* Cost Breakdown Section Skeleton */}
        <View style={detailStyles.section}>
          <View style={detailStyles.sectionHeader}>
            <View style={detailStyles.sectionIcon}>
              <ShimmerElement width={28} height={28} borderRadius={8} delay={1250} />
            </View>
            <ShimmerElement width={100} height={12} borderRadius={4} delay={1300} />
            <View style={{ flex: 1 }} />
            <ShimmerElement width={50} height={10} borderRadius={4} delay={1350} />
          </View>
          {/* Cost table header */}
          <View style={bookingDetailStyles.costTableHeader}>
            <ShimmerElement width={60} height={10} borderRadius={4} delay={1400} />
            <ShimmerElement width={60} height={10} borderRadius={4} delay={1450} />
            <ShimmerElement width={60} height={10} borderRadius={4} delay={1500} />
          </View>
          {/* Cost rows */}
          <View style={detailStyles.sectionContent}>
            <View style={bookingDetailStyles.costRow}>
              <View style={{ flex: 1 }}>
                <ShimmerElement width={100} height={14} borderRadius={4} delay={1550} style={{ marginBottom: 4 }} />
                <ShimmerElement width={140} height={10} borderRadius={4} delay={1600} />
              </View>
              <ShimmerElement width={60} height={12} borderRadius={4} delay={1650} />
              <ShimmerElement width={60} height={12} borderRadius={4} delay={1700} />
            </View>
            <View style={[bookingDetailStyles.costRow, { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1 }}>
                <ShimmerElement width={80} height={14} borderRadius={4} delay={1750} style={{ marginBottom: 4 }} />
                <ShimmerElement width={120} height={10} borderRadius={4} delay={1800} />
              </View>
              <ShimmerElement width={60} height={12} borderRadius={4} delay={1850} />
              <ShimmerElement width={60} height={12} borderRadius={4} delay={1900} />
            </View>
          </View>
          {/* Totals */}
          <View style={bookingDetailStyles.totalsRow}>
            <ShimmerElement width={50} height={14} borderRadius={4} delay={1950} />
            <ShimmerElement width={70} height={12} borderRadius={4} delay={2000} />
            <ShimmerElement width={80} height={18} borderRadius={4} delay={2050} />
          </View>
          {/* Profit row */}
          <View style={bookingDetailStyles.profitRow}>
            <ShimmerElement width={110} height={12} borderRadius={4} delay={2100} />
            <ShimmerElement width={120} height={18} borderRadius={4} delay={2150} />
          </View>
        </View>
      </View>
    </View>
  )
}

// Booking detail specific skeleton styles
const bookingDetailStyles = StyleSheet.create({
  costTableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F7F5F2',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26, 24, 21, 0.12)',
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26, 24, 21, 0.08)',
    gap: 16,
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(184, 150, 63, 0.12)',
    borderTopWidth: 2,
    borderTopColor: '#B8963F',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  profitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(74, 122, 90, 0.1)',
    borderTopWidth: 1,
    borderTopColor: '#4A7A5A',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
})

// Detail skeleton styles
const detailStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: '#1A1815',
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  headerNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 80,
  },
  moreButton: {
    width: 80,
    alignItems: 'flex-end',
  },
  amountCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: -60,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#1A1815',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    paddingTop: 0,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#1A1815',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    paddingHorizontal: 16,
    backgroundColor: '#F7F5F2',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26, 24, 21, 0.08)',
  },
  sectionIcon: {
    width: 28,
    height: 28,
    backgroundColor: 'rgba(184, 150, 63, 0.12)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionContent: {
    padding: 14,
    paddingHorizontal: 16,
  },
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
    backgroundColor: 'rgba(184, 150, 63, 0.12)',
    borderRadius: 20,
  },
  customerInfo: {
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26, 24, 21, 0.08)',
  },
  lineItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26, 24, 21, 0.08)',
  },
  lineItemMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalsArea: {
    backgroundColor: '#F7F5F2',
    borderTopWidth: 1,
    borderTopColor: 'rgba(26, 24, 21, 0.12)',
    padding: 12,
    paddingHorizontal: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(184, 150, 63, 0.12)',
    borderTopWidth: 2,
    borderTopColor: '#B8963F',
    marginHorizontal: -16,
    marginBottom: -12,
    marginTop: 4,
    padding: 14,
    paddingHorizontal: 16,
  },
})

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
  },
  card: {
    backgroundColor: SKELETON_COLORS.cardBg,
    borderRadius: 16,
    padding: 20,
    // Very subtle shadow
    shadowColor: '#1A1815',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  accentBar: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  flexItem: {
    flex: 1,
  },
  lineSpacing: {
    marginBottom: 12,
  },
  shimmerContainer: {
    overflow: 'hidden',
  },
  shimmerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 300,
  },
  shimmerGradient: {
    width: 300,
    height: '100%',
  },

  // Dashboard skeleton styles
  dashboardContainer: {
    flex: 1,
    backgroundColor: SKELETON_COLORS.screenBg,
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  accountCardSection: {
    marginBottom: 24,
  },
  accountCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  accountCard: {
    marginHorizontal: 24,
    backgroundColor: SKELETON_COLORS.cardBg,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#1A1815',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SKELETON_COLORS.base,
  },
  dotActive: {
    width: 20,
    backgroundColor: SKELETON_COLORS.accentGold,
  },
  quickActionsSection: {
    marginBottom: 24,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
  },
  quickActionItem: {
    alignItems: 'center',
  },
  recentSection: {
    flex: 1,
  },
  documentCard: {
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: SKELETON_COLORS.cardBg,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#1A1815',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
})
