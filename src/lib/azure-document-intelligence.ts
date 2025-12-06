/**
 * Azure Document Intelligence client for text extraction
 *
 * Supports: PDF, DOCX, XLSX, PPTX, Images (PNG, JPG, WEBP, GIF)
 */

import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';

// ============================================
// Types
// ============================================

export interface AzureDIPage {
  pageNumber: number;
  text: string;
}

export interface AzureDIResult {
  text: string;
  numPages: number;
  pages: AzureDIPage[];
}

// ============================================
// Client Singleton
// ============================================

let azureDIClient: DocumentAnalysisClient | null = null;

function getAzureDIClient(): DocumentAnalysisClient {
  if (!azureDIClient) {
    const endpoint = process.env.AZURE_DI_ENDPOINT;
    const key = process.env.AZURE_DI_KEY;

    if (!endpoint || !key) {
      throw new Error('Azure Document Intelligence endpoint and key are required. Set AZURE_DI_ENDPOINT and AZURE_DI_KEY environment variables.');
    }

    azureDIClient = new DocumentAnalysisClient(
      endpoint,
      new AzureKeyCredential(key)
    );
  }
  return azureDIClient;
}

// ============================================
// Extraction Function
// ============================================

/**
 * Extract text using Azure Document Intelligence
 *
 * Uses the prebuilt-read model which is optimized for:
 * - Printed and handwritten text extraction
 * - Multiple languages
 * - Tables and structure preservation
 *
 * Supports: PDF, DOCX, XLSX, PPTX, PNG, JPG, WEBP, GIF, BMP, TIFF
 *
 * Note: The SDK automatically detects content type from the buffer.
 * The mimeType parameter is kept for documentation/logging purposes.
 */
export async function extractTextWithAzureDI(
  buffer: Buffer,
  mimeType: string
): Promise<AzureDIResult> {
  const client = getAzureDIClient();

  console.log(`Azure DI processing document (${mimeType}, ${buffer.length} bytes)`);

  // Use prebuilt-read model for text extraction
  // This model is best for general text extraction from documents
  // The SDK automatically detects content type from the buffer
  const poller = await client.beginAnalyzeDocument(
    'prebuilt-read',
    buffer
  );

  const result = await poller.pollUntilDone();

  if (!result.pages || result.pages.length === 0) {
    throw new Error('No pages extracted from document');
  }

  // Extract text from each page
  const pages: AzureDIPage[] = result.pages.map((page, index) => {
    // Get all lines from the page and join them
    const pageText = page.lines
      ?.map(line => line.content)
      .join('\n') || '';

    return {
      pageNumber: index + 1,
      text: pageText,
    };
  });

  // Combine all pages with double newlines between them
  const fullText = pages.map(p => p.text).join('\n\n');

  return {
    text: fullText,
    numPages: pages.length,
    pages,
  };
}
