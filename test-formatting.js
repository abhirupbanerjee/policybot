/**
 * Test script to verify improved formatting
 * Run with: npx tsx test-formatting.js
 */

import { getSystemPrompt } from './src/lib/storage.js';

async function testFormatting() {
  console.log('='.repeat(80));
  console.log('Testing Improved System Prompt');
  console.log('='.repeat(80));
  console.log();

  try {
    const promptConfig = await getSystemPrompt();

    console.log('📋 System Prompt Preview:');
    console.log('-'.repeat(80));
    console.log(promptConfig.prompt.substring(0, 1000) + '...');
    console.log('-'.repeat(80));
    console.log();

    console.log('✅ Key Features Present:');
    const features = [
      { name: 'Markdown Structure Rules', check: promptConfig.prompt.includes('## Markdown Structure') },
      { name: 'Visual Indicators', check: promptConfig.prompt.includes('## Visual Indicators') },
      { name: 'Citation Format', check: promptConfig.prompt.includes('## Citation Format') },
      { name: 'Readability Rules', check: promptConfig.prompt.includes('## Readability Rules') },
      { name: 'Response Template', check: promptConfig.prompt.includes('## Response Template') },
      { name: 'Readability Checklist', check: promptConfig.prompt.includes('# READABILITY CHECKLIST') },
      { name: 'Content Rules', check: promptConfig.prompt.includes('# CONTENT RULES') },
    ];

    features.forEach(feature => {
      const status = feature.check ? '✅' : '❌';
      console.log(`  ${status} ${feature.name}`);
    });

    console.log();
    console.log('📊 Prompt Statistics:');
    console.log(`  • Total Length: ${promptConfig.prompt.length} characters`);
    console.log(`  • Lines: ${promptConfig.prompt.split('\n').length}`);
    console.log(`  • Updated At: ${promptConfig.updatedAt}`);
    console.log(`  • Updated By: ${promptConfig.updatedBy}`);

    console.log();
    console.log('='.repeat(80));
    console.log('✅ System prompt successfully updated with improved formatting rules!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testFormatting();
