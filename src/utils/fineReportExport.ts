import jsPDF from 'jspdf';
import type { SafetyFine, FineDateRange } from '../services/fineService';
import type { ContractorFine } from '../services/contractorFineService';
import { formatISTDate, formatISTDateTime } from './dateUtils';

// jsPDF's built-in Helvetica has no "₹" glyph, so PDFs use "Rs."
const rs = (n: number) => `Rs. ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const amountOf = (v: string | null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
// Strip characters Helvetica (WinAnsi) can't render so the PDF never shows garbage
const safe = (v: unknown) =>
  String(v ?? '')
    .replace(/₹/g, 'Rs.')
    .replace(/[^\x20-\x7E -ÿ\n]/g, '')
    .trim();

const describeRange = (r: FineDateRange) => {
  if (r.from && r.to) return `${formatISTDate(r.from)} to ${formatISTDate(r.to)}`;
  if (r.from) return `From ${formatISTDate(r.from)}`;
  if (r.to) return `Up to ${formatISTDate(r.to)}`;
  return 'All dates';
};

interface Column {
  title: string;
  w: number; // mm; 0 = take remaining width
  right?: boolean;
  amount?: boolean; // highlighted in brand colour
}

interface ReportSpec {
  title: string;
  footer: string;
  filePrefix: string;
  range: FineDateRange;
  truncated?: boolean;
  summary: [string, string, boolean?][]; // label, value, highlight
  columns: Column[];
  rows: string[][];
}

/** Shared landscape A4 table report (header, summary boxes, paginated table, page numbers). */
const buildReport = (spec: ReportSpec) => {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 12;
  const BRAND: [number, number, number] = [185, 28, 28];

  // ---------- Header ----------
  pdf.setFillColor(...BRAND);
  pdf.rect(0, 0, W, 20, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text(spec.title, M, 12.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`Generated: ${safe(formatISTDateTime(new Date()))}`, W - M, 12.5, { align: 'right' });

  pdf.setTextColor(30, 41, 59);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Period: ${safe(describeRange(spec.range))}`, M, 28);

  // ---------- Summary boxes ----------
  const n = spec.summary.length;
  const bw = (W - M * 2 - 3 * (n - 1)) / n;
  spec.summary.forEach(([label, value, highlight], i) => {
    const x = M + i * (bw + 3);
    pdf.setDrawColor(226, 232, 240);
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(x, 32, bw, 15, 2, 2, 'FD');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(label, x + 4, 37.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    if (highlight) pdf.setTextColor(...BRAND);
    else pdf.setTextColor(30, 41, 59);
    pdf.text(value, x + 4, 44);
  });

  if (spec.truncated) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(180, 83, 9);
    pdf.text(`Note: only the latest ${spec.rows.length} fines are included. Narrow the date range for a complete report.`, M, 51.5);
  }

  // ---------- Table ----------
  const cols = spec.columns.map((c) => ({ ...c }));
  const fixed = cols.reduce((s, c) => s + c.w, 0);
  const flex = cols.find((c) => c.w === 0);
  if (flex) flex.w = W - M * 2 - fixed;

  const LINE = 4;
  const PAD = 2;
  let y = spec.truncated ? 56 : 53;

  const drawHeader = () => {
    pdf.setFillColor(241, 245, 249);
    pdf.rect(M, y, W - M * 2, 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(51, 65, 85);
    let x = M;
    cols.forEach((c) => {
      pdf.text(c.title, c.right ? x + c.w - PAD : x + PAD, y + 5.5, c.right ? { align: 'right' } : undefined);
      x += c.w;
    });
    y += 8;
  };

  drawHeader();
  pdf.setFontSize(8.5);

  if (spec.rows.length === 0) {
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(100, 116, 139);
    pdf.text('No fines recorded in this period.', M + PAD, y + 7);
  }

  spec.rows.forEach((cells, idx) => {
    pdf.setFont('helvetica', 'normal');
    const wrapped = cells.map((txt, i) => pdf.splitTextToSize(txt, cols[i].w - PAD * 2) as string[]);
    const rowH = Math.max(...wrapped.map((l) => l.length)) * LINE + PAD * 2;

    if (y + rowH > H - 14) {
      pdf.addPage();
      y = M;
      drawHeader();
    }

    if (idx % 2 === 1) {
      pdf.setFillColor(250, 250, 252);
      pdf.rect(M, y, W - M * 2, rowH, 'F');
    }
    let x = M;
    wrapped.forEach((lines, i) => {
      const c = cols[i];
      if (c.amount) {
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...BRAND);
      } else {
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(30, 41, 59);
      }
      pdf.text(lines, c.right ? x + c.w - PAD : x + PAD, y + PAD + 3, c.right ? { align: 'right' } : undefined);
      x += c.w;
    });
    pdf.setDrawColor(226, 232, 240);
    pdf.line(M, y + rowH, W - M, y + rowH);
    y += rowH;
  });

  // ---------- Footer page numbers ----------
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text(spec.footer, M, H - 6);
    pdf.text(`Page ${p} of ${pages}`, W - M, H - 6, { align: 'right' });
  }

  const stamp = (spec.range.from || 'all') + (spec.range.to ? `_to_${spec.range.to}` : '');
  pdf.save(`${spec.filePrefix}_${stamp}.pdf`);
};

const countRepeat = (keys: string[]) => {
  const m = new Map<string, number>();
  keys.forEach((k) => m.set(k, (m.get(k) || 0) + 1));
  return { unique: m.size, repeat: Array.from(m.values()).filter((c) => c > 1).length };
};

/** Employee fines report — one row per fine. */
export const exportFinesPDF = (fines: SafetyFine[], range: FineDateRange, opts: { truncated?: boolean } = {}) => {
  const total = fines.reduce((s, f) => s + amountOf(f.fine_amount), 0);
  const { unique, repeat } = countRepeat(fines.map((f) => f.emp_id || '—'));
  buildReport({
    title: 'SKA Ispat - Safety Fine Report',
    footer: 'Health & Safety - Fine Report',
    filePrefix: 'Safety_Fines',
    range,
    truncated: opts.truncated,
    summary: [
      ['Total Fines', String(fines.length)],
      ['Total Amount', rs(total), true],
      ['Employees Fined', String(unique)],
      ['Repeat Offenders', String(repeat), true],
    ],
    columns: [
      { title: '#', w: 10 },
      { title: 'Date', w: 26 },
      { title: 'Emp ID', w: 24 },
      { title: 'Employee Name', w: 48 },
      { title: 'Department', w: 40 },
      { title: 'Designation', w: 38 },
      { title: 'Amount', w: 26, right: true, amount: true },
      { title: 'Reason', w: 0 },
    ],
    rows: fines.map((f, idx) => [
      String(idx + 1),
      safe(formatISTDate(f.date || f.created_at)),
      safe(f.emp_id || '—'),
      safe(f.employee?.full_name || 'Unknown'),
      safe(f.employee?.department || '—'),
      safe(f.employee?.designation || '—'),
      rs(amountOf(f.fine_amount)),
      safe(f.reason || '—'),
    ]),
  });
};

/** Contractor fines report — one row per fine. */
export const exportContractorFinesPDF = (fines: ContractorFine[], range: FineDateRange, opts: { truncated?: boolean } = {}) => {
  const total = fines.reduce((s, f) => s + amountOf(f.fine_amount), 0);
  const { unique, repeat } = countRepeat(fines.map((f) => String(f.con_id ?? '—')));
  buildReport({
    title: 'SKA Ispat - Contractor Safety Fine Report',
    footer: 'Health & Safety - Contractor Fine Report',
    filePrefix: 'Contractor_Safety_Fines',
    range,
    truncated: opts.truncated,
    summary: [
      ['Total Fines', String(fines.length)],
      ['Total Amount', rs(total), true],
      ['Contractors Fined', String(unique)],
      ['Repeat Contractors', String(repeat), true],
    ],
    columns: [
      { title: '#', w: 10 },
      { title: 'Date', w: 26 },
      { title: 'Contractor', w: 50 },
      { title: 'Department', w: 38 },
      { title: 'Phone', w: 28 },
      { title: 'Worker Name', w: 42 },
      { title: 'Amount', w: 26, right: true, amount: true },
      { title: 'Reason', w: 0 },
    ],
    rows: fines.map((f, idx) => [
      String(idx + 1),
      safe(formatISTDate(f.date || f.created_at)),
      safe(f.contractor?.contractor_name || 'Unknown'),
      safe(f.contractor?.department || '—'),
      safe(f.contractor?.phone_number || '—'),
      safe(f.emp_name || '—'),
      rs(amountOf(f.fine_amount)),
      safe(f.reason || '—'),
    ]),
  });
};

/** PPE issue register — one row per issue record. */
export const exportPpePDF = (
  issues: import('../services/ppeService').PpeIssue[],
  range: FineDateRange,
  opts: { truncated?: boolean } = {}
) => {
  const totalQty = issues.reduce((s, r) => s + r.items.reduce((q, i) => q + i.qty, 0), 0);
  const employees = new Set(issues.map((r) => r.emp_id || '—')).size;
  const itemTypes = new Set(issues.flatMap((r) => r.items.map((i) => i.item.toLowerCase()))).size;
  buildReport({
    title: 'SKA Ispat - PPE Issue Register',
    footer: 'Health & Safety - PPE Issue Register',
    filePrefix: 'PPE_Issue_Register',
    range,
    truncated: opts.truncated,
    summary: [
      ['Issue Records', String(issues.length)],
      ['Total Qty Issued', String(totalQty), true],
      ['Employees', String(employees)],
      ['Item Types', String(itemTypes)],
    ],
    columns: [
      { title: '#', w: 10 },
      { title: 'Issue Date', w: 26 },
      { title: 'Emp ID', w: 24 },
      { title: 'Employee Name', w: 50 },
      { title: 'Department', w: 42 },
      { title: 'Qty', w: 16, right: true, amount: true },
      { title: 'Items Issued', w: 0 },
    ],
    rows: issues.map((r, idx) => [
      String(idx + 1),
      safe(formatISTDate(r.issue_date || r.created_at)),
      safe(r.emp_id || '—'),
      safe(r.employee?.full_name || 'Unknown'),
      safe(r.employee?.department || '—'),
      String(r.items.reduce((q, i) => q + i.qty, 0)),
      safe(r.items.map((i) => `${i.item} x ${i.qty}${i.size ? ` (Size ${i.size})` : ''}${i.color ? ` (${i.color})` : ''}`).join(', ') || '—'),
    ]),
  });
};
