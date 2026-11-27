import {
  FineService,
  FINE_BUCKET,
  FINE_LIMITS,
  FineDateRange,
  applyDateRange,
  requireClient,
  todayIST,
  monthStartIST,
  validateFineAmount,
  validateFineImage,
  sanitizeSearchTerm,
} from './fineService';

/* ==========================================================================
   Contractor Safety Fines
   Tables: public.contractor, public.safety_fine_contractor (fk con_id -> contractor.id)
   Images: same 'observation' bucket, under fines/contractor_<id>/
   ========================================================================== */

// Edge function slug as deployed in Supabase (URL: /functions/v1/safety_fine_contractor)
const CONTRACTOR_WHATSAPP_FUNCTION = 'safety_fine_contractor';
const FINE_COLUMNS = 'id, created_at, con_id, emp_name, fine_amount, reason, picture, date';
export const MAX_WORKER_NAME = 100;

export interface Contractor {
  id: number;
  contractor_name: string | null;
  department: string | null;
  phone_number: string | null;
}

export interface ContractorFine {
  id: number;
  created_at: string;
  con_id: number | null;
  emp_name: string | null;
  fine_amount: string | null;
  reason: string | null;
  picture: string | null;
  date: string | null;
  contractor: Contractor | null;
}

/** List entry: one per contractor. */
export interface ContractorFineGroup {
  con_id: number | null;
  contractor: Contractor | null;
  latest: ContractorFine;
  count: number;
  totalAmount: number;
}

type Row = Omit<ContractorFine, 'contractor'>;

const attachContractors = async (rows: Row[]): Promise<ContractorFine[]> => {
  const client = requireClient();
  const ids = Array.from(new Set(rows.map((r) => r.con_id).filter((v): v is number => v != null)));
  const map = new Map<number, Contractor>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await client
      .from('contractor')
      .select('id, contractor_name, department, phone_number')
      .in('id', ids.slice(i, i + 200));
    if (error) console.warn('Unable to resolve contractors:', error.message);
    (data || []).forEach((c: Contractor) => map.set(Number(c.id), c));
  }
  return rows.map((r) => ({ ...r, contractor: r.con_id != null ? map.get(Number(r.con_id)) || null : null }));
};

const amountOf = (v: string | null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const ContractorFineService = {
  /** All contractors for the dropdown, sorted by name. */
  async getContractors(): Promise<Contractor[]> {
    const client = requireClient();
    const { data, error } = await client
      .from('contractor')
      .select('id, contractor_name, department, phone_number')
      .order('contractor_name', { ascending: true })
      .limit(2000);
    if (error) {
      console.error('Failed to load contractors:', error);
      throw new Error('Could not load contractors.');
    }
    return (data || []) as Contractor[];
  },

  /** All contractor fines in range (batched, capped at EXPORT_MAX). Latest first. */
  async getFines(range: FineDateRange = {}): Promise<{ fines: ContractorFine[]; truncated: boolean }> {
    const client = requireClient();
    const rows: Row[] = [];
    let truncated = false;
    for (let offset = 0; ; offset += FINE_LIMITS.BATCH_SIZE) {
      const { data, error } = await applyDateRange(client.from('safety_fine_contractor').select(FINE_COLUMNS), range)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + FINE_LIMITS.BATCH_SIZE - 1);
      if (error) {
        console.error('Failed to load contractor fines:', error);
        throw new Error('Could not load contractor fines.');
      }
      const batch = (data || []) as Row[];
      rows.push(...batch);
      if (batch.length < FINE_LIMITS.BATCH_SIZE) break;
      if (rows.length >= FINE_LIMITS.EXPORT_MAX) {
        truncated = true;
        break;
      }
    }
    return { fines: await attachContractors(rows.slice(0, FINE_LIMITS.EXPORT_MAX)), truncated };
  },

  /** One entry per contractor: latest fine + count & total in range. */
  groupByContractor(fines: ContractorFine[]): ContractorFineGroup[] {
    const map = new Map<string, ContractorFineGroup>();
    for (const f of fines) {
      const key = f.con_id != null ? String(f.con_id) : `__none_${f.id}`;
      const g = map.get(key);
      if (!g) {
        map.set(key, { con_id: f.con_id, contractor: f.contractor, latest: f, count: 1, totalAmount: amountOf(f.fine_amount) });
        continue;
      }
      g.count += 1;
      g.totalAmount += amountOf(f.fine_amount);
      if (f.created_at > g.latest.created_at || (f.created_at === g.latest.created_at && f.id > g.latest.id)) g.latest = f;
    }
    return Array.from(map.values()).sort((a, b) =>
      a.latest.created_at === b.latest.created_at ? b.latest.id - a.latest.id : a.latest.created_at < b.latest.created_at ? 1 : -1
    );
  },

  /** Client-side search across contractor name, worker name, department and phone. */
  matches(g: ContractorFineGroup, allFines: ContractorFine[], rawTerm: string): boolean {
    const term = sanitizeSearchTerm(rawTerm).toLowerCase();
    if (!term) return true;
    const c = g.contractor;
    const hay = [c?.contractor_name, c?.department, c?.phone_number, String(g.con_id ?? '')];
    // Include every worker name fined under this contractor
    allFines.forEach((f) => {
      if (f.con_id === g.con_id) hay.push(f.emp_name);
    });
    return hay.some((v) => (v || '').toLowerCase().includes(term));
  },

  /** Fines per contractor in the current IST month. */
  async getCurrentMonthCounts(): Promise<Map<number, number>> {
    const client = requireClient();
    const counts = new Map<number, number>();
    const range = { from: monthStartIST(), to: todayIST() };
    for (let offset = 0; offset < FINE_LIMITS.EXPORT_MAX; offset += FINE_LIMITS.BATCH_SIZE) {
      const { data, error } = await applyDateRange(client.from('safety_fine_contractor').select('con_id'), range)
        .order('id', { ascending: true })
        .range(offset, offset + FINE_LIMITS.BATCH_SIZE - 1);
      if (error) {
        console.warn('Contractor monthly counts failed:', error.message);
        return counts;
      }
      (data || []).forEach((r: { con_id: number | null }) => {
        if (r.con_id != null) counts.set(Number(r.con_id), (counts.get(Number(r.con_id)) || 0) + 1);
      });
      if (!data || data.length < FINE_LIMITS.BATCH_SIZE) break;
    }
    return counts;
  },

  /**
   * Distinct worker names previously fined under this contractor, most recent first.
   * Used to prefill / suggest the Worker Name field.
   */
  async getWorkerNames(conId: number): Promise<string[]> {
    if (!Number.isSafeInteger(conId) || conId <= 0) return [];
    const client = requireClient();
    const { data, error } = await client
      .from('safety_fine_contractor')
      .select('emp_name, created_at')
      .eq('con_id', conId)
      .not('emp_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      console.warn('Could not load worker names:', error.message);
      return [];
    }
    const seen = new Set<string>();
    const names: string[] = [];
    (data || []).forEach((r: { emp_name: string | null }) => {
      const name = (r.emp_name || '').replace(/\s+/g, ' ').trim();
      const key = name.toLowerCase();
      if (name && !seen.has(key)) {
        seen.add(key);
        names.push(name);
      }
    });
    return names;
  },

  /** Contractor profile + full fine history (latest first). */
  async getContractorHistory(conId: number): Promise<{
    contractor: Contractor | null;
    fines: ContractorFine[];
    totalCount: number;
    totalAmount: number;
  }> {
    const client = requireClient();
    if (!Number.isSafeInteger(conId) || conId <= 0) throw new Error('Invalid contractor.');
    const [cRes, fRes] = await Promise.all([
      client.from('contractor').select('id, contractor_name, department, phone_number').eq('id', conId).maybeSingle(),
      client
        .from('safety_fine_contractor')
        .select(FINE_COLUMNS, { count: 'exact' })
        .eq('con_id', conId)
        .order('created_at', { ascending: false })
        .limit(FINE_LIMITS.HISTORY_LIMIT),
    ]);
    if (cRes.error) throw new Error('Could not load contractor.');
    if (fRes.error) throw new Error('Could not load fine history.');
    const contractor = (cRes.data as Contractor) || null;
    const fines = ((fRes.data || []) as Row[]).map((r) => ({ ...r, contractor }));

    let totalAmount = 0;
    const { data: amounts } = await client.from('safety_fine_contractor').select('fine_amount').eq('con_id', conId);
    (amounts || []).forEach((r: { fine_amount: string | null }) => (totalAmount += amountOf(r.fine_amount)));

    return { contractor, fines, totalCount: fRes.count ?? fines.length, totalAmount };
  },

  /**
   * Upload image then insert the contractor fine.
   * If the insert fails the uploaded image is removed (no orphaned files).
   */
  async createFine(input: { con_id: number; emp_name: string; amount: string; reason: string; image: File }): Promise<ContractorFine> {
    const client = requireClient();

    const conId = Number(input.con_id);
    if (!Number.isSafeInteger(conId) || conId <= 0) throw new Error('Please select a contractor.');

    const empName = input.emp_name.replace(/\s+/g, ' ').trim();
    if (empName.length < 2) throw new Error('Please enter the worker name.');
    if (empName.length > MAX_WORKER_NAME) throw new Error(`Worker name cannot exceed ${MAX_WORKER_NAME} characters.`);

    const amount = validateFineAmount(input.amount);
    if (amount.error || !amount.value) throw new Error(amount.error || 'Invalid amount.');

    const reason = input.reason.trim();
    if (reason.length < FINE_LIMITS.MIN_REASON_LENGTH) throw new Error('Please provide a reason for the fine.');
    if (reason.length > FINE_LIMITS.MAX_REASON_LENGTH) {
      throw new Error(`Reason cannot exceed ${FINE_LIMITS.MAX_REASON_LENGTH} characters.`);
    }

    const imgErr = validateFineImage(input.image);
    if (imgErr) throw new Error(imgErr);

    // Confirm contractor still exists (FK would reject too, but this gives a clear message)
    const { data: contractor, error: cErr } = await client
      .from('contractor')
      .select('id, contractor_name, department, phone_number')
      .eq('id', conId)
      .maybeSingle();
    if (cErr) throw new Error('Could not verify contractor. Please try again.');
    if (!contractor) throw new Error('Contractor record not found.');

    const { url, path } = await FineService.uploadFineImage(input.image, `contractor_${conId}`);

    const { data, error } = await client
      .from('safety_fine_contractor')
      .insert({
        con_id: conId,
        emp_name: empName,
        fine_amount: amount.value,
        reason,
        picture: url,
        date: todayIST(),
      })
      .select(FINE_COLUMNS)
      .single();

    if (error || !data) {
      console.error('Contractor fine insert failed:', error);
      await client.storage.from(FINE_BUCKET).remove([path]).catch(() => undefined);
      throw new Error(error?.message ? `Could not save fine: ${error.message}` : 'Could not save fine.');
    }

    return { ...(data as Row), contractor: contractor as Contractor };
  },

  /** Trigger the contractor WhatsApp edge function. Never throws. */
  async sendWhatsApp(fineId: number): Promise<{ sent: boolean; error?: string }> {
    try {
      const client = requireClient();
      const { data, error } = await client.functions.invoke(CONTRACTOR_WHATSAPP_FUNCTION, { body: { fine_id: fineId } });
      if (error) {
        let msg = error.message;
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (body?.error) msg = body.error;
          }
        } catch {
          /* ignore */
        }
        return { sent: false, error: msg };
      }
      return data?.success ? { sent: true } : { sent: false, error: data?.error || 'Unknown response' };
    } catch (err: any) {
      return { sent: false, error: err?.message || 'Network error' };
    }
  },
};
