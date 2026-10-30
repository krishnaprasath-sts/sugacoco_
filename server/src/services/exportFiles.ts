/** Report downloads: CSV, Excel (.xlsx) and PDF from the same header + rows. */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { env } from '../config/env.js';

/** server/assets/sugacoco-logo.png. Same relative path from src/services and dist/services. */
export const LOGO_PATH = fileURLToPath(new URL('../../assets/sugacoco-logo.png', import.meta.url));
export const hasLogo = existsSync(LOGO_PATH);

const PLUM = '6B2170';

export type ColType = 'text' | 'number' | 'money' | 'date' | 'datetime';
export type Col = { header: string; type?: ColType; width?: number };
export type ExportFormat = 'csv' | 'xlsx' | 'pdf';
export type ExportDoc = {
  /** File name without extension or date, e.g. "orders-report". */
  name: string;
  /** Title printed on the Excel sheet and PDF. */
  title: string;
  /** One line under the title, e.g. the filters used. */
  subtitle?: string;
  cols: Col[];
  rows: unknown[][];
  /** Lines printed under the PDF table / Excel rows, e.g. totals per currency. */
  footer?: string[];
};

const today = () => new Date().toISOString().slice(0, 10);
const isEmpty = (v: unknown) => v == null || v === '';
/** DB values are UTC strings ("2026-10-29" or "2026-10-29 10:12:00"). */
const toDate = (v: unknown) => {
  if (v instanceof Date) return v;
  const s = String(v);
  return new Date(s.length === 10 ? `${s}T00:00:00Z` : `${s.replace(' ', 'T')}${/Z|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z'}`);
};
/** Excel has no time zones: shift UTC to IST so the sheet shows Indian time. */
const IST_MS = 330 * 60 * 1000;

function attach(res: Response, name: string, ext: string, type: string) {
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `attachment; filename="${name}-${today()}.${ext}"`);
  res.setHeader('Cache-Control', 'no-store');
}

export function sendExport(res: Response, format: ExportFormat, doc: ExportDoc) {
  if (format === 'xlsx') return sendXlsx(res, doc);
  if (format === 'pdf') return sendPdf(res, doc);
  return sendCsv(res, doc);
}

function sendCsv(res: Response, { name, cols, rows }: ExportDoc) {
  // Quote every cell; neutralise spreadsheet formulas (=, +, -, @).
  const cell = (v: unknown) => {
    let s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [cols.map((c) => c.header), ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  attach(res, name, 'csv', 'text/csv; charset=utf-8');
  res.send('﻿' + csv);
}

const XL_FORMAT: Record<ColType, string | undefined> = {
  text: undefined,
  number: '#,##0',
  // Indian grouping (34,76,818.00) in any Excel locale.
  money: '[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00',
  date: 'dd-mmm-yyyy',
  datetime: 'dd-mmm-yyyy hh:mm AM/PM',
};
/** Width a value needs in Excel characters, as it will be displayed. */
const displayLen = (v: unknown, type: ColType = 'text') => {
  if (isEmpty(v)) return 0;
  if (type === 'date') return 11;
  if (type === 'datetime') return 20;
  if (type === 'money') return Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 }).length;
  if (type === 'number') return Number(v).toLocaleString('en-IN').length;
  return String(v).length;
};

async function sendXlsx(res: Response, { name, title, subtitle, cols, rows, footer }: ExportDoc) {
  const wb = new ExcelJS.Workbook();
  wb.creator = env.company.name;
  wb.created = new Date();
  const ws = wb.addWorksheet(title.slice(0, 31), {
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
    properties: { defaultRowHeight: 20 },
  });
  const last = cols.length;
  const border = { style: 'thin' as const, color: { argb: 'FFE3DFEA' } };
  const borders = { top: border, left: border, bottom: border, right: border };
  const HEAD = 6; // table header row

  // Column widths: fit the longest value (or the header + room for the filter arrow), within limits.
  cols.forEach((c, i) => {
    const longest = Math.max(...rows.map((r) => displayLen(r[i], c.type)), 0);
    ws.getColumn(i + 1).width = Math.min(45, Math.max(c.header.length + 5, longest + 3, 9));
  });

  // Title block: logo on the left (rows 1-4), title / filters / download time beside it.
  for (const [r, h] of [[1, 24], [2, 18], [3, 16], [4, 8], [5, 6]] as const) ws.getRow(r).height = h;
  const textCol = hasLogo ? 3 : 1;
  if (hasLogo) {
    const img = wb.addImage({ filename: LOGO_PATH, extension: 'png' });
    ws.addImage(img, { tl: { col: 0.15, row: 0.15 }, ext: { width: 132, height: 56 } });
  }
  const titleLines: [string, Partial<ExcelJS.Font>][] = [
    [title, { bold: true, size: 16, color: { argb: `FF${PLUM}` } }],
    [subtitle ?? '', { size: 10, color: { argb: 'FF4B5563' } }],
    [`Downloaded ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}  ·  ${rows.length} rows`, { size: 9, italic: true, color: { argb: 'FF9CA3AF' } }],
  ];
  titleLines.forEach(([text, font], i) => {
    ws.mergeCells(i + 1, textCol, i + 1, Math.max(textCol, last));
    const cell = ws.getCell(i + 1, textCol);
    cell.value = text;
    cell.font = font;
    cell.alignment = { vertical: 'middle' };
  });

  // Table header
  const headerRow = ws.getRow(HEAD);
  headerRow.height = 30;
  cols.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${PLUM}` } };
    cell.alignment = { vertical: 'middle', horizontal: c.type === 'money' || c.type === 'number' ? 'right' : 'left', indent: 1 };
    cell.border = borders;
  });

  // Rows
  rows.forEach((r, ri) => {
    const row = ws.getRow(HEAD + 1 + ri);
    row.height = 20;
    cols.forEach((c, i) => {
      const v = r[i];
      const cell = row.getCell(i + 1);
      const type = c.type ?? 'text';
      if (!isEmpty(v)) {
        if (type === 'money' || type === 'number') cell.value = Number(v);
        else if (type === 'date') cell.value = toDate(v);
        else if (type === 'datetime') cell.value = new Date(toDate(v).getTime() + IST_MS);
        else cell.value = String(v);
      }
      if (XL_FORMAT[type]) cell.numFmt = XL_FORMAT[type]!;
      cell.font = { size: 10, color: { argb: 'FF111827' } };
      cell.alignment = { vertical: 'middle', horizontal: type === 'money' || type === 'number' ? 'right' : 'left', indent: type === 'text' ? 1 : 0 };
      cell.border = borders;
      if (ri % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF8FC' } };
    });
  });

  // Totals: one shaded line each, across the whole table.
  let fr = HEAD + rows.length + 2;
  for (const line of footer ?? []) {
    ws.mergeCells(fr, 1, fr, last);
    const cell = ws.getCell(fr, 1);
    cell.value = line;
    cell.font = { bold: true, size: 10.5, color: { argb: `FF${PLUM}` } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3EEF7' } };
    cell.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(fr).height = 24;
    fr++;
  }

  ws.views = [{ state: 'frozen', ySplit: HEAD, showGridLines: false }];
  ws.autoFilter = { from: { row: HEAD, column: 1 }, to: { row: HEAD + rows.length, column: last } };
  ws.pageSetup.printTitlesRow = `${HEAD}:${HEAD}`;

  attach(res, name, 'xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  await wb.xlsx.write(res);
  res.end();
}

// Built-in PDF fonts have no ₹ glyph, so amounts print as plain numbers; the currency is its own column.
const pdfValue = (v: unknown, type: ColType = 'text') => {
  if (isEmpty(v)) return '—';
  if (type === 'money') return Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (type === 'number') return Number(v).toLocaleString('en-IN');
  if (type === 'date' || type === 'datetime') {
    const d = toDate(v);
    return Number.isNaN(d.getTime())
      ? String(v)
      : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata', ...(type === 'datetime' ? { hour: '2-digit', minute: '2-digit' } : {}) });
  }
  return String(v);
};

function sendPdf(res: Response, { name, title, subtitle, cols, rows, footer }: ExportDoc) {
  attach(res, name, 'pdf', 'application/pdf');
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, bufferPages: true, info: { Title: title, Author: env.company.name } });
  doc.pipe(res);
  const L = 30;
  const R = doc.page.width - 30;
  const W = R - L;
  const BOTTOM = doc.page.height - 40;

  // Column widths: share the page width by each column's weight (default 1).
  const weights = cols.map((c) => c.width ?? 12);
  const sum = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => (w / sum) * W);
  const align = (c: Col) => (c.type === 'money' || c.type === 'number' ? 'right' : 'left') as 'left' | 'right';

  // Header block on the first page.
  doc.rect(0, 0, doc.page.width, 5).fill(`#${PLUM}`);
  let y = 20;
  if (hasLogo) doc.image(LOGO_PATH, L, y, { height: 44 });
  const tx = hasLogo ? L + 120 : L;
  doc.fillColor(`#${PLUM}`).font('Helvetica-Bold').fontSize(16).text(title, tx, y + 2, { width: R - tx });
  doc.fillColor('#6B7280').font('Helvetica').fontSize(9);
  if (subtitle) doc.text(subtitle, tx, doc.y + 2, { width: R - tx });
  doc.text(`Downloaded ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}  ·  ${rows.length} rows`, tx, doc.y + 1, { width: R - tx });
  y = Math.max(y + 50, doc.y + 10);

  const drawHead = () => {
    doc.font('Helvetica-Bold').fontSize(8);
    const h = Math.max(20, ...cols.map((c, i) => doc.heightOfString(c.header, { width: widths[i] - 8 }) + 10));
    doc.rect(L, y, W, h).fill(`#${PLUM}`);
    let x = L;
    cols.forEach((c, i) => {
      doc.fillColor('#FFFFFF').text(c.header, x + 4, y + 5, { width: widths[i] - 8, align: align(c) });
      x += widths[i];
    });
    y += h;
  };
  drawHead();

  rows.forEach((r, ri) => {
    doc.font('Helvetica').fontSize(8);
    const cells = cols.map((c, i) => pdfValue(r[i], c.type));
    const h = Math.max(18, ...cells.map((s, i) => doc.heightOfString(s, { width: widths[i] - 8 }) + 8));
    if (y + h > BOTTOM) {
      doc.addPage();
      y = 30;
      drawHead();
      doc.font('Helvetica').fontSize(8);
    }
    if (ri % 2) doc.rect(L, y, W, h).fill('#FAF8FC');
    let x = L;
    cells.forEach((s, i) => {
      doc.fillColor('#111827').text(s, x + 4, y + 4, { width: widths[i] - 8, align: align(cols[i]) });
      x += widths[i];
    });
    y += h;
    doc.moveTo(L, y).lineTo(R, y).strokeColor('#E3DFEA').lineWidth(0.5).stroke();
  });

  if (footer?.length) {
    y += 10;
    if (y + footer.length * 14 > BOTTOM) {
      doc.addPage();
      y = 30;
    }
    doc.fillColor(`#${PLUM}`).font('Helvetica-Bold').fontSize(9);
    for (const line of footer) {
      doc.text(line, L, y, { width: W });
      y = doc.y + 3;
    }
  }

  // Page numbers on every page.
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // writing inside the bottom margin must not start a new page
    doc.fillColor('#9CA3AF').font('Helvetica').fontSize(7.5).text(`${env.company.name}  ·  ${title}  ·  Page ${i + 1} of ${range.count}`, L, doc.page.height - 25, { width: W, align: 'center', lineBreak: false });
  }
  doc.end();
}
