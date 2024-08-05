function startButton() {
	resetButton();
	// Prompt the user to choose a file using an HTML dialog
	var html = HtmlService.createHtmlOutputFromFile("index3");
	SpreadsheetApp.getUi().showModalDialog(html, "Upload PDF");
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
	const text = convertPDFToText(file, "no");
	console.log("Extracted text from PDF:", text);

	const companies = extractInformationFromPDFText(text);
	console.log("Extracted companies:", companies);

	const sum = extractSumFromPDFText(text);
	console.log("Sum from PDF:", sum);

	const total = calculateTotal(companies);
	console.log("Sum from extracted data:", total);

	const recipientCompany = extractRecipientCompanyFromPDFText(text);
	console.log("Recipient company:", recipientCompany);

	writeToGoogleSheet(companies, sum, recipientCompany);

	if (sum === null) {
		return "Failed to extract the total sum from the PDF. Please check the data manually.";
	} else if (Math.abs(sum - total) > 0.01) {
		// Allow for small floating-point discrepancies
		return `The sum of extracted data (${total}) does not match the sum in the PDF file (${sum}). Please check the data.`;
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
		var message =
			"An error occurred while uploading the file: " + error.message;
		return message;
	}
}

const extractInformationFromPDFText = (textContent) => {
	console.log("Full text content:", textContent); // Log full content for debugging

	const companies = [];

	// Main extraction pattern
	const pattern = /(\d+)\s+(.+?)\s+([\d\s,.]+)\s+kr,-\s+(\d+)\s*%/gm;
	let match;
	while ((match = pattern.exec(textContent)) !== null) {
		companies.push({
			name: match[2].trim(),
			number: match[3].replace(/[\s,.]/g, "").replace(",", "."),
			numberOfGifts: parseInt(match[1]),
			percentage: parseInt(match[4]),
		});
	}

	// Fallback pattern for multi-line entries
	const fallbackPattern =
		/(?:%|\btotalbeløp)\s(\D+?)\n\d*\s\n(\D+?)\s+kr\s+([\d\s,.]+)-\s\d+\s/g;
	let fallbackMatch;
	while ((fallbackMatch = fallbackPattern.exec(textContent)) !== null) {
		companies.push({
			name: (fallbackMatch[1].trim() + " " + fallbackMatch[2].trim()).trim(),
			number: fallbackMatch[3].replace(/[\s,.]/g, "").replace(",", "."),
		});
	}

	// Extract cost contribution - modified pattern
	const costPattern =
		/Kostnadsbidrag\stil\sGi\sGaven\sVidere\s+([\d\s,.]+)\s*kr/i;
	const costMatch = textContent.match(costPattern);
	console.log("Cost contribution match:", costMatch); // Log the match result
	if (costMatch) {
		companies.push({
			name: "Kostnadsbidrag til Gi Gaven Videre",
			number: costMatch[1].replace(/[\s,.]/g, "").replace(",", "."),
		});
	} else {
		console.warn(
			"Cost contribution not found. Attempting alternative extraction."
		);
		// Alternative extraction method
		const lines = textContent.split("\n");
		const costLine = lines.find((line) =>
			line.includes("Kostnadsbidrag til Gi Gaven Videre")
		);
		if (costLine) {
			const costMatch = costLine.match(/([\d\s,.]+)\s*kr/);
			if (costMatch) {
				companies.push({
					name: "Kostnadsbidrag til Gi Gaven Videre",
					number: costMatch[1].replace(/[\s,.]/g, "").replace(",", "."),
				});
			}
		}
	}

	console.log("Extracted companies:", companies);
	if (companies.length === 0) {
		console.warn("No companies extracted. PDF structure might have changed.");
	}

	return companies;
};

const extractSumFromPDFText = (textContent) => {
	console.log("Extracting sum from text...");

	// Look for "Totalsum" or "Total" followed by a number and "kr"
	const sumPattern = /(Totalsum|Total)\s*(kr\s*)?(\d[\d\s,.]+)(\s*kr)?/i;
	const match = textContent.match(sumPattern);

	if (match) {
		console.log("Sum match found:", match[0]);
		const sumText = match[3];
		const sum = parseFloat(sumText.replace(/\s+/g, "").replace(",", "."));
		console.log("Extracted sum:", sum);
		return sum;
	} else {
		console.warn(
			"No sum found using the primary pattern. Attempting alternative extraction..."
		);

		// Alternative: Look for the last occurrence of a number followed by "kr"
		const lines = textContent.split("\n").reverse();
		for (const line of lines) {
			const altMatch = line.match(/(\d[\d\s,.]+)\s*kr/);
			if (altMatch) {
				const sum = parseFloat(
					altMatch[1].replace(/\s+/g, "").replace(",", ".")
				);
				console.log("Sum found using alternative method:", sum);
				return sum;
			}
		}

		console.error("Failed to extract sum from the text.");
		return null;
	}
};

const calculateTotal = (companies) => {
	return companies.reduce(
		(acc, company) => acc + parseFloat(company.number),
		0
	);
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
		range.setValues(
			newCompanies.map((company) => [company.name, company.number])
		);
	}

	sheet.getRange("C1").setValue(sum);
	sheet.getRange("B8").setValue(recipientCompany);

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
