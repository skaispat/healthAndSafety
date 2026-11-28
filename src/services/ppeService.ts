import {
  FINE_LIMITS,
  FineDateRange,
  applyDateRange,
  requireClient,
  todayIST,
  sanitizeSearchTerm,
} from './fineService';

/* ==========================================================================
   PPE Issue register
   Table: public.ppe_issue (fk emp_id -> users2.emp_id)
   issued_ppe (jsonb) is stored as:
     [{ "item": "Safety Helmet", "qty": 2, "color": "Yellow" },
      { "item": "Safety Shoes",  "qty": 1, "size": "8" }]
   Footwear items record a SIZE; everything else records an optional COLOR.
   ========================================================================== */

export const PPE_LIMITS = {
  MAX_ITEMS: 25,
  MAX_ITEM_NAME: 60,
  MAX_COLOR: 30,
  MAX_SIZE: 10,
  MAX_QTY: 999,
} as const;

/** Suggestions for the Item field (free text is still allowed). */
export const COMMON_PPE_ITEMS = [
  'Safety Helmet',
  'Safety Shoes',
  'Hand Gloves',
  'Safety Goggles',
  'Ear Plugs',
  'Ear Muffs',
  'Dust Mask',
  'Reflective Jacket',
  'Safety Harness',
  'Leather Apron',
  'Face Shield',
  'Welding Gloves',
  'Gum Boots',
  'Rain Coat',
  'Uniform',
];

/** Common shoe sizes offered as suggestions (free text still allowed, e.g. "UK 8"). */
export const COMMON_SHOE_SIZES = ['5', '6', '7', '8', '9', '10', '11', '12'];

/**
 * Footwear detection — tolerant of common spellings/typos:
 * shoe, shoes, showe, showes, safety shoes, gum boot(s), boot(s), footwear, gumboot.
 * Requires the "e" after "sho/show" so words like "shorts" don't match.
 */
export const isFootwear = (item: string): boolean => /\b(sho+w?es?|gum ?boots?|boots?|footwear)\b/i.test(item.trim());

export interface PpeItem {
  item: string;
  qty: number;
  color?: string;
  size?: string;
}

export interface PpeEmployee {
  emp_id: string;
  full_name: string;
  department: string | null;
  designation: string | null;
  is_active?: boolean | null;
}

export interface PpeContractor {
  id: number;
  contractor_name: string | null;
  department: string | null;
  phone_number: string | null;
}

/** Employee records have emp_id; contractor records have contracto_id (emp_id left blank). */
export type PpeKind = 'employee' | 'contractor';

export interface PpeIssue {
  id: number;
  created_at: string;
  emp_id: string | null;
  contracto_id: number | null;
  issue_date: string | null;
  items: PpeItem[];
  employee: PpeEmployee | null;
  contractor: PpeContractor | null;
}

const COLUMNS = 'id, created_at, emp_id, contracto_id, issue_date, issued_ppe';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Read issued_ppe defensively. Supports the canonical array form plus older/hand-entered shapes:
 *   [{item, qty, color|size}]  |  {"Helmet": 2}  |  {"Helmet": {"qty": 2, "color": "Yellow"}}
 */
export const parseIssuedPpe = (raw: unknown): PpeItem[] => {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  const toItem = (item: unknown, qty: unknown, color?: unknown, size?: unknown): PpeItem | null => {
    const name = String(item ?? '').trim();
    if (!name) return null;
    const n = Number(qty);
    const c = String(color ?? '').trim();
    const s = String(size ?? '').trim();
    return {
      item: name,
      qty: Number.isFinite(n) && n > 0 ? Math.floor(n) : 1,
      ...(c ? { color: c } : {}),
      ...(s ? { size: s } : {}),
    };
  };
  const fromObj = (name: unknown, v: any) =>
    toItem(name, v.qty ?? v.quantity, v.color ?? v.colour, v.size);

  if (Array.isArray(value)) {
    return value
      .map((v: any) => (v && typeof v === 'object' ? fromObj(v.item ?? v.name, v) : toItem(v, 1)))
      .filter((v): v is PpeItem => v !== null);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => (v && typeof v === 'object' ? fromObj(k, v) : toItem(k, v)))
      .filter((v): v is PpeItem => v !== null);
  }
  return [];
};

/** Detail text for an item: "Size 8" for footwear, colour otherwise. */
export const ppeItemDetail = (i: PpeItem): string => {
  const parts: string[] = [];
  if (i.size) parts.push(`Size ${i.size}`);
  if (i.color) parts.push(i.color);
  return parts.join(', ');
};

export const formatPpeItem = (i: PpeItem) => {
  const d = ppeItemDetail(i);
  return `${i.item} × ${i.qty}${d ? ` (${d})` : ''}`;
};

/** Validate & normalise editor rows. Returns clean items or per-row errors. */
export const validatePpeItems = (
  rows: { item: string; qty: string; color: string; size: string }[]
): { items?: PpeItem[]; rowErrors: Record<number, string>; error?: string } => {
  const rowErrors: Record<number, string> = {};
  const items: PpeItem[] = [];
  const seen = new Map<string, number>();

  rows.forEach((r, i) => {
    const item = r.item.replace(/\s+/g, ' ').trim();
    const footwear = isFootwear(item);
    // Only the field that is visible for this item is kept
    const color = footwear ? '' : r.color.replace(/\s+/g, ' ').trim();
    const size = footwear ? r.size.replace(/\s+/g, ' ').trim() : '';
    const qtyStr = r.qty.trim();
    if (!item && (!qtyStr || qtyStr === '1') && !r.color.trim() && !r.size.trim()) return; // ignore blank rows
    if (!item) return void (rowErrors[i] = 'Item name is required.');
    if (item.length > PPE_LIMITS.MAX_ITEM_NAME) return void (rowErrors[i] = `Item name max ${PPE_LIMITS.MAX_ITEM_NAME} characters.`);
    if (!/^\d{1,3}$/.test(qtyStr) || Number(qtyStr) < 1) return void (rowErrors[i] = `Qty must be 1–${PPE_LIMITS.MAX_QTY}.`);
    if (footwear && !size) return void (rowErrors[i] = 'Please enter the shoe size.');
    if (size.length > PPE_LIMITS.MAX_SIZE) return void (rowErrors[i] = `Size max ${PPE_LIMITS.MAX_SIZE} characters.`);
    if (color.length > PPE_LIMITS.MAX_COLOR) return void (rowErrors[i] = `Color max ${PPE_LIMITS.MAX_COLOR} characters.`);
    const key = `${item.toLowerCase()}|${color.toLowerCase()}|${size.toLowerCase()}`;
    if (seen.has(key)) return void (rowErrors[i] = `Duplicate of row ${seen.get(key)! + 1} — increase its qty instead.`);
    seen.set(key, i);
    items.push({ item, qty: Number(qtyStr), ...(color ? { color } : {}), ...(size ? { size } : {}) });
  });

  if (Object.keys(rowErrors).length > 0) return { rowErrors };
  if (items.length === 0) return { rowErrors, error: 'Add at least one PPE item.' };
  if (items.length > PPE_LIMITS.MAX_ITEMS) return { rowErrors, error: `Maximum ${PPE_LIMITS.MAX_ITEMS} items per issue.` };
  return { items, rowErrors };
};

const attachEmployees = async (rows: any[]): Promise<PpeIssue[]> => {
  const client = requireClient();
  const empIds = Array.from(new Set(rows.map((r) => r.emp_id).filter(Boolean))) as string[];
  const conIds = Array.from(new Set(rows.map((r) => r.contracto_id).filter((v) => v != null))).map(Number);
  const empMap = new Map<string, PpeEmployee>();
  const conMap = new Map<number, PpeContractor>();
  for (let i = 0; i < empIds.length; i += 200) {
    const { data, error } = await client
      .from('users2')
      .select('emp_id, full_name, department, designation, is_active')
      .in('emp_id', empIds.slice(i, i + 200));
    if (error) console.warn('Unable to resolve employees for PPE:', error.message);
    (data || []).forEach((e: any) => empMap.set(String(e.emp_id), { ...e, emp_id: String(e.emp_id) }));
  }
  for (let i = 0; i < conIds.length; i += 200) {
    const { data, error } = await client
      .from('contractor')
      .select('id, contractor_name, department, phone_number')
      .in('id', conIds.slice(i, i + 200));
    if (error) console.warn('Unable to resolve contractors for PPE:', error.message);
    (data || []).forEach((c: any) => conMap.set(Number(c.id), c));
  }
  return rows.map((r) => ({
    id: r.id,
    created_at: r.created_at,
    emp_id: r.emp_id,
    contracto_id: r.contracto_id != null ? Number(r.contracto_id) : null,
    issue_date: r.issue_date,
    items: parseIssuedPpe(r.issued_ppe),
    employee: r.emp_id ? empMap.get(String(r.emp_id)) || null : null,
    contractor: r.contracto_id != null ? conMap.get(Number(r.contracto_id)) || null : null,
  }));
};

const validateCommon = (empId: string, issueDate: string, items: PpeItem[]) => {
  if (!empId.trim()) throw new Error('Please select an employee.');
  if (!ISO_DATE.test(issueDate)) throw new Error('Please select a valid issue date.');
  if (issueDate > todayIST()) throw new Error('Issue date cannot be in the future.');
  if (!items.length) throw new Error('Add at least one PPE item.');
  if (items.length > PPE_LIMITS.MAX_ITEMS) throw new Error(`Maximum ${PPE_LIMITS.MAX_ITEMS} items per issue.`);
};

/** Throws if the employee doesn't exist or is inactive (users2.is_active = false). */
const assertActiveEmployee = async (empId: string) => {
  const client = requireClient();
  const { data, error } = await client
    .from('users2')
    .select('emp_id, full_name, is_active')
    .eq('emp_id', empId.trim())
    .maybeSingle();
  if (error) throw new Error('Could not verify employee. Please try again.');
  if (!data) throw new Error('Employee record not found.');
  if (data.is_active === false) {
    throw new Error(`${data.full_name || 'This employee'} is inactive. PPE cannot be issued to inactive employees.`);
  }
};

const validateBase = (issueDate: string, items: PpeItem[]) => {
  if (!ISO_DATE.test(issueDate)) throw new Error('Please select a valid issue date.');
  if (issueDate > todayIST()) throw new Error('Issue date cannot be in the future.');
  if (!items.length) throw new Error('Add at least one PPE item.');
  if (items.length > PPE_LIMITS.MAX_ITEMS) throw new Error(`Maximum ${PPE_LIMITS.MAX_ITEMS} items per issue.`);
};

const assertContractor = async (conId: number) => {
  if (!Number.isSafeInteger(conId) || conId <= 0) throw new Error('Please select a contractor.');
  const client = requireClient();
  const { data, error } = await client.from('contractor').select('id').eq('id', conId).maybeSingle();
  if (error) throw new Error('Could not verify contractor. Please try again.');
  if (!data) throw new Error('Contractor record not found.');
};

/** Latest PPE issues for one person (used by the fine forms). */
const historyFor = async (column: 'emp_id' | 'contracto_id', value: string | number, limit: number) => {
  const client = requireClient();
  const { data, error } = await client
    .from('ppe_issue')
    .select(COLUMNS)
    .eq(column, value)
    .order('issue_date', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('PPE history failed:', error.message);
    throw new Error('Could not load issued PPE.');
  }
  return { issues: await attachEmployees(data || []) };
};

export const PpeService = {
  /** All PPE issues in range (batched; capped at EXPORT_MAX). Latest first. */
  async list(range: FineDateRange = {}, kind: PpeKind = 'employee'): Promise<{ issues: PpeIssue[]; truncated: boolean }> {
    const client = requireClient();
    const rows: any[] = [];
    let truncated = false;
    for (let offset = 0; ; offset += FINE_LIMITS.BATCH_SIZE) {
      // Each tab shows only its own records: employees have emp_id, contractors have contracto_id
      const scopeColumn = kind === 'contractor' ? 'contracto_id' : 'emp_id';
      const scoped = client.from('ppe_issue').select(COLUMNS).not(scopeColumn, 'is', null);
      const { data, error } = await applyDateRange(scoped, range, 'issue_date')
        .order('issue_date', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
        .range(offset, offset + FINE_LIMITS.BATCH_SIZE - 1);
      if (error) {
        console.error('Failed to load PPE issues:', error);
        throw new Error('Could not load PPE issue records.');
      }
      rows.push(...(data || []));
      if (!data || data.length < FINE_LIMITS.BATCH_SIZE) break;
      if (rows.length >= FINE_LIMITS.EXPORT_MAX) {
        truncated = true;
        break;
      }
    }
    return { issues: await attachEmployees(rows.slice(0, FINE_LIMITS.EXPORT_MAX)), truncated };
  },

  matches(issue: PpeIssue, rawTerm: string): boolean {
    const term = sanitizeSearchTerm(rawTerm).toLowerCase();
    if (!term) return true;
    const hay = [
      issue.emp_id,
      issue.employee?.full_name,
      issue.employee?.department,
      issue.employee?.designation,
      issue.contractor?.contractor_name,
      issue.contractor?.department,
      issue.contractor?.phone_number,
      ...issue.items.map((i) => `${i.item} ${i.color || ''} ${i.size ? `size ${i.size}` : ''}`),
    ];
    return hay.some((v) => (v || '').toLowerCase().includes(term));
  },

  async create(input: { emp_id: string; issue_date: string; items: PpeItem[] }): Promise<PpeIssue> {
    validateCommon(input.emp_id, input.issue_date, input.items);
    await assertActiveEmployee(input.emp_id);
    const client = requireClient();
    const { data, error } = await client
      .from('ppe_issue')
      .insert({ emp_id: input.emp_id.trim(), issue_date: input.issue_date, issued_ppe: input.items })
      .select(COLUMNS)
      .single();
    if (error || !data) {
      console.error('PPE insert failed:', error);
      throw new Error(error?.message ? `Could not save PPE issue: ${error.message}` : 'Could not save PPE issue.');
    }
    return (await attachEmployees([data]))[0];
  },

  async update(id: number, input: { emp_id: string; issue_date: string; items: PpeItem[] }): Promise<PpeIssue> {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid record.');
    validateCommon(input.emp_id, input.issue_date, input.items);
    const client = requireClient();
    // Editing an existing record of a now-inactive employee is allowed (corrections),
    // but a record may not be re-assigned TO an inactive employee.
    const { data: current, error: curErr } = await client.from('ppe_issue').select('emp_id').eq('id', id).maybeSingle();
    if (curErr) throw new Error('Could not load the record. Please try again.');
    if (!current) throw new Error('This record no longer exists (it may have been deleted).');
    if (String(current.emp_id ?? '') !== input.emp_id.trim()) await assertActiveEmployee(input.emp_id);
    const { data, error } = await client
      .from('ppe_issue')
      .update({ emp_id: input.emp_id.trim(), issue_date: input.issue_date, issued_ppe: input.items })
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) {
      console.error('PPE update failed:', error);
      throw new Error(`Could not update PPE issue: ${error.message}`);
    }
    if (!data) throw new Error('This record no longer exists (it may have been deleted).');
    return (await attachEmployees([data]))[0];
  },

  /** Issue PPE to a contractor: contracto_id set, emp_id left blank. */
  async createForContractor(input: { contracto_id: number; issue_date: string; items: PpeItem[] }): Promise<PpeIssue> {
    validateBase(input.issue_date, input.items);
    await assertContractor(Number(input.contracto_id));
    const client = requireClient();
    const { data, error } = await client
      .from('ppe_issue')
      .insert({ contracto_id: Number(input.contracto_id), emp_id: null, issue_date: input.issue_date, issued_ppe: input.items })
      .select(COLUMNS)
      .single();
    if (error || !data) {
      console.error('Contractor PPE insert failed:', error);
      throw new Error(error?.message ? `Could not save PPE issue: ${error.message}` : 'Could not save PPE issue.');
    }
    return (await attachEmployees([data]))[0];
  },

  async updateForContractor(id: number, input: { contracto_id: number; issue_date: string; items: PpeItem[] }): Promise<PpeIssue> {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid record.');
    validateBase(input.issue_date, input.items);
    await assertContractor(Number(input.contracto_id));
    const client = requireClient();
    const { data, error } = await client
      .from('ppe_issue')
      .update({ contracto_id: Number(input.contracto_id), emp_id: null, issue_date: input.issue_date, issued_ppe: input.items })
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) {
      console.error('Contractor PPE update failed:', error);
      throw new Error(`Could not update PPE issue: ${error.message}`);
    }
    if (!data) throw new Error('This record no longer exists (it may have been deleted).');
    return (await attachEmployees([data]))[0];
  },

  /** PPE issued to an employee (latest first) — shown while marking a fine. */
  async getEmployeeHistory(empId: string, limit = 20): Promise<PpeIssue[]> {
    const id = String(empId || '').trim();
    if (!id) return [];
    return (await historyFor('emp_id', id, limit)).issues;
  },

  /** PPE issued to a contractor (latest first) — shown while marking a contractor fine. */
  async getContractorHistory(conId: number, limit = 20): Promise<PpeIssue[]> {
    if (!Number.isSafeInteger(conId) || conId <= 0) return [];
    return (await historyFor('contracto_id', conId, limit)).issues;
  },

  async remove(id: number): Promise<void> {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid record.');
    const client = requireClient();
    const { data, error } = await client.from('ppe_issue').delete().eq('id', id).select('id');
    if (error) {
      console.error('PPE delete failed:', error);
      throw new Error(`Could not delete PPE issue: ${error.message}`);
    }
    if (!data || data.length === 0) throw new Error('Record not found or you do not have permission to delete it.');
  },
};
