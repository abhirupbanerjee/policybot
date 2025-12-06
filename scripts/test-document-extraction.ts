/**
 * Test script for multi-tier document extraction
 *
 * Usage:
 *   npx tsx scripts/test-document-extraction.ts [file-path]
 *   npx tsx scripts/test-document-extraction.ts /path/to/file.docx
 *   npx tsx scripts/test-document-extraction.ts  # Tests first file in data/global-docs/
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

// Load .env.local first, then .env as fallback
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { extractText, isSupportedMimeType, getMimeTypeFromFilename } from '../src/lib/document-extractor';

async function main() {
  console.log('='.repeat(60));
  console.log('Document Extraction Test');
  console.log('='.repeat(60));

  // Check environment
  console.log('\n📋 Environment Check:');
  console.log(`  MISTRAL_API_KEY: ${process.env.MISTRAL_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`  AZURE_DI_ENDPOINT: ${process.env.AZURE_DI_ENDPOINT ? '✅ Set' : '❌ Not set'}`);
  console.log(`  AZURE_DI_KEY: ${process.env.AZURE_DI_KEY ? '✅ Set' : '❌ Not set'}`);

  // Test MIME type detection
  console.log('\n📋 MIME Type Detection:');
  const testFileNames = [
    'document.pdf',
    'report.docx',
    'data.xlsx',
    'slides.pptx',
    'image.png',
    'photo.jpg',
    'graphic.webp',
    'animation.gif',
    'unknown.xyz',
  ];

  for (const file of testFileNames) {
    const mimeType = getMimeTypeFromFilename(file);
    const supported = isSupportedMimeType(mimeType);
    console.log(`  ${file} → ${mimeType} ${supported ? '✅' : '❌'}`);
  }

  // Check for command line argument for specific file
  const argFile = process.argv[2];

  let testFile: string | null = null;
  let buffer: Buffer | null = null;
  let mimeType: string | null = null;

  if (argFile) {
    // Use specified file
    console.log(`\n📋 Using specified file: ${argFile}`);
    try {
      const filePath = path.isAbsolute(argFile) ? argFile : path.join(process.cwd(), argFile);
      buffer = await fs.readFile(filePath);
      testFile = path.basename(filePath);
      mimeType = getMimeTypeFromFilename(testFile);
    } catch (err) {
      console.log(`  ❌ Failed to read file: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
  } else {
    // Check for test files in data directory
    const dataDir = path.join(process.cwd(), 'data');
    const globalDocsDir = path.join(dataDir, 'global-docs');

    console.log('\n📋 Looking for test documents in data/global-docs/...');

    try {
      const files = await fs.readdir(globalDocsDir);
      const supportedFiles = files.filter(f => {
        const mt = getMimeTypeFromFilename(f);
        return isSupportedMimeType(mt);
      });

      if (supportedFiles.length > 0) {
        testFile = supportedFiles[0];
        const testFilePath = path.join(globalDocsDir, testFile);
        buffer = await fs.readFile(testFilePath);
        mimeType = getMimeTypeFromFilename(testFile);
        console.log(`  Found ${supportedFiles.length} supported file(s)`);
      }
    } catch {
      // Directory might not exist
    }

    // If no files found, try to use a test file from /tmp
    if (!buffer) {
      console.log('  No documents found in data/global-docs/');

      // Check for test files in /tmp
      const tmpFiles = [
        { path: '/tmp/test-document.pdf', mime: 'application/pdf' },
        { path: '/tmp/test-document.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        { path: '/tmp/test-document.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        { path: '/tmp/test-document.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
        { path: '/tmp/test-image.png', mime: 'image/png' },
        { path: '/tmp/test-image.jpg', mime: 'image/jpeg' },
      ];

      for (const tf of tmpFiles) {
        try {
          buffer = await fs.readFile(tf.path);
          testFile = path.basename(tf.path);
          mimeType = tf.mime;
          console.log(`  Using test file from ${tf.path}`);
          break;
        } catch {
          // Try next
        }
      }

      if (!buffer) {
        console.log('  No test files available.');
        console.log('  Usage: npx tsx scripts/test-document-extraction.ts /path/to/file.docx');
        return;
      }
    }
  }

  console.log(`\n📄 Testing extraction on: ${testFile}`);
  console.log(`  MIME type: ${mimeType}`);
  console.log(`  File size: ${(buffer.length / 1024).toFixed(2)} KB`);

  console.log('\n🔄 Starting extraction...');
  const startTime = Date.now();

  try {
    const result = await extractText(buffer, mimeType!, testFile!);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ Extraction successful!`);
    console.log(`  Provider: ${result.provider}`);
    console.log(`  Pages: ${result.numPages}`);
    console.log(`  Text length: ${result.text.length} characters`);
    console.log(`  Time: ${elapsed}s`);

    // Show preview of extracted text
    if (result.text.length > 0) {
      const preview = result.text.substring(0, 500).replace(/\n/g, ' ').trim();
      console.log(`\n📝 Text preview (first 500 chars):`);
      console.log(`  "${preview}${result.text.length > 500 ? '...' : ''}"`);
    } else {
      console.log(`\n📝 No text extracted (expected for blank/minimal test image)`);
    }

  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n❌ Extraction failed after ${elapsed}s`);
    console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
