import type { Period } from "../types";

export const MONTHS_RO = [
  "Ianuarie",
  "Februarie",
  "Martie",
  "Aprilie",
  "Mai",
  "Iunie",
  "Iulie",
  "August",
  "Septembrie",
  "Octombrie",
  "Noiembrie",
  "Decembrie"
];

export function isoDate(year: number, month1: number, day: number): string {
  return `${year}-${String(month1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Build an (empty) period starting in the given year/month (1-based). */
export function makePeriod(year: number, month1: number, startDay: number): Period {
  const endMonth1 = month1 === 12 ? 1 : month1 + 1;
  const endYear = month1 === 12 ? year + 1 : year;
  return {
    id: `${year}-${String(month1).padStart(2, "0")}`,
    name: `${MONTHS_RO[month1 - 1]} ${year}`,
    start: isoDate(year, month1, startDay),
    end: isoDate(endYear, endMonth1, startDay),
    budgetAvailable: 0,
    transactions: []
  };
}

/** The period that contains the given date, per monthStartDay. */
export function periodForDate(date: Date, startDay: number): Period {
  let year = date.getFullYear();
  let month1 = date.getMonth() + 1;
  if (date.getDate() < startDay) {
    month1 -= 1;
    if (month1 === 0) {
      month1 = 12;
      year -= 1;
    }
  }
  return makePeriod(year, month1, startDay);
}

/** Local ISO date (yyyy-mm-dd) for a Date. */
export function localIsoDate(d: Date): string {
  return isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** True if the local date of `d` falls inside [start, end). */
export function dateInPeriod(d: Date, period: Period): boolean {
  const day = localIsoDate(d);
  return day >= period.start && day < period.end;
}

export function findPeriodForDate(periods: Period[], d: Date): Period | undefined {
  return periods.find((p) => dateInPeriod(d, p));
}

export function sortPeriods(periods: Period[]): Period[] {
  return [...periods].sort((a, b) => a.start.localeCompare(b.start));
}
