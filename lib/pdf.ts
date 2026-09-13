import type { Quotation } from "@/lib/types";
import { money, numberOrDash, textOrDash } from "@/lib/format";
import { PORTAL, applyCoupon, applySpecialDiscount } from "@/lib/config";

// Client-side PDF builder for the sales portal (INR only). Everything runs in
// the browser — nothing is uploaded anywhere.

// jsPDF's built-in Helvetica has no ₹ glyph; swap it for "Rs " in the PDF only.
function pdfMoney(value: number | undefined): string {
  return money(value, "INR").replace("₹", "Rs ");
}

const BRAND: [number, number, number] = [221, 97, 28]; // #dd611c
const HEAD_DARK: [number, number, number] = [28, 25, 23];
const HEAD_LIGHT: [number, number, number] = [245, 245, 244];
const GREEN: [number, number, number] = [21, 128, 61];

export type PdfItem = {
  quotation: Quotation;
  discounted: boolean;
  specialDiscount?: number;
};

/** Final payable for one item after the coupon and any negotiated discount. */
function payableOf({ quotation, discounted, specialDiscount }: PdfItem): number | undefined {
  const total = quotation.price.totalInr;
  const afterCoupon = discounted ? applyCoupon(total) : total;
  const special = specialDiscount && specialDiscount > 0 ? specialDiscount : 0;
  return special > 0 ? applySpecialDiscount(afterCoupon, special) : afterCoupon;
}

async function buildDoc(items: PdfItem[]) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const afterTable = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  let lastY = margin;

  items.forEach((item, index) => {
    const { quotation: q, discounted, specialDiscount } = item;
    if (index > 0) doc.addPage();
    let y = margin;

    // Brand header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...BRAND);
    doc.text("SEYAA SOLITAIRE", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(PORTAL.title, margin, y + 15);
    y += 38;

    // SR (left), date · category (right), design under it
    doc.setTextColor(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`SR ${q.srNo}`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    const meta = [q.stockCode, q.date, q.sourceTab].filter(Boolean).join("  ·  ");
    if (meta) doc.text(meta, pageWidth - margin, y, { align: "right" });
    y += 17;
    doc.setTextColor(28);
    doc.setFontSize(12);
    doc.text(textOrDash(q.design), margin, y);
    y += 18;

    // Product details
    autoTable(doc, {
      startY: y,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 2 },
      body: [
        ["Gold", textOrDash(q.goldDetails), "Inch Size", textOrDash(q.inchSize)],
        ["Gross Wt", numberOrDash(q.grossWeight), "Net Wt", numberOrDash(q.netWeight)],
        [
          "Total Diamond Wt",
          numberOrDash(q.totalDiamondWeight),
          "Total Stone Pcs",
          numberOrDash(q.totalStonePcs),
        ],
      ],
      columnStyles: {
        0: { fontStyle: "bold", textColor: 100, cellWidth: 90 },
        2: { fontStyle: "bold", textColor: 100, cellWidth: 90 },
      },
      margin: { left: margin, right: margin },
    });
    y = afterTable() + 14;

    // Price summary (INR)
    const total = q.price.totalInr;
    autoTable(doc, {
      startY: y,
      theme: "grid",
      headStyles: { fillColor: HEAD_LIGHT, textColor: 80, fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 11 },
      head: [["Diamond", "Gold", "Labor", "Sales Price"]],
      body: [
        [
          pdfMoney(q.price.diamondInr),
          pdfMoney(q.price.goldInr),
          pdfMoney(q.price.laborInr),
          pdfMoney(total),
        ],
      ],
      columnStyles: { 3: { fontStyle: "bold", textColor: BRAND } },
      margin: { left: margin, right: margin },
    });
    y = afterTable() + 14;

    // Discount block — coupon and/or negotiated discount (both can apply)
    const coupon = PORTAL.coupon;
    const specialAmt = specialDiscount && specialDiscount > 0 ? specialDiscount : 0;
    const afterCoupon = discounted ? applyCoupon(total) : total;
    const finalPayable = payableOf(item);

    if (((discounted && coupon) || specialAmt > 0) && total !== undefined) {
      const rows: string[][] = [[pdfMoney(total), "MRP", ""]];
      if (discounted && coupon) {
        rows.push([pdfMoney(afterCoupon), `Coupon ${coupon.code}`, `- ${coupon.percent}%`]);
      }
      if (specialAmt > 0) {
        rows.push([
          pdfMoney(finalPayable),
          "Special discount",
          `- Rs ${specialAmt.toLocaleString("en-IN")}`,
        ]);
      }

      autoTable(doc, {
        startY: y,
        theme: "grid",
        headStyles: { fillColor: GREEN, textColor: 255, fontSize: 9, fontStyle: "bold" },
        bodyStyles: { fontSize: 10 },
        head: [["Amount", "Description", "Discount"]],
        body: rows,
        columnStyles: { 2: { textColor: GREEN, fontStyle: "bold" } },
        margin: { left: margin, right: margin },
      });

      y = afterTable() + 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...GREEN);
      doc.text(`Final Payable: ${pdfMoney(finalPayable)}`, margin, y + 10);
      doc.setFont("helvetica", "normal");
      y += 24;
    }

    // Diamond / stone breakup
    if (q.lineItems.length > 0) {
      autoTable(doc, {
        startY: y,
        theme: "striped",
        headStyles: { fillColor: HEAD_DARK, textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        head: [["Shape", "Sieve / Size", "Wt", "Pcs", "Pointers", "Product Code", "Diamond Rs"]],
        body: q.lineItems.map((li) => [
          textOrDash(li.shape),
          textOrDash(li.sieveSize),
          numberOrDash(li.stoneWeightBreakup),
          numberOrDash(li.stonePcs),
          numberOrDash(li.pointers),
          textOrDash(li.productCode),
          pdfMoney(li.diamondPriceInr),
        ]),
        columnStyles: {
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
          6: { halign: "right" },
        },
        margin: { left: margin, right: margin },
      });
      y = afterTable() + 10;
    }

    // Comments
    if (q.comments) {
      doc.setFontSize(9);
      doc.setTextColor(110);
      const lines = doc.splitTextToSize(`Comments: ${q.comments}`, pageWidth - margin * 2);
      doc.text(lines, margin, y + 4);
      y += 4 + lines.length * 11;
    }
    lastY = y;
  });

  // Combined summary across every item in this PDF (weights + payable).
  if (items.length > 1) {
    const sum = (pick: (q: Quotation) => number | undefined) =>
      items.reduce((acc, it) => acc + (pick(it.quotation) ?? 0), 0);
    const totalPayable = items.reduce((acc, it) => acc + (payableOf(it) ?? 0), 0);

    let y = lastY + 24;
    if (y + 120 > pageHeight - 30) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(28);
    doc.text(`Totals (${items.length} products)`, margin, y);
    y += 10;

    autoTable(doc, {
      startY: y,
      theme: "grid",
      headStyles: { fillColor: HEAD_LIGHT, textColor: 80, fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 11 },
      head: [["Total Gross Wt", "Total Net Wt", "Total Diamond Wt (cts)", "Total Stone Pcs"]],
      body: [
        [
          numberOrDash(sum((q) => q.grossWeight)),
          numberOrDash(sum((q) => q.netWeight)),
          numberOrDash(sum((q) => q.totalDiamondWeight)),
          numberOrDash(sum((q) => q.totalStonePcs)),
        ],
      ],
      columnStyles: { 2: { fontStyle: "bold", textColor: BRAND } },
      margin: { left: margin, right: margin },
    });
    y = afterTable() + 12;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...GREEN);
    doc.text(`Total Payable: ${pdfMoney(totalPayable)}`, margin, y + 4);
    doc.setFont("helvetica", "normal");
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  const generated = new Date().toLocaleDateString("en-IN");
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Generated ${generated}`, margin, h - 20);
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, h - 20, { align: "right" });
  }

  return doc;
}

/** Build and download a PDF for the given products. */
export async function exportStockPdf(items: PdfItem[]): Promise<void> {
  if (items.length === 0) return;
  const doc = await buildDoc(items);
  doc.save(buildFilename(items));
}

function buildFilename(items: PdfItem[]): string {
  const tags = items
    .map((it) => `SR${it.quotation.srNo}`.replace(/[^a-zA-Z0-9]/g, ""))
    .join("-");
  return `seyaa-${tags}.pdf`;
}
