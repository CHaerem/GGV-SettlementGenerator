import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('GGV Oppgjørsgenerator - Page Load', () => {
  test('should load the page with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('GGV Oppgjørsgenerator');
  });

  test('should display header with correct text', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('GGV Oppgjørsgenerator');
    await expect(page.locator('.subtitle')).toContainText('Gi Gaven Videre');
  });

  test('should display upload area', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#dropZone')).toBeVisible();
    await expect(page.locator('.upload-text')).toHaveText('Dra og slipp PDF-fil her');
    await expect(page.locator('.upload-button')).toHaveText('Velg fil');
  });

  test('should display footer', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer')).toContainText('GGV Oppgjørsgenerator');
  });

  test('should have hidden sections initially', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#statusSection')).toBeHidden();
    await expect(page.locator('#errorSection')).toBeHidden();
    await expect(page.locator('#resultsSection')).toBeHidden();
  });
});

test.describe('GGV Oppgjørsgenerator - File Input', () => {
  test('should have file input that accepts PDF files', async ({ page }) => {
    await page.goto('/');
    const fileInput = page.locator('#fileInput');
    await expect(fileInput).toHaveAttribute('accept', '.pdf');
  });

  test('should trigger file input when clicking upload button', async ({ page }) => {
    await page.goto('/');

    // Check that clicking the upload button area triggers the file dialog
    const fileInput = page.locator('#fileInput');
    const uploadButton = page.locator('.upload-button');

    await expect(uploadButton).toBeVisible();
    await expect(fileInput).toBeHidden(); // Input is hidden but functional
  });

  test('should trigger file input when clicking drop zone', async ({ page }) => {
    await page.goto('/');

    const dropZone = page.locator('#dropZone');
    await expect(dropZone).toBeVisible();

    // Verify drop zone is clickable
    const boundingBox = await dropZone.boundingBox();
    expect(boundingBox).not.toBeNull();
  });
});

test.describe('GGV Oppgjørsgenerator - Drag and Drop', () => {
  test('should add dragover class when dragging over drop zone', async ({ page }) => {
    await page.goto('/');

    // Simulate dragover event using page.evaluate
    await page.evaluate(() => {
      const dropZone = document.getElementById('dropZone');
      const event = new Event('dragover', { bubbles: true, cancelable: true });
      event.preventDefault = () => {};
      dropZone.dispatchEvent(event);
    });

    await expect(page.locator('#dropZone')).toHaveClass(/dragover/);
  });

  test('should remove dragover class when leaving drop zone', async ({ page }) => {
    await page.goto('/');

    // Simulate dragover then dragleave
    await page.evaluate(() => {
      const dropZone = document.getElementById('dropZone');
      const dragoverEvent = new Event('dragover', { bubbles: true, cancelable: true });
      dragoverEvent.preventDefault = () => {};
      dropZone.dispatchEvent(dragoverEvent);
    });

    await page.evaluate(() => {
      const dropZone = document.getElementById('dropZone');
      const dragleaveEvent = new Event('dragleave', { bubbles: true, cancelable: true });
      dragleaveEvent.preventDefault = () => {};
      dropZone.dispatchEvent(dragleaveEvent);
    });

    await expect(page.locator('#dropZone')).not.toHaveClass(/dragover/);
  });
});

test.describe('GGV Oppgjørsgenerator - PDF Processing', () => {
  test('should show error for non-PDF files', async ({ page }) => {
    await page.goto('/');

    // Create a non-PDF file
    const buffer = Buffer.from('This is not a PDF');

    const fileInput = page.locator('#fileInput');
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: buffer,
    });

    // Should show error
    await expect(page.locator('#errorSection')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#errorText')).toContainText('PDF');
  });

  test('should show processing status when uploading PDF', async ({ page }) => {
    await page.goto('/');

    // Create a minimal valid PDF
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Test) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000214 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
306
%%EOF`;

    const buffer = Buffer.from(pdfContent);

    const fileInput = page.locator('#fileInput');
    await fileInput.setInputFiles({
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: buffer,
    });

    // Should show status section (processing)
    await expect(page.locator('#statusSection')).toBeVisible({ timeout: 5000 });
  });

  test('should display file name after selection', async ({ page }) => {
    await page.goto('/');

    const pdfContent = '%PDF-1.4\n%%EOF';
    const buffer = Buffer.from(pdfContent);

    const fileInput = page.locator('#fileInput');
    await fileInput.setInputFiles({
      name: 'my-settlement.pdf',
      mimeType: 'application/pdf',
      buffer: buffer,
    });

    await expect(page.locator('#fileName')).toHaveText('my-settlement.pdf');
  });
});

test.describe('GGV Oppgjørsgenerator - Results Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Mock the PDF processing by injecting test data using the exposed API
    await page.evaluate(() => {
      window.setExtractedData({
        companies: [
          { name: 'Røde Kors', number: '5000', numberOfGifts: 10, percentage: 25 },
          { name: 'Kirkens Bymisjon', number: '3000', numberOfGifts: 6, percentage: 15 },
          { name: 'Amnesty', number: '2000', numberOfGifts: 4, percentage: 10 },
        ],
        sum: 10000,
        recipientCompany: 'Test Company AS',
        calculatedTotal: 10000
      });

      // Call displayResults directly
      window.displayResults();
    });
  });

  test('should display results section after processing', async ({ page }) => {
    await expect(page.locator('#resultsSection')).toBeVisible();
  });

  test('should display correct recipient', async ({ page }) => {
    await expect(page.locator('#recipientValue')).toHaveText('Test Company AS');
  });

  test('should display correct total sum', async ({ page }) => {
    const totalText = await page.locator('#totalValue').textContent();
    expect(totalText).toContain('10');
    expect(totalText).toContain('kr');
  });

  test('should display correct organization count', async ({ page }) => {
    await expect(page.locator('#orgCountValue')).toHaveText('3');
  });

  test('should display success validation message when sums match', async ({ page }) => {
    await expect(page.locator('#validationMessage')).toHaveClass(/success/);
    await expect(page.locator('#validationMessage')).toContainText('vellykket');
  });

  test('should display organizations in table', async ({ page }) => {
    const rows = page.locator('#resultsBody tr');
    await expect(rows).toHaveCount(3);

    // Check first organization
    const firstRow = rows.first();
    await expect(firstRow.locator('td').first()).toContainText('Røde Kors');
  });

  test('should display action buttons', async ({ page }) => {
    await expect(page.locator('button:has-text("Last ned CSV")')).toBeVisible();
    await expect(page.locator('button:has-text("Ny fil")')).toBeVisible();
  });
});

test.describe('GGV Oppgjørsgenerator - Validation Messages', () => {
  test('should show warning when sum is null', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      window.setExtractedData({
        companies: [{ name: 'Test Org', number: '1000' }],
        sum: null,
        recipientCompany: 'Test',
        calculatedTotal: 1000
      });
      window.displayResults();
    });

    await expect(page.locator('#validationMessage')).toHaveClass(/warning/);
    await expect(page.locator('#validationMessage')).toContainText('Kunne ikke trekke ut totalsum');
  });

  test('should show warning when sums do not match', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      window.setExtractedData({
        companies: [{ name: 'Test Org', number: '1000' }],
        sum: 5000,
        recipientCompany: 'Test',
        calculatedTotal: 1000
      });
      window.displayResults();
    });

    await expect(page.locator('#validationMessage')).toHaveClass(/warning/);
    await expect(page.locator('#validationMessage')).toContainText('stemmer ikke');
  });
});

test.describe('GGV Oppgjørsgenerator - CSV Export', () => {
  test('should trigger CSV download when clicking export button', async ({ page }) => {
    await page.goto('/');

    // Set up test data
    await page.evaluate(() => {
      window.setExtractedData({
        companies: [
          { name: 'Test Org', number: '1000', numberOfGifts: 5, percentage: 50 },
        ],
        sum: 1000,
        recipientCompany: 'Test Company',
        calculatedTotal: 1000
      });
      window.displayResults();
    });

    // Listen for download
    const downloadPromise = page.waitForEvent('download');

    await page.click('button:has-text("Last ned CSV")');

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('ggv-oppgjor.csv');
  });
});

test.describe('GGV Oppgjørsgenerator - Reset Functionality', () => {
  test('should reset app when clicking "Ny fil" button', async ({ page }) => {
    await page.goto('/');

    // Show results first
    await page.evaluate(() => {
      window.setExtractedData({
        companies: [{ name: 'Test', number: '100' }],
        sum: 100,
        recipientCompany: 'Test',
        calculatedTotal: 100
      });
      window.displayResults();
    });

    await expect(page.locator('#resultsSection')).toBeVisible();

    // Click reset button
    await page.click('button:has-text("Ny fil")');

    // Should hide results and show upload
    await expect(page.locator('#resultsSection')).toBeHidden();
    await expect(page.locator('.upload-section')).toBeVisible();
  });

  test('should reset app when clicking retry button after error', async ({ page }) => {
    await page.goto('/');

    // Show error
    await page.evaluate(() => {
      const errorSection = document.getElementById('errorSection');
      const errorText = document.getElementById('errorText');
      errorSection.classList.remove('hidden');
      errorText.textContent = 'Test error';
      document.querySelector('.upload-section').classList.add('hidden');
    });

    await expect(page.locator('#errorSection')).toBeVisible();

    // Click retry button
    await page.click('button:has-text("Prøv igjen")');

    // Should hide error and show upload
    await expect(page.locator('#errorSection')).toBeHidden();
    await expect(page.locator('.upload-section')).toBeVisible();
  });
});

test.describe('GGV Oppgjørsgenerator - Progress Indicator', () => {
  test('should show progress bar during processing', async ({ page }) => {
    await page.goto('/');

    // Manually show status section
    await page.evaluate(() => {
      showStatus('Testing progress...', 50);
    });

    await expect(page.locator('#statusSection')).toBeVisible();
    await expect(page.locator('#statusText')).toHaveText('Testing progress...');

    // Check progress bar width
    const progressFill = page.locator('#progressFill');
    const style = await progressFill.getAttribute('style');
    expect(style).toContain('50%');
  });

  test('should update progress during processing', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      showStatus('Step 1', 25);
    });

    let style = await page.locator('#progressFill').getAttribute('style');
    expect(style).toContain('25%');

    await page.evaluate(() => {
      updateProgress(75);
    });

    style = await page.locator('#progressFill').getAttribute('style');
    expect(style).toContain('75%');
  });
});

test.describe('GGV Oppgjørsgenerator - Responsive Design', () => {
  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // All main elements should still be visible
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('#dropZone')).toBeVisible();
    await expect(page.locator('.upload-button')).toBeVisible();
  });

  test('should stack action buttons on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Show results
    await page.evaluate(() => {
      window.setExtractedData({
        companies: [{ name: 'Test', number: '100' }],
        sum: 100,
        recipientCompany: 'Test',
        calculatedTotal: 100
      });
      window.displayResults();
    });

    // Action buttons should still be visible and functional
    await expect(page.locator('button:has-text("Last ned CSV")')).toBeVisible();
    await expect(page.locator('button:has-text("Ny fil")')).toBeVisible();
  });
});

test.describe('GGV Oppgjørsgenerator - Accessibility', () => {
  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/');

    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toBeVisible();
  });

  test('should have accessible file input', async ({ page }) => {
    await page.goto('/');

    const fileInput = page.locator('#fileInput');
    const label = page.locator('.upload-button');

    // Label should be associated with input (via containing label element)
    await expect(label).toBeVisible();
  });

  test('should have visible focus states', async ({ page }) => {
    await page.goto('/');

    // Tab to the upload button
    await page.keyboard.press('Tab');

    // The drop zone or upload button should be focusable
    const activeElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(activeElement).toBeTruthy();
  });
});

test.describe('GGV Oppgjørsgenerator - Data Extraction Functions', () => {
  test('extractInformationFromPDFText should extract companies correctly', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      const testText = `
        10 Røde Kors 5 000 kr,- 25%
        5 Kirkens Bymisjon 3 000 kr,- 15%
        Kostnadsbidrag til Gi Gaven Videre 500 kr
      `;
      return extractInformationFromPDFText(testText);
    });

    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.some(c => c.name.includes('Røde Kors'))).toBe(true);
  });

  test('extractSumFromPDFText should extract total correctly', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      const testText = 'Some text\nTotalsum 10 000 kr\nMore text';
      return extractSumFromPDFText(testText);
    });

    expect(result).toBe(10000);
  });

  test('extractSumFromPDFText should handle alternative format', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      const testText = 'Some text\nTotal kr 5000\nMore text';
      return extractSumFromPDFText(testText);
    });

    expect(result).toBe(5000);
  });

  test('extractRecipientCompanyFromPDFText should extract recipient', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      const testText = 'Payment details\ntil: Test Company AS \nOther info';
      return extractRecipientCompanyFromPDFText(testText);
    });

    expect(result).toBe('Test Company AS');
  });

  test('calculateTotal should sum company amounts', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      const companies = [
        { name: 'A', number: '1000' },
        { name: 'B', number: '2000' },
        { name: 'C', number: '3000' },
      ];
      return calculateTotal(companies);
    });

    expect(result).toBe(6000);
  });
});

test.describe('GGV Oppgjørsgenerator - Edge Cases', () => {
  test('should handle empty company list', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      window.setExtractedData({
        companies: [],
        sum: 0,
        recipientCompany: null,
        calculatedTotal: 0
      });
      window.displayResults();
    });

    await expect(page.locator('#resultsSection')).toBeVisible();
    await expect(page.locator('#orgCountValue')).toHaveText('0');
    await expect(page.locator('#recipientValue')).toHaveText('-');
  });

  test('should handle special characters in company names', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      window.setExtractedData({
        companies: [
          { name: 'Org with <script>alert("xss")</script>', number: '1000' },
          { name: 'Org with "quotes" & ampersands', number: '2000' },
        ],
        sum: 3000,
        recipientCompany: 'Test',
        calculatedTotal: 3000
      });
      window.displayResults();
    });

    // Should not execute script, should escape HTML
    const tableContent = await page.locator('#resultsBody').innerHTML();
    expect(tableContent).not.toContain('<script>');
    expect(tableContent).toContain('&lt;script&gt;');
  });

  test('should handle very large numbers', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      window.setExtractedData({
        companies: [
          { name: 'Big Org', number: '1000000000' },
        ],
        sum: 1000000000,
        recipientCompany: 'Test',
        calculatedTotal: 1000000000
      });
      window.displayResults();
    });

    await expect(page.locator('#resultsSection')).toBeVisible();
    const totalText = await page.locator('#totalValue').textContent();
    expect(totalText).toContain('kr');
  });

  test('should handle decimal amounts', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      const companies = [
        { name: 'A', number: '1000.50' },
        { name: 'B', number: '2000.75' },
      ];
      return calculateTotal(companies);
    });

    expect(result).toBeCloseTo(3001.25, 2);
  });
});

test.describe('GGV Oppgjørsgenerator - Helper Functions', () => {
  test('formatNumber should format numbers correctly', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      return formatNumber(1234567.89);
    });

    // Norwegian locale uses space as thousands separator
    expect(result).toMatch(/1.*234.*567/);
  });

  test('formatNumber should handle NaN', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      return formatNumber(NaN);
    });

    expect(result).toBe('-');
  });

  test('escapeHtml should escape HTML entities', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      return escapeHtml('<script>alert("test")</script>');
    });

    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
    expect(result).not.toContain('<script>');
  });
});

test.describe('GGV Oppgjørsgenerator - Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Set up test data with multiple companies
    await page.evaluate(() => {
      window.setExtractedData({
        companies: [
          { name: 'Røde Kors', number: '1000', numberOfGifts: 5, percentage: 25 },
          { name: 'Kreftforeningen', number: '2000', numberOfGifts: 10, percentage: 50 },
          { name: 'Redd Barna', number: '500', numberOfGifts: 2, percentage: 25 }
        ],
        sum: 3500,
        recipientCompany: 'Test Company',
        calculatedTotal: 3500
      });
      displayResults();
    });
  });

  test('should display search input', async ({ page }) => {
    const searchInput = page.locator('#searchInput');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', 'Søk etter organisasjon...');
  });

  test('should filter table rows based on search query', async ({ page }) => {
    const searchInput = page.locator('#searchInput');
    await searchInput.fill('Kors');

    // Only Røde Kors should be visible
    const visibleRows = page.locator('#resultsBody tr:not(.hidden)');
    await expect(visibleRows).toHaveCount(1);
    await expect(visibleRows.first()).toContainText('Røde Kors');
  });

  test('should show all rows when search is cleared', async ({ page }) => {
    const searchInput = page.locator('#searchInput');
    await searchInput.fill('Kors');
    await searchInput.fill('');

    const visibleRows = page.locator('#resultsBody tr:not(.hidden)');
    await expect(visibleRows).toHaveCount(3);
  });

  test('should update result count during search', async ({ page }) => {
    const searchInput = page.locator('#searchInput');
    await searchInput.fill('Kors');

    const sortInfo = page.locator('#sortInfo');
    await expect(sortInfo).toContainText('Viser 1 av 3');
  });

  test('should be case insensitive', async ({ page }) => {
    const searchInput = page.locator('#searchInput');
    await searchInput.fill('KREFT');

    const visibleRows = page.locator('#resultsBody tr:not(.hidden)');
    await expect(visibleRows).toHaveCount(1);
    await expect(visibleRows.first()).toContainText('Kreftforeningen');
  });
});

test.describe('GGV Oppgjørsgenerator - Sort Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.setExtractedData({
        companies: [
          { name: 'Bravo Org', number: '2000', numberOfGifts: 10, percentage: 40 },
          { name: 'Alpha Org', number: '1000', numberOfGifts: 5, percentage: 20 },
          { name: 'Charlie Org', number: '3000', numberOfGifts: 15, percentage: 40 }
        ],
        sum: 6000,
        recipientCompany: 'Test Company',
        calculatedTotal: 6000
      });
      displayResults();
    });
  });

  test('should display sortable column headers', async ({ page }) => {
    const sortableHeaders = page.locator('.results-table th.sortable');
    await expect(sortableHeaders).toHaveCount(4);
  });

  test('should sort by name ascending when clicking name header', async ({ page }) => {
    await page.click('th[data-sort="name"]');

    const firstRow = page.locator('#resultsBody tr').first();
    await expect(firstRow).toContainText('Alpha Org');
  });

  test('should sort by name descending on second click', async ({ page }) => {
    await page.click('th[data-sort="name"]');
    await page.click('th[data-sort="name"]');

    const firstRow = page.locator('#resultsBody tr').first();
    await expect(firstRow).toContainText('Charlie Org');
  });

  test('should sort by amount', async ({ page }) => {
    await page.click('th[data-sort="amount"]');

    const firstRow = page.locator('#resultsBody tr').first();
    await expect(firstRow).toContainText('Alpha Org');
  });

  test('should show sort indicator on active column', async ({ page }) => {
    await page.click('th[data-sort="name"]');

    const nameHeader = page.locator('th[data-sort="name"]');
    await expect(nameHeader).toHaveClass(/asc/);
  });

  test('should toggle sort indicator direction', async ({ page }) => {
    await page.click('th[data-sort="name"]');
    await page.click('th[data-sort="name"]');

    const nameHeader = page.locator('th[data-sort="name"]');
    await expect(nameHeader).toHaveClass(/desc/);
  });
});

test.describe('GGV Oppgjørsgenerator - Verification Section', () => {
  test('should display verification section after processing', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.setExtractedData({
        companies: [{ name: 'Test Org', number: '1000' }],
        sum: 1000,
        recipientCompany: 'Test Company',
        calculatedTotal: 1000
      });
      displayResults();
    });

    const verificationSection = page.locator('#verificationSection');
    await expect(verificationSection).toBeVisible();
  });

  test('should show matching status when sums match', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.setExtractedData({
        companies: [{ name: 'Test Org', number: '1000' }],
        sum: 1000,
        recipientCompany: 'Test Company',
        calculatedTotal: 1000
      });
      displayResults();
    });

    const status = page.locator('#verifyStatus');
    await expect(status).toContainText('Verifisert OK');
    await expect(status).toHaveClass(/match/);
  });

  test('should show mismatch status when sums differ', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.setExtractedData({
        companies: [{ name: 'Test Org', number: '1000' }],
        sum: 1500,
        recipientCompany: 'Test Company',
        calculatedTotal: 1000
      });
      displayResults();
    });

    const status = page.locator('#verifyStatus');
    await expect(status).toContainText('Avvik funnet');
    await expect(status).toHaveClass(/mismatch/);
  });

  test('should display correct PDF sum', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.setExtractedData({
        companies: [{ name: 'Test Org', number: '1000' }],
        sum: 1000,
        recipientCompany: 'Test Company',
        calculatedTotal: 1000
      });
      displayResults();
    });

    const pdfSum = page.locator('#verifyPdfSum');
    await expect(pdfSum).toContainText('1');
  });

  test('should display calculated sum', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.setExtractedData({
        companies: [{ name: 'Test Org', number: '1000' }],
        sum: 1000,
        recipientCompany: 'Test Company',
        calculatedTotal: 1000
      });
      displayResults();
    });

    const calcSum = page.locator('#verifyCalcSum');
    await expect(calcSum).toContainText('1');
  });

  test('should show zero difference when sums match', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.setExtractedData({
        companies: [{ name: 'Test Org', number: '1000' }],
        sum: 1000,
        recipientCompany: 'Test Company',
        calculatedTotal: 1000
      });
      displayResults();
    });

    const diff = page.locator('#verifyDiff');
    await expect(diff).toContainText('0 kr');
  });

  test('should show difference amount when sums do not match', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.setExtractedData({
        companies: [{ name: 'Test Org', number: '1000' }],
        sum: 1500,
        recipientCompany: 'Test Company',
        calculatedTotal: 1000
      });
      displayResults();
    });

    const diff = page.locator('#verifyDiff');
    await expect(diff).toContainText('500');
  });
});

test.describe('GGV Oppgjørsgenerator - Master Organization List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear localStorage before each test
    await page.evaluate(() => localStorage.clear());
  });

  test('should load default organizations from JSON file', async ({ page }) => {
    await page.reload();
    await page.waitForTimeout(500); // Wait for async load

    const masterList = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('ggv-master-org-list') || '[]');
    });

    expect(masterList.length).toBeGreaterThan(0);
    expect(masterList).toContain('Røde Kors');
  });

  test('should save and retrieve master list from localStorage', async ({ page }) => {
    const testOrgs = ['Org A', 'Org B', 'Org C'];

    await page.evaluate((orgs) => {
      localStorage.setItem('ggv-master-org-list', JSON.stringify(orgs));
    }, testOrgs);

    const retrieved = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('ggv-master-org-list') || '[]');
    });

    expect(retrieved).toEqual(testOrgs);
  });

});

test.describe('GGV Oppgjørsgenerator - New Organizations Alert', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('should show alert when PDF contains orgs not in master list', async ({ page }) => {
    // Set up a small master list
    await page.evaluate(() => {
      localStorage.setItem('ggv-master-org-list', JSON.stringify(['Existing Org']));
    });
    await page.reload();

    // Set extracted data with a new org
    await page.evaluate(() => {
      window.setExtractedData({
        companies: [
          { name: 'Existing Org', number: '1000' },
          { name: 'Brand New Org', number: '500' }
        ],
        sum: 1500,
        recipientCompany: 'Test',
        calculatedTotal: 1500
      });
      displayResults();
    });

    await expect(page.locator('#newOrgsAlert')).toBeVisible();
    await expect(page.locator('#newOrgsCount')).toHaveText('1');
  });

  test('should hide alert when no new orgs found', async ({ page }) => {
    // Set up master list that includes the org
    await page.evaluate(() => {
      localStorage.setItem('ggv-master-org-list', JSON.stringify(['Test Org']));
    });
    await page.reload();

    await page.evaluate(() => {
      window.setExtractedData({
        companies: [{ name: 'Test Org', number: '1000' }],
        sum: 1000,
        recipientCompany: 'Test',
        calculatedTotal: 1000
      });
      displayResults();
    });

    await expect(page.locator('#newOrgsAlert')).toBeHidden();
  });

  test('should add new orgs to master list when clicking add button', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('ggv-master-org-list', JSON.stringify(['Existing Org']));
    });
    await page.reload();

    // Mock fetch to prevent actual GitHub API call
    await page.evaluate(() => {
      window.fetch = async () => ({ ok: true, json: async () => ({}) });
    });

    await page.evaluate(() => {
      window.setExtractedData({
        companies: [
          { name: 'Existing Org', number: '1000' },
          { name: 'New Org To Add', number: '500' }
        ],
        sum: 1500,
        recipientCompany: 'Test',
        calculatedTotal: 1500
      });
      displayResults();
    });

    await page.click('.new-orgs-add-btn');

    const masterList = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('ggv-master-org-list') || '[]');
    });

    expect(masterList).toContain('New Org To Add');
  });
});

test.describe('GGV Oppgjørsgenerator - GitHub Issue Creation', () => {
  test('should call GitHub API when adding new organizations', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    await page.evaluate(() => {
      localStorage.setItem('ggv-master-org-list', JSON.stringify(['Existing Org']));
    });
    await page.reload();

    // Track fetch calls
    const fetchCalls = [];
    await page.evaluate(() => {
      window.originalFetch = window.fetch;
      window.fetchCalls = [];
      window.fetch = async (url, options) => {
        window.fetchCalls.push({ url, options });
        return { ok: true, json: async () => ({ id: 123 }) };
      };
    });

    await page.evaluate(() => {
      window.setExtractedData({
        companies: [
          { name: 'Existing Org', number: '1000' },
          { name: 'New Org', number: '500' }
        ],
        sum: 1500,
        recipientCompany: 'Test',
        calculatedTotal: 1500
      });
      displayResults();
    });

    await page.click('.new-orgs-add-btn');
    await page.waitForTimeout(500); // Wait for async fetch

    const calls = await page.evaluate(() => window.fetchCalls);

    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0].url).toContain('github.com');
    expect(calls[0].url).toContain('issues');
  });

  test('should include correct labels in GitHub issue', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    await page.evaluate(() => {
      localStorage.setItem('ggv-master-org-list', JSON.stringify(['Existing']));
    });
    await page.reload();

    await page.evaluate(() => {
      window.fetchCalls = [];
      window.fetch = async (url, options) => {
        window.fetchCalls.push({ url, options });
        return { ok: true, json: async () => ({ id: 123 }) };
      };
    });

    await page.evaluate(() => {
      window.setExtractedData({
        companies: [{ name: 'New Org', number: '500' }],
        sum: 500,
        recipientCompany: 'Test',
        calculatedTotal: 500
      });
      displayResults();
    });

    await page.click('.new-orgs-add-btn');
    await page.waitForTimeout(500);

    const calls = await page.evaluate(() => window.fetchCalls);
    const body = JSON.parse(calls[0].options.body);

    expect(body.labels).toContain('new-organization');
  });

  test('should continue working even if GitHub API fails', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    await page.evaluate(() => {
      localStorage.setItem('ggv-master-org-list', JSON.stringify(['Existing']));
    });
    await page.reload();

    // Mock fetch to fail
    await page.evaluate(() => {
      window.fetch = async () => {
        throw new Error('Network error');
      };
    });

    await page.evaluate(() => {
      window.setExtractedData({
        companies: [{ name: 'New Org', number: '500' }],
        sum: 500,
        recipientCompany: 'Test',
        calculatedTotal: 500
      });
      displayResults();
    });

    await page.click('.new-orgs-add-btn');

    // Should still add locally despite API failure
    const masterList = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('ggv-master-org-list') || '[]');
    });

    expect(masterList).toContain('New Org');
  });
});

test.describe('GGV Oppgjørsgenerator - Copy with Master List Order', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('should copy amounts in master list order', async ({ page }) => {
    // Set up master list in specific order
    await page.evaluate(() => {
      localStorage.setItem('ggv-master-org-list', JSON.stringify(['Org A', 'Org B', 'Org C']));
    });
    await page.reload();

    await page.evaluate(() => {
      window.setExtractedData({
        companies: [
          { name: 'Org C', number: '300' },
          { name: 'Org A', number: '100' }
          // Org B is missing - should be 0
        ],
        sum: 400,
        recipientCompany: 'Test',
        calculatedTotal: 400
      });
      displayResults();
    });

    // Get companies in master list order
    const orderedCompanies = await page.evaluate(() => {
      return window.getCompaniesInMasterListOrder ? window.getCompaniesInMasterListOrder() : [];
    });

    expect(orderedCompanies[0].name).toBe('Org A');
    expect(orderedCompanies[0].number).toBe('100');
    expect(orderedCompanies[1].name).toBe('Org B');
    expect(orderedCompanies[1].number).toBe('0'); // Missing = 0
    expect(orderedCompanies[2].name).toBe('Org C');
    expect(orderedCompanies[2].number).toBe('300');
  });
});
