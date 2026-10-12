import { TrainingRecord } from '../types/database';
import { formatISTDateTime, formatISTDate } from './dateUtils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

export const exportTrainingReportPDF = async (training: TrainingRecord): Promise<void> => {
  const rawDept = (training.dept_name || training.department?.name || 'Department').trim();
  const isOther = (training.department?.name && training.department.name.trim().toUpperCase() === 'OTHER') ||
    (training.department?.dept_name && training.department.dept_name.trim().toUpperCase() === 'OTHER') ||
    String(training.dept_id) === '14';

  let deptName = rawDept;
  if (isOther && rawDept) {
    if (rawDept.toUpperCase() !== 'OTHER' && !/^other\s*\(/i.test(rawDept)) {
      deptName = `Other (${rawDept})`;
    }
  } else if (!deptName) {
    deptName = training.department?.name || 'Department';
  }

  const areaName = training.area || 'Plant Area';
  const cleanDept = deptName.replace(/[\\/:*?"<>|]/g, '').trim();
  const cleanArea = areaName.replace(/[\\/:*?"<>|]/g, '').trim();
  const dateOnly = formatISTDate(training.training_date).replace(/[\\/:*?"<>|]/g, '').trim();
  const reportDocTitle = `Training_${training.training_number}_${cleanDept}_${dateOnly}`;
  const nowIST = formatISTDateTime(new Date().toISOString());

  // Determine group photos and attendance photos
  const groupPhotoList = (training.group_photos && training.group_photos.length > 0)
    ? training.group_photos
    : (training.photos || []).filter((p) => (p.photo_type || 'GROUP').toUpperCase() === 'GROUP');

  const attendancePhotoList = (training.attendance_photos && training.attendance_photos.length > 0)
    ? training.attendance_photos
    : (training.photos || []).filter((p) => (p.photo_type || '').toUpperCase() === 'ATTENDANCE');

  // Convert photos to base64 for reliable canvas rendering
  const resolvedGroupPhotos = await Promise.all(
    groupPhotoList.map(async (p) => ({
      ...p,
      url: await urlToBase64(p.photo_url || ''),
    }))
  );

  const resolvedAttendancePhotos = await Promise.all(
    attendancePhotoList.map(async (p) => ({
      ...p,
      url: await urlToBase64(p.photo_url || ''),
    }))
  );

  // Chunk group photos: 4 per page
  const groupPhotoPages: (typeof resolvedGroupPhotos)[] = [];
  if (resolvedGroupPhotos.length > 0) {
    const chunkSize = 4;
    for (let i = 0; i < resolvedGroupPhotos.length; i += chunkSize) {
      groupPhotoPages.push(resolvedGroupPhotos.slice(i, i + chunkSize));
    }
  }

  const totalPages = 1 + groupPhotoPages.length;

  // Render Attendance Section for Page 1 with proper header and clean margin
  const renderAttendanceSection = () => {
    if (resolvedAttendancePhotos.length === 0) {
      return `
        <div style="border: 1px dashed #cbd5e1; border-radius: 6px; padding: 14px; background: #f8fafc; text-align: center; color: #64748b; font-size: 12px; margin-top: 14px;">
          No attendance sheet attached to this record.
        </div>
      `;
    }

    return `
      <div style="border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; background: #ffffff; margin-top: 14px;">
        <!-- Attendance Header (Bigger text) -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="background: #0284c7; color: #ffffff; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em;">
              ATTENDANCE
            </span>
            <strong style="font-size: 16px; font-weight: 800; color: #0369a1;">Verified Attendance Sheet & Roster</strong>
          </div>
          <span style="font-size: 12px; color: #64748b; font-weight: 700;">
            ${resolvedAttendancePhotos.length} Document${resolvedAttendancePhotos.length === 1 ? '' : 's'} Attached
          </span>
        </div>

        <!-- Attendance Photo(s) with clean margin from header -->
        <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
          ${resolvedAttendancePhotos
        .map(
          (p, idx) => `
            <div style="border: 1.5px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #f8fafc; box-shadow: 0 2px 8px rgba(0,0,0,0.06); max-width: ${resolvedAttendancePhotos.length === 1 ? '540px' : '360px'
            }; width: 100%;">
              <img src="${p.url}" alt="Attendance Sheet #${idx + 1}" style="width: 100%; height: 260px; object-fit: contain; display: block; background: #f8fafc;" />
              <div style="background: #f1f5f9; padding: 6px 10px; font-size: 11px; font-weight: 700; color: #334155; text-align: center; border-top: 1px solid #e2e8f0;">
                Attendance Document #${idx + 1}
              </div>
            </div>
          `
        )
        .join('')}
        </div>
      </div>
    `;
  };

  // HTML for Page 1 (Details, Description & Attendance Sheet)
  const page1Html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #ffffff; padding: 26px 30px; width: 800px; min-height: 1120px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <!-- Top Corporate Header (Bigger text) -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 3.5px solid #b91c1c; padding-bottom: 14px; margin-bottom: 16px;">
          <div>
            <div style="font-size: 24px; font-weight: 900; color: #b91c1c; letter-spacing: -0.02em;">
              SKA ISPAT — ENVIRONMENTAL HEALTH & SAFETY
            </div>
            <div style="font-size: 13px; color: #334155; text-transform: uppercase; font-weight: 800; letter-spacing: 0.06em; margin-top: 3px;">
              Safety & Training Record
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16px; font-weight: 900; color: #0f172a; font-family: monospace;">
              ${training.training_number}
            </div>
            <span style="display: inline-block; font-size: 10px; font-weight: 800; padding: 3px 10px; border-radius: 4px; text-transform: uppercase; background: #15803d; color: #ffffff; margin-top: 4px; letter-spacing: 0.04em;">
              STATUS: COMPLETED
            </span>
          </div>
        </div>

        <!-- Session Metadata Grid (Bigger text & clean padding) -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: #64748b; letter-spacing: 0.04em;">Department</span>
            <span style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">
              ${deptName}
            </span>
          </div>
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: #64748b; letter-spacing: 0.04em;">Plant Area</span>
            <span style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">
              ${areaName}
            </span>
          </div>
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: #64748b; letter-spacing: 0.04em;">Training Date</span>
            <span style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">
              ${formatISTDate(training.training_date)}
            </span>
          </div>
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: #64748b; letter-spacing: 0.04em;">Conducted By</span>
            <span style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">
              ${training.conducted_by || training.creator?.full_name || 'Safety Officer'}
            </span>
          </div>
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: #64748b; letter-spacing: 0.04em;">Attended</span>
            <span style="font-size: 14px; font-weight: 900; color: #15803d; margin-top: 2px;">
              ${training.number_of_persons} Persons
            </span>
          </div>
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: #64748b; letter-spacing: 0.04em;">Report Generated</span>
            <span style="font-size: 13px; font-weight: 700; color: #475569; margin-top: 2px;">
              ${nowIST}
            </span>
          </div>
        </div>

        <!-- Training Topic Banner (Bigger text) -->
        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-left: 6px solid #0284c7; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px;">
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0284c7; letter-spacing: 0.05em;">
            TRAINING TOPIC
          </div>
          <div style="font-size: 17px; font-weight: 900; color: #0f172a; margin-top: 4px; line-height: 1.3;">
            ${training.training_topic}
          </div>
        </div>

        <!-- Session Description (Bigger header & readable content) -->
        <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; margin-bottom: 6px;">
            SESSION DESCRIPTION, PRACTICAL DEMONSTRATION & SAFETY GUIDELINES
          </div>
          <div style="font-size: 13.5px; color: #334155; line-height: 1.55; white-space: pre-wrap; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px;">
            ${training.description || 'No detailed description provided.'}
          </div>
        </div>

        <!-- Attendance Sheet Section -->
        ${renderAttendanceSection()}
      </div>

      <!-- Page 1 Footer -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 16px; display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #94a3b8; font-weight: 600;">
        <span>SKA Ispat Industrial Safety Management System • ${training.training_number}</span>
        <span style="font-weight: 800; color: #64748b;">Page 1 of ${totalPages}</span>
      </div>
    </div>
  `;

  // HTML for Page 2+ (Group Photos with bigger headers, clear margins, and NO extra verification box)
  const renderGroupPhotosPageHtml = (photos: typeof resolvedGroupPhotos, pageIndex: number) => {
    const pageNum = 2 + pageIndex;
    const isSinglePhoto = photos.length === 1;

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #ffffff; padding: 26px 30px; width: 800px; min-height: 1120px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <!-- Header for Evidence Page (Bigger text) -->
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 3.5px solid #b91c1c; padding-bottom: 14px; margin-bottom: 16px;">
            <div>
              <div style="font-size: 24px; font-weight: 900; color: #b91c1c; letter-spacing: -0.02em;">
                SKA ISPAT — ENVIRONMENTAL HEALTH & SAFETY
              </div>
              <div style="font-size: 13px; color: #334155; text-transform: uppercase; font-weight: 800; letter-spacing: 0.06em; margin-top: 3px;">
                Training Photo Documentation & Evidence
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 16px; font-weight: 900; color: #0f172a; font-family: monospace;">
                ${training.training_number}
              </div>
              <span style="display: inline-block; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; background: #15803d; color: #ffffff; margin-top: 4px;">
                PHOTO EVIDENCE
              </span>
            </div>
          </div>

          <!-- Quick Context Strip (Bigger text) -->
          <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between;">
            <div style="font-size: 13px; font-weight: 800; color: #0f172a;">
              Topic: <span style="color: #0284c7;">${training.training_topic}</span>
            </div>
            <div style="font-size: 12px; color: #475569; font-weight: 700;">
              ${deptName} • ${areaName} • ${formatISTDate(training.training_date)}
            </div>
          </div>

          <!-- Section Header (Bigger text & clear bottom margin) -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="background: #15803d; color: #ffffff; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em;">
                PHOTOS
              </span>
              <strong style="font-size: 17px; font-weight: 900; color: #166534;">Training Session & Practical Group Photos</strong>
            </div>
            <span style="font-size: 12px; color: #64748b; font-weight: 700;">
              Photos ${pageIndex * 4 + 1}–${Math.min((pageIndex + 1) * 4, resolvedGroupPhotos.length)} of ${resolvedGroupPhotos.length}
            </span>
          </div>

          <!-- Large High-Resolution Photos Grid with clean margin -->
          <div style="display: grid; grid-template-columns: ${isSinglePhoto ? '1fr' : 'repeat(2, 1fr)'}; gap: 16px; margin-top: 6px;">
            ${photos
        .map(
          (p, idx) => `
              <div style="position: relative; border: 1.5px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #0f172a; box-shadow: 0 3px 10px rgba(0,0,0,0.1);">
                <img src="${p.url}" alt="Training Photo" style="width: 100%; height: ${isSinglePhoto ? '360px' : photos.length <= 2 ? '300px' : '260px'
            }; object-fit: cover; display: block;" />
                <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(15,23,42,0.85), transparent); padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
                  <span style="color: #ffffff; font-size: 12px; font-weight: 800; letter-spacing: 0.04em;">
                    Training Photo #${pageIndex * 4 + idx + 1}
                  </span>
                  <span style="color: #94a3b8; font-size: 10px; font-weight: 700;">
                    ${deptName}
                  </span>
                </div>
              </div>
            `
        )
        .join('')}
          </div>
        </div>

        <!-- Clean Bottom Footer (NO extra verification section added) -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 16px; display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #94a3b8; font-weight: 600;">
          <span>SKA Ispat Industrial Safety Management System • ${training.training_number}</span>
          <span style="font-weight: 800; color: #64748b;">Page ${pageNum} of ${totalPages}</span>
        </div>
      </div>
    `;
  };

  const allPageHtmls: string[] = [page1Html];
  groupPhotoPages.forEach((chunk, idx) => {
    allPageHtmls.push(renderGroupPhotosPageHtml(chunk, idx));
  });

  // Create temporary container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-9999';
  document.body.appendChild(container);

  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    for (let pageIdx = 0; pageIdx < allPageHtmls.length; pageIdx++) {
      const pageDiv = document.createElement('div');
      pageDiv.innerHTML = allPageHtmls[pageIdx];
      container.appendChild(pageDiv);

      // Wait for all images in page to load
      const imgElements = Array.from(pageDiv.querySelectorAll('img'));
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

      const canvas = await html2canvas(pageDiv, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);

      if (pageIdx > 0) {
        pdf.addPage();
      }

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      container.removeChild(pageDiv);
    }

    const finalFileName = `${reportDocTitle}.pdf`;
    pdf.save(finalFileName);
  } catch (err) {
    console.error('Direct PDF export error, opening print window fallback:', err);
    const printWindow = window.open('', '_blank', 'width=960,height=850');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${reportDocTitle}</title>
            <style>
              @page { size: A4 portrait; margin: 10mm; }
              body { margin: 0; padding: 0; }
              .page-container { page-break-after: always; break-after: page; }
              .page-container:last-child { page-break-after: avoid; break-after: avoid; }
            </style>
          </head>
          <body>
            ${allPageHtmls
          .map((h) => `<div class="page-container">${h}</div>`)
          .join('')}
          </body>
        </html>
      `);
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
