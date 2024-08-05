/**
 * Convert PDF file to text
 * @param {Blob} pdfFile - The PDF file blob
 * @param {string} language - The language of the PDF text to use for OCR
 * @return {string} - The extracted text of the PDF file
 */
const convertPDFToText = (pdfFile, language) => {
  language = language || 'en'; // English

  try {
    // Use OCR to convert PDF to a temporary Google Document
    const tempDoc = Drive.Files.insert(
      {
        title: 'tempdoc',
        mimeType: 'application/pdf',
      },
      pdfFile,
      {
        ocr: true,
        ocrLanguage: language,
      }
    );

    // Use the Document API to extract text from the Google Document
    const textContent = DocumentApp.openById(tempDoc.id).getBody().getText();

    // Delete the temporary Google Document since it is no longer needed
    DriveApp.getFileById(tempDoc.id).setTrashed(true);

    return textContent;
  } catch (error) {
    console.error('Error converting PDF file to text:', error);
    return null;
  }
};
