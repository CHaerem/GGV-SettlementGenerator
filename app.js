/**
 * GGV Oppgjørsgenerator - Client-side PDF Processing
 * Migrated from Google Apps Script to GitHub Pages
 */

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Global state
let extractedData = {
    companies: [],
    sum: null,
    recipientCompany: null,
    calculatedTotal: 0
};

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');
const statusSection = document.getElementById('statusSection');
const statusText = document.getElementById('statusText');
const progressFill = document.getElementById('progressFill');
const errorSection = document.getElementById('errorSection');
const errorText = document.getElementById('errorText');
const resultsSection = document.getElementById('resultsSection');
const resultsBody = document.getElementById('resultsBody');
const recipientValue = document.getElementById('recipientValue');
const totalValue = document.getElementById('totalValue');
const orgCountValue = document.getElementById('orgCountValue');
const validationMessage = document.getElementById('validationMessage');

// Initialize event listeners
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    // Click on drop zone
    dropZone.addEventListener('click', () => fileInput.click());
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

async function processFile(file) {
    // Validate file type
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        showError('Vennligst velg en PDF-fil.');
        return;
    }

    // Show file name
    fileName.textContent = file.name;

    // Show processing status
    showStatus('Laster inn PDF...', 10);
    hideError();
    hideResults();

    try {
        // Extract text from PDF
        const text = await extractTextFromPDF(file);
        console.log('Extracted text from PDF:', text);

        if (!text || text.trim().length < 50) {
            // If very little text extracted, try OCR
            showStatus('Prøver OCR på PDF...', 30);
            const ocrText = await performOCR(file);
            await processExtractedText(ocrText);
        } else {
            await processExtractedText(text);
        }
    } catch (error) {
        console.error('Error processing PDF:', error);
        showError('Feil ved behandling av PDF: ' + error.message);
    }
}

async function extractTextFromPDF(file) {
    showStatus('Leser PDF...', 20);

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    const totalPages = pdf.numPages;

    for (let i = 1; i <= totalPages; i++) {
        showStatus(`Leser side ${i} av ${totalPages}...`, 20 + (i / totalPages) * 30);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
    }

    return fullText;
}

async function performOCR(file) {
    showStatus('Starter OCR-behandling...', 40);

    // Convert PDF to images first, then OCR
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    const totalPages = pdf.numPages;

    for (let i = 1; i <= totalPages; i++) {
        showStatus(`OCR-behandler side ${i} av ${totalPages}...`, 40 + (i / totalPages) * 40);

        const page = await pdf.getPage(i);
        const scale = 2; // Higher scale for better OCR
        const viewport = page.getViewport({ scale });

        // Create canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Render page to canvas
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        // Perform OCR on the canvas
        const result = await Tesseract.recognize(canvas, 'nor', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    const pageProgress = 40 + ((i - 1) / totalPages) * 40 + (m.progress / totalPages) * 40;
                    updateProgress(pageProgress);
                }
            }
        });

        fullText += result.data.text + '\n';
    }

    return fullText;
}

async function processExtractedText(text) {
    showStatus('Analyserer tekst...', 85);

    // Extract data using the same patterns as the original script
    const companies = extractInformationFromPDFText(text);
    console.log('Extracted companies:', companies);

    const sum = extractSumFromPDFText(text);
    console.log('Sum from PDF:', sum);

    const total = calculateTotal(companies);
    console.log('Calculated total:', total);

    const recipientCompany = extractRecipientCompanyFromPDFText(text);
    console.log('Recipient company:', recipientCompany);

    // Store extracted data
    extractedData = {
        companies,
        sum,
        recipientCompany,
        calculatedTotal: total
    };

    showStatus('Fullført!', 100);

    // Display results
    setTimeout(() => {
        displayResults();
    }, 500);
}

/**
 * Extract organization information from PDF text
 * Ported from Code.js
 */
function extractInformationFromPDFText(textContent) {
    console.log('Full text content:', textContent);

    const companies = [];

    // Main extraction pattern - flexible with whitespace around "kr" and ",-"
    // Matches: "1   Uinnløste til   Ung Kreft   500   kr ,-   100 %"
    const pattern = /(\d+)\s+(.+?)\s+([\d\s,.]+)\s*kr\s*[,\-]+\s*(\d+)\s*%/gm;
    let match;
    while ((match = pattern.exec(textContent)) !== null) {
        companies.push({
            name: match[2].trim().replace(/\s+/g, ' '),  // Collapse multiple spaces
            number: match[3].replace(/[\s,.]/g, '').replace(',', '.'),
            numberOfGifts: parseInt(match[1]),
            percentage: parseInt(match[4])
        });
    }

    // Fallback pattern for multi-line entries
    const fallbackPattern = /(?:%|\btotalbeløp)\s(\D+?)\n\d*\s\n(\D+?)\s+kr\s+([\d\s,.]+)-\s\d+\s/g;
    let fallbackMatch;
    while ((fallbackMatch = fallbackPattern.exec(textContent)) !== null) {
        companies.push({
            name: (fallbackMatch[1].trim() + ' ' + fallbackMatch[2].trim()).trim(),
            number: fallbackMatch[3].replace(/[\s,.]/g, '').replace(',', '.')
        });
    }

    // Extract cost contribution
    const costPattern = /Kostnadsbidrag\stil\sGi\sGaven\sVidere\s+([\d\s,.]+)\s*kr/i;
    const costMatch = textContent.match(costPattern);
    console.log('Cost contribution match:', costMatch);
    if (costMatch) {
        companies.push({
            name: 'Kostnadsbidrag til Gi Gaven Videre',
            number: costMatch[1].replace(/[\s,.]/g, '').replace(',', '.')
        });
    } else {
        console.warn('Cost contribution not found. Attempting alternative extraction.');
        // Alternative extraction method
        const lines = textContent.split('\n');
        const costLine = lines.find(line => line.includes('Kostnadsbidrag til Gi Gaven Videre'));
        if (costLine) {
            const altCostMatch = costLine.match(/([\d\s,.]+)\s*kr/);
            if (altCostMatch) {
                companies.push({
                    name: 'Kostnadsbidrag til Gi Gaven Videre',
                    number: altCostMatch[1].replace(/[\s,.]/g, '').replace(',', '.')
                });
            }
        }
    }

    console.log('Extracted companies:', companies);
    if (companies.length === 0) {
        console.warn('No companies extracted. PDF structure might have changed.');
    }

    return companies;
}

/**
 * Extract total sum from PDF text
 * Ported from Code.js
 */
function extractSumFromPDFText(textContent) {
    console.log('Extracting sum from text...');

    // Look for "Totalsum" or "Total" followed by a number and "kr"
    const sumPattern = /(Totalsum|Total)\s*(kr\s*)?(\d[\d\s,.]+)(\s*kr)?/i;
    const match = textContent.match(sumPattern);

    if (match) {
        console.log('Sum match found:', match[0]);
        const sumText = match[3];
        const sum = parseFloat(sumText.replace(/\s+/g, '').replace(',', '.'));
        console.log('Extracted sum:', sum);
        return sum;
    } else {
        console.warn('No sum found using the primary pattern. Attempting alternative extraction...');

        // Alternative: Look for the last occurrence of a number followed by "kr"
        const lines = textContent.split('\n').reverse();
        for (const line of lines) {
            const altMatch = line.match(/(\d[\d\s,.]+)\s*kr/);
            if (altMatch) {
                const sum = parseFloat(altMatch[1].replace(/\s+/g, '').replace(',', '.'));
                console.log('Sum found using alternative method:', sum);
                return sum;
            }
        }

        console.error('Failed to extract sum from the text.');
        return null;
    }
}

/**
 * Calculate total from extracted companies
 * Ported from Code.js
 */
function calculateTotal(companies) {
    return companies.reduce((acc, company) => acc + parseFloat(company.number || 0), 0);
}

/**
 * Extract recipient company from PDF text
 * Ported from Code.js
 */
function extractRecipientCompanyFromPDFText(textContent) {
    // Try multiple patterns for recipient extraction
    const patterns = [
        /til:\s+(.+?)\s*\n/s,                                    // Original pattern with newline
        /til:\s+([A-ZÆØÅa-zæøå][a-zæøå]+(?:\s+[A-ZÆØÅa-zæøå][a-zæøå]+)*)/,  // Name (First Last format)
        /til:\s+([A-ZÆØÅa-zæøå\s]+?)(?:\s{2,}[A-Z]|\s+\d)/i,    // Name followed by double space+capital or digit (address)
    ];

    for (const pattern of patterns) {
        const match = textContent.match(pattern);
        if (match && match[1]) {
            // Clean up multiple spaces and limit to reasonable length
            let result = match[1].trim().replace(/\s+/g, ' ');
            // If result seems too long, try to extract just the name portion
            if (result.length > 50) {
                const words = result.split(' ');
                // Take first 2-4 words that look like a name
                result = words.slice(0, 4).join(' ');
            }
            return result;
        }
    }

    return null;
}

function displayResults() {
    hideStatus();
    hideError();

    const { companies, sum, recipientCompany, calculatedTotal } = extractedData;

    // Update summary cards
    recipientValue.textContent = recipientCompany || '-';
    totalValue.textContent = sum ? formatNumber(sum) + ' kr' : '-';
    orgCountValue.textContent = companies.length;

    // Validation message
    validationMessage.className = 'validation-message';
    if (sum === null) {
        validationMessage.textContent = 'Kunne ikke trekke ut totalsum fra PDF. Vennligst sjekk dataene manuelt.';
        validationMessage.classList.add('warning');
    } else if (Math.abs(sum - calculatedTotal) > 0.01) {
        validationMessage.textContent = `Summen av trukket data (${formatNumber(calculatedTotal)} kr) stemmer ikke med sum i PDF (${formatNumber(sum)} kr). Vennligst sjekk dataene.`;
        validationMessage.classList.add('warning');
    } else {
        validationMessage.textContent = 'Data er vellykket hentet ut fra PDF-filen.';
        validationMessage.classList.add('success');
    }

    // Populate table
    resultsBody.innerHTML = '';
    companies.forEach(company => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(company.name)}</td>
            <td>${formatNumber(parseFloat(company.number))}</td>
            <td>${company.numberOfGifts || '-'}</td>
            <td>${company.percentage ? company.percentage + '%' : '-'}</td>
        `;
        resultsBody.appendChild(row);
    });

    resultsSection.classList.remove('hidden');
}

function showStatus(message, progress) {
    statusSection.classList.remove('hidden');
    statusText.textContent = message;
    progressFill.style.width = progress + '%';
    document.querySelector('.upload-section').classList.add('hidden');
}

function updateProgress(progress) {
    progressFill.style.width = progress + '%';
}

function hideStatus() {
    statusSection.classList.add('hidden');
}

function showError(message) {
    errorSection.classList.remove('hidden');
    errorText.textContent = message;
    hideStatus();
    document.querySelector('.upload-section').classList.add('hidden');
}

function hideError() {
    errorSection.classList.add('hidden');
}

function hideResults() {
    resultsSection.classList.add('hidden');
}

function resetApp() {
    hideStatus();
    hideError();
    hideResults();
    fileName.textContent = '';
    fileInput.value = '';
    document.querySelector('.upload-section').classList.remove('hidden');
    extractedData = {
        companies: [],
        sum: null,
        recipientCompany: null,
        calculatedTotal: 0
    };
}

function exportToCSV() {
    const { companies, sum, recipientCompany } = extractedData;

    let csv = 'Organisasjon;Beløp (kr);Antall gaver;Prosent\n';

    companies.forEach(company => {
        csv += `"${company.name}";${company.number};${company.numberOfGifts || ''};${company.percentage || ''}\n`;
    });

    csv += '\n';
    csv += `"Mottaker";"${recipientCompany || ''}"\n`;
    csv += `"Totalsum";${sum || ''}\n`;

    // Create download
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'ggv-oppgjor.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function formatNumber(num) {
    if (isNaN(num)) return '-';
    return num.toLocaleString('nb-NO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Expose functions for testing
if (typeof window !== 'undefined') {
    window.extractInformationFromPDFText = extractInformationFromPDFText;
    window.extractSumFromPDFText = extractSumFromPDFText;
    window.extractRecipientCompanyFromPDFText = extractRecipientCompanyFromPDFText;
    window.calculateTotal = calculateTotal;
    window.displayResults = displayResults;
    window.showStatus = showStatus;
    window.updateProgress = updateProgress;
    window.resetApp = resetApp;
    window.formatNumber = formatNumber;
    window.escapeHtml = escapeHtml;

    // Allow tests to set extractedData
    window.setExtractedData = function(data) {
        extractedData = data;
    };
    window.getExtractedData = function() {
        return extractedData;
    };
}
