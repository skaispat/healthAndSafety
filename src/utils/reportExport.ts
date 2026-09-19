import { Task, Observation } from '../types/database';
import { formatISTDateTime, formatISTDate } from './dateUtils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ExportTaskReportParams {
  task: Task;
  obs?: Observation | null;
  problemText: string;
  solutionRemarks: string;
  assignerName?: string | null;
  assigneeName?: string | null;
  deptName?: string | null;
  areaName?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  completedDate?: string | null;
  beforePhotos: { url?: string; photo_url?: string; file_name?: string }[];
  afterPhotos: { url?: string; photo_url?: string; file_name?: string }[];
  correctiveActions?: any[];
}

const urlToBase64 = async (url: string): Promise<string> => {
  if (!url || url.startsWith('data:')) return url;
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Could not convert image to base64:', url, err);
    return url;
  }
};

export const exportTaskReportPDF = async (params: ExportTaskReportParams): Promise<void> => {
  const {
    task,
    problemText,
    solutionRemarks,
    assignerName,
    assigneeName,
    deptName,
    areaName,
    priority,
    dueDate,
    completedDate,
    beforePhotos,
    afterPhotos,
    correctiveActions,
  } = params;

  const cleanDept = (deptName || 'Department').replace(/[\\/:*?"<>|]/g, '').trim();
  const cleanArea = (areaName || '').replace(/[\\/:*?"<>|]/g, '').trim();
  const dateOnly = formatISTDate(completedDate || task.completed_at || task.created_at || new Date().toISOString()).replace(/[\\/:*?"<>|]/g, '').trim();
  const reportDocTitle = cleanArea ? `${cleanDept} - ${cleanArea} - ${dateOnly}` : `${cleanDept} - ${dateOnly}`;

  const nowIST = formatISTDateTime(new Date().toISOString());

  // Pre-convert all images to base64 so html2canvas renders immediately with zero network/CORS lag
  const resolvedBeforePhotos = await Promise.all(
    beforePhotos.map(async (p) => ({
      ...p,
      url: await urlToBase64(p.photo_url || p.url || ''),
    }))
  );

  const resolvedAfterPhotos = await Promise.all(
    afterPhotos.map(async (p) => ({
      ...p,
      url: await urlToBase64(p.photo_url || p.url || ''),
    }))
  );

  const resolvedCorrectiveActions = correctiveActions
    ? await Promise.all(
      correctiveActions.map(async (ca: any) => {
        const caPhotos = ca.photos || [];
        const resPhotos = await Promise.all(
          caPhotos.map(async (p: any) => ({
            ...p,
            url: await urlToBase64(p.photo_url || p.url || ''),
          }))
        );
        return { ...ca, photos: resPhotos };
      })
    )
    : undefined;

  const renderPhotoHtml = (photos: { url?: string; photo_url?: string; file_name?: string }[], label: string, color: string) => {
    if (!photos || photos.length === 0) {
      return `<div style="color: #94a3b8; font-size: 11px; font-style: italic; padding: 10px; background: #f8fafc; border-radius: 6px; border: 1px dashed #cbd5e1; text-align: center;">No ${label.toLowerCase()} photos attached</div>`;
    }

    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin-top: 6px;">
        ${photos
        .map((p) => {
          const url = p.url || p.photo_url;
          if (!url) return '';
          return `
              <div style="position: relative; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; background: #000;">
                <img src="${url}" alt="${label} photo" style="width: 100%; height: 130px; object-fit: cover; display: block;" />
                <span style="position: absolute; bottom: 4px; left: 4px; background: ${color}; color: #fff; font-size: 9px; font-weight: 700; padding: 2px 5px; border-radius: 3px; text-transform: uppercase;">
                  ${label}
                </span>
              </div>
            `;
        })
        .join('')}
      </div>
    `;
  };

  const reportBodyHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #ffffff; padding: 20px; line-height: 1.4; width: 780px; box-sizing: border-box;">
      <!-- Header Bar -->
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #b91c1c; padding-bottom: 12px; margin-bottom: 14px;">
        <div>
          <div style="font-size: 18px; font-weight: 800; color: #b91c1c; letter-spacing: -0.02em;">SK AISPAT — INDUSTRIAL HEALTH & SAFETY</div>
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; margin-top: 2px;">
            Hazard Observation & Corrective Completion Report
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; font-family: monospace;">${task.task_number}</div>
          <span style="display: inline-block; font-size: 9px; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; background: #10b981; color: #fff; margin-top: 4px;">
            ${task.status === 'COMPLETED' ? 'STATUS: COMPLETED & VERIFIED' : `STATUS: ${task.status.replace(/_/g, ' ')}`}
          </span>
        </div>
      </div>

      <!-- Metadata Grid -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; margin-bottom: 14px;">
        <div style="display: flex; flexDirection: column;">
          <span style="font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b;">Department & Area</span>
          <span style="font-size: 12px; font-weight: 600; color: #0f172a; margin-top: 2px;">${deptName || 'N/A'}${areaName ? ` • ${areaName}` : ''}</span>
        </div>
        <div style="display: flex; flexDirection: column;">
          <span style="font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b;">Assigned To</span>
          <span style="font-size: 12px; font-weight: 600; color: #0f172a; margin-top: 2px;">${assigneeName || 'Employee'}</span>
        </div>
        <div style="display: flex; flexDirection: column;">
          <span style="font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b;">Created By</span>
          <span style="font-size: 12px; font-weight: 600; color: #0f172a; margin-top: 2px;">${assignerName || 'Safety Officer'}</span>
        </div>
        <div style="display: flex; flexDirection: column;">
          <span style="font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b;">Priority</span>
          <span style="font-size: 12px; font-weight: 600; color: #0f172a; margin-top: 2px;">${priority || 'NORMAL'}</span>
        </div>
        <div style="display: flex; flexDirection: column;">
          <span style="font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b;">Target Due Date</span>
          <span style="font-size: 12px; font-weight: 600; color: #0f172a; margin-top: 2px;">${dueDate ? formatISTDate(dueDate) : '—'}</span>
        </div>
        <div style="display: flex; flexDirection: column;">
          <span style="font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b;">Logged Date</span>
          <span style="font-size: 12px; font-weight: 600; color: #0f172a; margin-top: 2px;">${formatISTDate(task.created_at)}</span>
        </div>
        <div style="display: flex; flexDirection: column;">
          <span style="font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b;">Completion Date</span>
          <span style="font-size: 12px; font-weight: 600; color: #0f172a; margin-top: 2px;">${completedDate ? formatISTDate(completedDate) : '—'}</span>
        </div>
        <div style="display: flex; flexDirection: column;">
          <span style="font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b;">Report Generated</span>
          <span style="font-size: 12px; font-weight: 600; color: #0f172a; margin-top: 2px;">${nowIST}</span>
        </div>
      </div>

      <!-- Side-by-Side Comparison: Before & After -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; align-items: start;">
        <!-- LEFT: BEFORE -->
        <div style="border: 1.5px solid #fecdd3; border-radius: 8px; overflow: hidden; background: #ffffff;">
          <div style="background: #fff1f2; border-bottom: 1.5px solid #fecdd3; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="background: #ef4444; color: #fff; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 3px; text-transform: uppercase;">BEFORE</span>
              <strong style="font-size: 12px; color: #991b1b;">Initial Safety Hazard</strong>
            </div>
            <span style="font-size: 10px; color: #7f1d1d; font-weight: 600;">${formatISTDate(task.created_at)}</span>
          </div>
          <div style="padding: 10px 12px;">
            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Problem Statement (Observation)</div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; font-size: 12px; color: #1e293b; line-height: 1.45; margin-bottom: 10px;">
              ${problemText || 'No description recorded.'}
            </div>

            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Hazard Photos (${resolvedBeforePhotos.length})</div>
            ${renderPhotoHtml(resolvedBeforePhotos, 'Before', '#ef4444')}
          </div>
        </div>

        <!-- RIGHT: AFTER -->
        <div style="border: 1.5px solid #a7f3d0; border-radius: 8px; overflow: hidden; background: #ffffff;">
          <div style="background: #ecfdf5; border-bottom: 1.5px solid #a7f3d0; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="background: #10b981; color: #fff; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 3px; text-transform: uppercase;">AFTER</span>
              <strong style="font-size: 12px; color: #065f46;">Corrective Action Proof</strong>
            </div>
            <span style="font-size: 10px; color: #065f46; font-weight: 600;">${completedDate ? formatISTDate(completedDate) : 'Completed'}</span>
          </div>
          <div style="padding: 10px 12px;">
            ${resolvedCorrectiveActions && resolvedCorrectiveActions.length > 0 ? (
      resolvedCorrectiveActions.map((ca: any, idx: number) => {
        const isLatest = idx === resolvedCorrectiveActions.length - 1;
        const attemptPhotos = (ca.photos && ca.photos.length > 0) ? ca.photos : [];
        return `
                  <div style="background: ${isLatest ? '#f0fdf4' : '#f8fafc'}; border: 1px solid ${isLatest ? '#86efac' : '#e2e8f0'}; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
                      <strong style="font-size: 11px; color: ${isLatest ? '#15803d' : '#0f172a'};">
                        Attempt #${ca.attempt_number || idx + 1} ${isLatest ? '(Final Approved Resolution)' : ''}
                      </strong>
                      <span style="font-size: 9px; color: #64748b;">${formatISTDateTime(ca.submitted_at)}</span>
                    </div>

                    <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 2px;">User Remarks:</div>
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; font-size: 11px; color: #1e293b; line-height: 1.4; margin-bottom: 6px;">
                      ${ca.action_description || 'No remarks provided.'}
                    </div>

                    <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 2px;">Submitted Photos (${attemptPhotos.length}):</div>
                    ${renderPhotoHtml(attemptPhotos, 'After', '#10b981')}

                    ${ca.rework_reason ? `
                      <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 4px; padding: 6px 8px; margin-top: 6px;">
                        <div style="font-size: 9px; font-weight: 700; color: #e11d48; text-transform: uppercase;">
                          Officer Feedback / Rework Reason:
                        </div>
                        <div style="font-size: 11px; color: #881337; font-weight: 500; margin-top: 2px;">
                          "${ca.rework_reason}"
                        </div>
                      </div>
                    ` : ''}
                  </div>
                `;
      }).join('')
    ) : `
              <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">User Submission (Remarks)</div>
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; font-size: 12px; color: #1e293b; line-height: 1.45; margin-bottom: 10px;">
                ${solutionRemarks || 'Corrective action executed and verified by safety officer.'}
              </div>

              <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Evidence Photos (${resolvedAfterPhotos.length})</div>
              ${renderPhotoHtml(resolvedAfterPhotos, 'After', '#10b981')}
            `}
          </div>
        </div>
      </div>

      <!-- Footer & Signoff -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 8px; display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #64748b; margin-top: 8px;">
       
        <div>
          Safety Officer Verification: <strong style="color: #15803d;">APPROVED</strong>
        </div>
      </div>
    </div>
  `;

  // Create temporary container for html2canvas to render
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '780px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-9999';
  container.innerHTML = reportBodyHtml;
  document.body.appendChild(container);

  try {
    // Wait for any images inside the container to complete rendering
    const imgElements = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      imgElements.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) {
              resolve(true);
            } else {
              img.onload = () => resolve(true);
              img.onerror = () => resolve(true);
            }
          })
      )
    );

    // Render canvas at 2x scale for high quality PDF output
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    const pageHeight = pdf.internal.pageSize.getHeight();

    let heightLeft = pdfHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }

    // Direct download with filename combo of Department and Area with Date only
    const finalFileName = `${reportDocTitle}.pdf`;
    pdf.save(finalFileName);
  } catch (err) {
    console.error('Direct PDF export error, falling back to print window:', err);
    // Fallback: open print window
    const printWindow = window.open('', '_blank', 'width=960,height=850');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(`<!DOCTYPE html><html><head><title>${reportDocTitle}</title></head><body>${reportBodyHtml}</body></html>`);
      printWindow.document.close();
      printWindow.document.title = reportDocTitle;
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 600);
    }
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
};
