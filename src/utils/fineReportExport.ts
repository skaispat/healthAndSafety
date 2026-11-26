import jsPDF from 'jspdf';
import type { SafetyFine, FineDateRange } from '../services/fineService';
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

export const exportFinesPDF = (fines: SafetyFine[], range: FineDateRange, opts: { truncated?: boolean } = {}) => {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 12;
  const BRAND: [number, number, number] = [185, 28, 28];

  // ---------- Summary ----------
  const totalAmount = fines.reduce((s, f) => s + amountOf(f.fine_amount), 0);
  const perEmp = new Map<string, { name: string; count: number; amount: number }>();
  fines.forEach((f) => {
    const id = f.emp_id || '—';
    const cur = perEmp.get(id) || { name: f.employee?.full_name || 'Unknown', count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += amountOf(f.fine_amount);
    perEmp.set(id, cur);
  });
  const repeat = Array.from(perEmp.values()).filter((e) => e.count > 1).length;

  // ---------- Header ----------
  pdf.setFillColor(...BRAND);
  pdf.rect(0, 0, W, 20, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text('SKA Ispat - Safety Fine Report', M, 12.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`Generated: ${safe(formatISTDateTime(new Date()))}`, W - M, 12.5, { align: 'right' });

  pdf.setTextColor(30, 41, 59);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Period: ${safe(describeRange(range))}`, M, 28);

  // Summary boxes
  const boxes = [
    ['Total Fines', String(fines.length)],
    ['Total Amount', rs(totalAmount)],
    ['Employees Fined', String(perEmp.size)],
    ['Repeat Offenders', String(repeat)],
  ];
  const bw = (W - M * 2 - 9) / 4;
  boxes.forEach(([label, value], i) => {
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
    pdf.setTextColor(i === 1 || i === 3 ? BRAND[0] : 30, i === 1 || i === 3 ? BRAND[1] : 41, i === 1 || i === 3 ? BRAND[2] : 59);
    pdf.text(value, x + 4, 44);
  });

  if (opts.truncated) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(180, 83, 9);
    pdf.text(`Note: only the latest ${fines.length} fines are included. Narrow the date range for a complete report.`, M, 51.5);
  }

  // ---------- Table ----------
  const cols = [
    { title: '#', w: 10 },
    { title: 'Date', w: 26 },
    { title: 'Emp ID', w: 24 },
    { title: 'Employee Name', w: 48 },
    { title: 'Department', w: 40 },
    { title: 'Designation', w: 38 },
    { title: 'Amount', w: 26, right: true },
    { title: 'Reason', w: 0 },
  ];
  const fixed = cols.reduce((s, c) => s + c.w, 0);
  cols[cols.length - 1].w = W - M * 2 - fixed;

  const LINE = 4;
  const PAD = 2;
  let y = opts.truncated ? 56 : 53;

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

  if (fines.length === 0) {
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(100, 116, 139);
    pdf.text('No fines recorded in this period.', M + PAD, y + 7);
  }

  fines.forEach((f, idx) => {
    const cells = [
      String(idx + 1),
      safe(formatISTDate(f.date || f.created_at)),
      safe(f.emp_id || '—'),
      safe(f.employee?.full_name || 'Unknown'),
      safe(f.employee?.department || '—'),
      safe(f.employee?.designation || '—'),
      rs(amountOf(f.fine_amount)),
      safe(f.reason || '—'),
    ];
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
      if (i === 6) {
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
    pdf.text('Health & Safety - Fine Report', M, H - 6);
    pdf.text(`Page ${p} of ${pages}`, W - M, H - 6, { align: 'right' });
  }

  const stamp = (range.from || 'all') + (range.to ? `_to_${range.to}` : '');
  pdf.save(`Safety_Fines_${stamp}.pdf`);
};
