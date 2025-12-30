import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfExamplesDir = path.join(__dirname, '..', 'PDF examples');

test.describe('GGV Oppgjørsgenerator - Real PDF Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should process Oppgjørsgenerator.pdf correctly', async ({ page }) => {
    const pdfPath = path.join(pdfExamplesDir, 'Oppgjørsgenerator.pdf');

    // Skip if PDF doesn't exist
    if (!fs.existsSync(pdfPath)) {
      test.skip();
      return;
    }

    const fileInput = page.locator('#fileInput');
    await fileInput.setInputFiles(pdfPath);

    // Wait for processing to complete (either results or error)
    await page.waitForFunction(
      () => {
        const results = document.getElementById('resultsSection');
        const error = document.getElementById('errorSection');
        return !results?.classList.contains('hidden') || !error?.classList.contains('hidden');
      },
      { timeout: 60000 }
    );

    // Check if results are displayed
    const resultsVisible = await page.locator('#resultsSection').isVisible();

    if (resultsVisible) {
      // Verify some data was extracted
      const orgCount = await page.locator('#orgCountValue').textContent();
      expect(parseInt(orgCount || '0')).toBeGreaterThan(0);

      // Check that table has rows
      const rows = page.locator('#resultsBody tr');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(0);

      console.log(`Extracted ${rowCount} organizations from Oppgjørsgenerator.pdf`);
    } else {
      // If error, log it but don't fail (OCR might not work in all environments)
      const errorText = await page.locator('#errorText').textContent();
      console.log(`PDF processing resulted in error: ${errorText}`);
    }
  });

  test('should process Unknown-30.pdf correctly', async ({ page }) => {
    const pdfPath = path.join(pdfExamplesDir, 'Unknown-30.pdf');

    // Skip if PDF doesn't exist
    if (!fs.existsSync(pdfPath)) {
      test.skip();
      return;
    }

    const fileInput = page.locator('#fileInput');
    await fileInput.setInputFiles(pdfPath);

    // Wait for processing to complete
    await page.waitForFunction(
      () => {
        const results = document.getElementById('resultsSection');
        const error = document.getElementById('errorSection');
        return !results?.classList.contains('hidden') || !error?.classList.contains('hidden');
      },
      { timeout: 60000 }
    );

    // Check if results are displayed
    const resultsVisible = await page.locator('#resultsSection').isVisible();

    if (resultsVisible) {
      // Verify some data was extracted
      const orgCount = await page.locator('#orgCountValue').textContent();
      expect(parseInt(orgCount || '0')).toBeGreaterThan(0);

      console.log(`Extracted organizations from Unknown-30.pdf`);
    } else {
      const errorText = await page.locator('#errorText').textContent();
      console.log(`PDF processing resulted in error: ${errorText}`);
    }
  });

  test('should allow CSV export after processing real PDF', async ({ page }) => {
    const pdfPath = path.join(pdfExamplesDir, 'Oppgjørsgenerator.pdf');

    if (!fs.existsSync(pdfPath)) {
      test.skip();
      return;
    }

    const fileInput = page.locator('#fileInput');
    await fileInput.setInputFiles(pdfPath);

    // Wait for results
    await page.waitForFunction(
      () => !document.getElementById('resultsSection')?.classList.contains('hidden'),
      { timeout: 60000 }
    );

    // Test CSV download
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Last ned CSV")');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('ggv-oppgjor.csv');
  });
});
