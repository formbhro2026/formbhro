/**
 * Safe CSV export utility conforming to RFC 4180
 * Prevents CSV formula injection (=, +, -, @, tab, cr)
 * Includes UTF-8 BOM so Excel opens with proper character encoding
 */

export interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => unknown;
}

export function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '""';

  let str = String(val);

  // Formula injection defense: If value starts with =, +, -, @, \t, or \r, prefix with single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Double up any quotes
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function generateCsvContent<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const headerLine = columns.map((col) => escapeCsvValue(col.header)).join(",");
  const dataLines = rows.map((row) =>
    columns.map((col) => escapeCsvValue(col.accessor(row))).join(",")
  );
  // Prepend UTF-8 BOM (\uFEFF)
  return "\uFEFF" + [headerLine, ...dataLines].join("\r\n");
}

export function downloadSimpleCsv(
  filenameBase: string,
  headers: string[],
  rows: unknown[][]
): void {
  const headerLine = headers.map((h) => escapeCsvValue(h)).join(",");
  const dataLines = rows.map((r) => r.map((c) => escapeCsvValue(c)).join(","));
  const content = "\uFEFF" + [headerLine, ...dataLines].join("\r\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `${filenameBase}_${dateStr}.csv`;

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCsv<T>(
  filenameBase: string,
  columnsOrHeaders: CsvColumn<T>[] | string[],
  rows: T[] | unknown[][]
): void {
  if (columnsOrHeaders.length > 0 && typeof columnsOrHeaders[0] === "string") {
    downloadSimpleCsv(filenameBase, columnsOrHeaders as string[], rows as unknown[][]);
    return;
  }
  const content = generateCsvContent(columnsOrHeaders as CsvColumn<T>[], rows as T[]);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `${filenameBase}_${dateStr}.csv`;

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
