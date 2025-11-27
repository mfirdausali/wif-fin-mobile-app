/**
 * DocumentContextMenu Component
 *
 * Pattern 2 from document-behavior.html:
 * iOS 13+ style long-press context menu with document preview and actions.
 * Shows blurred overlay with preview + all actions.
 *
 * Actions:
 * - View Details
 * - Edit
 * - Share PDF
 * - Duplicate
 * - Delete (separated, in red)
 */

import React, { memo } from 'react'
import {
  StyleSheet,
  View,
  Pressable,
  Modal,
  Text as RNText,
} from 'react-native'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import {
  Eye,
  Edit3,
  Share2,
  Copy,
  Trash2,
} from '@tamagui/lucide-icons'

// WIF Japan Design System Colors
const COLORS = {
  bgCard: '#FFFFFF',
  bgPrimary: '#FAF8F5',

  textPrimary: '#1A1815',
  textSecondary: '#5C5650',
  textMuted: '#8C8680',

  kinGold: '#B8963F',
  aiIndigo: '#4A5A7A',
  midoriJade: '#4A7A5A',
  shuVermillion: '#C75B4A',
  deleteRed: '#DC3545',

  borderSubtle: 'rgba(26, 24, 21, 0.08)',
}

// Document type colors
const typeColors: Record<string, string> = {
  invoice: COLORS.shuVermillion,
  receipt: COLORS.kinGold,
  voucher: COLORS.midoriJade,
  statement: COLORS.aiIndigo,
}

// Status config
const statusConfig: Record<string, { color: string; bg: string }> = {
  draft: { color: COLORS.textMuted, bg: 'rgba(140, 134, 128, 0.12)' },
  issued: { color: COLORS.aiIndigo, bg: 'rgba(74, 90, 122, 0.12)' },
  paid: { color: COLORS.midoriJade, bg: 'rgba(74, 122, 90, 0.12)' },
  completed: { color: COLORS.midoriJade, bg: 'rgba(74, 122, 90, 0.12)' },
  cancelled: { color: COLORS.shuVermillion, bg: 'rgba(199, 91, 74, 0.12)' },
}

export interface DocumentContextMenuProps {
  visible: boolean
  onClose: () => void
  document: {
    id: string
    title: string
    documentNumber: string
    type: 'invoice' | 'receipt' | 'voucher' | 'statement'
    status: 'draft' | 'issued' | 'paid' | 'completed' | 'cancelled'
    amount?: string
    currency?: string
  }
  onViewDetails?: () => void
  onEdit?: () => void
  onShare?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  canEdit?: boolean
  canShare?: boolean
  canDelete?: boolean
}

export const DocumentContextMenu = memo(function DocumentContextMenu({
  visible,
  onClose,
  document,
  onViewDetails,
  onEdit,
  onShare,
  onDuplicate,
  onDelete,
  canEdit = true,
  canShare = true,
  canDelete = true,
}: DocumentContextMenuProps) {
  const typeColor = typeColors[document.type] || COLORS.shuVermillion
  const status = statusConfig[document.status] || statusConfig.issued

  const handleAction = async (action: () => void | undefined) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
    if (action) {
      // Small delay to allow modal to close
      setTimeout(action, 150)
    }
  }

  const handleClose = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />

        <Pressable style={styles.menuCard} onPress={(e) => e.stopPropagation()}>
          {/* Document Preview */}
          <View style={styles.preview}>
            <View style={styles.previewHeader}>
              <View style={styles.documentType}>
                <View style={[styles.typeDot, { backgroundColor: typeColor }]} />
                <RNText style={[styles.typeLabel, { color: typeColor }]}>
                  {document.type.toUpperCase()}
                </RNText>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <RNText style={[styles.statusText, { color: status.color }]}>
                  {document.status}
                </RNText>
              </View>
            </View>
            <RNText style={styles.documentTitle}>{document.title}</RNText>
            <RNText style={styles.documentId}>{document.documentNumber}</RNText>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {/* View Details */}
            <Pressable
              style={({ pressed }) => [
                styles.action,
                pressed && styles.actionPressed,
              ]}
              onPress={() => handleAction(onViewDetails!)}
            >
              <Eye size={20} color={COLORS.textSecondary} />
              <RNText style={styles.actionText}>View Details</RNText>
            </Pressable>

            {/* Edit */}
            {canEdit && onEdit && (
              <Pressable
                style={({ pressed }) => [
                  styles.action,
                  pressed && styles.actionPressed,
                ]}
                onPress={() => handleAction(onEdit)}
              >
                <Edit3 size={20} color={COLORS.kinGold} />
                <RNText style={styles.actionText}>Edit</RNText>
              </Pressable>
            )}

            {/* Share PDF */}
            {canShare && onShare && (
              <Pressable
                style={({ pressed }) => [
                  styles.action,
                  pressed && styles.actionPressed,
                ]}
                onPress={() => handleAction(onShare)}
              >
                <Share2 size={20} color={COLORS.aiIndigo} />
                <RNText style={styles.actionText}>Share PDF</RNText>
              </Pressable>
            )}

            {/* Duplicate */}
            {onDuplicate && (
              <Pressable
                style={({ pressed }) => [
                  styles.action,
                  pressed && styles.actionPressed,
                ]}
                onPress={() => handleAction(onDuplicate)}
              >
                <Copy size={20} color={COLORS.midoriJade} />
                <RNText style={styles.actionText}>Duplicate</RNText>
              </Pressable>
            )}

            {/* Delete - separated */}
            {canDelete && onDelete && (
              <Pressable
                style={({ pressed }) => [
                  styles.action,
                  styles.actionDelete,
                  pressed && styles.actionPressed,
                ]}
                onPress={() => handleAction(onDelete)}
              >
                <Trash2 size={20} color={COLORS.deleteRed} />
                <RNText style={[styles.actionText, styles.actionTextDelete]}>
                  Delete
                </RNText>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
})

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  menuCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  preview: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  documentType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  typeLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  documentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  documentId: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  // Actions
  actions: {
    paddingVertical: 8,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  actionPressed: {
    backgroundColor: COLORS.bgPrimary,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  actionDelete: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    marginTop: 4,
    paddingTop: 14,
  },
  actionTextDelete: {
    color: COLORS.deleteRed,
  },
})
