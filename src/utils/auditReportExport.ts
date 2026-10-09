import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface AuditReportData {
  periodLabel: string;
  departmentName: string;
  totalAudited: number;
  totalClosed: number;
  totalOpen: number;
  complianceRate: number;
  highRiskCount: number;
  totalTrained: number;
  departmentRows: {
    name: string;
    total: number;
    closed: number;
    open: number;
    complianceRate: number;
    trained: number;
    status: string;
  }[];
  criticalItems: {
    srNo: number;
    area: string;
    hazard: string;
    department: string;
    priority: string;
    status: string;
    dueDate: string;
  }[];
}

export const exportAuditReportPDF = async (data: AuditReportData): Promise<void> => {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px';
  container.style.background = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  container.style.padding = '32px';
  container.style.boxSizing = 'border-box';

  const rowsHtml = data.departmentRows
    .map(
      (r, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 8px 10px; font-weight: 600;">${idx + 1}</td>
        <td style="padding: 8px 10px; font-weight: 700;">${r.name}</td>
        <td style="padding: 8px 10px; text-align: center;">${r.total}</td>
        <td style="padding: 8px 10px; text-align: center; color: #16a34a; font-weight: 600;">${r.closed}</td>
        <td style="padding: 8px 10px; text-align: center; color: #d97706; font-weight: 600;">${r.open}</td>
        <td style="padding: 8px 10px; text-align: center; font-weight: 700;">${r.complianceRate}%</td>
        <td style="padding: 8px 10px; text-align: center; font-weight: 600;">${r.trained}</td>
        <td style="padding: 8px 10px; text-align: center;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; ${
            r.status === 'COMPLIANT'
              ? 'background: #dcfce7; color: #16a34a;'
              : r.status === 'ATTENTION'
              ? 'background: #fef3c7; color: #b45309;'
              : 'background: #fee2e2; color: #dc2626;'
          }">
            ${r.status}
          </span>
        </td>
      </tr>
    `
    )
    .join('');

  const criticalHtml =
    data.criticalItems.length === 0
      ? '<div style="padding: 12px; font-size: 11px; color: #64748b; text-align: center; background: #f8fafc; border-radius: 6px;">No critical or high-risk open hazards in this audit scope.</div>'
      : `
      <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
            <th style="padding: 6px 8px;">#</th>
            <th style="padding: 6px 8px;">Dept & Area</th>
            <th style="padding: 6px 8px;">Hazard Description</th>
            <th style="padding: 6px 8px; text-align: center;">Priority</th>
            <th style="padding: 6px 8px; text-align: center;">Due Date</th>
            <th style="padding: 6px 8px; text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.criticalItems
            .slice(0, 10)
            .map(
              (c) => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 8px; font-weight: 700;">${c.srNo}</td>
              <td style="padding: 6px 8px; font-weight: 600;">${c.department}<br/><span style="font-size: 9.5px; color: #64748b;">${c.area}</span></td>
              <td style="padding: 6px 8px; max-width: 240px;">${c.hazard}</td>
              <td style="padding: 6px 8px; text-align: center;"><span style="color: #dc2626; font-weight: 700;">${c.priority}</span></td>
              <td style="padding: 6px 8px; text-align: center; white-space: nowrap;">${c.dueDate}</td>
              <td style="padding: 6px 8px; text-align: center; font-weight: 600;">${c.status}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;

  container.innerHTML = `
    <div style="border: 2px solid #cbd5e1; border-radius: 8px; padding: 24px;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #b91c1c;">
        <div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #b91c1c; letter-spacing: -0.5px;">SKA ISPAT PRIVATE LIMITED</h1>
          <div style="font-size: 13px; font-weight: 700; color: #334155; margin-top: 2px;">SAFETY & AUDIT COMPLIANCE REPORT</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Scope: ${data.departmentName} • Period: ${data.periodLabel}</div>
        </div>
        <div style="text-align: right; font-size: 10px; color: #64748b;">
          <div>ISO 45001 EHS System</div>
          <div style="font-weight: 600; color: #0f172a; margin-top: 2px;">Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        </div>
      </div>

      <!-- KPI Executive Summary -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 18px 0;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; text-align: center;">
          <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Hazards Audited</div>
          <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px;">${data.totalAudited}</div>
        </div>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; text-align: center;">
          <div style="font-size: 10px; color: #166534; font-weight: 700; text-transform: uppercase;">Resolution Rate</div>
          <div style="font-size: 20px; font-weight: 800; color: #16a34a; margin-top: 4px;">${data.complianceRate}%</div>
          <div style="font-size: 9.5px; color: #15803d;">${data.totalClosed} Resolved</div>
        </div>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px; text-align: center;">
          <div style="font-size: 10px; color: #991b1b; font-weight: 700; text-transform: uppercase;">High-Risk Flags</div>
          <div style="font-size: 20px; font-weight: 800; color: #dc2626; margin-top: 4px;">${data.highRiskCount}</div>
          <div style="font-size: 9.5px; color: #b91c1c;">${data.totalOpen} Total Open</div>
        </div>
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 12px; text-align: center;">
          <div style="font-size: 10px; color: #075985; font-weight: 700; text-transform: uppercase;">Workers Trained</div>
          <div style="font-size: 20px; font-weight: 800; color: #0284c7; margin-top: 4px;">${data.totalTrained}</div>
          <div style="font-size: 9.5px; color: #0369a1;">Safety Certified</div>
        </div>
      </div>

      <!-- Department Performance Matrix -->
      <div style="margin-top: 20px;">
        <div style="font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
          Department Safety Performance Breakdown
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; font-size: 10.5px; text-align: left;">
              <th style="padding: 8px 10px; width: 36px;">#</th>
              <th style="padding: 8px 10px;">Department</th>
              <th style="padding: 8px 10px; text-align: center;">Audited</th>
              <th style="padding: 8px 10px; text-align: center;">Closed</th>
              <th style="padding: 8px 10px; text-align: center;">Open</th>
              <th style="padding: 8px 10px; text-align: center;">Resolution %</th>
              <th style="padding: 8px 10px; text-align: center;">Trained</th>
              <th style="padding: 8px 10px; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Key Attention Items -->
      <div style="margin-top: 22px;">
        <div style="font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
          Priority Hazards & Action Items
        </div>
        ${criticalHtml}
      </div>

      <!-- Sign Off -->
      <div style="display: flex; justify-content: space-between; margin-top: 36px; padding-top: 18px; border-top: 1px solid #cbd5e1;">
        <div style="text-align: center; width: 180px;">
          <div style="border-bottom: 1px solid #475569; height: 32px; margin-bottom: 6px;"></div>
          <div style="font-size: 10px; font-weight: 700; color: #0f172a;">Safety Officer</div>
          <div style="font-size: 9px; color: #64748b;">SKA Ispat Safety Dept</div>
        </div>
        <div style="text-align: center; width: 180px;">
          <div style="border-bottom: 1px solid #475569; height: 32px; margin-bottom: 6px;"></div>
          <div style="font-size: 10px; font-weight: 700; color: #0f172a;">Head of Department</div>
          <div style="font-size: 9px; color: #64748b;">Operations / Maintenance</div>
        </div>
        <div style="text-align: center; width: 180px;">
          <div style="border-bottom: 1px solid #475569; height: 32px; margin-bottom: 6px;"></div>
          <div style="font-size: 10px; font-weight: 700; color: #0f172a;">Plant Head / Director</div>
          <div style="font-size: 9px; color: #64748b;">SKA Ispat Executive Sign-off</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`SKA_Ispat_Safety_Audit_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
};
