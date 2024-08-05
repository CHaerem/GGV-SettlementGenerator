# GGV-SettlementGenerator

## Overview

GGV-SettlementGenerator is a Google Apps Script project designed to automate the process of extracting donation information from PDF files generated by "Gi Gaven Videre AS" and populating a Google Sheet with this data. This tool significantly streamlines the process of managing and recording charitable donations.

## Google Sheet

The project is associated with the following Google Sheet:

[GGV-SettlementGenerator Sheet](https://docs.google.com/spreadsheets/d/1tSNa_Lgl8oLpG3MFq4mSI2q5Yka25VUalgxb5wqPHCA/edit?usp=sharing)

## Features

- Extracts donation information from PDF files
- Parses data for multiple organizations and their respective donation amounts
- Calculates and verifies total donation sums
- Captures cost contributions to "Gi Gaven Videre"
- Populates a Google Sheet with extracted data
- Provides error checking and data validation

## Google Sheet Structure

The Google Sheet is set up with the following structure:

- Column A: List of charitable organizations
- Column B: Donation amounts for each organization
- Column C: Total sum from the PDF
- Column D & E: Additional extracted information (varies based on PDF content)
- Cell B8: Recipient company information

The sheet includes rows for various charitable organizations, including:

- Kirkens Bymisjon Oslo
- Amnesty
- Helen Keller International
- Røde Kors
- HivNorge
- Adina Stiftelsen
- ...and many more

It also includes special rows for:

- Gavekort der mottager har valgt at Gi gaven videre skal velge formål
- Uinnløste gavekort der Gi gaven videre velger formål
- Kostnadsbidrag til Gi Gaven Videre

## Usage

1. Open the [Google Sheet](https://docs.google.com/spreadsheets/d/1tSNa_Lgl8oLpG3MFq4mSI2q5Yka25VUalgxb5wqPHCA/edit?usp=sharing) containing the GGV-SettlementGenerator script.
2. Click the "Upload PDF" button in the sheet.
3. Choose the PDF file of the settlement when prompted.
4. The script will process the PDF and populate the sheet with extracted data.
5. Review the populated data in the sheet.

## Functions

- `startButton()`: Initiates the PDF upload process.
- `processFile(file)`: Main function for processing the uploaded PDF file.
- `extractInformationFromPDFText(textContent)`: Extracts donation information from the PDF text.
- `extractSumFromPDFText(textContent)`: Extracts the total sum from the PDF text.
- `extractRecipientCompanyFromPDFText(textContent)`: Extracts the recipient company information.
- `writeToGoogleSheet(companies, sum, recipientCompany)`: Writes extracted data to the Google Sheet.

This script automates the process of extracting and organizing donation data, saving time and reducing manual data entry errors.
