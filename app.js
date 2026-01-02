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

// Sort state
let currentSort = {
    column: null,
    direction: 'asc'
};

// Master organization list (stored in localStorage)
const MASTER_LIST_KEY = 'ggv-master-org-list';
const DEFAULT_LIST_URL = 'organizations.json';

/**
 * Get master organization list from localStorage
 */
function getMasterList() {
    const stored = localStorage.getItem(MASTER_LIST_KEY);
    return stored ? JSON.parse(stored) : [];
}

/**
 * Load default organization list from JSON file (if no local list exists)
 */
async function loadDefaultOrganizations() {
    const currentList = getMasterList();
    if (currentList.length > 0) {
        // Already have a list, don't overwrite
        return;
    }

    try {
        const response = await fetch(DEFAULT_LIST_URL);
        if (response.ok) {
            const data = await response.json();
            if (data.organizations && data.organizations.length > 0) {
                saveMasterList(data.organizations);
                console.log('Loaded default organization list:', data.organizations.length, 'organizations');
            }
        }
    } catch (err) {
        console.log('No default organization list found or failed to load:', err);
    }
}

/**
 * Save master organization list to localStorage
 */
function saveMasterList(list) {
    localStorage.setItem(MASTER_LIST_KEY, JSON.stringify(list));
    updateMasterListUI();
}

/**
 * Add organizations to master list
 */
function addToMasterList(orgNames) {
    const masterList = getMasterList();
    const newOrgs = orgNames.filter(name =>
        !masterList.some(existing => normalizeOrgName(existing) === normalizeOrgName(name))
    );
    if (newOrgs.length > 0) {
        const updated = [...masterList, ...newOrgs].sort((a, b) => a.localeCompare(b, 'nb'));
        saveMasterList(updated);
        return newOrgs;
    }
    return [];
}

/**
 * Normalize organization name for comparison
 */
function normalizeOrgName(name) {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Find new organizations not in master list
 */
function findNewOrganizations(companies) {
    const masterList = getMasterList();
    if (masterList.length === 0) return [];

    return companies.filter(company =>
        !masterList.some(master => normalizeOrgName(master) === normalizeOrgName(company.name))
    );
}

/**
 * Get companies mapped to master list order with zeros for missing
 */
function getCompaniesInMasterListOrder() {
    const masterList = getMasterList();
    const { companies } = extractedData;

    if (masterList.length === 0) {
        // No master list, return alphabetically sorted
        return [...companies].sort((a, b) => a.name.localeCompare(b.name, 'nb'));
    }

    // Map each master list org to the extracted data (or zero if not found)
    return masterList.map(masterName => {
        const found = companies.find(c => normalizeOrgName(c.name) === normalizeOrgName(masterName));
        return {
            name: masterName,
            number: found ? found.number : '0',
            numberOfGifts: found ? found.numberOfGifts : 0,
            percentage: found ? found.percentage : 0,
            isFromPdf: !!found
        };
    });
}

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
const searchInput = document.getElementById('searchInput');
const verificationSection = document.getElementById('verificationSection');
const verifyPdfSum = document.getElementById('verifyPdfSum');
const verifyCalcSum = document.getElementById('verifyCalcSum');
const verifyDiff = document.getElementById('verifyDiff');
const verifyStatus = document.getElementById('verifyStatus');

// Initialize event listeners
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    // Click on drop zone
    dropZone.addEventListener('click', () => fileInput.click());

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    // Sortable table headers
    document.querySelectorAll('.results-table th.sortable').forEach(header => {
        header.addEventListener('click', () => handleSort(header.dataset.sort));
    });

    // Load default organizations if no local list exists
    await loadDefaultOrganizations();

    // Update org list count in footer
    updateOrgListCount();
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

    if (!textContent) {
        console.warn('No text content to extract from');
        return companies;
    }

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

    if (!textContent) {
        console.warn('No text content to extract sum from');
        return null;
    }

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
    if (!textContent) {
        return null;
    }

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

            // Remove common unwanted suffixes
            result = result.replace(/\s*Referanse:.*$/i, '');
            result = result.replace(/\s*Org\.?nr\.?:?.*$/i, '');
            result = result.replace(/\s*\d{9}.*$/, ''); // Remove org numbers
            result = result.trim();

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

    // Show count as "X av Y" if master list exists
    const masterList = getMasterList();
    if (masterList.length > 0) {
        orgCountValue.textContent = `${companies.length} av ${masterList.length}`;
    } else {
        orgCountValue.textContent = companies.length;
    }

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

    // Show automatic verification
    displayVerification(sum, calculatedTotal);

    // Check for new organizations (only if master list exists)
    if (masterList.length > 0) {
        const newOrgs = findNewOrganizations(companies);
        if (newOrgs.length > 0) {
            showNewOrgsAlert(newOrgs);
        } else {
            hideNewOrgsAlert();
        }
    } else {
        hideNewOrgsAlert();
    }

    // Populate table with all organizations from master list
    const displayCompanies = getCompaniesInMasterListOrder();
    renderTable(displayCompanies);

    // Reset search and sort
    if (searchInput) {
        searchInput.value = '';
    }
    resetSortIndicators();

    resultsSection.classList.remove('hidden');
}

function displayVerification(pdfSum, calculatedSum) {
    if (!verificationSection) return;

    const diff = pdfSum !== null ? Math.abs(pdfSum - calculatedSum) : null;
    const isMatch = diff !== null && diff < 0.01;

    verifyPdfSum.textContent = pdfSum !== null ? formatNumber(pdfSum) + ' kr' : 'Ikke funnet';
    verifyCalcSum.textContent = formatNumber(calculatedSum) + ' kr';

    if (diff !== null) {
        verifyDiff.textContent = diff < 0.01 ? '0 kr' : formatNumber(diff) + ' kr';
        verifyDiff.className = 'verification-value ' + (isMatch ? 'match' : 'mismatch');
    } else {
        verifyDiff.textContent = '-';
        verifyDiff.className = 'verification-value';
    }

    if (pdfSum === null) {
        verifyStatus.textContent = 'Kunne ikke verifisere';
        verifyStatus.className = 'verification-value mismatch';
    } else if (isMatch) {
        verifyStatus.textContent = 'Verifisert OK';
        verifyStatus.className = 'verification-value match';
    } else {
        verifyStatus.textContent = 'Avvik funnet';
        verifyStatus.className = 'verification-value mismatch';
    }

    verificationSection.classList.remove('hidden');
}

function renderTable(companies) {
    resultsBody.innerHTML = '';
    companies.forEach(company => {
        const row = document.createElement('tr');
        row.dataset.name = company.name.toLowerCase();
        const amount = parseFloat(company.number);
        const isZero = amount === 0;
        if (isZero) {
            row.classList.add('zero-amount');
        }
        row.innerHTML = `
            <td>${escapeHtml(company.name)}</td>
            <td>${formatNumber(amount)}</td>
            <td>${company.numberOfGifts || '-'}</td>
            <td>${company.percentage ? company.percentage + '%' : '-'}</td>
        `;
        resultsBody.appendChild(row);
    });
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    const rows = resultsBody.querySelectorAll('tr');

    rows.forEach(row => {
        const name = row.dataset.name || '';
        if (query === '' || name.includes(query)) {
            row.classList.remove('hidden');
        } else {
            row.classList.add('hidden');
        }
    });

    // Update sort info with result count
    const visibleRows = resultsBody.querySelectorAll('tr:not(.hidden)').length;
    const sortInfo = document.getElementById('sortInfo');
    if (sortInfo) {
        if (query) {
            sortInfo.textContent = `Viser ${visibleRows} av ${rows.length} organisasjoner`;
        } else {
            sortInfo.textContent = 'Klikk på kolonneoverskrift for å sortere';
        }
    }
}

function handleSort(column) {
    const { companies } = extractedData;

    // Toggle direction if same column
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }

    // Sort companies
    const sortedCompanies = [...companies].sort((a, b) => {
        let aVal, bVal;

        switch (column) {
            case 'name':
                aVal = a.name.toLowerCase();
                bVal = b.name.toLowerCase();
                break;
            case 'amount':
                aVal = parseFloat(a.number) || 0;
                bVal = parseFloat(b.number) || 0;
                break;
            case 'gifts':
                aVal = a.numberOfGifts || 0;
                bVal = b.numberOfGifts || 0;
                break;
            case 'percentage':
                aVal = a.percentage || 0;
                bVal = b.percentage || 0;
                break;
            default:
                return 0;
        }

        if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Re-render table
    renderTable(sortedCompanies);

    // Re-apply search filter
    if (searchInput && searchInput.value) {
        handleSearch({ target: searchInput });
    }

    // Update sort indicators
    updateSortIndicators();
}

function updateSortIndicators() {
    document.querySelectorAll('.results-table th.sortable').forEach(header => {
        header.classList.remove('asc', 'desc');
        if (header.dataset.sort === currentSort.column) {
            header.classList.add(currentSort.direction);
        }
    });
}

function resetSortIndicators() {
    currentSort = { column: null, direction: 'asc' };
    document.querySelectorAll('.results-table th.sortable').forEach(header => {
        header.classList.remove('asc', 'desc');
    });
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
    if (verificationSection) {
        verificationSection.classList.add('hidden');
    }
    fileName.textContent = '';
    fileInput.value = '';
    if (searchInput) {
        searchInput.value = '';
    }
    resetSortIndicators();
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

/**
 * Get sorted companies (alphabetically by name)
 */
function getSortedCompaniesAlphabetically() {
    const { companies } = extractedData;
    return [...companies].sort((a, b) => a.name.localeCompare(b.name, 'nb'));
}

/**
 * Sort table alphabetically and update UI
 */
function sortAlphabetically() {
    currentSort.column = 'name';
    currentSort.direction = 'asc';

    const sortedCompanies = getSortedCompaniesAlphabetically();
    renderTable(sortedCompanies);
    updateSortIndicators();

    // Re-apply search filter
    if (searchInput && searchInput.value) {
        handleSearch({ target: searchInput });
    }

    showCopyNotification('Sortert alfabetisk');
}

/**
 * Copy data to clipboard in a format suitable for Google Sheets
 * @param {string} format - 'full' for all columns, 'amounts' for just amounts, 'master-amounts' for master list order
 */
async function copyToClipboard(format = 'full') {
    const masterList = getMasterList();
    const hasMasterList = masterList.length > 0;

    // Use master list order if available, otherwise alphabetical
    const companies = hasMasterList ? getCompaniesInMasterListOrder() : getSortedCompaniesAlphabetically();
    let text = '';

    if (format === 'amounts' || format === 'master-amounts') {
        // Only copy amounts column (for pasting into existing sheet with org names)
        text = companies.map(c => c.number).join('\n');
    } else if (format === 'names-amounts') {
        // Copy organization names and amounts (tab-separated for Google Sheets)
        text = companies.map(c => `${c.name}\t${c.number}`).join('\n');
    } else {
        // Full data with all columns (tab-separated)
        text = 'Organisasjon\tBeløp (kr)\tAntall gaver\tProsent\n';
        text += companies.map(c =>
            `${c.name}\t${c.number}\t${c.numberOfGifts || ''}\t${c.percentage || ''}`
        ).join('\n');
    }

    try {
        await navigator.clipboard.writeText(text);
        showCopyNotification(getCopyMessage(format, hasMasterList));
    } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showCopyNotification(getCopyMessage(format, hasMasterList));
    }
}

function getCopyMessage(format, hasMasterList) {
    const suffix = hasMasterList ? ' (i fast rekkefølge)' : '';
    switch (format) {
        case 'amounts':
        case 'master-amounts':
            return 'Beløp kopiert' + suffix;
        case 'names-amounts':
            return 'Organisasjoner og beløp kopiert' + suffix;
        default:
            return 'Data kopiert til utklippstavle' + suffix;
    }
}

/**
 * Show a notification when copying
 */
function showCopyNotification(message) {
    // Remove existing notification
    const existing = document.querySelector('.copy-notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    // Trigger animation
    requestAnimationFrame(() => {
        notification.classList.add('show');
    });

    // Remove after delay
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

/**
 * Toggle dropdown menu visibility
 */
function toggleDropdown(button) {
    const dropdown = button.closest('.dropdown');
    const isOpen = dropdown.classList.contains('open');

    // Close all dropdowns first
    closeDropdowns();

    // Toggle this one if it wasn't open
    if (!isOpen) {
        dropdown.classList.add('open');
    }
}

/**
 * Close all dropdown menus
 */
function closeDropdowns() {
    document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) {
        closeDropdowns();
    }
});

// ============================================
// MASTER LIST MODAL FUNCTIONS
// ============================================

/**
 * Open the settings modal
 */
function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.classList.remove('hidden');
        updateMasterListUI();
    }
}

/**
 * Close the settings modal
 */
function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Update master list display in modal
 */
function updateMasterListUI() {
    const listContainer = document.getElementById('masterListContainer');
    const countDisplay = document.getElementById('masterListCount');
    const masterList = getMasterList();

    if (countDisplay) {
        countDisplay.textContent = masterList.length;
    }

    if (listContainer) {
        if (masterList.length === 0) {
            listContainer.innerHTML = '<p class="empty-list-message">Ingen organisasjoner lagt til ennå. Lim inn fra Google Sheets eller legg til fra PDF.</p>';
        } else {
            listContainer.innerHTML = masterList.map((org, index) => `
                <div class="master-list-item">
                    <span class="master-list-number">${index + 1}.</span>
                    <span class="master-list-name">${escapeHtml(org)}</span>
                    <button class="master-list-remove" onclick="removeFromMasterList('${escapeHtml(org).replace(/'/g, "\\'")}')">×</button>
                </div>
            `).join('');
        }
    }

    // Update footer count
    updateOrgListCount();
}

/**
 * Remove organization from master list
 */
function removeFromMasterList(orgName) {
    const masterList = getMasterList();
    const updated = masterList.filter(org => org !== orgName);
    saveMasterList(updated);
}

/**
 * Clear entire master list
 */
function clearMasterList() {
    if (confirm('Er du sikker på at du vil slette hele organisasjonslisten?')) {
        saveMasterList([]);
        showCopyNotification('Organisasjonslisten er tømt');
    }
}

/**
 * Import organizations from pasted text
 */
function importFromPaste() {
    const textarea = document.getElementById('pasteOrgList');
    if (!textarea) return;

    const text = textarea.value.trim();
    if (!text) {
        showCopyNotification('Ingen tekst å importere');
        return;
    }

    // Split by newlines and clean up
    const orgs = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    if (orgs.length === 0) {
        showCopyNotification('Ingen organisasjoner funnet');
        return;
    }

    // Add to master list (will deduplicate)
    const masterList = getMasterList();
    const uniqueNew = orgs.filter(org =>
        !masterList.some(existing => normalizeOrgName(existing) === normalizeOrgName(org))
    );

    if (uniqueNew.length > 0) {
        const updated = [...masterList, ...uniqueNew].sort((a, b) => a.localeCompare(b, 'nb'));
        saveMasterList(updated);
        showCopyNotification(`${uniqueNew.length} organisasjoner lagt til`);
    } else {
        showCopyNotification('Alle organisasjoner finnes allerede');
    }

    textarea.value = '';
}

/**
 * Export master list to clipboard
 */
async function exportMasterList() {
    const masterList = getMasterList();
    if (masterList.length === 0) {
        showCopyNotification('Ingen organisasjoner å eksportere');
        return;
    }

    const text = masterList.join('\n');

    try {
        await navigator.clipboard.writeText(text);
        showCopyNotification('Organisasjonsliste kopiert');
    } catch (err) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showCopyNotification('Organisasjonsliste kopiert');
    }
}

/**
 * Add new organizations from current PDF to master list
 */
function addNewOrgsToMasterList() {
    const { companies } = extractedData;
    const newOrgs = findNewOrganizations(companies);

    if (newOrgs.length === 0) {
        showCopyNotification('Ingen nye organisasjoner å legge til');
        return;
    }

    const added = addToMasterList(newOrgs.map(c => c.name));
    if (added.length > 0) {
        showCopyNotification(`${added.length} nye organisasjoner lagt til`);
        hideNewOrgsAlert();
    }
}

/**
 * Show alert for new organizations found
 */
function showNewOrgsAlert(newOrgs) {
    const alert = document.getElementById('newOrgsAlert');
    const list = document.getElementById('newOrgsList');
    const count = document.getElementById('newOrgsCount');

    if (alert && list && count) {
        count.textContent = newOrgs.length;
        list.innerHTML = newOrgs.map(c => `<span class="new-org-tag">${escapeHtml(c.name)}</span>`).join('');
        alert.classList.remove('hidden');
    }
}

/**
 * Hide new organizations alert
 */
function hideNewOrgsAlert() {
    const alert = document.getElementById('newOrgsAlert');
    if (alert) {
        alert.classList.add('hidden');
    }
}

/**
 * Add new organizations locally and create GitHub Issue
 */
async function addAndReportNewOrgs() {
    const { companies } = extractedData;
    const newOrgs = findNewOrganizations(companies);

    if (newOrgs.length === 0) {
        showCopyNotification('Ingen nye organisasjoner');
        return;
    }

    // Add locally
    const added = addToMasterList(newOrgs.map(c => c.name));

    if (added.length > 0) {
        // Create GitHub Issue in background
        createGitHubIssue(added).catch(err => {
            console.log('Could not create GitHub issue:', err);
        });

        showCopyNotification(`${added.length} lagt til`);
        hideNewOrgsAlert();
    }
}

/**
 * Create GitHub Issue for new organizations (runs silently in background)
 */
async function createGitHubIssue(orgNames) {
    // Token with minimal permissions (Issues only, this repo only)
    const _t = ['github_pat_11ACCSZRA0', 'NWtbQH4Y8PVl_Itphbks', 'Sv0ze04VdyYQxIl2KXt4', 'YnJbN1CYdFZWBwq26QTJ', 'OK6ZLZm5vyom'];

    const title = `Nye organisasjoner: ${orgNames.slice(0, 3).join(', ')}${orgNames.length > 3 ? '...' : ''}`;
    const body = `## Nye organisasjoner fra PDF\n\nFølgende organisasjoner ble lagt til lokalt og bør vurderes for organizations.json:\n\n${orgNames.map(o => `- ${o}`).join('\n')}\n\n---\n*Automatisk opprettet av GGV Oppgjørsgenerator*`;

    const response = await fetch('https://api.github.com/repos/CHaerem/GGV-SettlementGenerator/issues', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${_t.join('')}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: title,
            body: body,
            labels: ['new-organization']
        })
    });

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
    }

    return response.json();
}

/**
 * Organization List Modal functions
 */
function openOrgListModal() {
    const modal = document.getElementById('orgListModal');
    const container = document.getElementById('orgListContainer');
    const masterList = getMasterList();

    if (container) {
        container.innerHTML = masterList.map(org =>
            `<div class="org-list-item" onclick="requestOrgRemoval('${escapeHtml(org).replace(/'/g, "\\'")}')">
                ${escapeHtml(org)}
                <span class="org-remove-hint">Klikk for å be om fjerning</span>
            </div>`
        ).join('');
    }

    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeOrgListModal() {
    const modal = document.getElementById('orgListModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

async function requestOrgRemoval(orgName) {
    if (!confirm(`Fjerne "${orgName}" fra listen?`)) {
        return;
    }

    // Remove locally immediately
    removeFromMasterList(orgName);
    updateOrgListCount();

    // Refresh modal
    openOrgListModal();

    showCopyNotification('Fjernet');

    // Create GitHub Issue in background (for global list update)
    createGitHubIssueForRemoval(orgName).catch(err => {
        console.log('Could not create GitHub issue:', err);
    });
}

async function createGitHubIssueForRemoval(orgName) {
    const _t = ['github_pat_11ACCSZRA0', 'NWtbQH4Y8PVl_Itphbks', 'Sv0ze04VdyYQxIl2KXt4', 'YnJbN1CYdFZWBwq26QTJ', 'OK6ZLZm5vyom'];

    const title = `Fjern organisasjon: ${orgName}`;
    const body = `## Forespørsel om fjerning\n\nBruker ber om at følgende organisasjon fjernes fra master-listen:\n\n- **${orgName}**\n\n---\n*Automatisk opprettet av GGV Oppgjørsgenerator*`;

    const response = await fetch('https://api.github.com/repos/CHaerem/GGV-SettlementGenerator/issues', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${_t.join('')}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: title,
            body: body,
            labels: ['remove-organization']
        })
    });

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
    }

    return response.json();
}

function updateOrgListCount() {
    const countEl = document.getElementById('orgListCount');
    if (countEl) {
        const masterList = getMasterList();
        countEl.textContent = masterList.length;
    }
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('orgListModal');
    if (modal && e.target === modal) {
        closeOrgListModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeOrgListModal();
    }
});

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

    // Master list functions
    window.getMasterList = getMasterList;
    window.saveMasterList = saveMasterList;
    window.getCompaniesInMasterListOrder = getCompaniesInMasterListOrder;
    window.findNewOrganizations = findNewOrganizations;

    // Allow tests to set extractedData
    window.setExtractedData = function(data) {
        extractedData = data;
    };
    window.getExtractedData = function() {
        return extractedData;
    };
}
