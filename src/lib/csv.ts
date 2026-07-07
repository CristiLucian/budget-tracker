import type { AppState, Period } from "../types";
import { formatNumber, sumAmounts } from "./money";
import { actualIncome, periodBalance } from "./budget";

const SEP = ";"; // Excel with Romanian regional settings expects ; when decimal is ,

function csvCell(value: string): string {
  if (value.includes(SEP) || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * CSV matching the old Google Sheet layout: one column per category,
 * each transaction as an amount in its category's column, totals at the
 * bottom, then the three summary numbers. Romanian decimal comma.
 */
export function buildPeriodCsv(state: AppState, period: Period): string {
  const ordered = [...state.settings.categories].sort((a, b) => a.order - b.order);
  // Only keep columns that ever existed in the sheet sense: all categories,
  // so the layout stays stable across periods.
  const columns = ordered;

  const byCategory = new Map<string, number[]>();
  for (const c of columns) byCategory.set(c.id, []);
  for (const t of period.transactions) {
    if (!byCategory.has(t.categoryId)) byCategory.set(t.categoryId, []);
    byCategory.get(t.categoryId)!.push(t.amount);
  }

  const extraIds = [...byCategory.keys()].filter(
    (id) => !columns.some((c) => c.id === id)
  );
  const headerNames = [
    ...columns.map((c) => c.name),
    ...extraIds // transactions whose category no longer exists; keep the data
  ];
  const colAmounts = [
    ...columns.map((c) => byCategory.get(c.id)!),
    ...extraIds.map((id) => byCategory.get(id)!)
  ];

  const rows: string[] = [];
  rows.push(csvCell(`${period.name} (${period.start} - ${period.end})`));
  rows.push(headerNames.map(csvCell).join(SEP));

  const maxLen = Math.max(0, ...colAmounts.map((a) => a.length));
  for (let i = 0; i < maxLen; i++) {
    rows.push(
      colAmounts.map((a) => (i < a.length ? formatNumber(a[i]) : "")).join(SEP)
    );
  }

  const totals = colAmounts.map((a) =>
    formatNumber(a.reduce((s, x) => s + Math.round(x * 100), 0) / 100)
  );
  rows.push(totals.join(SEP));
  rows.push("");

  const cheltuit = sumAmounts(period.transactions);
  const bal = periodBalance(state, period.id);
  if (bal.carryIn !== 0) {
    rows.push([csvCell("Venit"), formatNumber(actualIncome(period))].join(SEP));
    rows.push([csvCell("Report din luna trecuta"), formatNumber(bal.carryIn)].join(SEP));
  }
  rows.push([csvCell("Buget disponibil"), formatNumber(bal.available)].join(SEP));
  rows.push([csvCell("Buget cheltuit"), formatNumber(cheltuit)].join(SEP));
  rows.push([csvCell("Buget ramas"), formatNumber(bal.leftover)].join(SEP));

  // BOM so Excel opens it as UTF-8; CRLF line endings for Excel.
  return "﻿" + rows.join("\r\n") + "\r\n";
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
