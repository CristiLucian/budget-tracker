import type { AppState, Period } from "../types";
import { sumAmounts } from "./money";

const MONEY_FMT = '#,##0.00 "lei"';

/**
 * Full Excel workbook: a summary sheet, one sheet per period in the old
 * Google Sheet layout (categories as columns), and a flat transactions
 * sheet ready for pivot tables. exceljs is loaded lazily to keep the main
 * bundle small.
 */
export async function exportExcel(state: AppState): Promise<void> {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  wb.creator = "Buget";
  wb.created = new Date();

  const categories = [...state.settings.categories].sort((a, b) => a.order - b.order);
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  // ---- Sumar ----
  const sumar = wb.addWorksheet("Sumar");
  sumar.columns = [
    { header: "Perioadă", key: "name", width: 18 },
    { header: "Buget disponibil", key: "disp", width: 18 },
    { header: "Buget cheltuit", key: "chelt", width: 18 },
    { header: "Buget rămas", key: "ramas", width: 18 },
    { header: "Rată economisire", key: "rata", width: 18 }
  ];
  sumar.getRow(1).font = { bold: true };
  for (const p of state.periods) {
    const cheltuit = sumAmounts(p.transactions);
    const ramas = p.budgetAvailable - cheltuit;
    const row = sumar.addRow({
      name: p.name,
      disp: p.budgetAvailable,
      chelt: cheltuit,
      ramas,
      rata: p.budgetAvailable > 0 ? ramas / p.budgetAvailable : 0
    });
    row.getCell("disp").numFmt = MONEY_FMT;
    row.getCell("chelt").numFmt = MONEY_FMT;
    row.getCell("ramas").numFmt = MONEY_FMT;
    row.getCell("rata").numFmt = "0.0%";
    if (ramas < 0) row.getCell("ramas").font = { color: { argb: "FFDC2626" } };
  }

  // ---- One sheet per period (old sheet layout) ----
  for (const p of state.periods) {
    addPeriodSheet(wb, p, categories, catName);
  }

  // ---- Flat transactions ----
  const flat = wb.addWorksheet("Tranzacții");
  flat.columns = [
    { header: "Data", key: "data", width: 12 },
    { header: "Perioadă", key: "per", width: 16 },
    { header: "Categorie", key: "cat", width: 20 },
    { header: "Notă", key: "nota", width: 28 },
    { header: "Sumă", key: "suma", width: 14 }
  ];
  flat.getRow(1).font = { bold: true };
  for (const p of state.periods) {
    for (const t of p.transactions) {
      const row = flat.addRow({
        data: new Date(t.timestamp),
        per: p.name,
        cat: catName(t.categoryId),
        nota: t.note ?? "",
        suma: t.amount
      });
      row.getCell("data").numFmt = "dd.mm.yyyy";
      row.getCell("suma").numFmt = MONEY_FMT;
    }
  }
  flat.autoFilter = { from: "A1", to: "E1" };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `buget-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function addPeriodSheet(
  wb: import("exceljs").Workbook,
  period: Period,
  categories: { id: string; name: string }[],
  catName: (id: string) => string
): void {
  // Worksheet names: max 31 chars, no []*?/\:
  const ws = wb.addWorksheet(period.name.slice(0, 31));

  const columnIds = [...categories.map((c) => c.id)];
  for (const t of period.transactions) {
    if (!columnIds.includes(t.categoryId)) columnIds.push(t.categoryId);
  }

  const byCategory = new Map<string, number[]>(columnIds.map((id) => [id, []]));
  for (const t of period.transactions) byCategory.get(t.categoryId)!.push(t.amount);

  ws.addRow([`${period.name} (${period.start} – ${period.end})`]).font = { bold: true };
  const header = ws.addRow(columnIds.map(catName));
  header.font = { bold: true };

  const maxLen = Math.max(0, ...[...byCategory.values()].map((a) => a.length));
  for (let i = 0; i < maxLen; i++) {
    const row = ws.addRow(columnIds.map((id) => byCategory.get(id)![i] ?? null));
    row.eachCell((cell) => (cell.numFmt = MONEY_FMT));
  }

  const totals = ws.addRow(
    columnIds.map((id) =>
      byCategory.get(id)!.reduce((s, x) => s + Math.round(x * 100), 0) / 100
    )
  );
  totals.font = { bold: true };
  totals.eachCell((cell) => (cell.numFmt = MONEY_FMT));

  ws.addRow([]);
  const cheltuit = sumAmounts(period.transactions);
  const rows: [string, number][] = [
    ["Buget disponibil", period.budgetAvailable],
    ["Buget cheltuit", cheltuit],
    ["Buget rămas", period.budgetAvailable - cheltuit]
  ];
  for (const [label, value] of rows) {
    const r = ws.addRow([label, value]);
    r.getCell(1).font = { bold: true };
    r.getCell(2).numFmt = MONEY_FMT;
  }

  ws.columns.forEach((c) => (c.width = 16));
}
