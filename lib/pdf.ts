import type { Quotation } from "@/lib/types";
import { money, numberOrDash, textOrDash } from "@/lib/format";
import { PORTAL, applyCoupon, applySpecialDiscount } from "@/lib/config";

// Client-side PDF builder for the sales portal. Everything runs in the browser
// — nothing is uploaded anywhere.

const CURRENCY = PORTAL.currency;

// jsPDF's built-in Helvetica has no ₹ glyph; swap it for "Rs " in the PDF only.
function pdfMoney(value: number | undefined): string {
  return money(value, CURRENCY).replace("₹", "Rs ");
}

/** The sheet's price in the configured currency. */
function totalOf(q: Quotation): number | undefined {
  return CURRENCY === "USD" ? q.price.totalUsd : q.price.totalInr;
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
  const total = totalOf(quotation);
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
    doc.text(`Stock ${q.srNo}`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    const meta = [q.stockCode, q.type, q.location, q.date].filter(Boolean).join("  ·  ");
    if (meta) doc.text(meta, pageWidth - margin, y, { align: "right" });
    y += 17;
    doc.setTextColor(28);
    doc.setFontSize(12);
    doc.text(textOrDash(q.design), margin, y);
    y += 18;

    // Product details
    const fields: [string, string][] = (
      [
        ["Type", q.type],
        ["Gold", q.goldDetails],
        ["Inch Size", q.inchSize],
        ["Gross Wt", q.grossWeight],
        ["Net Wt", q.netWeight],
        ["Diamond Wt", q.totalDiamondWeight],
        ["Diamond Pcs", q.totalStonePcs],
        ["Diamond Size / Sieve", q.diamondSize],
        ["Location", q.location],
      ] as [string, string | number | undefined][]
    )
      .filter(([, v]) => v !== undefined && String(v).trim() !== "")
      .map(([label, v]) => [label, typeof v === "number" ? numberOrDash(v) : textOrDash(String(v))]);

    // Two label/value pairs per row.
    const detailRows: string[][] = [];
    for (let i = 0; i < fields.length; i += 2) {
      const [l1, v1] = fields[i];
      const pair = fields[i + 1];
      detailRows.push(pair ? [l1, v1, pair[0], pair[1]] : [l1, v1, "", ""]);
    }

    autoTable(doc, {
      startY: y,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 2 },
      body: detailRows,
      columnStyles: {
        0: { fontStyle: "bold", textColor: 100, cellWidth: 90 },
        2: { fontStyle: "bold", textColor: 100, cellWidth: 90 },
      },
      margin: { left: margin, right: margin },
    });
    y = afterTable() + 14;

    // Price summary — with the cost split only when the sheet breaks it down.
    const total = totalOf(q);
    const diamond = CURRENCY === "USD" ? q.price.diamondUsd : q.price.diamondInr;
    const gold = CURRENCY === "USD" ? q.price.goldUsd : q.price.goldInr;
    const labor = CURRENCY === "USD" ? q.price.laborUsd : q.price.laborInr;
    const hasCostSplit = diamond !== undefined || gold !== undefined || labor !== undefined;

    autoTable(doc, {
      startY: y,
      theme: "grid",
      headStyles: { fillColor: HEAD_LIGHT, textColor: 80, fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 11 },
      head: hasCostSplit
        ? [["Diamond", "Gold", "Labor", "Sales Price"]]
        : [["Sales Price"]],
      body: hasCostSplit
        ? [[pdfMoney(diamond), pdfMoney(gold), pdfMoney(labor), pdfMoney(total)]]
        : [[pdfMoney(total)]],
      columnStyles: hasCostSplit
        ? { 3: { fontStyle: "bold", textColor: BRAND } }
        : { 0: { fontStyle: "bold", textColor: BRAND } },
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
        rows.push([pdfMoney(finalPayable), "Special discount", `- ${pdfMoney(specialAmt)}`]);
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
        head: [[
          "Shape", "Sieve / Size", "Wt", "Pcs", "Pointers", "Product Code",
          CURRENCY === "USD" ? "Diamond $" : "Diamond Rs",
        ]],
        body: q.lineItems.map((li) => [
          textOrDash(li.shape),
          textOrDash(li.sieveSize),
          numberOrDash(li.stoneWeightBreakup),
          numberOrDash(li.stonePcs),
          numberOrDash(li.pointers),
          textOrDash(li.productCode),
          pdfMoney(CURRENCY === "USD" ? li.diamondPriceUsd : li.diamondPriceInr),
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
    .map((it) => it.quotation.srNo.replace(/[^a-zA-Z0-9]/g, ""))
    .join("-");
  return `seyaa-${tags}.pdf`;
}
