function startButton() {
  resetButton();
  // Prompt the user to choose a file using an HTML dialog
  var html = HtmlService.createHtmlOutputFromFile('index3');
  SpreadsheetApp.getUi().showModalDialog(html, 'Upload PDF');
}

function resetButton() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getActiveSheet();
  const lastRow = sheet.getLastRow();
  sheet.getRange(`B8:B${lastRow}`).clearContent();
  sheet.getRange(`D9:E${lastRow}`).clearContent();
  sheet.getRange(`C1`).clearContent();
}

function processFile(file) {
  text = convertPDFToText(file, 'no');
  console.log(text);
  var companies = extractInformationFromPDFText(text);
  var sum = extractSumFromPDFText(text);
  console.log("Sum from PDF: " + sum);
  var total = calculateTotal(companies);
  console.log("Sum from extracted data: " + total);
  var recipientCompany = extractRecipientCompanyFromPDFText(text);
  console.log("Recipient company: " + recipientCompany);
  writeToGoogleSheet(companies, sum, recipientCompany);

  if (sum !== total) {
    return "The sum of extracted data (" + total + ") does not match the sum in the PDF file (" + sum + "). Please check the data.";
  } else {
    return "Data has been successfully extracted and written to the Google Sheet.";
  }
}

function doGet() {
  startButton();
}

function uploadFile(form) {
  try {
    // Get the uploaded file
    var file = form.file;
    // Call the backend function to process the file
    var result = processFile(file);
    // Return a response to the client
    return result;
  } catch (error) {
    // Display an error message to the user
    var message = "An error occurred while uploading the file: " + error.message;
    return message;
  }
}

const extractInformationFromPDFText = (textContent) => {
  const header = "Antall  \ngaver Organisasjon Samlet beløp % av totalbeløp";
  const footer = "Totalsum kr";
  const startIndex = textContent.indexOf(header);
  const endIndex = textContent.indexOf(footer, startIndex + header.length);
  const tableContent = textContent.substring(startIndex, endIndex);
  const pattern = /(?:%|\btotalbeløp)\s*\d[\d\s,]*\s+(.+?)\s+kr\s+([\d\s,.]+),-\s+\d+\s*/g;
  const matches = [...tableContent.matchAll(pattern)];
  var companies = matches.map((match) => ({
    name: match[1].trim(),
    number: match[2].replace(/[\s,.]/g, '').replace(',', '.'),
  }));

  const pattern2 = /(?:%|\btotalbeløp)\s(\D+?)\n\d*\s\n(\D+?)\s+kr\s+([\d\s,.]+)-\s\d+\s/g;
  const matches2 = [...tableContent.matchAll(pattern2)];
  companies2 = matches2.map((match) => ({
    name: match[1].trim() + " " + match[2].trim(),
    number: match[3].replace(/[\s,.]/g, '').replace(',', '.'),
  }));
  companies = companies.concat(companies2);

  const pattern3 = /(Kostnadsbidrag\stil\sGi\sGaven\sVidere)\skr\s([\d\s.]+)/g;
  const matches3 = [...tableContent.matchAll(pattern3)];
  const companies3 = matches3.map((match) => ({
    name: match[1].trim(),
    number: match[2].replace(/[\s,.]/g, '').replace(',', '.'),
  }));
  console.log(companies3);

  return companies.concat(companies3);
};

const extractSumFromPDFText = (textContent) => {
  const footer = "Totalsum kr";
  const index = textContent.indexOf(footer);
  const sumText = textContent.substring(index + footer.length);
  const sum = sumText.replace(/\s+/g, '').replace(',', '.');
  return parseFloat(sum);
};

const calculateTotal = (companies) => {
  return companies.reduce((acc, company) => acc + parseFloat(company.number), 0);
};

const extractRecipientCompanyFromPDFText = (textContent) => {
  const pattern = /til:\s+(.+?)\s\n/s;
  const match = textContent.match(pattern);
  if (match && match[1]) {
    return match[1].trim();
  } else {
    return null;
  }
};

const writeToGoogleSheet = (companies, sum, recipientCompany) => {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getActiveSheet();
  const lastRow = sheet.getLastRow();
  const existingCompanies = sheet.getRange(`A1:A${lastRow}`).getValues().flat();
  const newCompanies = [];
  companies.forEach((company) => {
    const rowIndex = existingCompanies.indexOf(company.name) + 1;
    if (rowIndex > 0) {
      sheet.getRange(`B${rowIndex}`).setValue(company.number);
    } else {
      newCompanies.push(company);
    }
  });
  if (newCompanies.length > 0) {
    const startRow = 9;
    const range = sheet.getRange(startRow, 4, newCompanies.length, 2);
    range.setValues(newCompanies.map((company) => [company.name, company.number]));
  }

  sheet.getRange('C1').setValue(sum);
  sheet.getRange('B8').setValue(recipientCompany);

  // Fill every empty cell in column B from row 9 to last row with "-"
  const rangeToFill = sheet.getRange(`B9:B${lastRow}`);
  const valuesToFill = rangeToFill.getValues();
  const filledValues = valuesToFill.map((row, index) => {
    const rowIndex = index + 9; 
    if (!row[0] && !sheet.getRange(`A${rowIndex}`).isBlank()) {
      return ["-"];
    } else {
      return row;
    }
  });
  rangeToFill.setValues(filledValues);

  SpreadsheetApp.flush();
};



