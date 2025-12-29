/**
 * Image Processing Utilities
 *
 * Uses sharp for high-performance image optimization.
 * Handles resizing, format conversion, and thumbnail generation.
 */

import sharp from 'sharp';
import type {
  ProcessedImage,
  ProcessingOptions,
  ImageMetadata,
  OutputFormat,
} from '@/types/image-gen';

// ===== Default Processing Options =====

const DEFAULT_OPTIONS: Required<ProcessingOptions> = {
  maxDimension: 2048,
  format: 'webp',
  quality: 85,
  generateThumbnail: true,
  thumbnailSize: 400,
};

// ===== Main Processing Function =====

/**
 * Process a generated image buffer:
 * - Resize if larger than maxDimension
 * - Convert to optimized format (WebP by default)
 * - Generate thumbnail for chat preview
 *
 * @param buffer - Raw image buffer from provider
 * @param options - Processing options
 * @returns Processed image with main buffer, optional thumbnail, and metadata
 */
export async function processImage(
  buffer: Buffer,
  options: ProcessingOptions = {}
): Promise<ProcessedImage> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Get original metadata
  const originalMeta = await sharp(buffer).metadata();
  const originalWidth = originalMeta.width || 0;
  const originalHeight = originalMeta.height || 0;

  // Create sharp instance for processing
  let image = sharp(buffer);

  // Resize if larger than max dimension
  const needsResize =
    originalWidth > opts.maxDimension || originalHeight > opts.maxDimension;

  if (needsResize) {
    image = image.resize(opts.maxDimension, opts.maxDimension, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Convert to optimized format
  const mainBuffer = await convertToFormat(image, opts.format, opts.quality);

  // Get final dimensions
  const finalMeta = await sharp(mainBuffer).metadata();
  const width = finalMeta.width || 0;
  const height = finalMeta.height || 0;

  // Generate thumbnail if requested
  let thumbnail: Buffer | undefined;
  let thumbnailSizeBytes: number | undefined;

  if (opts.generateThumbnail) {
    thumbnail = await sharp(buffer)
      .resize(opts.thumbnailSize, opts.thumbnailSize, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();
    thumbnailSizeBytes = thumbnail.length;
  }

  const metadata: ImageMetadata = {
    width,
    height,
    format: opts.format,
    originalWidth,
    originalHeight,
    sizeBytes: mainBuffer.length,
    thumbnailSizeBytes,
  };

  return {
    main: mainBuffer,
    thumbnail,
    metadata,
  };
}

// ===== Helper Functions =====

/**
 * Convert sharp instance to specified format
 */
async function convertToFormat(
  image: sharp.Sharp,
  format: OutputFormat,
  quality: number
): Promise<Buffer> {
  switch (format) {
    case 'webp':
      return image.webp({ quality }).toBuffer();
    case 'jpeg':
      return image.jpeg({ quality }).toBuffer();
    case 'png':
    default:
      return image.png({ compressionLevel: 6 }).toBuffer();
  }
}

/**
 * Get image dimensions from buffer
 *
 * @param buffer - Image buffer
 * @returns Width and height
 */
export async function getImageDimensions(
  buffer: Buffer
): Promise<{ width: number; height: number }> {
  const meta = await sharp(buffer).metadata();
  return {
    width: meta.width || 0,
    height: meta.height || 0,
  };
}

/**
 * Get full image metadata from buffer
 *
 * @param buffer - Image buffer
 * @returns Metadata including format, dimensions, etc.
 */
export async function getImageMetadata(buffer: Buffer): Promise<{
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
}> {
  const meta = await sharp(buffer).metadata();
  return {
    width: meta.width || 0,
    height: meta.height || 0,
    format: meta.format || 'unknown',
    size: meta.size || buffer.length,
    hasAlpha: meta.hasAlpha || false,
  };
}

/**
 * Get file extension for output format
 */
export function getFileExtension(format: OutputFormat): string {
  switch (format) {
    case 'jpeg':
      return 'jpg';
    case 'webp':
      return 'webp';
    case 'png':
    default:
      return 'png';
  }
}

/**
 * Get MIME type for output format
 */
export function getMimeType(format: OutputFormat): string {
  switch (format) {
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'png':
    default:
      return 'image/png';
  }
}

/**
 * Validate that a buffer contains a valid image
 *
 * @param buffer - Buffer to validate
 * @returns True if valid image, false otherwise
 */
export async function isValidImage(buffer: Buffer): Promise<boolean> {
  try {
    const meta = await sharp(buffer).metadata();
    return !!(meta.width && meta.height && meta.format);
  } catch {
    return false;
  }
}

/**
 * Calculate size reduction percentage
 */
export function calculateSizeReduction(
  originalSize: number,
  processedSize: number
): number {
  if (originalSize === 0) return 0;
  return Math.round(((originalSize - processedSize) / originalSize) * 100);
}
