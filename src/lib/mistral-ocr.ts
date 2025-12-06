import { Mistral } from '@mistralai/mistralai';

let mistralClient: Mistral | null = null;

function getMistralClient(): Mistral {
  if (!mistralClient) {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY environment variable is required');
    }
    mistralClient = new Mistral({ apiKey });
  }
  return mistralClient;
}

export interface MistralPageText {
  pageNumber: number;
  text: string;
}

/**
 * Check if the MIME type is an image type supported by Mistral OCR
 */
function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Extract text using Mistral OCR
 *
 * Supports:
 * - PDF documents (type: document_url)
 * - Images: PNG, JPG, WEBP, GIF (type: image_url)
 */
export async function extractTextWithMistral(
  buffer: Buffer,
  mimeType: string = 'application/pdf'
): Promise<{ text: string; numPages: number; pages: MistralPageText[] }> {
  const client = getMistralClient();

  // Convert buffer to base64 data URL
  const base64Data = buffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64Data}`;

  // Determine document type based on MIME type
  // Images use image_url, PDFs use document_url
  const isImage = isImageMimeType(mimeType);

  // Call Mistral OCR API with appropriate document type
  const response = await client.ocr.process({
    model: 'mistral-ocr-latest',
    document: isImage
      ? {
          type: 'image_url',
          imageUrl: dataUrl,
        }
      : {
          type: 'document_url',
          documentUrl: dataUrl,
        },
    ...(isImage && { includeImageBase64: true }),
  });

  // Extract text from each page
  const pages: MistralPageText[] = response.pages.map((page, index) => ({
    pageNumber: index + 1,
    text: page.markdown || '', // Mistral returns markdown format
  }));

  // Combine all pages
  const fullText = pages.map(p => p.text).join('\n\n');

  return {
    text: fullText,
    numPages: pages.length,
    pages,
  };
}
