/**
 * PDF Builder - Generate branded PDF documents using PDFKit
 *
 * Handles PDF generation with:
 * - Header/footer with logo and branding
 * - Markdown content rendering
 * - Page numbers
 * - Custom styling
 */

import PDFDocument from 'pdfkit';
import {
  type BrandingConfig,
  type ProcessedLogo,
  processLogo,
  mapFontFamily,
  hexToRgb,
  processTemplateContent,
} from './branding';

// ============ Types ============

export interface PdfOptions {
  title: string;
  content: string;
  branding: BrandingConfig;
  metadata?: {
    author?: string;
    subject?: string;
    keywords?: string[];
  };
}

export interface PdfResult {
  buffer: Buffer;
  pageCount: number;
  fileSize: number;
}

// ============ Page Layout Constants ============

const PAGE = {
  width: 612, // Letter size (8.5 x 11 inches in points)
  height: 792,
  margin: {
    top: 72, // 1 inch
    bottom: 72,
    left: 72,
    right: 72,
  },
  headerHeight: 50,
  footerHeight: 40,
};

const FONTS = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  italic: 'Helvetica-Oblique',
};

// ============ PDF Builder Class ============

export class PdfBuilder {
  private doc: PDFKit.PDFDocument;
  private branding: BrandingConfig;
  private logo: ProcessedLogo | null = null;
  private pageCount: number = 0;
  private fontFamily: string;
  private primaryColor: { r: number; g: number; b: number };

  constructor(options: PdfOptions) {
    this.branding = options.branding;
    this.fontFamily = mapFontFamily(options.branding.fontFamily);
    this.primaryColor = hexToRgb(options.branding.primaryColor || '#003366');

    this.doc = new PDFDocument({
      size: 'LETTER',
      bufferPages: true, // Keep all pages in memory for header/footer insertion
      margins: {
        top: PAGE.margin.top + (this.branding.header?.enabled ? PAGE.headerHeight : 0),
        bottom: PAGE.margin.bottom + (this.branding.footer?.enabled ? PAGE.footerHeight : 0),
        left: PAGE.margin.left,
        right: PAGE.margin.right,
      },
      info: {
        Title: options.title,
        Author: options.metadata?.author || options.branding.organizationName || 'Policy Bot',
        Subject: options.metadata?.subject || '',
        Keywords: options.metadata?.keywords?.join(', ') || '',
        Creator: 'Policy Bot Document Generator',
      },
      autoFirstPage: false,
    });

    // Track page additions for headers/footers
    this.doc.on('pageAdded', () => {
      this.pageCount++;
    });
  }

  /**
   * Initialize the PDF builder (load logo, etc.)
   */
  async initialize(): Promise<void> {
    if (this.branding.enabled && this.branding.logoUrl) {
      this.logo = await processLogo(this.branding.logoUrl, 150, 50);
    }
  }

  /**
   * Generate the PDF document
   */
  async generate(content: string, title: string): Promise<PdfResult> {
    await this.initialize();

    // Add first page
    this.doc.addPage();

    // Render title
    this.renderTitle(title);

    // Render content
    this.renderContent(content);

    // Add headers and footers to all pages
    this.addHeadersAndFooters();

    // Finalize and return buffer
    return this.finalize();
  }

  /**
   * Render the document title
   */
  private renderTitle(title: string): void {
    const { doc, primaryColor } = this;

    doc
      .font(FONTS.bold)
      .fontSize(24)
      .fillColor([primaryColor.r, primaryColor.g, primaryColor.b])
      .text(title, {
        align: 'center',
      });

    // Add underline
    const titleY = doc.y;
    doc
      .moveTo(PAGE.margin.left, titleY + 10)
      .lineTo(PAGE.width - PAGE.margin.right, titleY + 10)
      .strokeColor([primaryColor.r, primaryColor.g, primaryColor.b])
      .lineWidth(2)
      .stroke();

    doc.moveDown(2);
  }

  /**
   * Render markdown-like content
   */
  private renderContent(content: string): void {
    const { doc } = this;
    const lines = content.split('\n');
    let inCodeBlock = false;
    let codeBlockLines: string[] = [];

    for (const line of lines) {
      // Check for code block markers
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // End code block
          this.renderCodeBlock(codeBlockLines.join('\n'));
          codeBlockLines = [];
          inCodeBlock = false;
        } else {
          // Start code block
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockLines.push(line);
        continue;
      }

      // Headings
      if (line.startsWith('### ')) {
        this.renderHeading(line.substring(4), 3);
      } else if (line.startsWith('## ')) {
        this.renderHeading(line.substring(3), 2);
      } else if (line.startsWith('# ')) {
        this.renderHeading(line.substring(2), 1);
      }
      // Bullet points
      else if (line.startsWith('- ') || line.startsWith('* ')) {
        this.renderBullet(line.substring(2));
      }
      // Numbered lists
      else if (/^\d+\.\s/.test(line)) {
        const match = line.match(/^(\d+)\.\s(.*)$/);
        if (match) {
          this.renderNumberedItem(parseInt(match[1]), match[2]);
        }
      }
      // Bold text line
      else if (line.startsWith('**') && line.endsWith('**')) {
        doc.font(FONTS.bold).fontSize(12).fillColor('black');
        doc.text(line.slice(2, -2));
        doc.font(FONTS.regular);
        doc.moveDown(0.5);
      }
      // Regular paragraph
      else if (line.trim()) {
        this.renderParagraph(line);
      }
      // Empty line
      else {
        doc.moveDown(0.5);
      }

      // Check if we need a new page
      this.checkPageBreak();
    }
  }

  /**
   * Render a heading
   */
  private renderHeading(text: string, level: number): void {
    const { doc, primaryColor } = this;
    const sizes = [20, 16, 14];
    const size = sizes[level - 1] || 12;

    doc.moveDown(0.5);
    doc
      .font(FONTS.bold)
      .fontSize(size)
      .fillColor([primaryColor.r, primaryColor.g, primaryColor.b])
      .text(text);
    doc.fillColor('black');
    doc.moveDown(0.5);
  }

  /**
   * Render a bullet point
   */
  private renderBullet(text: string): void {
    const { doc } = this;
    const bulletIndent = 20;

    doc.font(FONTS.regular).fontSize(12).fillColor('black');

    // Draw bullet
    const y = doc.y + 4;
    doc.circle(PAGE.margin.left + 5, y, 2).fill('black');

    // Draw text
    doc.text(text, PAGE.margin.left + bulletIndent, doc.y, {
      width: PAGE.width - PAGE.margin.left - PAGE.margin.right - bulletIndent,
    });
    doc.moveDown(0.3);
  }

  /**
   * Render a numbered list item
   */
  private renderNumberedItem(number: number, text: string): void {
    const { doc } = this;
    const numberIndent = 25;

    doc.font(FONTS.regular).fontSize(12).fillColor('black');

    // Draw number
    doc.text(`${number}.`, PAGE.margin.left, doc.y, { continued: true });

    // Draw text
    doc.text(` ${text}`, {
      width: PAGE.width - PAGE.margin.left - PAGE.margin.right - numberIndent,
    });
    doc.moveDown(0.3);
  }

  /**
   * Render a paragraph with inline formatting
   */
  private renderParagraph(text: string): void {
    const { doc } = this;

    doc.font(FONTS.regular).fontSize(12).fillColor('black');

    // Handle inline bold and italic
    const processedText = this.processInlineFormatting(text);
    doc.text(processedText, {
      align: 'justify',
      lineGap: 2,
    });
    doc.moveDown(0.5);
  }

  /**
   * Process inline formatting (simplified - PDFKit doesn't easily support mixed formatting)
   */
  private processInlineFormatting(text: string): string {
    // Remove markdown formatting for now (could be enhanced with RichText)
    return text
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
      .replace(/\*([^*]+)\*/g, '$1') // Italic
      .replace(/`([^`]+)`/g, '$1') // Inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Links (show text only)
  }

  /**
   * Render a code block
   */
  private renderCodeBlock(code: string): void {
    const { doc } = this;

    doc.moveDown(0.5);

    // Background rectangle
    const startY = doc.y;
    const codeWidth = PAGE.width - PAGE.margin.left - PAGE.margin.right;

    // Set font/size before measuring height
    doc.font('Courier').fontSize(10);

    // Measure text height
    const textHeight = doc.heightOfString(code, {
      width: codeWidth - 20,
    });

    // Draw background
    doc
      .rect(PAGE.margin.left, startY, codeWidth, textHeight + 20)
      .fillColor('#f5f5f5')
      .fill();

    // Draw code text
    doc
      .font('Courier')
      .fontSize(10)
      .fillColor('#333333')
      .text(code, PAGE.margin.left + 10, startY + 10, {
        width: codeWidth - 20,
      });

    doc.moveDown(1);
    doc.font(FONTS.regular);
  }

  /**
   * Check if we need a page break
   */
  private checkPageBreak(): void {
    const { doc } = this;
    const footerSpace = this.branding.footer?.enabled ? PAGE.footerHeight : 0;
    const bottomMargin = PAGE.margin.bottom + footerSpace + 20;

    if (doc.y > PAGE.height - bottomMargin) {
      doc.addPage();
    }
  }

  /**
   * Add headers and footers to all pages
   */
  private addHeadersAndFooters(): void {
    const pages = (this.doc as unknown as { _pageBuffer: unknown[] })._pageBuffer || [];
    const totalPages = pages.length || this.pageCount;

    for (let i = 0; i < totalPages; i++) {
      this.doc.switchToPage(i);

      if (this.branding.header?.enabled) {
        this.renderHeader(i + 1);
      }

      if (this.branding.footer?.enabled) {
        this.renderFooter(i + 1, totalPages);
      }
    }
  }

  /**
   * Render page header
   */
  private renderHeader(pageNumber: number): void {
    const { doc, branding, logo, primaryColor } = this;

    const headerY = 20;
    const headerContent = processTemplateContent(branding.header?.content || '', {
      page: pageNumber.toString(),
      organization: branding.organizationName,
    });

    // Draw header line
    doc
      .moveTo(PAGE.margin.left, headerY + PAGE.headerHeight - 5)
      .lineTo(PAGE.width - PAGE.margin.right, headerY + PAGE.headerHeight - 5)
      .strokeColor([primaryColor.r, primaryColor.g, primaryColor.b])
      .lineWidth(1)
      .stroke();

    // Draw logo if available
    if (logo && branding.enabled) {
      doc.image(logo.buffer, PAGE.margin.left, headerY, {
        width: logo.width,
        height: logo.height,
      });
    }

    // Draw organization name or header content
    const textX = logo ? PAGE.margin.left + (logo.width || 0) + 20 : PAGE.margin.left;
    const displayText = headerContent || branding.organizationName;

    if (displayText) {
      doc
        .font(FONTS.bold)
        .fontSize(10)
        .fillColor([primaryColor.r, primaryColor.g, primaryColor.b])
        .text(displayText, textX, headerY + 15, {
          width: PAGE.width - textX - PAGE.margin.right,
          align: logo ? 'left' : 'center',
        });
    }
  }

  /**
   * Render page footer
   */
  private renderFooter(pageNumber: number, totalPages: number): void {
    const { doc, branding, primaryColor } = this;

    const footerY = PAGE.height - PAGE.margin.bottom + 10;
    const footerContent = processTemplateContent(branding.footer?.content || '', {
      page: pageNumber.toString(),
      total: totalPages.toString(),
      organization: branding.organizationName,
    });

    // Draw footer line
    doc
      .moveTo(PAGE.margin.left, footerY - 5)
      .lineTo(PAGE.width - PAGE.margin.right, footerY - 5)
      .strokeColor([primaryColor.r, primaryColor.g, primaryColor.b])
      .lineWidth(1)
      .stroke();

    // Draw footer content
    if (footerContent) {
      doc
        .font(FONTS.regular)
        .fontSize(9)
        .fillColor('#666666')
        .text(footerContent, PAGE.margin.left, footerY + 5, {
          width: PAGE.width - PAGE.margin.left - PAGE.margin.right,
          align: 'center',
        });
    }

    // Draw page number
    if (branding.footer?.includePageNumber) {
      const pageText = `Page ${pageNumber} of ${totalPages}`;
      doc
        .font(FONTS.regular)
        .fontSize(9)
        .fillColor('#666666')
        .text(pageText, PAGE.margin.left, footerY + 20, {
          width: PAGE.width - PAGE.margin.left - PAGE.margin.right,
          align: 'right',
        });
    }
  }

  /**
   * Finalize the document and return buffer
   */
  private finalize(): Promise<PdfResult> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      this.doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      this.doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          buffer,
          pageCount: this.pageCount,
          fileSize: buffer.length,
        });
      });
      this.doc.on('error', reject);

      this.doc.end();
    });
  }
}

// ============ Convenience Function ============

/**
 * Generate a PDF document
 */
export async function generatePdf(options: PdfOptions): Promise<PdfResult> {
  const builder = new PdfBuilder(options);
  return builder.generate(options.content, options.title);
}
