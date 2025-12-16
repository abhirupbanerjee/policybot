/**
 * Word Document Builder - Generate branded DOCX documents
 *
 * Handles Word document generation with:
 * - Header/footer with logo and branding
 * - Markdown content rendering
 * - Page numbers
 * - Custom styling
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  ImageRun,
  BorderStyle,
  TableOfContents,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Packer,
} from 'docx';
import {
  type BrandingConfig,
  type ProcessedLogo,
  processLogo,
  getDocxFontFamily,
  processTemplateContent,
} from './branding';

// ============ Types ============

export interface DocxOptions {
  title: string;
  content: string;
  branding: BrandingConfig;
  metadata?: {
    author?: string;
    subject?: string;
    keywords?: string[];
    description?: string;
  };
  includeToc?: boolean;
}

export interface DocxResult {
  buffer: Buffer;
  fileSize: number;
}

// ============ Styling Constants ============

const STYLES = {
  title: {
    size: 48, // 24pt in half-points
    bold: true,
  },
  heading1: {
    size: 40, // 20pt
    bold: true,
  },
  heading2: {
    size: 32, // 16pt
    bold: true,
  },
  heading3: {
    size: 28, // 14pt
    bold: true,
  },
  body: {
    size: 24, // 12pt
    bold: false,
  },
  code: {
    size: 20, // 10pt
    font: 'Courier New',
  },
};

// ============ DOCX Builder Class ============

export class DocxBuilder {
  private branding: BrandingConfig;
  private logo: ProcessedLogo | null = null;
  private fontFamily: string;
  private primaryColorHex: string;

  constructor(private options: DocxOptions) {
    this.branding = options.branding;
    this.fontFamily = getDocxFontFamily(options.branding.fontFamily);
    this.primaryColorHex = options.branding.primaryColor?.replace('#', '') || '003366';
  }

  /**
   * Initialize the builder (load logo, etc.)
   */
  async initialize(): Promise<void> {
    if (this.branding.enabled && this.branding.logoUrl) {
      this.logo = await processLogo(this.branding.logoUrl, 150, 50);
    }
  }

  /**
   * Generate the Word document
   */
  async generate(): Promise<DocxResult> {
    await this.initialize();

    const sections = this.parseContent(this.options.content);
    const children: (Paragraph | Table)[] = [];

    // Add title
    children.push(this.createTitle(this.options.title));
    children.push(new Paragraph({ spacing: { after: 400 } }));

    // Add table of contents if requested
    if (this.options.includeToc) {
      children.push(
        new TableOfContents('Table of Contents', {
          hyperlink: true,
          headingStyleRange: '1-3',
        })
      );
      children.push(new Paragraph({ spacing: { after: 400 } }));
    }

    // Add content sections
    for (const section of sections) {
      children.push(...this.renderSection(section));
    }

    // Create document
    const doc = new Document({
      creator: this.options.metadata?.author || this.branding.organizationName || 'Policy Bot',
      title: this.options.title,
      subject: this.options.metadata?.subject,
      keywords: this.options.metadata?.keywords?.join(', '),
      description: this.options.metadata?.description,
      styles: this.getDocumentStyles(),
      sections: [
        {
          headers: this.branding.header?.enabled ? { default: this.createHeader() } : undefined,
          footers: this.branding.footer?.enabled ? { default: this.createFooter() } : undefined,
          children,
        },
      ],
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    return {
      buffer,
      fileSize: buffer.length,
    };
  }

  /**
   * Get document styles configuration
   */
  private getDocumentStyles() {
    return {
      default: {
        document: {
          run: {
            font: this.fontFamily,
            size: STYLES.body.size,
          },
          paragraph: {
            spacing: { line: 276 }, // 1.15 line spacing
          },
        },
        heading1: {
          run: {
            font: this.fontFamily,
            size: STYLES.heading1.size,
            bold: true,
            color: this.primaryColorHex,
          },
          paragraph: {
            spacing: { before: 400, after: 200 },
          },
        },
        heading2: {
          run: {
            font: this.fontFamily,
            size: STYLES.heading2.size,
            bold: true,
            color: this.primaryColorHex,
          },
          paragraph: {
            spacing: { before: 300, after: 150 },
          },
        },
        heading3: {
          run: {
            font: this.fontFamily,
            size: STYLES.heading3.size,
            bold: true,
            color: this.primaryColorHex,
          },
          paragraph: {
            spacing: { before: 240, after: 120 },
          },
        },
      },
    };
  }

  /**
   * Create document header
   */
  private createHeader(): Header {
    const children: Paragraph[] = [];

    // Create header content row
    const headerRuns: (TextRun | ImageRun)[] = [];

    // Add logo if available
    if (this.logo && this.branding.enabled) {
      headerRuns.push(
        new ImageRun({
          data: this.logo.buffer,
          transformation: {
            width: this.logo.width,
            height: this.logo.height,
          },
          type: 'png',
        })
      );
      headerRuns.push(new TextRun({ text: '    ' })); // Spacer
    }

    // Add organization name or header content
    const headerText = processTemplateContent(
      this.branding.header?.content || this.branding.organizationName || '',
      { organization: this.branding.organizationName }
    );

    if (headerText) {
      headerRuns.push(
        new TextRun({
          text: headerText,
          bold: true,
          color: this.primaryColorHex,
          size: 20,
        })
      );
    }

    if (headerRuns.length > 0) {
      children.push(
        new Paragraph({
          children: headerRuns,
          alignment: this.logo ? AlignmentType.LEFT : AlignmentType.CENTER,
          border: {
            bottom: {
              color: this.primaryColorHex,
              space: 4,
              style: BorderStyle.SINGLE,
              size: 8,
            },
          },
          spacing: { after: 200 },
        })
      );
    }

    return new Header({ children });
  }

  /**
   * Create document footer
   */
  private createFooter(): Footer {
    const children: Paragraph[] = [];

    // Add separator line
    children.push(
      new Paragraph({
        border: {
          top: {
            color: this.primaryColorHex,
            space: 4,
            style: BorderStyle.SINGLE,
            size: 8,
          },
        },
        spacing: { before: 200 },
      })
    );

    // Add footer content
    const footerText = processTemplateContent(this.branding.footer?.content || '', {
      organization: this.branding.organizationName,
    });

    if (footerText) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: footerText,
              size: 18,
              color: '666666',
            }),
          ],
          alignment: AlignmentType.CENTER,
        })
      );
    }

    // Add page numbers
    if (this.branding.footer?.includePageNumber) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Page ',
              size: 18,
              color: '666666',
            }),
            new TextRun({
              children: [PageNumber.CURRENT],
              size: 18,
              color: '666666',
            }),
            new TextRun({
              text: ' of ',
              size: 18,
              color: '666666',
            }),
            new TextRun({
              children: [PageNumber.TOTAL_PAGES],
              size: 18,
              color: '666666',
            }),
          ],
          alignment: AlignmentType.RIGHT,
        })
      );
    }

    return new Footer({ children });
  }

  /**
   * Create the document title
   */
  private createTitle(title: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: STYLES.title.size,
          color: this.primaryColorHex,
          font: this.fontFamily,
        }),
      ],
      alignment: AlignmentType.CENTER,
      border: {
        bottom: {
          color: this.primaryColorHex,
          space: 8,
          style: BorderStyle.SINGLE,
          size: 16,
        },
      },
      spacing: { after: 400 },
    });
  }

  /**
   * Parse content into sections
   */
  private parseContent(content: string): ContentSection[] {
    const sections: ContentSection[] = [];
    const lines = content.split('\n');
    let currentSection: ContentSection = { type: 'paragraph', content: [] };
    let inCodeBlock = false;
    let codeBlockLines: string[] = [];

    for (const line of lines) {
      // Code block handling
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          sections.push({ type: 'code', content: codeBlockLines.join('\n') });
          codeBlockLines = [];
          inCodeBlock = false;
        } else {
          if (currentSection.content.length > 0) {
            sections.push(currentSection);
            currentSection = { type: 'paragraph', content: [] };
          }
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
        if (currentSection.content.length > 0) {
          sections.push(currentSection);
          currentSection = { type: 'paragraph', content: [] };
        }
        sections.push({ type: 'heading3', content: line.substring(4) });
      } else if (line.startsWith('## ')) {
        if (currentSection.content.length > 0) {
          sections.push(currentSection);
          currentSection = { type: 'paragraph', content: [] };
        }
        sections.push({ type: 'heading2', content: line.substring(3) });
      } else if (line.startsWith('# ')) {
        if (currentSection.content.length > 0) {
          sections.push(currentSection);
          currentSection = { type: 'paragraph', content: [] };
        }
        sections.push({ type: 'heading1', content: line.substring(2) });
      }
      // Bullet points
      else if (line.startsWith('- ') || line.startsWith('* ')) {
        if (currentSection.type !== 'bullet') {
          if (currentSection.content.length > 0) {
            sections.push(currentSection);
          }
          currentSection = { type: 'bullet', content: [] };
        }
        (currentSection.content as string[]).push(line.substring(2));
      }
      // Numbered lists
      else if (/^\d+\.\s/.test(line)) {
        if (currentSection.type !== 'numbered') {
          if (currentSection.content.length > 0) {
            sections.push(currentSection);
          }
          currentSection = { type: 'numbered', content: [] };
        }
        const match = line.match(/^\d+\.\s(.*)$/);
        if (match) {
          (currentSection.content as string[]).push(match[1]);
        }
      }
      // Regular text
      else if (line.trim()) {
        if (currentSection.type !== 'paragraph') {
          if (currentSection.content.length > 0) {
            sections.push(currentSection);
          }
          currentSection = { type: 'paragraph', content: [] };
        }
        (currentSection.content as string[]).push(line);
      }
      // Empty line
      else if (currentSection.content.length > 0) {
        sections.push(currentSection);
        currentSection = { type: 'paragraph', content: [] };
      }
    }

    // Push remaining content
    if (currentSection.content.length > 0) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Render a content section to Paragraphs
   */
  private renderSection(section: ContentSection): (Paragraph | Table)[] {
    switch (section.type) {
      case 'heading1':
        return [
          new Paragraph({
            text: section.content as string,
            heading: HeadingLevel.HEADING_1,
          }),
        ];

      case 'heading2':
        return [
          new Paragraph({
            text: section.content as string,
            heading: HeadingLevel.HEADING_2,
          }),
        ];

      case 'heading3':
        return [
          new Paragraph({
            text: section.content as string,
            heading: HeadingLevel.HEADING_3,
          }),
        ];

      case 'bullet':
        return (section.content as string[]).map(
          (item) =>
            new Paragraph({
              children: this.parseInlineFormatting(item),
              bullet: { level: 0 },
            })
        );

      case 'numbered':
        return (section.content as string[]).map(
          (item) =>
            new Paragraph({
              children: this.parseInlineFormatting(item),
              numbering: { reference: 'default-numbering', level: 0 },
            })
        );

      case 'code':
        return [this.createCodeBlock(section.content as string)];

      case 'paragraph':
      default:
        return (section.content as string[]).map(
          (text) =>
            new Paragraph({
              children: this.parseInlineFormatting(text),
              spacing: { after: 200 },
            })
        );
    }
  }

  /**
   * Parse inline formatting (bold, italic, links)
   */
  private parseInlineFormatting(text: string): TextRun[] {
    const runs: TextRun[] = [];

    // For simplicity, just handle bold for now and strip other formatting
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let match;
    let lastIndex = 0;

    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        runs.push(
          new TextRun({
            text: text.substring(lastIndex, match.index),
            font: this.fontFamily,
            size: STYLES.body.size,
          })
        );
      }

      // Add bold text
      runs.push(
        new TextRun({
          text: match[1],
          bold: true,
          font: this.fontFamily,
          size: STYLES.body.size,
        })
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      // Clean up other markdown
      const cleanText = text
        .substring(lastIndex)
        .replace(/\*([^*]+)\*/g, '$1') // Italic
        .replace(/`([^`]+)`/g, '$1') // Code
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Links

      runs.push(
        new TextRun({
          text: cleanText,
          font: this.fontFamily,
          size: STYLES.body.size,
        })
      );
    }

    // If no formatting was found, return the original text
    if (runs.length === 0) {
      const cleanText = text
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

      runs.push(
        new TextRun({
          text: cleanText,
          font: this.fontFamily,
          size: STYLES.body.size,
        })
      );
    }

    return runs;
  }

  /**
   * Create a code block as a table with background
   */
  private createCodeBlock(code: string): Table {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: code.split('\n').map(
                (line) =>
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: line || ' ',
                        font: 'Courier New',
                        size: STYLES.code.size,
                      }),
                    ],
                  })
              ),
              shading: { fill: 'f5f5f5' },
              margins: {
                top: 100,
                bottom: 100,
                left: 200,
                right: 200,
              },
            }),
          ],
        }),
      ],
    });
  }
}

// ============ Types ============

interface ContentSection {
  type: 'heading1' | 'heading2' | 'heading3' | 'paragraph' | 'bullet' | 'numbered' | 'code';
  content: string | string[];
}

// ============ Convenience Function ============

/**
 * Generate a Word document
 */
export async function generateDocx(options: DocxOptions): Promise<DocxResult> {
  const builder = new DocxBuilder(options);
  return builder.generate();
}
