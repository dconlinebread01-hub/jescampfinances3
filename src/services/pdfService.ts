import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FinancialDocument, DocumentType } from '../types';
import { format } from 'date-fns';

export const generateDocumentPDF = (doc: FinancialDocument) => {
  const pdf = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });
  
  const fileName = doc.type === DocumentType.CREDIT_NOTE 
    ? `${doc.storeName} CREDIT NOTE ${format(new Date(doc.date), 'MMMM').toUpperCase()}`
    : `${doc.storeName} ${doc.documentNumber || doc.lpoNumber}`;

  pdf.setProperties({
    title: fileName.trim()
  });

  const isInvoice = doc.type === DocumentType.INVOICE;
  const brandPurple: [number, number, number] = [106, 27, 154];
  const brandOrange: [number, number, number] = [255, 109, 0];
  const accentColor: [number, number, number] = isInvoice ? brandOrange : brandPurple;
  const title = isInvoice ? 'Invoice' : 'Credit Note';

  // --- Colors ---
  const lightBg: [number, number, number] = [250, 245, 240];
  const lightBorder: [number, number, number] = [200, 200, 200];
  const purpleLogo: [number, number, number] = brandPurple;
  const orangeLogo: [number, number, number] = brandOrange;
  const textPurple: [number, number, number] = [81, 20, 117]; // Deeper purple for better text visibility
  const textOrange: [number, number, number] = [230, 81, 0];   // Deeper orange for better text visibility

  // --- Header Layout ---
  // Left side (Logo area)
  pdf.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  pdf.rect(10, 10, 100, 40, 'F');
  pdf.setDrawColor(lightBorder[0], lightBorder[1], lightBorder[2]);
  pdf.setLineWidth(0.2);
  pdf.rect(10, 10, 100, 40, 'S');
  
  // Right side (Title area)
  pdf.setDrawColor(lightBorder[0], lightBorder[1], lightBorder[2]);
  pdf.rect(110, 10, 90, 40, 'S');
  
  // Accent Lines (Top and Bottom of Title Box)
  pdf.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
  pdf.setLineWidth(1.0);
  pdf.line(115, 16, 195, 16);
  pdf.line(115, 44, 195, 44);

  // Professional Logo Branding (Perfectly Centered)
  const boxCenterX = 60; // (10 + 110) / 2
  const boxCenterY = 30; // (10 + 50) / 2
  
  // Logo Mark: Overlapping circles
  const markX = boxCenterX - 24;
  pdf.setFillColor(purpleLogo[0], purpleLogo[1], purpleLogo[2]);
  pdf.circle(markX, boxCenterY - 1, 6, 'F');
  pdf.setFillColor(orangeLogo[0], orangeLogo[1], orangeLogo[2]);
  pdf.circle(markX + 4, boxCenterY - 1, 4, 'F');
  
  // Company Name: Prominent Serif Typography
  pdf.setFontSize(20);
  pdf.setTextColor(textPurple[0], textPurple[1], textPurple[2]);
  pdf.setFont("times", "bold");
  pdf.text("Jes'Camp Finance", boxCenterX + 8, boxCenterY, { align: 'center' });
  
  pdf.setFontSize(8);
  pdf.setTextColor(60, 60, 60);
  pdf.setFont("helvetica", "bold");
  pdf.text("GIFTS & DECORATIONS LTD", boxCenterX + 8, boxCenterY + 6, { align: 'center' });

  // Title Text (Elegant Editorial Serif)
  const titleFontSize = isInvoice ? 62 : 42; 
  pdf.setFontSize(titleFontSize);
  // Use deeper accent color for maximum visibility and brand impact
  const titleColor = isInvoice ? textOrange : textPurple;
  pdf.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
  pdf.setFont("times", "italic"); // Italic adds a sophisticated, high-end editorial feel
  pdf.text(title, 155, 35, { align: 'center' });

  // --- Contact Info Bar ---
  const barY = 55;
  pdf.setDrawColor(lightBorder[0], lightBorder[1], lightBorder[2]);
  pdf.setLineWidth(0.2);
  pdf.rect(10, barY, 100, 10, 'S');
  pdf.rect(110, barY, 45, 10, 'S');
  pdf.rect(155, barY, 45, 10, 'S');

  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 100);
  pdf.setFont("helvetica", "normal");
  pdf.text("Contact Info", 60, barY + 6.5, { align: 'center' });
  
  pdf.setTextColor(0);
  pdf.setFont("helvetica", "bold");
  pdf.text("jescampltd@gmail.com", 132.5, barY + 6.5, { align: 'center' });
  pdf.text("(+254) 720 427 535", 177.5, barY + 6.5, { align: 'center' });

  // --- Details Grid ---
  const gridY = 70;
  pdf.setDrawColor(lightBorder[0], lightBorder[1], lightBorder[2]);
  pdf.rect(10, gridY, 190, 35, 'S');
  
  // Vertical lines
  pdf.line(110, gridY, 110, gridY + 35);
  pdf.line(155, gridY, 155, gridY + 35);
  
  // Horizontal lines in right side
  pdf.line(110, gridY + 17.5, 200, gridY + 17.5);

  // Labels
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.setFont("helvetica", "normal");
  pdf.text("Store/Company Details", 12, gridY + 5);
  
  const label1 = isInvoice ? "L.P.O Number" : "Return Order Number";
  const label2 = isInvoice ? "Invoice No:" : "Return Number:";
  const label3 = isInvoice ? "Invoice Date:" : "Return Date:";
  const label4 = isInvoice ? "Delivery Note No:" : "Return No:";

  pdf.text(label1, 112, gridY + 5);
  pdf.text(label2, 157, gridY + 5);
  pdf.text(label3, 112, gridY + 22.5);
  pdf.text(label4, 157, gridY + 22.5);

  // Values
  pdf.setFontSize(10);
  pdf.setTextColor(0);
  pdf.setFont("helvetica", "bold");
  pdf.text("Company Name:", 12, gridY + 14);
  pdf.setFont("helvetica", "normal");
  pdf.text("Naivas Limited", 42, gridY + 14);
  
  pdf.setFont("helvetica", "bold");
  pdf.text("Store Name:", 12, gridY + 24);
  pdf.setFont("helvetica", "normal");
  pdf.text(doc.storeName, 42, gridY + 24);

  pdf.setFont("helvetica", "bold");
  pdf.text(doc.lpoNumber, 112, gridY + 12);
  pdf.text(doc.id?.slice(-8).toUpperCase() || 'NEW', 157, gridY + 12);
  pdf.text(format(new Date(doc.date), 'dd/MM/yyyy'), 112, gridY + 29.5);
  pdf.text(doc.documentNumber || "N/A", 157, gridY + 29.5);

  // --- Table ---
  const tableData = doc.items.map(item => [
    item.code,
    item.description,
    item.qty,
    item.unitPrice.toFixed(2),
    item.netAmount.toFixed(2)
  ]);

  // Fill up to 12 rows
  while (tableData.length < 12) {
    tableData.push(['', '', '', '', '']);
  }

  autoTable(pdf, {
    startY: 110,
    head: [['Item code', 'Item Description', 'Qty', 'unit price', 'Net Amt']],
    body: tableData,
    theme: 'grid',
    headStyles: { 
      fillColor: [250, 245, 240], 
      textColor: [0, 0, 0], 
      fontStyle: 'bold',
      lineWidth: 0.1,
      lineColor: [220, 220, 220]
    },
    styles: { 
      fontSize: 9,
      cellPadding: 3,
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
      minCellHeight: 8
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
    },
    margin: { left: 10, right: 10 }
  });

  let finalY = (pdf as any).lastAutoTable.finalY || 180;

  // --- Totals Section ---
  const totalsY = finalY + 2;
  pdf.setFillColor(250, 245, 240);
  pdf.rect(10, totalsY, 190, 24, 'F');
  pdf.setDrawColor(220, 220, 220);
  pdf.rect(10, totalsY, 190, 24, 'S');
  
  pdf.line(140, totalsY, 140, totalsY + 24);
  pdf.line(175, totalsY, 175, totalsY + 24);
  pdf.line(140, totalsY + 8, 200, totalsY + 8);
  pdf.line(140, totalsY + 16, 200, totalsY + 16);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text("Subtotal", 173, totalsY + 6, { align: 'right' });
  pdf.text("Tax Rate (16% VAT)", 173, totalsY + 14, { align: 'right' });
  pdf.text("Total", 173, totalsY + 22, { align: 'right' });

  pdf.text(doc.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 }), 198, totalsY + 6, { align: 'right' });
  pdf.text(doc.vat.toLocaleString(undefined, { minimumFractionDigits: 2 }), 198, totalsY + 14, { align: 'right' });
  pdf.text(doc.orderTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }), 198, totalsY + 22, { align: 'right' });

  return pdf;
};

export const generateMonthlyStatementPDF = (
  month: string,
  documents: FinancialDocument[],
  totals: { subtotal: number; vat: number; total: number }
) => {
  const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape
  const brandPurple: [number, number, number] = [106, 27, 154];
  const textPurple: [number, number, number] = [81, 20, 117];
  const lightBg: [number, number, number] = [250, 248, 252];
  
  // Header Background
  pdf.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  pdf.rect(0, 0, 297, 45, 'F');
  
  // Logo Text (Consistent with Document PDF)
  pdf.setFontSize(26);
  pdf.setTextColor(textPurple[0], textPurple[1], textPurple[2]);
  pdf.setFont("times", "bold");
  pdf.text("Jes'Camp Finance", 20, 20);
  
  pdf.setFontSize(9);
  pdf.setTextColor(80, 80, 80);
  pdf.setFont("helvetica", "bold");
  pdf.text("GIFTS & DECORATIONS LTD", 20, 26);

  // Statement Title
  pdf.setFontSize(28);
  pdf.setTextColor(textPurple[0], textPurple[1], textPurple[2]);
  pdf.setFont("times", "italic");
  pdf.text(`Monthly Statement`, 277, 20, { align: 'right' });
  pdf.setFontSize(14);
  pdf.text(month, 277, 28, { align: 'right' });

  // Customer Details
  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 100);
  pdf.setFont("helvetica", "bold");
  pdf.text("CUSTOMER:", 20, 35);
  pdf.setFontSize(11);
  pdf.setTextColor(0);
  pdf.text("Naivas Limited", 45, 35);
  
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(70, 70, 70);
  pdf.text("P.O. Box 61600-00200, Nairobi, Kenya", 45, 40);

  const tableData = documents.map(doc => [
    format(new Date(doc.date), 'dd/MM/yyyy'),
    doc.lpoNumber,
    doc.storeName,
    doc.type.toUpperCase().replace('_', ' '),
    doc.subtotal.toFixed(2),
    doc.vat.toFixed(2),
    doc.orderTotal.toFixed(2)
  ]);

  autoTable(pdf, {
    startY: 50,
    head: [['Date', 'LPO / Return No', 'Store Name', 'Type', 'Subtotal', 'VAT', 'Order Total']],
    body: tableData,
    theme: 'grid',
    headStyles: { 
      fillColor: [250, 245, 240], 
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineWidth: 0.1,
      lineColor: [220, 220, 220]
    },
    styles: { 
      fontSize: 9,
      cellPadding: 3,
      lineColor: [220, 220, 220],
      lineWidth: 0.1
    },
  });

  const finalY = (pdf as any).lastAutoTable.finalY || 100;

  // Summary Box
  const summaryY = finalY + 10;
  pdf.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  pdf.rect(200, summaryY, 77, 35, 'F');
  pdf.setDrawColor(230, 230, 230);
  pdf.rect(200, summaryY, 77, 35, 'S');

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(brandPurple[0], brandPurple[1], brandPurple[2]);
  pdf.text("SUMMARY TOTALS", 205, summaryY + 7);
  
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(0);
  pdf.text("Total Subtotal:", 205, summaryY + 15);
  pdf.text("Total VAT:", 205, summaryY + 22);
  pdf.setFont("helvetica", "bold");
  pdf.text("Net Amount:", 205, summaryY + 29);

  pdf.text(totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 }), 272, summaryY + 15, { align: 'right' });
  pdf.text(totals.vat.toLocaleString(undefined, { minimumFractionDigits: 2 }), 272, summaryY + 22, { align: 'right' });
  pdf.text(totals.total.toLocaleString(undefined, { minimumFractionDigits: 2 }), 272, summaryY + 29, { align: 'right' });

  return pdf;
};
