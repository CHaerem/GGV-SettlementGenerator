import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfExamplesDir = path.join(__dirname, '..', 'PDF examples');

test.describe('Debug PDF Extraction', () => {
  test('debug Oppgjørsgenerator.pdf extraction', async ({ page }) => {
    const pdfPath = path.join(pdfExamplesDir, 'Oppgjørsgenerator.pdf');

    if (!fs.existsSync(pdfPath)) {
      test.skip();
      return;
    }

    await page.goto('/');

    // Add debug logging
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'warn' || msg.type() === 'error') {
        console.log(`[Browser ${msg.type()}]:`, msg.text());
      }
    });

    const fileInput = page.locator('#fileInput');
    await fileInput.setInputFiles(pdfPath);

    // Wait for processing
    await page.waitForFunction(
      () => {
        const results = document.getElementById('resultsSection');
        const error = document.getElementById('errorSection');
        return !results?.classList.contains('hidden') || !error?.classList.contains('hidden');
      },
      { timeout: 120000 }
    );

    // Get extracted data
    const extractedData = await page.evaluate(() => window.getExtractedData());
    console.log('Extracted data:', JSON.stringify(extractedData, null, 2));

    // Get validation message
    const validationText = await page.locator('#validationMessage').textContent();
    console.log('Validation message:', validationText);
  });
});
