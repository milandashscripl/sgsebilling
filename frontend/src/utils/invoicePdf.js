import { jsPDF } from 'jspdf';

const loadImageAsDataUrl = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export async function downloadInvoicePdf(invoice) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 12;
  const marginRight = 12;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = 10;

  // Header with optional logo
  let sellerLogo = invoice.sellerLogo || null;
  try {
    const storedUser = localStorage.getItem('user');
    if (!sellerLogo && storedUser) {
      const su = JSON.parse(storedUser);
      if (su?.shopLogoUrl) sellerLogo = su.shopLogoUrl;
    }
  } catch (e) {
    // ignore
  }

  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.setTextColor('#186FAF');

  if (sellerLogo) {
    const imgData = await loadImageAsDataUrl(sellerLogo).catch(() => null);
    if (imgData) {
      try { doc.addImage(imgData, 'PNG', marginLeft, y - 2, 30, 30); } catch { try { doc.addImage(imgData, 'JPEG', marginLeft, y - 2, 30, 30); } catch {} }
    }
  }

  const titleX = sellerLogo ? marginLeft + 36 : marginLeft;
  doc.text(invoice.sellerName || 'GST INVOICE', titleX, y + 6);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.setTextColor('#333333');
  y += 14;

  if (invoice.sellerAddress) {
    const addressLines = doc.splitTextToSize(invoice.sellerAddress, contentWidth - (sellerLogo ? 36 : 0));
    doc.text(addressLines, titleX, y);
    y += addressLines.length * 3.5 + 2;
  }

  if (invoice.sellerGSTIN || invoice.sellerPhone || invoice.sellerEmail) {
    doc.setFontSize(8);
    if (invoice.sellerGSTIN) doc.text(`GSTIN: ${invoice.sellerGSTIN}`, titleX, y);
    y += 3;
    if (invoice.sellerPhone) doc.text(`Phone: ${invoice.sellerPhone}`, titleX, y);
    y += 3;
    if (invoice.sellerEmail) doc.text(`Email: ${invoice.sellerEmail}`, titleX, y);
    y += 3;
  }

  y += 3;
  doc.setDrawColor('#186FAF');
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 8;

  // Rest of the invoice (items, taxes, totals)
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor('#186FAF');
  doc.text('GST INVOICE', marginLeft, y);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.setTextColor('#333333');

  // Invoice meta
  doc.text(`Invoice No: ${invoice.invoiceNumber || ''}`, pageWidth - marginRight - 60, y);
  y += 5;
  if (invoice.createdAt) doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString('en-IN')}`, pageWidth - marginRight - 60, y);
  y += 6;

  // Buyer
  doc.setFont(undefined, 'bold');
  doc.text('Buyer (Bill To)', marginLeft, y);
  y += 4;
  doc.setFont(undefined, 'normal');
  doc.text(invoice.partyName || invoice.customerName || '-', marginLeft, y);
  y += 4;

  // Items minimal rendering (adapted)
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  if (invoice.items && invoice.items.length) {
    y += 6;
    invoice.items.forEach((item) => {
      if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 20; }
      const line = `${item.name || item.description || ''} — Qty: ${item.quantity || 1} — ₹${(item.total || (item.quantity*(item.price||0))).toFixed(2)}`;
      const lines = doc.splitTextToSize(line, contentWidth);
      doc.text(lines, marginLeft, y);
      y += lines.length * 4;
    });
  }

  // Totals
  y += 6;
  const subtotal = invoice.subtotal || 0;
  const gstAmount = invoice.gstAmount || 0;
  const total = invoice.grandTotal || 0;
  doc.text(`Taxable Value: ₹${subtotal.toFixed(2)}`, pageWidth - marginRight - 80, y, { align: 'right' });
  y += 5;
  doc.text(`GST: ₹${gstAmount.toFixed(2)}`, pageWidth - marginRight - 80, y, { align: 'right' });
  y += 6;
  doc.setFont(undefined, 'bold');
  doc.text(`TOTAL: ₹${total.toFixed(2)}`, pageWidth - marginRight - 80, y, { align: 'right' });

  // Declaration & signature
  y += 12;
  const declaration = 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.';
  const declLines = doc.splitTextToSize(declaration, contentWidth);
  doc.setFontSize(8);
  doc.text(declLines, marginLeft, y);

  y += declLines.length * 4 + 8;
  doc.text(`FOR ${invoice.sellerName || 'SGSE'}`, pageWidth - marginRight - 40, y);

  doc.save(`${invoice.invoiceNumber || 'invoice'}.pdf`);
}

export default downloadInvoicePdf;
