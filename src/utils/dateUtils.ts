/**
 * Indian Standard Time (IST) formatting utilities
 * Ensures all dates and times across the Safety & Health platform display in UTC+5:30 (Asia/Kolkata).
 */

export const formatISTDateTime = (dateVal: string | number | Date | null | undefined): string => {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '—';

    const formatted = d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    return formatted;
  } catch (err) {
    return String(dateVal);
  }
};

export const formatISTDate = (dateVal: string | number | Date | null | undefined): string => {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '—';

    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch (err) {
    return String(dateVal);
  }
};

export const formatISTTime = (dateVal: string | number | Date | null | undefined): string => {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '—';

    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch (err) {
    return String(dateVal);
  }
};
