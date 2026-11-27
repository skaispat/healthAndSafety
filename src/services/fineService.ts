import { supabase, isSupabaseConfigured } from '../lib/supabase';

/* ==========================================================================
   Safety Fines (Penalty) Service
   Tables: public.users2 (employees), public.safety_fines (fk emp_id -> users2)
   Storage bucket: 'observation' (images stored under the "fines/" prefix)
   ========================================================================== */

export const FINE_BUCKET = 'observation';
const FINE_FOLDER = 'fines';
// Edge function slug as deployed in Supabase (URL: /functions/v1/safety_fine)
const FINE_WHATSAPP_FUNCTION = 'safety_fine';

export const FINE_LIMITS = {
  MAX_AMOUNT: 1_000_000,
  MAX_REASON_LENGTH: 500,
  MIN_REASON_LENGTH: 3,
  MAX_IMAGE_BYTES: 10 * 1024 * 1024, // raw file limit before compression
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  SEARCH_MIN_CHARS: 2,
  SEARCH_MAX_CHARS: 50,
  SEARCH_LIMIT: 25,
  PAGE_SIZE: 20,
  BATCH_SIZE: 1000,
  EXPORT_MAX: 5000,
  HISTORY_LIMIT: 50,
} as const;

// Only non-sensitive columns. NEVER select password / username here.
const EMPLOYEE_COLUMNS = 'emp_id, full_name, designation, department, phone_number, hod_id, is_active';

export interface FineEmployee {
  emp_id: string;
  full_name: string;
  designation: string | null;
  department: string | null;
  phone_number: string | null;
  hod_id: string | null;
  hod_name: string | null;
  is_active: boolean | null;
}

export interface SafetyFine {
  id: number;
  created_at: string;
  emp_id: string | null;
  fine_amount: string | null;
  reason: string | null;
  picture: string | null;
  date: string | null;
  employee: Pick<FineEmployee, 'emp_id' | 'full_name' | 'department' | 'designation'> | null;
}

export interface CreateFineInput {
  emp_id: string;
  amount: string;
  reason: string;
  image: File;
}

export const requireClient = () => {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Database connection is not configured. Please contact the administrator.');
  }
  return supabase;
};

/** Strip characters that could break a PostgREST `or()` filter expression. */
export const sanitizeSearchTerm = (raw: string): string =>
  raw
    .replace(/[^\p{L}\p{N}\s@._+-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, FINE_LIMITS.SEARCH_MAX_CHARS);

/** Validate & normalise an amount string. Returns normalised string or an error. */
export const validateFineAmount = (raw: string): { value?: string; error?: string } => {
  const v = raw.trim();
  if (!v) return { error: 'Fine amount is required.' };
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(v)) return { error: 'Enter a valid amount (max 2 decimal places).' };
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return { error: 'Amount must be greater than 0.' };
  if (n > FINE_LIMITS.MAX_AMOUNT) return { error: `Amount cannot exceed ₹${FINE_LIMITS.MAX_AMOUNT.toLocaleString('en-IN')}.` };
  // Normalise: drop leading zeros / trailing ".00"
  return { value: Number.isInteger(n) ? String(n) : n.toFixed(2) };
};

/**
 * HEIC/HEIF detection. Windows/Chrome often report an EMPTY mime type for .heic files,
 * so the file extension is checked as well.
 */
export const isHeicFile = (file: File): boolean =>
  /^image\/hei[cf](-sequence)?$/i.test(file.type || '') || /\.(heic|heif)$/i.test(file.name || '');

/** `accept` attribute for evidence pickers (extensions included for Windows file dialogs). */
export const FINE_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif';

/**
 * Convert HEIC/HEIF photos (iPhone default) to JPEG so every browser can preview them and
 * WhatsApp can use them. Non-HEIC files are returned unchanged. The converter (~3 MB) is
 * loaded on demand only when a HEIC file is picked.
 */
export const normalizeFineImage = async (file: File): Promise<File> => {
  if (!isHeicFile(file)) return file;
  try {
    const { heicTo } = await import('heic-to');
    const blob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.85 });
    const base = (file.name || 'photo').replace(/\.(heic|heif)$/i, '') || 'photo';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch (err) {
    console.error('HEIC conversion failed:', err);
    throw new Error('Could not read this HEIC photo. Please try another photo or use JPG/PNG.');
  }
};

export const validateFineImage = (file: File | null): string | null => {
  if (!file) return 'Evidence image is required.';
  const type = (file.type || '').toLowerCase();
  if (!(FINE_LIMITS.ALLOWED_IMAGE_TYPES as readonly string[]).includes(type) && !isHeicFile(file)) {
    return 'Only JPG, PNG, WebP or HEIC images are allowed.';
  }
  if (file.size > FINE_LIMITS.MAX_IMAGE_BYTES) return 'Image must be smaller than 10 MB.';
  if (file.size === 0) return 'Selected image is empty.';
  return null;
};

/** Current date in IST as YYYY-MM-DD (for the `date` column). */
export const todayIST = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date()
  );

/**
 * Downscale large photos (phone cameras produce 4–12 MB images) to a max edge of 1600px JPEG.
 * Falls back to the original file if the browser cannot decode it (e.g. HEIC on desktop Chrome).
 */
const compressImage = async (file: File, maxEdge = 1600, quality = 0.82): Promise<Blob> => {
  const type = (file.type || '').toLowerCase();
  const isMetaSafe = type === 'image/jpeg' || type === 'image/jpg' || type === 'image/png';
  // Small JPG/PNG can go as-is; everything else (WebP/HEIC) must be converted,
  // because WhatsApp template image headers accept only JPEG and PNG.
  if (isMetaSafe && file.size < 400 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;
    return !isMetaSafe || blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
};

const fetchHodNames = async (hodIds: string[]): Promise<Map<string, string>> => {
  const map = new Map<string, string>();
  const ids = Array.from(new Set(hodIds.filter(Boolean)));
  if (ids.length === 0) return map;
  const client = requireClient();
  const { data, error } = await client.from('users2').select('emp_id, full_name').in('emp_id', ids);
  if (error) {
    console.warn('Unable to resolve HOD names:', error.message);
    return map;
  }
  (data || []).forEach((r: { emp_id: string; full_name: string }) => map.set(String(r.emp_id), r.full_name));
  return map;
};

export interface FineDateRange {
  from?: string; // YYYY-MM-DD inclusive
  to?: string; // YYYY-MM-DD inclusive
}

type FineRow = Omit<SafetyFine, 'employee'>;

/** Recent-fines list entry: one per employee. */
export interface FineGroup {
  emp_id: string | null;
  employee: SafetyFine['employee'];
  latest: SafetyFine;
  count: number; // fines in selected range
  totalAmount: number; // sum in selected range
}
const FINE_COLUMNS = 'id, created_at, emp_id, fine_amount, reason, picture, date';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** First day of current month in IST (YYYY-MM-01). */
export const monthStartIST = (): string => `${todayIST().slice(0, 8)}01`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const applyDateRange = <Q extends { gte: any; lte: any }>(query: Q, range: FineDateRange): Q => {
  let q = query;
  if (range.from && ISO_DATE.test(range.from)) q = q.gte('date', range.from);
  if (range.to && ISO_DATE.test(range.to)) q = q.lte('date', range.to);
  return q;
};

const attachEmployees = async (rows: FineRow[]): Promise<SafetyFine[]> => {
  const empIds = Array.from(new Set(rows.map((r) => r.emp_id).filter(Boolean))) as string[];
  const empMap = new Map<string, SafetyFine['employee']>();
  const client = requireClient();
  // Chunk IN() lists to keep URLs short
  for (let i = 0; i < empIds.length; i += 200) {
    const { data, error } = await client
      .from('users2')
      .select('emp_id, full_name, department, designation')
      .in('emp_id', empIds.slice(i, i + 200));
    if (error) console.warn('Unable to resolve employee names for fines:', error.message);
    (data || []).forEach((e: any) => empMap.set(String(e.emp_id), e));
  }
  return rows.map((r) => ({ ...r, employee: r.emp_id ? empMap.get(String(r.emp_id)) || null : null }));
};

export const FineService = {
  /** Search employees in users2 by emp_id, full_name or phone_number. */
  async searchEmployees(rawTerm: string): Promise<FineEmployee[]> {
    const term = sanitizeSearchTerm(rawTerm);
    if (term.length < FINE_LIMITS.SEARCH_MIN_CHARS) return [];
    const client = requireClient();

    const pattern = `"%${term}%"`;
    const { data, error } = await client
      .from('users2')
      .select(EMPLOYEE_COLUMNS)
      .or(`emp_id.ilike.${pattern},full_name.ilike.${pattern},phone_number.ilike.${pattern}`)
      .order('full_name', { ascending: true })
      .limit(FINE_LIMITS.SEARCH_LIMIT);

    if (error) {
      console.error('Employee search failed:', error);
      throw new Error('Employee search failed. Please try again.');
    }

    const rows = (data || []) as Omit<FineEmployee, 'hod_name'>[];
    const hodMap = await fetchHodNames(rows.map((r) => r.hod_id || ''));
    return rows.map((r) => ({
      ...r,
      emp_id: String(r.emp_id),
      hod_name: r.hod_id ? hodMap.get(String(r.hod_id)) || null : null,
    }));
  },

  /** Paginated list of most recent fines (optionally within a date range), joined with employee info. */
  async getRecentFines(page = 0, range: FineDateRange = {}): Promise<{ fines: SafetyFine[]; hasMore: boolean }> {
    const client = requireClient();
    const from = page * FINE_LIMITS.PAGE_SIZE;
    const to = from + FINE_LIMITS.PAGE_SIZE; // fetch one extra row to detect "hasMore"

    const { data, error } = await applyDateRange(
      client.from('safety_fines').select(FINE_COLUMNS),
      range
    )
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Failed to load fines:', error);
      throw new Error('Could not load recent fines.');
    }

    const rows = (data || []) as FineRow[];
    const hasMore = rows.length > FINE_LIMITS.PAGE_SIZE;
    return { fines: await attachEmployees(rows.slice(0, FINE_LIMITS.PAGE_SIZE)), hasMore };
  },

  /** All fines in a date range (for PDF export). Fetched in batches; capped at EXPORT_MAX rows. */
  async getFinesForExport(range: FineDateRange = {}): Promise<{ fines: SafetyFine[]; truncated: boolean }> {
    const client = requireClient();
    const rows: FineRow[] = [];
    let truncated = false;
    for (let offset = 0; ; offset += FINE_LIMITS.BATCH_SIZE) {
      const { data, error } = await applyDateRange(
        client.from('safety_fines').select(FINE_COLUMNS),
        range
      )
        .order('date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + FINE_LIMITS.BATCH_SIZE - 1);
      if (error) {
        console.error('Export fetch failed:', error);
        throw new Error('Could not load fines for export.');
      }
      const batch = (data || []) as FineRow[];
      rows.push(...batch);
      if (batch.length < FINE_LIMITS.BATCH_SIZE) break;
      if (rows.length >= FINE_LIMITS.EXPORT_MAX) {
        truncated = true;
        break;
      }
    }
    return { fines: await attachEmployees(rows.slice(0, FINE_LIMITS.EXPORT_MAX)), truncated };
  },

  /**
   * One entry per employee for the selected range: their latest fine plus count & total amount.
   * Sorted by most recent fine first. Built from all fines in range (capped at EXPORT_MAX).
   */
  async getGroupedFines(range: FineDateRange = {}): Promise<{ groups: FineGroup[]; truncated: boolean }> {
    const { fines, truncated } = await this.getFinesForExport(range);
    const map = new Map<string, FineGroup>();
    for (const f of fines) {
      const key = f.emp_id ? String(f.emp_id) : `__none_${f.id}`;
      const amt = Number(f.fine_amount);
      const g = map.get(key);
      if (!g) {
        map.set(key, { emp_id: f.emp_id, employee: f.employee, latest: f, count: 1, totalAmount: Number.isFinite(amt) ? amt : 0 });
        continue;
      }
      g.count += 1;
      if (Number.isFinite(amt)) g.totalAmount += amt;
      if (f.created_at > g.latest.created_at || (f.created_at === g.latest.created_at && f.id > g.latest.id)) g.latest = f;
    }
    const groups = Array.from(map.values()).sort((a, b) =>
      a.latest.created_at === b.latest.created_at ? b.latest.id - a.latest.id : a.latest.created_at < b.latest.created_at ? 1 : -1
    );
    return { groups, truncated };
  },

  /** Number of fines per employee in the current calendar month (IST). */
  async getCurrentMonthCounts(): Promise<Map<string, number>> {
    const client = requireClient();
    const counts = new Map<string, number>();
    const range = { from: monthStartIST(), to: todayIST() };
    for (let offset = 0; offset < FINE_LIMITS.EXPORT_MAX; offset += FINE_LIMITS.BATCH_SIZE) {
      const { data, error } = await applyDateRange(client.from('safety_fines').select('emp_id'), range)
        .order('id', { ascending: true })
        .range(offset, offset + FINE_LIMITS.BATCH_SIZE - 1);
      if (error) {
        console.warn('Monthly fine counts failed:', error.message);
        return counts;
      }
      (data || []).forEach((r: { emp_id: string | null }) => {
        if (r.emp_id) counts.set(String(r.emp_id), (counts.get(String(r.emp_id)) || 0) + 1);
      });
      if (!data || data.length < FINE_LIMITS.BATCH_SIZE) break;
    }
    return counts;
  },

  /** Employee profile + their fine history (latest first). */
  async getEmployeeFineHistory(empId: string): Promise<{
    employee: FineEmployee | null;
    fines: SafetyFine[];
    totalCount: number;
    totalAmount: number;
  }> {
    const client = requireClient();
    const id = String(empId || '').trim();
    if (!id) throw new Error('Employee ID is required.');

    const [empRes, finesRes] = await Promise.all([
      client.from('users2').select(EMPLOYEE_COLUMNS).eq('emp_id', id).maybeSingle(),
      client
        .from('safety_fines')
        .select(FINE_COLUMNS, { count: 'exact' })
        .eq('emp_id', id)
        .order('created_at', { ascending: false })
        .limit(FINE_LIMITS.HISTORY_LIMIT),
    ]);

    if (empRes.error) throw new Error('Could not load employee details.');
    if (finesRes.error) throw new Error('Could not load fine history.');

    let employee: FineEmployee | null = null;
    if (empRes.data) {
      const e = empRes.data as Omit<FineEmployee, 'hod_name'>;
      const hodMap = await fetchHodNames(e.hod_id ? [String(e.hod_id)] : []);
      employee = { ...e, emp_id: String(e.emp_id), hod_name: e.hod_id ? hodMap.get(String(e.hod_id)) || null : null };
    }

    const empInfo: SafetyFine['employee'] = employee
      ? { emp_id: employee.emp_id, full_name: employee.full_name, department: employee.department, designation: employee.designation }
      : null;
    const fines = ((finesRes.data || []) as FineRow[]).map((r) => ({ ...r, employee: empInfo }));

    // Sum over all fines (not only the displayed page)
    let totalAmount = 0;
    const { data: amounts } = await client.from('safety_fines').select('fine_amount').eq('emp_id', id);
    (amounts || []).forEach((r: { fine_amount: string | null }) => {
      const n = Number(r.fine_amount);
      if (Number.isFinite(n)) totalAmount += n;
    });

    return { employee, fines, totalCount: finesRes.count ?? fines.length, totalAmount };
  },

  /** Upload evidence image to the 'observation' bucket. Returns public URL + storage path. */
  async uploadFineImage(rawFile: File, empId: string): Promise<{ url: string; path: string }> {
    const client = requireClient();
    // Safety net: the modals convert HEIC on pick, but never upload a raw HEIC
    const file = await normalizeFineImage(rawFile);
    const blob = await compressImage(file);
    const isJpeg = blob !== file || /jpe?g/i.test(file.type);
    const isPng = !isJpeg && /png/i.test(file.type);
    if (!isJpeg && !isPng) {
      throw new Error('This image format could not be converted. Please use a JPG or PNG photo.');
    }
    const ext = isJpeg ? 'jpg' : 'png';
    const safeEmp = empId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const path = `${FINE_FOLDER}/${safeEmp}/${Date.now()}_${rand}.${ext}`;

    const { error } = await client.storage.from(FINE_BUCKET).upload(path, blob, {
      cacheControl: '3600',
      upsert: false,
      contentType: isJpeg ? 'image/jpeg' : file.type,
    });
    if (error) {
      console.error('Fine image upload failed:', error);
      throw new Error(`Image upload failed: ${error.message}`);
    }

    const { data } = client.storage.from(FINE_BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, path };
  },

  /**
   * Upload image then insert the fine row.
   * If the insert fails, the uploaded image is removed so no orphaned files remain.
   */
  async createFine(input: CreateFineInput): Promise<SafetyFine> {
    const client = requireClient();

    const empId = String(input.emp_id || '').trim();
    if (!empId) throw new Error('Employee is required.');

    const amount = validateFineAmount(input.amount);
    if (amount.error || !amount.value) throw new Error(amount.error || 'Invalid amount.');

    const reason = input.reason.trim();
    if (reason.length < FINE_LIMITS.MIN_REASON_LENGTH) throw new Error('Please provide a reason for the fine.');
    if (reason.length > FINE_LIMITS.MAX_REASON_LENGTH) {
      throw new Error(`Reason cannot exceed ${FINE_LIMITS.MAX_REASON_LENGTH} characters.`);
    }

    const imgErr = validateFineImage(input.image);
    if (imgErr) throw new Error(imgErr);

    // Confirm employee still exists (FK would also reject, but this gives a clear message)
    const { data: emp, error: empErr } = await client
      .from('users2')
      .select('emp_id, full_name, department, designation')
      .eq('emp_id', empId)
      .maybeSingle();
    if (empErr) throw new Error('Could not verify employee. Please try again.');
    if (!emp) throw new Error('Employee record not found.');

    const { url, path } = await this.uploadFineImage(input.image, empId);

    const { data, error } = await client
      .from('safety_fines')
      .insert({
        emp_id: empId,
        fine_amount: amount.value,
        reason,
        picture: url,
        date: todayIST(),
      })
      .select('id, created_at, emp_id, fine_amount, reason, picture, date')
      .single();

    if (error || !data) {
      console.error('Fine insert failed:', error);
      // Roll back the uploaded image (best effort)
      await client.storage.from(FINE_BUCKET).remove([path]).catch(() => undefined);
      throw new Error(error?.message ? `Could not save fine: ${error.message}` : 'Could not save fine.');
    }

    return { ...data, employee: emp as SafetyFine['employee'] };
  },

  /**
   * Trigger the `safety-fine-whatsapp` edge function for a freshly created fine.
   * Never throws: the fine is already saved, so a messaging failure is reported, not fatal.
   */
  async sendFineWhatsApp(fineId: number): Promise<{ sent: boolean; error?: string }> {
    try {
      const client = requireClient();
      const { data, error } = await client.functions.invoke(FINE_WHATSAPP_FUNCTION, {
        body: { fine_id: fineId },
      });
      if (error) {
        let msg = error.message;
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (body?.error) msg = body.error;
          }
        } catch {
          /* ignore body parse errors */
        }
        console.warn('WhatsApp notification failed:', msg);
        return { sent: false, error: msg };
      }
      return data?.success ? { sent: true } : { sent: false, error: data?.error || 'Unknown response' };
    } catch (err: any) {
      console.warn('WhatsApp notification exception:', err);
      return { sent: false, error: err?.message || 'Network error' };
    }
  },
};
