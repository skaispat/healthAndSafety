import { supabase, isSupabaseConfigured } from '../lib/supabase';

/* ==========================================================================
   Safety Fines (Penalty) Service
   Tables: public.users2 (employees), public.safety_fines (fk emp_id -> users2)
   Storage bucket: 'observation' (images stored under the "fines/" prefix)
   ========================================================================== */

const FINE_BUCKET = 'observation';
const FINE_FOLDER = 'fines';

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

const requireClient = () => {
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

export const validateFineImage = (file: File | null): string | null => {
  if (!file) return 'Evidence image is required.';
  const type = (file.type || '').toLowerCase();
  if (!(FINE_LIMITS.ALLOWED_IMAGE_TYPES as readonly string[]).includes(type)) {
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
  if (file.size < 400 * 1024) return file;
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
    return blob && blob.size < file.size ? blob : file;
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

  /** Paginated list of most recent fines, joined with employee info. */
  async getRecentFines(page = 0): Promise<{ fines: SafetyFine[]; hasMore: boolean }> {
    const client = requireClient();
    const from = page * FINE_LIMITS.PAGE_SIZE;
    const to = from + FINE_LIMITS.PAGE_SIZE; // fetch one extra row to detect "hasMore"

    const { data, error } = await client
      .from('safety_fines')
      .select('id, created_at, emp_id, fine_amount, reason, picture, date')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Failed to load fines:', error);
      throw new Error('Could not load recent fines.');
    }

    const rows = data || [];
    const hasMore = rows.length > FINE_LIMITS.PAGE_SIZE;
    const pageRows = rows.slice(0, FINE_LIMITS.PAGE_SIZE);

    const empIds = Array.from(new Set(pageRows.map((r) => r.emp_id).filter(Boolean))) as string[];
    const empMap = new Map<string, SafetyFine['employee']>();
    if (empIds.length > 0) {
      const { data: emps, error: empErr } = await client
        .from('users2')
        .select('emp_id, full_name, department, designation')
        .in('emp_id', empIds);
      if (empErr) console.warn('Unable to resolve employee names for fines:', empErr.message);
      (emps || []).forEach((e: any) => empMap.set(String(e.emp_id), e));
    }

    return {
      fines: pageRows.map((r) => ({ ...r, employee: r.emp_id ? empMap.get(String(r.emp_id)) || null : null })),
      hasMore,
    };
  },

  /** Upload evidence image to the 'observation' bucket. Returns public URL + storage path. */
  async uploadFineImage(file: File, empId: string): Promise<{ url: string; path: string }> {
    const client = requireClient();
    const blob = await compressImage(file);
    const isJpeg = blob !== file || /jpe?g/i.test(file.type);
    const ext = isJpeg ? 'jpg' : (file.type.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase();
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
      const { data, error } = await client.functions.invoke('safety-fine-whatsapp', {
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
