/**
 * Storage Service for Mobile
 *
 * Handles file uploads to Supabase Storage for supporting documents.
 * Supports both document picker (PDF, images) and camera capture.
 */

import { supabase } from '../api/supabaseClient'
import * as FileSystem from 'expo-file-system'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'

const STORAGE_BUCKET = 'documents'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export interface PickedFile {
  uri: string
  name: string
  type: string
  size?: number
}

export interface UploadResult {
  path: string
  url: string
  filename: string
}

/**
 * Request camera permissions
 */
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    return status === 'granted'
  } catch (error) {
    console.error('Error requesting camera permission:', error)
    return false
  }
}

/**
 * Request media library permissions
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    return status === 'granted'
  } catch (error) {
    console.error('Error requesting media library permission:', error)
    return false
  }
}

/**
 * Pick a file from the document picker
 * Supports PDF and images
 */
export async function pickDocument(): Promise<PickedFile | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    })

    if (result.canceled) {
      return null
    }

    const file = result.assets[0]

    // Check file size
    if (file.size && file.size > MAX_FILE_SIZE) {
      throw new Error(`File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`)
    }

    return {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'application/octet-stream',
      size: file.size,
    }
  } catch (error) {
    console.error('Error picking document:', error)
    throw error
  }
}

/**
 * Pick an image from the gallery
 */
export async function pickImageFromGallery(): Promise<PickedFile | null> {
  try {
    const hasPermission = await requestMediaLibraryPermission()
    if (!hasPermission) {
      throw new Error('Media library permission not granted')
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      base64: false,
    })

    if (result.canceled) {
      return null
    }

    const asset = result.assets[0]
    const filename = asset.uri.split('/').pop() || 'image.jpg'

    return {
      uri: asset.uri,
      name: filename,
      type: asset.type === 'image' ? 'image/jpeg' : asset.mimeType || 'image/jpeg',
      size: asset.fileSize,
    }
  } catch (error) {
    console.error('Error picking image from gallery:', error)
    throw error
  }
}

/**
 * Take a photo with the camera
 */
export async function takePhoto(): Promise<PickedFile | null> {
  try {
    const hasPermission = await requestCameraPermission()
    if (!hasPermission) {
      throw new Error('Camera permission not granted')
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
      base64: false,
    })

    if (result.canceled) {
      return null
    }

    const asset = result.assets[0]
    const filename = `photo_${Date.now()}.jpg`

    return {
      uri: asset.uri,
      name: filename,
      type: 'image/jpeg',
      size: asset.fileSize,
    }
  } catch (error) {
    console.error('Error taking photo:', error)
    throw error
  }
}

/**
 * Upload a supporting document for Payment Voucher
 * @param file - The picked file
 * @param documentId - The payment voucher document ID
 * @returns Upload result with path and URL
 */
export async function uploadSupportingDocument(
  file: PickedFile,
  documentId: string
): Promise<UploadResult> {
  try {
    // Generate storage path: payment_voucher/{documentId}/{timestamp}_{filename}
    const timestamp = Date.now()
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `payment_voucher/${documentId}/${timestamp}_${sanitizedFilename}`

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.Base64,
    })

    // Convert to ArrayBuffer
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const fileData = bytes.buffer

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileData, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error('Upload error:', error)
      throw new Error(`Failed to upload file: ${error.message}`)
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path)

    return {
      path: data.path,
      url: urlData.publicUrl,
      filename: file.name,
    }
  } catch (error) {
    console.error('Error uploading supporting document:', error)
    throw error
  }
}

/**
 * Upload a file to Supabase Storage
 * @param filePath - Local file path or base64 data URI
 * @param storagePath - Path in storage bucket (e.g., 'statement_of_payment/{documentId}/{timestamp}_{filename}')
 * @returns Upload result with path and URL
 */
export async function uploadFile(
  filePath: string,
  storagePath: string
): Promise<UploadResult> {
  try {
    let fileData: ArrayBuffer

    // Check if it's a base64 data URI
    if (filePath.startsWith('data:')) {
      // Extract base64 data and convert to ArrayBuffer
      const base64Data = filePath.split(',')[1]
      const binaryString = atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      fileData = bytes.buffer
    } else {
      // Read file from local file system
      const base64 = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.Base64,
      })
      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      fileData = bytes.buffer
    }

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileData, {
        contentType: getContentType(storagePath),
        upsert: true,
      })

    if (error) throw error

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath)

    return {
      path: data.path,
      url: urlData.publicUrl,
      filename: storagePath.split('/').pop() || 'file',
    }
  } catch (error) {
    console.error('Error uploading file:', error)
    throw new Error(`Failed to upload file: ${error}`)
  }
}

/**
 * Delete a supporting document from Supabase Storage
 * @param storagePath - Path in storage bucket
 */
export async function deleteSupportingDocument(storagePath: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath])

    if (error) {
      console.error('Delete error:', error)
      throw new Error(`Failed to delete file: ${error.message}`)
    }
  } catch (error) {
    console.error('Error deleting supporting document:', error)
    throw error
  }
}

/**
 * Delete a file from Supabase Storage
 * @param storagePath - Path in storage bucket
 */
export async function deleteFile(storagePath: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath])

    if (error) throw error
  } catch (error) {
    console.error('Error deleting file:', error)
    throw new Error(`Failed to delete file: ${error}`)
  }
}

/**
 * Get public URL for a file
 * @param storagePath - Path in storage bucket
 */
export function getPublicUrl(storagePath: string): string {
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath)

  return data.publicUrl
}

/**
 * Get content type from file extension
 */
function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()

  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'pdf':
      return 'application/pdf'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    default:
      return 'application/octet-stream'
  }
}

/**
 * Check if file is an image based on mime type
 */
export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

/**
 * Check if file is a PDF
 */
export function isPdfFile(mimeType: string): boolean {
  return mimeType === 'application/pdf'
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes) return 'Unknown size'

  if (bytes < 1024) {
    return `${bytes} B`
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
}
