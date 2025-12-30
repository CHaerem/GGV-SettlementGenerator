/**
 * Test helpers for GGV Oppgjørsgenerator E2E tests
 */

/**
 * Sample text content that mimics a GGV settlement PDF
 */
export const samplePDFTextContent = `
Oppgjør fra Gi Gaven Videre AS

Oppgjør til: Test Bedrift AS
Periode: Januar 2024

Oversikt over gaver:

10 Røde Kors 5 000 kr,- 25%
8 Kirkens Bymisjon Oslo 4 000 kr,- 20%
6 Amnesty International 3 000 kr,- 15%
5 Helen Keller International 2 500 kr,- 12%
4 HivNorge 2 000 kr,- 10%
3 Adina Stiftelsen 1 500 kr,- 8%
2 Leger Uten Grenser 1 000 kr,- 5%
2 WWF 1 000 kr,- 5%

Kostnadsbidrag til Gi Gaven Videre 500 kr

Totalsum 20 500 kr

Takk for at dere bruker Gi Gaven Videre!
`;

/**
 * Creates a minimal valid PDF buffer for testing
 * This PDF contains embedded text that can be extracted by PDF.js
 */
export function createTestPDF(textContent = 'Test PDF Content') {
  // Create a simple PDF with the text content
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${textContent.length + 50} >>
stream
BT
/F1 12 Tf
50 750 Td
(${textContent.replace(/[()\\]/g, '\\$&')}) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000270 00000 n
0000000${350 + textContent.length} 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${420 + textContent.length}
%%EOF`;

  return Buffer.from(pdfContent);
}

/**
 * Test data for various scenarios
 */
export const testScenarios = {
  validSettlement: {
    companies: [
      { name: 'Røde Kors', number: '5000', numberOfGifts: 10, percentage: 25 },
      { name: 'Kirkens Bymisjon Oslo', number: '4000', numberOfGifts: 8, percentage: 20 },
      { name: 'Amnesty International', number: '3000', numberOfGifts: 6, percentage: 15 },
      { name: 'Kostnadsbidrag til Gi Gaven Videre', number: '500' },
    ],
    sum: 12500,
    recipientCompany: 'Test Bedrift AS',
    calculatedTotal: 12500
  },

  mismatchedSums: {
    companies: [
      { name: 'Røde Kors', number: '5000', numberOfGifts: 10, percentage: 50 },
    ],
    sum: 10000, // Doesn't match calculated total
    recipientCompany: 'Test AS',
    calculatedTotal: 5000
  },

  noSum: {
    companies: [
      { name: 'Test Org', number: '1000' },
    ],
    sum: null,
    recipientCompany: 'Test AS',
    calculatedTotal: 1000
  },

  emptySettlement: {
    companies: [],
    sum: 0,
    recipientCompany: null,
    calculatedTotal: 0
  },

  largeSettlement: {
    companies: Array.from({ length: 50 }, (_, i) => ({
      name: `Organization ${i + 1}`,
      number: String((i + 1) * 1000),
      numberOfGifts: i + 1,
      percentage: 2
    })),
    sum: 1275000,
    recipientCompany: 'Large Company AS',
    calculatedTotal: 1275000
  }
};

/**
 * Wait for PDF processing to complete
 */
export async function waitForProcessingComplete(page, timeout = 30000) {
  await page.waitForFunction(
    () => {
      const statusSection = document.getElementById('statusSection');
      const resultsSection = document.getElementById('resultsSection');
      const errorSection = document.getElementById('errorSection');

      return (
        statusSection?.classList.contains('hidden') &&
        (!resultsSection?.classList.contains('hidden') ||
         !errorSection?.classList.contains('hidden'))
      );
    },
    { timeout }
  );
}

/**
 * Upload a PDF file to the app
 */
export async function uploadPDF(page, pdfBuffer, filename = 'test.pdf') {
  const fileInput = page.locator('#fileInput');
  await fileInput.setInputFiles({
    name: filename,
    mimeType: 'application/pdf',
    buffer: pdfBuffer,
  });
}

/**
 * Set test data and display results
 */
export async function setTestDataAndDisplay(page, testData) {
  await page.evaluate((data) => {
    window.extractedData = data;
    displayResults();
  }, testData);
}
