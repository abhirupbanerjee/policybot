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

export async function extractTextWithMistral(
  pdfBuffer: Buffer
): Promise<{ text: string; numPages: number; pages: MistralPageText[] }> {
  const client = getMistralClient();

  // Convert buffer to base64 data URL
  const base64Pdf = pdfBuffer.toString('base64');
  const dataUrl = `data:application/pdf;base64,${base64Pdf}`;

  // Call Mistral OCR API using document_url with data URL
  const response = await client.ocr.process({
    model: 'mistral-ocr-latest',
    document: {
      type: 'document_url',
      documentUrl: dataUrl,
    },
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
