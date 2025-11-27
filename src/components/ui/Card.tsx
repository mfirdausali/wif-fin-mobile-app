import { YStack, XStack, Text, GetProps } from 'tamagui'
import { ReactNode } from 'react'

type YStackProps = GetProps<typeof YStack>

export interface CardProps extends Omit<YStackProps, 'ref'> {
  elevated?: boolean
  bordered?: boolean
  pressable?: boolean
  cardSize?: 'sm' | 'md' | 'lg'
  children?: ReactNode
  onLongPress?: () => void
}

const sizePadding = {
  sm: 12,
  md: 16,
  lg: 20,
}

export const Card = ({
  children,
  elevated = true,
  bordered,
  pressable,
  cardSize = 'md',
  onPress,
  onLongPress,
  ...props
}: CardProps) => {
  return (
    <YStack
      backgroundColor="$card"
      borderRadius={12}
      padding={sizePadding[cardSize]}
      animation="quick"
      {...(elevated && {
        shadowColor: '$shadowColor',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 4,
      })}
      {...(bordered && {
        borderWidth: 1,
        borderColor: '$borderColor',
      })}
      {...(pressable && {
        cursor: 'pointer',
        pressStyle: {
          opacity: 0.9,
          scale: 0.98,
        },
        onPress,
        onLongPress,
      })}
      {...props}
    >
      {children}
    </YStack>
  )
}

Card.displayName = 'Card'

// Card header
export interface CardHeaderProps extends Omit<YStackProps, 'ref'> {
  children?: ReactNode
}

export const CardHeader = ({ children, ...props }: CardHeaderProps) => {
  return (
    <YStack gap={4} marginBottom={12} {...props}>
      {children}
    </YStack>
  )
}

CardHeader.displayName = 'CardHeader'

// Card title
export interface CardTitleProps extends Omit<GetProps<typeof Text>, 'ref'> {
  children?: ReactNode
}

export const CardTitle = ({ children, ...props }: CardTitleProps) => {
  return (
    <Text fontSize={18} fontWeight="600" color="$color" {...props}>
      {children}
    </Text>
  )
}

CardTitle.displayName = 'CardTitle'

// Card description
export interface CardDescriptionProps extends Omit<GetProps<typeof Text>, 'ref'> {
  children?: ReactNode
}

export const CardDescription = ({ children, ...props }: CardDescriptionProps) => {
  return (
    <Text fontSize={16} color="$colorHover" opacity={0.7} {...props}>
      {children}
    </Text>
  )
}

CardDescription.displayName = 'CardDescription'

// Card content
export interface CardContentProps extends Omit<YStackProps, 'ref'> {
  children?: ReactNode
}

export const CardContent = ({ children, ...props }: CardContentProps) => {
  return (
    <YStack gap={8} {...props}>
      {children}
    </YStack>
  )
}

CardContent.displayName = 'CardContent'

// Card footer
export interface CardFooterProps extends Omit<GetProps<typeof XStack>, 'ref'> {
  children?: ReactNode
}

export const CardFooter = ({ children, ...props }: CardFooterProps) => {
  return (
    <XStack marginTop={12} gap={8} justifyContent="flex-end" {...props}>
      {children}
    </XStack>
  )
}

CardFooter.displayName = 'CardFooter'

// Document card specifically for invoices, receipts, etc.
// Uses Japanese aesthetic colors from theme
interface DocumentCardProps extends CardProps {
  title: string
  documentNumber: string
  date: string
  amount: string
  currency: 'MYR' | 'JPY'
  status: 'draft' | 'issued' | 'paid' | 'completed' | 'cancelled'
  type: 'invoice' | 'receipt' | 'voucher' | 'statement'
  onPress?: () => void
  onLongPress?: () => void
}

// Japanese aesthetic colors - vermillion (invoice), gold (receipt), jade (voucher), indigo (statement)
const typeColors = {
  invoice: { light: '#C75B4A', dark: '#C75B4A' },  // vermillion
  receipt: { light: '#B8963F', dark: '#C9A962' },  // gold
  voucher: { light: '#4A7A5A', dark: '#6B8C7A' },  // jade
  statement: { light: '#4A5A7A', dark: '#5B6B8C' }, // indigo
}

const statusConfig = {
  draft: { color: '#8C8680', bg: 'rgba(140, 134, 128, 0.12)' },
  issued: { color: '#4A5A7A', bg: 'rgba(74, 90, 122, 0.12)' },
  paid: { color: '#4A7A5A', bg: 'rgba(74, 122, 90, 0.12)' },
  completed: { color: '#4A7A5A', bg: 'rgba(74, 122, 90, 0.12)' },
  cancelled: { color: '#C75B4A', bg: 'rgba(199, 91, 74, 0.12)' },
}

export function DocumentCard({
  title,
  documentNumber,
  date,
  amount,
  currency,
  status,
  type,
  onPress,
  onLongPress,
  ...props
}: DocumentCardProps) {
  return (
    <Card
      pressable
      onPress={onPress}
      onLongPress={onLongPress}
      bordered
      elevated={false}
      enterStyle={{ opacity: 0, scale: 0.98 }}
      animation="quick"
      {...props}
    >
      <XStack justifyContent="space-between" alignItems="flex-start">
        <YStack flex={1} gap={4}>
          <XStack alignItems="center" gap={8}>
            <YStack
              width={8}
              height={8}
              borderRadius={999}
              backgroundColor={typeColors[type].light}
            />
            <Text
              fontSize={11}
              fontWeight="600"
              color="$colorHover"
              textTransform="uppercase"
              letterSpacing={0.8}
            >
              {type}
            </Text>
          </XStack>
          <Text fontSize={15} fontWeight="600" color="$color" numberOfLines={1}>
            {title}
          </Text>
          <Text fontSize={12} color="$colorHover" opacity={0.6}>
            {documentNumber}
          </Text>
        </YStack>

        <YStack alignItems="flex-end" gap={6}>
          <XStack
            backgroundColor={statusConfig[status].bg}
            paddingHorizontal={10}
            paddingVertical={4}
            borderRadius={10}
          >
            <Text
              fontSize={11}
              fontWeight="600"
              color={statusConfig[status].color}
              textTransform="capitalize"
            >
              {status}
            </Text>
          </XStack>
          <Text fontSize={11} color="$colorHover" opacity={0.5}>
            {date}
          </Text>
        </YStack>
      </XStack>

      <XStack marginTop={14} justifyContent="flex-end" alignItems="baseline" gap={4}>
        <Text fontSize={11} color="$colorHover" opacity={0.5}>
          {currency}
        </Text>
        <Text fontSize={18} fontWeight="700" color="$color">
          {amount}
        </Text>
      </XStack>
    </Card>
  )
}

DocumentCard.displayName = 'DocumentCard'

// Stat card for dashboard
interface StatCardProps extends CardProps {
  title: string
  value: string
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon?: ReactNode
}

export function StatCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  ...props
}: StatCardProps) {
  const changeColor =
    changeType === 'positive' ? '$success' : changeType === 'negative' ? '$error' : '$colorHover'

  return (
    <Card {...props}>
      <XStack justifyContent="space-between" alignItems="flex-start">
        <YStack flex={1}>
          <Text fontSize={12} color="$colorHover" opacity={0.7}>
            {title}
          </Text>
          <Text fontSize={24} fontWeight="700" color="$color" marginTop={4}>
            {value}
          </Text>
          {change && (
            <Text fontSize={12} color={changeColor} marginTop={4}>
              {change}
            </Text>
          )}
        </YStack>
        {icon && (
          <YStack
            width={44}
            height={44}
            borderRadius={12}
            backgroundColor="$backgroundHover"
            justifyContent="center"
            alignItems="center"
          >
            {icon}
          </YStack>
        )}
      </XStack>
    </Card>
  )
}

StatCard.displayName = 'StatCard'
