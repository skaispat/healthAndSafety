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
  const deptName = training.department?.name || 'Department';
  const areaName = training.area || 'Plant Area';
  const cleanDept = deptName.replace(/[\\/:*?"<>|]/g, '').trim();
  const cleanArea = areaName.replace(/[\\/:*?"<>|]/g, '').trim();
  const dateOnly = formatISTDate(training.training_date).replace(/[\\/:*?"<>|]/g, '').trim();
  const reportDocTitle = `Training_${training.training_number}_${cleanDept}_${dateOnly}`;
  const nowIST = formatISTDateTime(new Date().toISOString());

  // Determine group photos and attendance photos
  const groupPhotoList = (training.group_photos && training.group_photos.length > 0)
    ? training.group_photos
    : (training.photos || []).filter(p => (p.photo_type || 'GROUP').toUpperCase() === 'GROUP');

  const attendancePhotoList = (training.attendance_photos && training.attendance_photos.length > 0)
    ? training.attendance_photos
    : (training.photos || []).filter(p => (p.photo_type || '').toUpperCase() === 'ATTENDANCE');

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

  const renderPhotoGrid = (photos: { url: string; file_name?: string }[], label: string, badgeBg: string) => {
    if (!photos || photos.length === 0) {
      return `
        <div style="color: #64748b; font-size: 11px; padding: 12px; background: #f8fafc; border-radius: 6px; border: 1px dashed #cbd5e1; text-align: center;">
          No ${label.toLowerCase()} attached to this session.
        </div>
      `;
    }

    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; margin-top: 8px;">
        ${photos
        .map((p, idx) => {
          if (!p.url) return '';
          return `
              <div style="position: relative; border: 1.5px solid #e2e8f0; border-radius: 6px; overflow: hidden; background: #0f172a; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                <img src="${p.url}" alt="${label} ${idx + 1}" style="width: 100%; height: 140px; object-fit: cover; display: block;" />
                <span style="position: absolute; bottom: 5px; left: 5px; background: ${badgeBg}; color: #ffffff; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 3px; letter-spacing: 0.04em;">
                  ${label} #${idx + 1}
                </span>
              </div>
            `;
        })
        .join('')}
      </div>
    `;
  };

  const reportHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #ffffff; padding: 24px 28px; line-height: 1.45; width: 800px; box-sizing: border-box;">
      
      <!-- Top Corporate Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #b91c1c; padding-bottom: 14px; margin-bottom: 16px;">
        <div>
          <div style="font-size: 20px; font-weight: 800; color: #b91c1c; letter-spacing: -0.02em;">
            SKA ISPAT — INDUSTRIAL HEALTH & SAFETY
          </div>
          <div style="font-size: 11px; color: #475569; text-transform: uppercase; font-weight: 700; letter-spacing: 0.06em; margin-top: 3px;">
            Safety & Training Record
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; font-family: monospace;">
            ${training.training_number}
          </div>
          <span style="display: inline-block; font-size: 9px; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; background: #15803d; color: #ffffff; margin-top: 4px;">
            STATUS: COMPLETED
          </span>
        </div>
      </div>

      <!-- Training Session Metadata Grid -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px;">
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b;">Department</span>
          <span style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px;">
            ${deptName}
          </span>
        </div>
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b;">Plant Area</span>
          <span style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px;">
            ${areaName}
          </span>
        </div>
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b;">Training Date</span>
          <span style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px;">
            ${formatISTDate(training.training_date)}
          </span>
        </div>
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b;">Conducted By</span>
          <span style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px;">
            ${training.conducted_by || training.creator?.full_name || 'Safety Officer'}
          </span>
        </div>
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b;">Attended</span>
          <span style="font-size: 13px; font-weight: 800; color: #15803d; margin-top: 2px;">
            ${training.number_of_persons} Persons
          </span>
        </div>
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b;">Report Generated</span>
          <span style="font-size: 12px; font-weight: 600; color: #475569; margin-top: 2px;">
            ${nowIST}
          </span>
        </div>
      </div>

      <!-- Training Topic Banner -->
      <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-left: 5px solid #0284c7; border-radius: 6px; padding: 12px 14px; margin-bottom: 14px;">
        <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #0284c7; letter-spacing: 0.04em;">
          TRAINING TOPIC
        </div>
        <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 4px;">
          ${training.training_topic}
        </div>
      </div>

      <!-- Curriculum & Detailed Description -->
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; margin-bottom: 16px;">
        <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.04em; margin-bottom: 6px;">
          SESSION DESCRIPTION, PRACTICAL DEMONSTRATION & SAFETY GUIDELINES
        </div>
        <div style="font-size: 16px; color: #334155; line-height: 1.55; white-space: pre-wrap; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px;">
          ${training.description || 'No detailed description provided.'}
        </div>
      </div>

      <!-- Attendance Sheet Photo(s) Section -->
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; background: #ffffff;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="background: #0284c7; color: #fff; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 3px; text-transform: uppercase;">
              Attendance
            </span>
            <strong style="font-size: 12px; color: #0369a1;">Attendance Sheet</strong>
          </div>
          <span style="font-size: 10px; color: #64748b; font-weight: 600;">
            ${resolvedAttendancePhotos.length} Document(s) Attached
          </span>
        </div>
        ${renderPhotoGrid(resolvedAttendancePhotos, '', '')}
      </div>

      <!-- Practical Group Photos Section -->
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 20px; background: #ffffff;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="background: #15803d; color: #fff; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 3px; text-transform: uppercase;">
              Phothos
            </span>
            <strong style="font-size: 12px; color: #166534;">Training Session & Group Photos</strong>
          </div>
          <span style="font-size: 10px; color: #64748b; font-weight: 600;">
            ${resolvedGroupPhotos.length} Photo(s) Attached
          </span>
        </div>
        ${renderPhotoGrid(resolvedGroupPhotos, '', '')}
      </div>

    </div>
  `;

  // Create temporary container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-9999';
  container.innerHTML = reportHtml;
  document.body.appendChild(container);

  try {
    // Wait for all images in container to load
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

    const finalFileName = `${reportDocTitle}.pdf`;
    pdf.save(finalFileName);
  } catch (err) {
    console.error('Direct PDF export error, opening print window fallback:', err);
    const printWindow = window.open('', '_blank', 'width=960,height=850');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(`<!DOCTYPE html><html><head><title>${reportDocTitle}</title></head><body>${reportHtml}</body></html>`);
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
