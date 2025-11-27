/**
 * Booking Card PDF Template
 *
 * Generates vendor-facing booking cards for trip elements:
 * - Transportation
 * - Meals
 * - Entrance Fees
 * - Tour Guide
 * - Flights
 * - Accommodation
 *
 * Matches the web app's template design exactly.
 * Pricing information is hidden by default (vendor-facing).
 * Can optionally include internal/B2B prices for internal use.
 */

import type { Booking, BookingCostItem, CostCategory } from '../../types'

export const CATEGORY_LABELS: Record<string, string> = {
  transportation: 'TRANSPORTATION',
  meals: 'MEALS / RESTAURANT',
  entrance_fees: 'ENTRANCE FEES',
  tour_guides: 'TOUR GUIDE',
  flights: 'FLIGHTS',
  accommodation: 'ACCOMMODATION',
  other: 'OTHER SERVICES',
}

export const PRINT_CATEGORY_KEYS: Record<string, keyof Booking> = {
  transportation: 'transportation',
  meals: 'meals',
  entrance_fees: 'entranceFees',
  tour_guides: 'tourGuides',
  flights: 'flights',
  accommodation: 'accommodation',
  other: 'other',
}

export interface CompanyInfo {
  name: string
  address: string
  tel: string
  email: string
}

export interface PrintOptions {
  includePrices: boolean
  companyInfo?: CompanyInfo
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

/**
 * Generate HTML for a single booking card (one category)
 */
export function generateBookingCardHTML(
  booking: Booking,
  category: string,
  items: BookingCostItem[],
  options: PrintOptions = { includePrices: false }
): string {
  const { includePrices = false, companyInfo } = options

  const company: CompanyInfo = {
    name: companyInfo?.name || 'WIF JAPAN SDN BHD',
    address: companyInfo?.address || 'Malaysia Office\nKuala Lumpur, Malaysia',
    tel: companyInfo?.tel || '+60-XXX-XXXXXXX',
    email: companyInfo?.email || 'info@wifjapan.com',
  }

  const categoryLabel = CATEGORY_LABELS[category] || category.toUpperCase()

  // Sort items by date
  const sortedItems = [...items].sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0
    const dateB = b.date ? new Date(b.date).getTime() : 0
    if (!dateA && !dateB) return 0
    if (!dateA) return 1
    if (!dateB) return -1
    return dateA - dateB
  })

  // Calculate totals for this category
  const internalTotal = items.reduce((sum, item) => sum + (item.internalTotal || 0), 0)
  const b2bTotal = items.reduce((sum, item) => sum + (item.b2bTotal || 0), 0)

  // Generate items rows
  const itemsHTML = sortedItems
    .map(
      (item) => `
    <tr>
      <td class="date-col">${item.date ? formatDateShort(item.date) : '-'}</td>
      <td class="description-col">${item.description || '-'}</td>
      <td class="qty-col">${item.quantity || 1}</td>
      <td class="notes-col">${item.notes || '-'}</td>
    </tr>
  `
    )
    .join('')

  // Generate pricing rows (only if includePrices is true)
  const pricingItemsHTML = includePrices
    ? sortedItems
        .map(
          (item) => `
    <tr>
      <td class="description-col">${item.description || '-'}</td>
      <td class="price-col">¥${formatNumber(item.internalPrice || 0)}</td>
      <td class="price-col">¥${formatNumber(item.b2bPrice || 0)}</td>
      <td class="price-col">¥${formatNumber(item.internalTotal || 0)}</td>
      <td class="price-col">¥${formatNumber(item.b2bTotal || 0)}</td>
    </tr>
  `
        )
        .join('')
    : ''

  const pricingSection = includePrices
    ? `
    <div class="pricing-section">
      <div class="pricing-header">
        <span class="warning-icon">⚠️</span>
        PRICING INFORMATION - INTERNAL USE ONLY
      </div>
      <table class="pricing-table">
        <thead>
          <tr>
            <th class="description-col">Description</th>
            <th class="price-col">Internal/Unit</th>
            <th class="price-col">B2B/Unit</th>
            <th class="price-col">Internal Total</th>
            <th class="price-col">B2B Total</th>
          </tr>
        </thead>
        <tbody>
          ${pricingItemsHTML}
        </tbody>
        <tfoot>
          <tr class="totals-row">
            <td class="description-col"><strong>TOTAL</strong></td>
            <td class="price-col">-</td>
            <td class="price-col">-</td>
            <td class="price-col"><strong>¥${formatNumber(internalTotal)}</strong></td>
            <td class="price-col"><strong>¥${formatNumber(b2bTotal)}</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `
    : ''

  const watermark = includePrices ? `<div class="watermark">INTERNAL USE ONLY</div>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Card - ${categoryLabel} - ${booking.bookingNumber}</title>
    <style>
        * {
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            line-height: 1.4;
            color: #000000;
            background-color: white;
            margin: 0;
            padding: 20px;
            font-size: 10pt;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            position: relative;
        }

        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 48pt;
            color: rgba(255, 0, 0, 0.08);
            font-weight: bold;
            pointer-events: none;
            z-index: 1000;
            white-space: nowrap;
        }

        .document-container {
            width: 100%;
            margin: 0;
            background: white;
            position: relative;
            z-index: 1;
        }

        .document-title {
            text-align: center;
            font-size: 16pt;
            font-weight: normal;
            margin-bottom: 4pt;
            letter-spacing: 3pt;
            color: #000000;
        }

        .document-subtitle {
            text-align: center;
            font-size: 12pt;
            font-weight: bold;
            margin-bottom: 6pt;
            color: #333333;
        }

        .title-underline {
            width: 100%;
            height: 2pt;
            background: #000000;
            margin-bottom: 14pt;
        }

        .header-section {
            display: flex;
            width: 100%;
            margin-bottom: 14pt;
            gap: 20pt;
        }

        .header-left {
            flex: 1;
        }

        .header-right {
            flex: 1;
        }

        .company-info {
            margin-bottom: 12pt;
        }

        .company-name {
            font-size: 12pt;
            font-weight: normal;
            margin-bottom: 2pt;
        }

        .company-details {
            font-size: 9pt;
            line-height: 1.3;
            white-space: pre-line;
            color: #444444;
        }

        .booking-info {
            background: #f5f5f5;
            border: 1pt solid #cccccc;
            padding: 10pt;
            border-radius: 4pt;
        }

        .booking-info-row {
            display: flex;
            width: 100%;
            margin-bottom: 4pt;
        }

        .booking-info-row:last-child {
            margin-bottom: 0;
        }

        .booking-info-label {
            width: 35%;
            font-size: 9pt;
            color: #666666;
        }

        .booking-info-value {
            flex: 1;
            font-size: 9pt;
            font-weight: bold;
        }

        .booking-ref {
            font-size: 11pt;
            color: #0066cc;
        }

        .section-title {
            font-size: 11pt;
            font-weight: bold;
            margin-bottom: 8pt;
            padding-bottom: 4pt;
            border-bottom: 1pt solid #cccccc;
        }

        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16pt;
            border: 1pt solid #000000;
        }

        .items-table th {
            background: #e8e8e8;
            padding: 8pt 6pt;
            border: 0.5pt solid #000000;
            font-size: 9pt;
            font-weight: bold;
            text-align: center;
        }

        .items-table td {
            padding: 6pt;
            border: 0.5pt solid #000000;
            font-size: 9pt;
            text-align: center;
            vertical-align: top;
        }

        .items-table .date-col {
            width: 12%;
            text-align: center;
        }

        .items-table .description-col {
            text-align: left;
            width: 45%;
        }

        .items-table .qty-col {
            width: 8%;
            text-align: center;
        }

        .items-table .notes-col {
            text-align: left;
            width: 35%;
            font-size: 8pt;
            color: #555555;
        }

        .pricing-section {
            margin-top: 16pt;
            margin-bottom: 16pt;
            border: 2pt solid #cc0000;
            border-radius: 4pt;
            overflow: hidden;
        }

        .pricing-header {
            background: #ffeeee;
            color: #cc0000;
            font-weight: bold;
            font-size: 10pt;
            padding: 8pt 12pt;
            text-align: center;
            border-bottom: 1pt solid #cc0000;
        }

        .warning-icon {
            margin-right: 8pt;
        }

        .pricing-table {
            width: 100%;
            border-collapse: collapse;
        }

        .pricing-table th {
            background: #f8f8f8;
            padding: 6pt;
            font-size: 8pt;
            font-weight: bold;
            text-align: center;
            border-bottom: 1pt solid #cccccc;
        }

        .pricing-table td {
            padding: 5pt;
            font-size: 8pt;
            text-align: center;
            border-bottom: 0.5pt solid #eeeeee;
        }

        .pricing-table .description-col {
            text-align: left;
            width: 35%;
        }

        .pricing-table .price-col {
            width: 16.25%;
            text-align: right;
            font-family: 'Courier New', monospace;
        }

        .pricing-table .totals-row {
            background: #ffeeee;
        }

        .pricing-table .totals-row td {
            border-top: 1pt solid #cc0000;
            padding: 8pt 5pt;
        }

        .notes-section {
            margin-top: 16pt;
            border: 1pt solid #000000;
        }

        .notes-header {
            background: #e8e8e8;
            padding: 6pt 10pt;
            font-size: 10pt;
            font-weight: bold;
            border-bottom: 0.5pt solid #000000;
        }

        .notes-content {
            padding: 10pt;
            min-height: 40pt;
            font-size: 9pt;
            line-height: 1.4;
        }

        .notes-lines {
            border-bottom: 0.5pt dotted #cccccc;
            height: 18pt;
            margin-bottom: 4pt;
        }

        .confirmation-section {
            margin-top: 20pt;
            border: 1pt solid #000000;
            page-break-inside: avoid;
        }

        .confirmation-header {
            background: #e8e8e8;
            padding: 6pt 10pt;
            font-size: 10pt;
            font-weight: bold;
            border-bottom: 0.5pt solid #000000;
        }

        .confirmation-content {
            padding: 12pt;
        }

        .confirmation-row {
            display: flex;
            width: 100%;
            margin-bottom: 12pt;
            gap: 16pt;
        }

        .confirmation-field {
            flex: 1;
        }

        .confirmation-label {
            font-size: 8pt;
            color: #666666;
            margin-bottom: 4pt;
        }

        .confirmation-line {
            border-bottom: 1pt solid #000000;
            height: 20pt;
        }

        .confirmation-checkboxes {
            display: flex;
            width: 100%;
            margin-top: 12pt;
        }

        .confirmation-checkbox {
            flex: 1;
            font-size: 9pt;
        }

        .checkbox-box {
            display: inline-block;
            width: 12pt;
            height: 12pt;
            border: 1pt solid #000000;
            margin-right: 6pt;
            vertical-align: middle;
        }

        .footer-note {
            margin-top: 16pt;
            text-align: center;
            font-size: 8pt;
            color: #888888;
            font-style: italic;
        }

        @media print {
            body {
                padding: 0;
            }
        }
    </style>
</head>
<body>
    ${watermark}
    <div class="document-container">
        <div class="document-title">BOOKING CARD</div>
        <div class="document-subtitle">${categoryLabel}</div>
        <div class="title-underline"></div>

        <div class="header-section">
            <div class="header-left">
                <div class="company-info">
                    <div class="company-name">${company.name}</div>
                    <div class="company-details">${company.address}
Tel: ${company.tel}
Email: ${company.email}</div>
                </div>
            </div>

            <div class="header-right">
                <div class="booking-info">
                    <div class="booking-info-row">
                        <div class="booking-info-label">Booking Ref:</div>
                        <div class="booking-info-value booking-ref">${booking.bookingNumber || '-'}</div>
                    </div>
                    <div class="booking-info-row">
                        <div class="booking-info-label">Guest/Group:</div>
                        <div class="booking-info-value">${booking.guestName || '-'}</div>
                    </div>
                    <div class="booking-info-row">
                        <div class="booking-info-label">Trip Period:</div>
                        <div class="booking-info-value">${formatDate(booking.startDate)}${booking.endDate ? ' - ' + formatDate(booking.endDate) : ''}</div>
                    </div>
                    <div class="booking-info-row">
                        <div class="booking-info-label">Number of Pax:</div>
                        <div class="booking-info-value">${booking.pax || '-'}</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="section-title">BOOKING DETAILS</div>
        <table class="items-table">
            <thead>
                <tr>
                    <th class="date-col">Date</th>
                    <th class="description-col">Description</th>
                    <th class="qty-col">Qty</th>
                    <th class="notes-col">Notes / Special Requirements</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHTML}
            </tbody>
        </table>

        ${pricingSection}

        <div class="notes-section">
            <div class="notes-header">Additional Notes</div>
            <div class="notes-content">
                ${
                  booking.notes
                    ? booking.notes
                    : `
                <div class="notes-lines"></div>
                <div class="notes-lines"></div>
                <div class="notes-lines"></div>
                `
                }
            </div>
        </div>

        <div class="confirmation-section">
            <div class="confirmation-header">Vendor Confirmation</div>
            <div class="confirmation-content">
                <div class="confirmation-row">
                    <div class="confirmation-field">
                        <div class="confirmation-label">Vendor / Supplier Name</div>
                        <div class="confirmation-line"></div>
                    </div>
                    <div class="confirmation-field">
                        <div class="confirmation-label">Contact Person</div>
                        <div class="confirmation-line"></div>
                    </div>
                </div>
                <div class="confirmation-row">
                    <div class="confirmation-field">
                        <div class="confirmation-label">Contact Number</div>
                        <div class="confirmation-line"></div>
                    </div>
                    <div class="confirmation-field">
                        <div class="confirmation-label">Date</div>
                        <div class="confirmation-line"></div>
                    </div>
                </div>
                <div class="confirmation-row">
                    <div class="confirmation-field" style="width: 100%">
                        <div class="confirmation-label">Signature / Stamp</div>
                        <div class="confirmation-line" style="height: 50pt"></div>
                    </div>
                </div>
                <div class="confirmation-checkboxes">
                    <div class="confirmation-checkbox">
                        <span class="checkbox-box"></span> Confirmed
                    </div>
                    <div class="confirmation-checkbox">
                        <span class="checkbox-box"></span> Pending
                    </div>
                    <div class="confirmation-checkbox">
                        <span class="checkbox-box"></span> Cannot Fulfill
                    </div>
                </div>
            </div>
        </div>

        <div class="footer-note">
            This is a booking request document. Please confirm availability and details with vendor.
        </div>
    </div>
</body>
</html>`
}

/**
 * Generate combined booking card with multiple categories
 */
export function generateCombinedBookingCardHTML(
  booking: Booking,
  categoriesData: { category: string; items: BookingCostItem[] }[],
  options: PrintOptions = { includePrices: false }
): string {
  const pages = categoriesData.map(({ category, items }) => {
    return generateBookingCardHTML(booking, category, items, options)
  })

  // For combined output, add page breaks between categories
  return pages.join('\n<div style="page-break-before: always;"></div>\n')
}

/**
 * Get items for a specific category from a booking
 */
export function getCategoryItems(booking: Booking, category: string): BookingCostItem[] {
  const itemsKey = PRINT_CATEGORY_KEYS[category]
  if (!itemsKey) return []
  const items = booking[itemsKey]
  return Array.isArray(items) ? items : []
}

/**
 * Get all categories with their item counts
 */
export function getCategoriesWithCounts(
  booking: Booking
): { key: string; label: string; count: number }[] {
  return Object.keys(CATEGORY_LABELS).map((key) => ({
    key,
    label: CATEGORY_LABELS[key],
    count: getCategoryItems(booking, key).length,
  }))
}
