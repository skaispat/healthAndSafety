import { 
  Department, 
  User, 
  Observation, 
  Task, 
  CorrectiveAction, 
  TaskHistory, 
  ObservationHistoryItem,
  TaskParticipant, 
  TaskMessage, 
  Notification, 
  TrainingRecord,
  PriorityLevel,
  TaskStatus,
  ObservationStatus,
  PRIORITY_RISK_MAP
} from '../types/database';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Event emitter pattern for reactive updates
type Listener = () => void;
const listeners: Set<Listener> = new Set();

export const subscribeToDataChanges = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const notifyListeners = () => {
  listeners.forEach(l => l());
};

// Storage keys
const STORAGE_KEYS = {
  DEPARTMENTS: 'ehs_departments',
  USERS: 'ehs_users',
  OBSERVATIONS: 'ehs_observations',
  OBSERVATION_HISTORY: 'ehs_observation_history',
  NOTIFICATIONS: 'ehs_notifications',
  OBSERVATION_MESSAGES: 'ehs_observation_messages',
  TRAINING_RECORDS: 'ehs_training_records',
  CLEARED_VERSION: 'ehs_wipeout_v3',
};

// Auto-purge stale mock demo data on initial load
(() => {
  try {
    if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEYS.CLEARED_VERSION) !== 'true') {
      localStorage.removeItem(STORAGE_KEYS.DEPARTMENTS);
      localStorage.removeItem(STORAGE_KEYS.USERS);
      localStorage.removeItem(STORAGE_KEYS.OBSERVATIONS);
      localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
      localStorage.removeItem(STORAGE_KEYS.OBSERVATION_MESSAGES);
      localStorage.removeItem(STORAGE_KEYS.TRAINING_RECORDS);
      localStorage.removeItem('ehs_tasks');
      localStorage.removeItem('ehs_corrective_actions');
      localStorage.removeItem('ehs_task_history');
      localStorage.removeItem('ehs_task_participants');
      localStorage.removeItem('ehs_task_messages');
      localStorage.removeItem('ehs_active_user_id');
      localStorage.setItem(STORAGE_KEYS.CLEARED_VERSION, 'true');
    }
  } catch (e) {
    // ignore
  }
})();

function getStored<T>(key: string, initial: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch (e) {
    return initial;
  }
}

function getCircularReplacer() {
  const seen = new WeakSet();
  return (_key: string, value: any) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return undefined; // Discard circular references safely
      }
      seen.add(value);
    }
    return value;
  };
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value, getCircularReplacer()));
    notifyListeners();
  } catch (e) {
    console.error(`Failed to write to localStorage: ${key}`, e);
  }
}

// Reset data back to clean state
export const resetToSeedData = () => {
  localStorage.setItem(STORAGE_KEYS.OBSERVATIONS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.OBSERVATION_MESSAGES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.TRAINING_RECORDS, JSON.stringify([]));
  localStorage.removeItem('ehs_tasks');
  localStorage.removeItem('ehs_corrective_actions');
  localStorage.removeItem('ehs_task_history');
  localStorage.removeItem('ehs_task_participants');
  localStorage.removeItem('ehs_task_messages');
  notifyListeners();
};

export const DataService = {
  // -------------------------------------------------------------
  // DEPARTMENTS
  // -------------------------------------------------------------
  async getDepartments(): Promise<Department[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from('departments').select('*');
        if (!error && data && data.length > 0) {
          return data.map((d: any) => {
            const displayName = d.dept_name || d.name || `Department ${d.dept_id}`;
            return {
              dept_id: Number(d.dept_id),
              dept_name: displayName,
              id: String(d.dept_id),
              name: displayName,
              code: d.code,
              is_active: d.is_active !== false,
              created_at: d.created_at,
              updated_at: d.updated_at
            };
          }).sort((a: any, b: any) => a.name.localeCompare(b.name));
        }
      } catch (err) {
        console.warn('Supabase getDepartments error', err);
      }
    }
    return getStored<Department[]>(STORAGE_KEYS.DEPARTMENTS, []);
  },

  async addDepartment(name: string, code: string): Promise<Department> {
    const depts = await this.getDepartments();
    const newDept: Department = {
      dept_id: depts.length + 1,
      id: String(depts.length + 1),
      name,
      code: code.toUpperCase(),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('departments').insert([{
          name: newDept.name,
          code: newDept.code,
          is_active: true
        }]);
      } catch (err) {
        console.warn('Supabase add department error', err);
      }
    }
    setStored(STORAGE_KEYS.DEPARTMENTS, [...depts, newDept]);
    return newDept;
  },

  // -------------------------------------------------------------
  // USERS
  // -------------------------------------------------------------
  async getUsers(): Promise<User[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from('users').select('*').order('full_name');
        if (!error && data && data.length > 0) {
          const depts = await this.getDepartments();
          return data.map((u: any) => {
            const empIdNum = Number(u.emp_id);
            const deptIdNum = u.dept_id ? Number(u.dept_id) : null;
            const matchedDept = depts.find(d => d.dept_id === deptIdNum || d.name === u.department);
            const deptObj: Department = matchedDept || {
              dept_id: deptIdNum || 0,
              id: String(deptIdNum || ''),
              name: u.department || 'General',
              code: 'GEN'
            };
            const isHealthSafetyOfficer = String(u.position || '').trim().toUpperCase() === 'HEALTH AND SAFETY';
            const derivedRole = isHealthSafetyOfficer ? 'HEALTH_SAFETY_OFFICER' : 'EMPLOYEE';
            return {
              emp_id: empIdNum,
              id: String(empIdNum),
              employee_id: String(empIdNum),
              full_name: u.full_name,
              username: u.username,
              email: u.username,
              password: u.password,
              department: deptObj,
              dept_id: deptIdNum,
              department_id: deptIdNum ? String(deptIdNum) : null,
              role: derivedRole,
              status: u.status || 'active',
              is_active: u.status === 'active',
              user_access: u.user_access,
              mobile_number: u.mobile_number,
              phone: u.mobile_number,
              retail_access: u.retail_access,
              position: u.position,
              created_at: u.created_at || new Date().toISOString(),
              updated_at: u.created_at || new Date().toISOString(),
              profile_photo: `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name)}&background=b91c1c&color=fff`,
            };
          });
        }
      } catch (err) {
        console.warn('Supabase getUsers error', err);
      }
    }
    return getStored<User[]>(STORAGE_KEYS.USERS, []);
  },

  async getUserById(id: string | number): Promise<User | undefined> {
    const users = await this.getUsers();
    return users.find(u => u.emp_id === Number(id) || u.id === String(id));
  },

  async getActiveEmployees(): Promise<User[]> {
    const users = await this.getUsers();
    return users.filter(u => {
      const isOfficerRole = String(u.position || '').trim().toUpperCase() === 'HEALTH AND SAFETY';
      const isActive = u.status === 'active' || u.is_active;
      return !isOfficerRole && isActive;
    });
  },

  // -------------------------------------------------------------
  // UNIFIED OBSERVATIONS (Single Table for Observations & Assigned Tasks)
  // -------------------------------------------------------------
  async getObservations(): Promise<Observation[]> {
    let rawObs: any[] = [];

    if (isSupabaseConfigured() && supabase) {
      try {
        let { data, error } = await supabase
          .from('observations')
          .select('*, photos:observation_photos(*)')
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('Supabase getObservations query warning:', error.message);
          const simpleRes = await supabase
            .from('observations')
            .select('*')
            .order('created_at', { ascending: false });
          if (!simpleRes.error && simpleRes.data) {
            data = simpleRes.data;
            error = null;
          }
        }

        if (!error && data) {
          rawObs = data;
        }
      } catch (err) {
        console.warn('Supabase getObservations error, checking local store', err);
      }
    }

    if (rawObs.length === 0) {
      rawObs = getStored<Observation[]>(STORAGE_KEYS.OBSERVATIONS, []);
    }

    const depts = await this.getDepartments();
    const users = await this.getUsers();

    // Fetch all observation history records for loop tracking
    let allHistory: ObservationHistoryItem[] = [];
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('observation_history')
          .select('*')
          .order('created_at', { ascending: true });
        if (!error && data) {
          allHistory = data;
        }
      } catch (err) {
        console.warn('Supabase fetch observation_history error:', err);
      }
    }
    if (allHistory.length === 0) {
      allHistory = getStored<ObservationHistoryItem[]>(STORAGE_KEYS.OBSERVATION_HISTORY, []);
    }

    return rawObs.map((obs: any) => {
      const deptIdNum = Number(obs.dept_id || obs.department_id);
      const createdByNum = Number(obs.created_by);
      const assignedToNum = Number(obs.assigned_to);

      const rawDeptName = obs.department?.dept_name || obs.department?.name;
      const matchedDept = obs.department && rawDeptName
        ? {
            dept_id: Number(obs.department.dept_id),
            dept_name: rawDeptName,
            id: String(obs.department.dept_id),
            name: rawDeptName,
            code: obs.department.code,
            is_active: obs.department.is_active !== false,
          }
        : depts.find(d => d.dept_id === deptIdNum);

      const creator = users.find(u => u.emp_id === createdByNum);
      const assignee = users.find(u => u.emp_id === assignedToNum);

      const allObsPhotos: any[] = (obs.photos || []).map((p: any) => ({
        id: String(p.id),
        observation_id: String(obs.id),
        photo_url: p.photo_url || p.url,
        file_name: p.file_name,
        photo_type: p.photo_type || (p.uploaded_by && Number(p.uploaded_by) === createdByNum ? 'INITIAL' : 'CORRECTIVE'),
        uploaded_by: p.uploaded_by,
        created_at: p.created_at || obs.created_at,
      }));

      // Initial photos (problem hazard) uploaded by creator / assigner
      const initialPhotos = allObsPhotos.filter(
        p => p.photo_type === 'INITIAL' || (p.uploaded_by && Number(p.uploaded_by) === createdByNum && p.photo_type !== 'CORRECTIVE')
      );

      // Corrective photos (solution evidence) uploaded by assignee / employee
      const correctivePhotos = allObsPhotos.filter(
        p => p.photo_type === 'CORRECTIVE' || (p.uploaded_by && Number(p.uploaded_by) !== createdByNum)
      );

      // Find history events for this specific observation
      const obsHistory = allHistory
        .filter(h => String(h.observation_id) === String(obs.id))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // Reconstruct multi-cycle rework loop attempts (Attempt 1, 2, 3, 4, 5, etc.)
      const submissionEvents = obsHistory.filter(h => h.action_type === 'SUBMITTED_FOR_REVIEW' || h.action_type === 'COMPLETED');

      let correctiveActions: CorrectiveAction[] = [];
      if (submissionEvents.length > 0) {
        correctiveActions = submissionEvents.map(sub => {
          // Find any refusal/rework reason recorded for this attempt
          const reworkEvent = obsHistory.find(
            h => h.action_type === 'REWORK_REQUIRED' && h.attempt_number === sub.attempt_number
          );

          let subPhotos: any[] = [];
          if (Array.isArray(sub.photos) && sub.photos.length > 0) {
            subPhotos = sub.photos.map((p: any, pIdx: number) => ({
              id: `photo-${sub.id}-${pIdx}`,
              corrective_action_id: sub.id,
              photo_url: typeof p === 'string' ? p : (p.url || p.photo_url),
              file_name: p.file_name || `evidence_${pIdx + 1}.jpg`,
              photo_type: 'CORRECTIVE',
              uploaded_by: sub.performed_by,
              created_at: sub.created_at,
            }));
          } else {
            // Check if there are corrective photos matching this submitter
            const matchingPhotos = correctivePhotos.filter(cp => Number(cp.uploaded_by) === Number(sub.performed_by));
            if (matchingPhotos.length > 0) {
              subPhotos = matchingPhotos;
            }
          }

          return {
            id: sub.id,
            task_id: String(obs.id),
            submitted_by: sub.performed_by,
            action_description: sub.description,
            attempt_number: sub.attempt_number || 1,
            submitted_at: sub.created_at,
            submitter: users.find(u => u.emp_id === Number(sub.performed_by)),
            photos: subPhotos,
            rework_reason: reworkEvent ? reworkEvent.rework_reason : (obs.status === 'REWORK_REQUIRED' && sub.attempt_number === submissionEvents.length ? obs.rework_reason : null),
            reworked_at: reworkEvent ? reworkEvent.created_at : null,
            reworked_by: reworkEvent ? reworkEvent.performed_by : null,
            status: reworkEvent ? 'REWORK_REQUIRED' : (obs.status === 'COMPLETED' ? 'APPROVED' : 'SUBMITTED'),
          };
        });
      } else if (obs.corrective_action) {
        // Fallback for legacy observation records without history table entry
        correctiveActions = [{
          id: `ca-${obs.id}`,
          task_id: String(obs.id),
          submitted_by: assignedToNum,
          action_description: obs.corrective_action,
          attempt_number: 1,
          submitted_at: obs.updated_at,
          submitter: assignee,
          photos: correctivePhotos,
          rework_reason: obs.rework_reason,
          status: obs.status === 'REWORK_REQUIRED' ? 'REWORK_REQUIRED' : 'SUBMITTED',
        }];
      }

      // Map complete audit history with performer details
      const historyWithPerformers: TaskHistory[] = obsHistory.map(h => ({
        id: h.id,
        task_id: h.observation_id,
        action_type: h.action_type,
        attempt_number: h.attempt_number,
        description: h.description,
        rework_reason: h.rework_reason,
        performed_by: h.performed_by,
        previous_status: h.previous_status,
        new_status: h.new_status,
        photos: h.photos,
        created_at: h.created_at,
        performer: users.find(u => u.emp_id === Number(h.performed_by)),
      }));

      // Map as self-contained Task for backwards compatibility with any Task views
      const taskObj: Task = {
        id: String(obs.id),
        task_number: obs.observation_number,
        observation_id: String(obs.id),
        assigned_to: assignedToNum,
        assigned_by: createdByNum,
        status: obs.status as TaskStatus,
        due_date: obs.due_date,
        created_at: obs.created_at,
        updated_at: obs.updated_at,
        completed_at: obs.completed_at,
        completed_by: obs.completed_by,
        rework_reason: obs.rework_reason,
        assignee,
        assigner: creator,
        photos: initialPhotos,
        initial_photos: initialPhotos,
        corrective_photos: correctivePhotos,
        all_photos: allObsPhotos,
        corrective_actions: correctiveActions,
        history: historyWithPerformers,
      };

      const result: Observation = {
        id: String(obs.id),
        observation_number: obs.observation_number,
        created_by: createdByNum,
        dept_id: deptIdNum,
        department_id: String(deptIdNum),
        area: obs.area,
        observation_text: obs.observation_text,
        solution_text: obs.solution_text,
        priority: obs.priority,
        risk_min: Number(obs.risk_min),
        risk_max: Number(obs.risk_max),
        assigned_to: assignedToNum,
        due_date: obs.due_date,
        status: obs.status,
        corrective_action: obs.corrective_action,
        rework_reason: obs.rework_reason,
        is_personal: Boolean(obs.is_personal),
        closed_by: obs.closed_by,
        closed_at: obs.closed_at,
        completed_at: obs.completed_at,
        completed_by: obs.completed_by,
        created_at: obs.created_at,
        updated_at: obs.updated_at,
        department: matchedDept,
        creator,
        assignee,
        photos: initialPhotos,
        initial_photos: initialPhotos,
        corrective_photos: correctivePhotos,
        all_photos: allObsPhotos,
        history: obsHistory,
        task: taskObj,
      };

      taskObj.observation = result;

      return result;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getObservationById(id: string): Promise<Observation | undefined> {
    const observations = await this.getObservations();
    return observations.find(o => o.id === id || o.observation_number === id);
  },

  // Observation History / Audit Loop Tracking
  async getObservationHistory(observation_id: string): Promise<ObservationHistoryItem[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('observation_history')
          .select('*')
          .eq('observation_id', observation_id)
          .order('created_at', { ascending: true });
        if (!error && data && data.length > 0) {
          return data;
        }
      } catch (err) {
        console.warn('Supabase fetch observation_history error:', err);
      }
    }
    const stored = getStored<ObservationHistoryItem[]>(STORAGE_KEYS.OBSERVATION_HISTORY, []);
    return stored
      .filter(h => String(h.observation_id) === String(observation_id))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  },

  async recordObservationHistory(item: ObservationHistoryItem): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('observation_history').insert([{
          id: item.id,
          observation_id: item.observation_id,
          action_type: item.action_type,
          attempt_number: item.attempt_number,
          description: item.description,
          rework_reason: item.rework_reason || null,
          performed_by: Number(item.performed_by),
          previous_status: item.previous_status || null,
          new_status: item.new_status || null,
          photos: item.photos || [],
          created_at: item.created_at
        }]);
        if (error) console.warn('Supabase record observation_history error:', error);
      } catch (err) {
        console.warn('Supabase record observation_history error:', err);
      }
    }
    const stored = getStored<ObservationHistoryItem[]>(STORAGE_KEYS.OBSERVATION_HISTORY, []);
    setStored(STORAGE_KEYS.OBSERVATION_HISTORY, [...stored, item]);
  },

  // Single unified creation flow for Observation and Assigned Task
  async createObservationWithTask(params: {
    department_id: string | number;
    area: string;
    observation_text: string;
    solution_text?: string;
    assigned_to: string | number; // selected employee's emp_id
    due_date: string;
    priority: PriorityLevel;
    photo_urls: { url: string; file_name: string }[];
    officer_id: string | number; // creator's emp_id
  }): Promise<{ observation: Observation; task: Task }> {
    const now = new Date().toISOString();
    const obsId = crypto.randomUUID();
    const existingList = await this.getObservations();
    const obsCount = existingList.length + 1;
    const obsNumber = `OBS-2026-${String(obsCount).padStart(3, '0')}`;
    const risk = PRIORITY_RISK_MAP[params.priority];

    const deptIdNum = Number(params.department_id);
    const createdByNum = Number(params.officer_id);
    const assignedToNum = Number(params.assigned_to);

    const depts = await this.getDepartments();
    const users = await this.getUsers();
    const matchedDept = depts.find(d => d.dept_id === deptIdNum);
    const creator = users.find(u => u.emp_id === createdByNum);
    const assignee = users.find(u => u.emp_id === assignedToNum);

    const photos: any[] = params.photo_urls.map((p, idx) => ({
      id: crypto.randomUUID(),
      observation_id: obsId,
      photo_url: p.url,
      url: p.url,
      file_name: p.file_name || `photo_${idx + 1}.jpg`,
      photo_type: 'INITIAL',
      uploaded_by: createdByNum,
      created_at: now
    }));

    const newObservation: Observation = {
      id: obsId,
      observation_number: obsNumber,
      created_by: createdByNum,
      dept_id: deptIdNum,
      department_id: String(deptIdNum),
      area: params.area,
      observation_text: params.observation_text,
      solution_text: params.solution_text || null,
      priority: params.priority,
      risk_min: risk.min,
      risk_max: risk.max,
      assigned_to: assignedToNum,
      due_date: params.due_date,
      status: 'ASSIGNED',
      is_personal: false,
      created_at: now,
      updated_at: now,
      department: matchedDept,
      creator,
      assignee,
      photos,
      initial_photos: photos,
      all_photos: photos,
    };

    const taskObj: Task = {
      id: obsId,
      task_number: obsNumber,
      observation_id: obsId,
      assigned_to: assignedToNum,
      assigned_by: createdByNum,
      status: 'ASSIGNED',
      due_date: params.due_date,
      created_at: now,
      updated_at: now,
      assignee,
      assigner: creator,
      photos,
      initial_photos: photos,
      all_photos: photos,
    };
    newObservation.task = taskObj;

    // Notification for the assigned employee
    const newNotification: Notification = {
      id: crypto.randomUUID(),
      user_id: assignedToNum,
      observation_id: obsId,
      task_id: obsId,
      notification_type: 'TASK_ASSIGNED',
      title: `New Safety Task: ${obsNumber}`,
      message: `You have been assigned: ${params.observation_text.slice(0, 80)}... Area: ${params.area}`,
      is_read: false,
      created_at: now
    };

    // Supabase push directly into unified tables
    if (isSupabaseConfigured() && supabase) {
      try {
        const { error: obsInsertErr } = await supabase.from('observations').insert([{
          id: obsId,
          created_by: createdByNum,
          dept_id: deptIdNum,
          area: params.area,
          observation_text: params.observation_text,
          solution_text: params.solution_text || null,
          priority: params.priority,
          risk_min: risk.min,
          risk_max: risk.max,
          assigned_to: assignedToNum,
          due_date: params.due_date,
          status: 'ASSIGNED',
          is_personal: false
        }]);

        if (obsInsertErr) {
          console.error('Supabase insert observation error:', obsInsertErr);
        }

        if (photos.length > 0) {
          const { error: photoInsertErr } = await supabase.from('observation_photos').insert(photos.map(p => ({
            id: p.id,
            observation_id: obsId,
            photo_url: p.photo_url,
            file_name: p.file_name,
            photo_type: 'INITIAL',
            uploaded_by: createdByNum
          })));
          if (photoInsertErr) {
            console.error('Supabase insert photos error:', photoInsertErr);
          }
        }

        const { error: notifInsertErr } = await supabase.from('notifications').insert([{
          id: newNotification.id,
          user_id: assignedToNum,
          observation_id: obsId,
          notification_type: 'TASK_ASSIGNED',
          title: newNotification.title,
          message: newNotification.message,
          is_read: false
        }]);
        if (notifInsertErr) {
          console.error('Supabase insert notification error:', notifInsertErr);
        }
      } catch (err) {
        console.warn('Supabase insert observation error', err);
      }
    }

    // Record initial history event for tracking loop
    const initialHistoryItem: ObservationHistoryItem = {
      id: crypto.randomUUID(),
      observation_id: obsId,
      action_type: 'ASSIGNED',
      attempt_number: 1,
      description: `Safety observation logged and task assigned to ${assignee?.full_name || 'employee'} (Emp ID: ${assignedToNum}).`,
      rework_reason: null,
      performed_by: createdByNum,
      previous_status: null,
      new_status: 'ASSIGNED',
      photos: params.photo_urls,
      created_at: now
    };
    await this.recordObservationHistory(initialHistoryItem);

    // Persist to local storage cache
    const storedObs = getStored<Observation[]>(STORAGE_KEYS.OBSERVATIONS, []);
    setStored(STORAGE_KEYS.OBSERVATIONS, [newObservation, ...storedObs]);

    const storedNotifs = getStored<Notification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    setStored(STORAGE_KEYS.NOTIFICATIONS, [newNotification, ...storedNotifs]);

    return { observation: newObservation, task: taskObj };
  },

  // Personal Observation Workflow (Officer self-log)
  async createPersonalObservation(params: {
    department_id: string | number;
    area: string;
    observation_text: string;
    solution_text?: string;
    due_date?: string;
    priority: PriorityLevel;
    photo_urls: { url: string; file_name: string }[];
    officer_id: string | number;
  }): Promise<Observation> {
    const now = new Date().toISOString();
    const obsId = crypto.randomUUID();
    const existingList = await this.getObservations();
    const obsNumber = `OBS-2026-${String(existingList.length + 1).padStart(3, '0')}`;
    const risk = PRIORITY_RISK_MAP[params.priority];
    const deptIdNum = Number(params.department_id);
    const officerIdNum = Number(params.officer_id);

    const newObservation: Observation = {
      id: obsId,
      observation_number: obsNumber,
      created_by: officerIdNum,
      dept_id: deptIdNum,
      department_id: String(deptIdNum),
      area: params.area,
      observation_text: params.observation_text,
      solution_text: params.solution_text || null,
      priority: params.priority,
      risk_min: risk.min,
      risk_max: risk.max,
      assigned_to: officerIdNum,
      due_date: params.due_date || now,
      status: 'OPEN',
      is_personal: true,
      created_at: now,
      updated_at: now,
      photos: params.photo_urls.map((p) => ({
        id: crypto.randomUUID(),
        observation_id: obsId,
        photo_url: p.url,
        file_name: p.file_name,
        photo_type: 'INITIAL',
        uploaded_by: officerIdNum,
        created_at: now
      }))
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('observations').insert([{
          id: obsId,
          created_by: officerIdNum,
          dept_id: deptIdNum,
          area: params.area,
          observation_text: params.observation_text,
          solution_text: params.solution_text || null,
          priority: params.priority,
          risk_min: risk.min,
          risk_max: risk.max,
          assigned_to: officerIdNum,
          due_date: params.due_date || now,
          status: 'OPEN',
          is_personal: true
        }]);
      } catch (err) {
        console.warn('Supabase personal observation error', err);
      }
    }

    const storedObs = getStored<Observation[]>(STORAGE_KEYS.OBSERVATIONS, []);
    setStored(STORAGE_KEYS.OBSERVATIONS, [newObservation, ...storedObs]);
    return newObservation;
  },

  async togglePersonalObservationStatus(observation_id: string, officer_id: string | number, closeReason?: string): Promise<Observation | null> {
    const obsList = await this.getObservations();
    const index = obsList.findIndex(o => o.id === observation_id);
    if (index === -1) return null;

    const current = obsList[index];
    const newStatus = current.status === 'OPEN' ? 'CLOSED' : 'OPEN';
    const now = new Date().toISOString();

    const updated: Observation = {
      ...current,
      status: newStatus,
      closed_by: newStatus === 'CLOSED' ? Number(officer_id) : null,
      closed_at: newStatus === 'CLOSED' ? now : null,
      updated_at: now,
      solution_text: closeReason ? `${current.solution_text || ''}\n[Closed Note]: ${closeReason}`.trim() : current.solution_text
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('observations').update({
          status: newStatus,
          closed_by: newStatus === 'CLOSED' ? Number(officer_id) : null,
          closed_at: newStatus === 'CLOSED' ? now : null,
          solution_text: updated.solution_text,
          updated_at: now
        }).eq('id', observation_id);
      } catch (err) {
        console.warn('Supabase toggle status error', err);
      }
    }

    obsList[index] = updated;
    setStored(STORAGE_KEYS.OBSERVATIONS, obsList);
    return updated;
  },

  // -------------------------------------------------------------
  // TASKS (Mapped directly from Unified Observations)
  // -------------------------------------------------------------
  async getTasks(): Promise<Task[]> {
    const observations = await this.getObservations();
    return observations.map(o => {
      if (!o.task) return null;
      return {
        ...o.task,
        assigned_to: Number(o.assigned_to),
        observation: o
      };
    }).filter(Boolean) as Task[];
  },

  async getTaskById(id: string): Promise<Task | undefined> {
    const tasks = await this.getTasks();
    return tasks.find(t => t.id === id || t.task_number === id);
  },

  // Employee Submits Corrective Action for the Observation
  async submitCorrectiveAction(params: {
    task_id: string; // observation id
    submitted_by: string | number; // employee emp_id
    action_description: string;
    photos: { url: string; file_name: string }[];
    markAsCompleted?: boolean;
    stage?: 'PARTIALLY_DONE' | 'COMPLETED';
  }): Promise<CorrectiveAction> {
    const obs = await this.getObservationById(params.task_id);
    if (!obs) throw new Error('Observation task not found');

    const now = new Date().toISOString();
    const employeeEmpId = Number(params.submitted_by);
    const isCompleted = params.stage === 'COMPLETED' || params.markAsCompleted === true;
    const isPartial = params.stage === 'PARTIALLY_DONE';
    const targetStatus: ObservationStatus = isCompleted ? 'COMPLETED' : (isPartial ? 'IN_PROGRESS' : 'SUBMITTED_FOR_REVIEW');

    // Calculate current attempt number dynamically from previous submissions
    const obsHistory = await this.getObservationHistory(obs.id);
    const prevSubmissions = obsHistory.filter(h => h.action_type === 'SUBMITTED_FOR_REVIEW' || h.action_type === 'COMPLETED' || h.action_type === 'IN_PROGRESS');
    const attemptNumber = prevSubmissions.length + 1;

    const actionRecordId = crypto.randomUUID();

    const correctivePhotos = params.photos.map((p, pIdx) => ({
      id: crypto.randomUUID(),
      observation_id: obs.id,
      photo_url: p.url,
      file_name: p.file_name || `corrective_${attemptNumber}_${pIdx + 1}.jpg`,
      photo_type: 'CORRECTIVE' as const,
      uploaded_by: employeeEmpId,
      created_at: now
    }));

    // Record tracking event in observation_history table
    const historyActionType = isCompleted ? 'COMPLETED' : (isPartial ? 'IN_PROGRESS' : 'SUBMITTED_FOR_REVIEW');
    const historyItem: ObservationHistoryItem = {
      id: actionRecordId,
      observation_id: obs.id,
      action_type: historyActionType as any,
      attempt_number: attemptNumber,
      description: isPartial
        ? `Partially Done: ${params.action_description}`
        : params.action_description,
      rework_reason: null,
      performed_by: employeeEmpId,
      previous_status: obs.status,
      new_status: targetStatus,
      photos: params.photos.map(p => ({ url: p.url, file_name: p.file_name })),
      created_at: now
    };
    await this.recordObservationHistory(historyItem);

    if (isSupabaseConfigured() && supabase) {
      try {
        const updatePayload: any = {
          status: targetStatus,
          corrective_action: params.action_description,
          updated_at: now
        };
        if (isCompleted) {
          updatePayload.completed_at = now;
          updatePayload.completed_by = employeeEmpId;
          updatePayload.closed_at = now;
          updatePayload.closed_by = employeeEmpId;
        }

        const { error: updErr } = await supabase
          .from('observations')
          .update(updatePayload)
          .eq('id', obs.id);

        if (updErr) console.error('Supabase update observation error:', updErr);

        if (correctivePhotos.length > 0) {
          const { error: photoErr } = await supabase.from('observation_photos').insert(correctivePhotos);
          if (photoErr) console.error('Supabase insert corrective photos error:', photoErr);
        }

        // Notify creator (Safety Officer)
        const notifType = params.markAsCompleted ? 'TASK_COMPLETED' : 'CORRECTIVE_SUBMITTED';
        const notifTitle = params.markAsCompleted
          ? `Task Completed (${obs.observation_number || 'OBS'})`
          : `Corrective Action Submitted — Attempt #${attemptNumber} (${obs.observation_number || 'OBS'})`;

        const { error: notifErr } = await supabase.from('notifications').insert([{
          id: crypto.randomUUID(),
          user_id: Number(obs.created_by),
          observation_id: obs.id,
          notification_type: notifType,
          title: notifTitle,
          message: `Assignee submitted Attempt #${attemptNumber} remarks: "${params.action_description.slice(0, 80)}"`,
          is_read: false
        }]);
        if (notifErr) console.warn('Supabase corrective notification error:', notifErr);
      } catch (err) {
        console.warn('Supabase submit corrective error', err);
      }
    }

    const obsList = await this.getObservations();
    const idx = obsList.findIndex(o => o.id === obs.id);
    if (idx !== -1) {
      obsList[idx].status = targetStatus;
      obsList[idx].corrective_action = params.action_description;
      if (isCompleted) {
        obsList[idx].completed_at = now;
        obsList[idx].completed_by = employeeEmpId;
        obsList[idx].closed_at = now;
        obsList[idx].closed_by = employeeEmpId;
      }
      obsList[idx].updated_at = now;
      obsList[idx].photos = [...(obsList[idx].photos || []), ...correctivePhotos];
      setStored(STORAGE_KEYS.OBSERVATIONS, obsList);
    }

    const newNotif: Notification = {
      id: crypto.randomUUID(),
      user_id: Number(obs.created_by),
      observation_id: obs.id,
      task_id: obs.id,
      notification_type: 'CORRECTIVE_SUBMITTED',
      title: `Corrective Action (Attempt #${attemptNumber}) Submitted (${obs.observation_number})`,
      message: `Assignee submitted corrective proof for review.`,
      is_read: false,
      created_at: now
    };
    const storedNotifs = getStored<Notification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    setStored(STORAGE_KEYS.NOTIFICATIONS, [newNotif, ...storedNotifs]);

    return {
      id: actionRecordId,
      task_id: obs.id,
      submitted_by: employeeEmpId,
      action_description: params.action_description,
      attempt_number: attemptNumber,
      submitted_at: now,
      photos: correctivePhotos.map(p => ({
        id: p.id,
        corrective_action_id: p.id,
        photo_url: p.photo_url,
        file_name: p.file_name,
        uploaded_by: employeeEmpId,
        created_at: now
      }))
    };
  },

  // Officer reviews observation task
  async reviewTask(params: {
    task_id: string; // observation id
    officer_id: string | number; // officer emp_id
    decision: 'COMPLETE' | 'REWORK';
    rework_reason?: string;
  }): Promise<Task> {
    const obs = await this.getObservationById(params.task_id);
    if (!obs) throw new Error('Observation not found');

    const now = new Date().toISOString();
    const officerEmpId = Number(params.officer_id);
    const newStatus: ObservationStatus = params.decision === 'COMPLETE' ? 'COMPLETED' : 'REWORK_REQUIRED';

    if (params.decision === 'REWORK' && (!params.rework_reason || !params.rework_reason.trim())) {
      throw new Error('Rework reason is mandatory when requesting rework.');
    }

    // Determine the attempt number that was reviewed
    const obsHistory = await this.getObservationHistory(obs.id);
    const lastSubmission = [...obsHistory].reverse().find(h => h.action_type === 'SUBMITTED_FOR_REVIEW' || h.action_type === 'COMPLETED');
    const attemptNumber = lastSubmission ? lastSubmission.attempt_number : 1;

    // Record review decision in observation_history table
    const reviewHistoryItem: ObservationHistoryItem = {
      id: crypto.randomUUID(),
      observation_id: obs.id,
      action_type: params.decision === 'COMPLETE' ? 'COMPLETED' : 'REWORK_REQUIRED',
      attempt_number: attemptNumber,
      description: params.decision === 'COMPLETE'
        ? `Officer approved Attempt #${attemptNumber} and marked task as COMPLETED.`
        : `Officer refused Attempt #${attemptNumber} and requested rework.`,
      rework_reason: params.decision === 'REWORK' ? params.rework_reason : null,
      performed_by: officerEmpId,
      previous_status: obs.status,
      new_status: newStatus,
      photos: [],
      created_at: now
    };
    await this.recordObservationHistory(reviewHistoryItem);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('observations').update({
          status: newStatus,
          rework_reason: params.decision === 'REWORK' ? params.rework_reason : null,
          completed_at: params.decision === 'COMPLETE' ? now : null,
          completed_by: params.decision === 'COMPLETE' ? officerEmpId : null,
          closed_at: params.decision === 'COMPLETE' ? now : null,
          closed_by: params.decision === 'COMPLETE' ? officerEmpId : null,
          updated_at: now
        }).eq('id', obs.id);

        // Notify assigned employee
        await supabase.from('notifications').insert([{
          id: crypto.randomUUID(),
          user_id: Number(obs.assigned_to),
          observation_id: obs.id,
          notification_type: params.decision === 'COMPLETE' ? 'TASK_COMPLETED' : 'REWORK_REQUESTED',
          title: params.decision === 'COMPLETE' ? `Task Completed: ${obs.observation_number}` : `Rework Required (Attempt #${attemptNumber}): ${obs.observation_number}`,
          message: params.decision === 'COMPLETE' ? `Your corrective action has been verified and marked completed.` : `Officer requested rework: "${params.rework_reason}"`,
          is_read: false
        }]);
      } catch (err) {
        console.warn('Supabase review task error', err);
      }
    }

    const obsList = await this.getObservations();
    const idx = obsList.findIndex(o => o.id === obs.id);
    if (idx !== -1) {
      obsList[idx].status = newStatus;
      obsList[idx].updated_at = now;
      if (params.decision === 'COMPLETE') {
        obsList[idx].completed_at = now;
        obsList[idx].completed_by = officerEmpId;
        obsList[idx].closed_at = now;
        obsList[idx].closed_by = officerEmpId;
        obsList[idx].rework_reason = null;
      } else {
        obsList[idx].rework_reason = params.rework_reason;
      }
      setStored(STORAGE_KEYS.OBSERVATIONS, obsList);
    }

    const newNotif: Notification = {
      id: crypto.randomUUID(),
      user_id: Number(obs.assigned_to),
      observation_id: obs.id,
      task_id: obs.id,
      notification_type: params.decision === 'COMPLETE' ? 'TASK_COMPLETED' : 'REWORK_REQUESTED',
      title: params.decision === 'COMPLETE' ? `Task Completed: ${obs.observation_number}` : `Rework Required (Attempt #${attemptNumber}): ${obs.observation_number}`,
      message: params.decision === 'COMPLETE' ? `Task verified and completed.` : `Officer requested rework: "${params.rework_reason}"`,
      is_read: false,
      created_at: now
    };
    const storedNotifs = getStored<Notification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    setStored(STORAGE_KEYS.NOTIFICATIONS, [newNotif, ...storedNotifs]);

    return (await this.getTaskById(params.task_id))!;
  },

  // -------------------------------------------------------------
  // REALTIME COMMUNICATION (Observation Messages)
  // -------------------------------------------------------------
  async sendMessage(params: {
    task_id: string; // observation id
    sender_id: string | number; // emp_id
    message: string;
  }): Promise<TaskMessage> {
    const now = new Date().toISOString();
    const senderEmpId = Number(params.sender_id);
    const users = await this.getUsers();
    const sender = users.find(u => u.emp_id === senderEmpId);
    const obs = await this.getObservationById(params.task_id);

    const newMsg: TaskMessage = {
      id: crypto.randomUUID(),
      task_id: params.task_id,
      sender_id: senderEmpId,
      message: params.message,
      created_at: now,
      updated_at: now,
      sender
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('observation_messages').insert([{
          id: newMsg.id,
          observation_id: params.task_id,
          sender_id: senderEmpId,
          message: params.message
        }]);

        if (obs) {
          const recipientId = senderEmpId === Number(obs.assigned_to) ? Number(obs.created_by) : Number(obs.assigned_to);
          await supabase.from('notifications').insert([{
            id: crypto.randomUUID(),
            user_id: recipientId,
            observation_id: obs.id,
            notification_type: 'CHAT_MESSAGE',
            title: `New Message: ${obs.observation_number}`,
            message: `${sender?.full_name || 'User'}: ${params.message.slice(0, 70)}...`,
            is_read: false
          }]);
        }
      } catch (err) {
        console.warn('Supabase sendMessage error', err);
      }
    }

    const messages = getStored<TaskMessage[]>(STORAGE_KEYS.OBSERVATION_MESSAGES, []);
    setStored(STORAGE_KEYS.OBSERVATION_MESSAGES, [...messages, newMsg]);
    return newMsg;
  },

  // -------------------------------------------------------------
  // NOTIFICATIONS
  // -------------------------------------------------------------
  async getNotifications(user_id?: string | number): Promise<Notification[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase.from('notifications').select('*').order('created_at', { ascending: false });
        if (user_id) {
          query = query.eq('user_id', Number(user_id));
        }
        const { data, error } = await query;
        if (!error && data) {
          return data.map((n: any) => ({
            id: String(n.id),
            user_id: Number(n.user_id),
            task_id: n.observation_id ? String(n.observation_id) : (n.task_id ? String(n.task_id) : null),
            observation_id: n.observation_id ? String(n.observation_id) : null,
            notification_type: n.notification_type,
            title: n.title,
            message: n.message,
            is_read: Boolean(n.is_read),
            created_at: n.created_at
          }));
        }
      } catch (err) {
        console.warn('Supabase getNotifications error', err);
      }
    }

    const notifs = getStored<Notification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    if (user_id) {
      return notifs.filter(n => Number(n.user_id) === Number(user_id)).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return notifs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async markNotificationAsRead(id: string): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      } catch (err) {
        console.warn('Supabase markNotificationAsRead error', err);
      }
    }
    const notifs = getStored<Notification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    const idx = notifs.findIndex(n => n.id === id);
    if (idx !== -1) {
      notifs[idx].is_read = true;
      setStored(STORAGE_KEYS.NOTIFICATIONS, notifs);
    }
  },

  async markAllNotificationsAsRead(user_id: string | number): Promise<void> {
    const empIdNum = Number(user_id);
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', empIdNum);
      } catch (err) {
        console.warn('Supabase markAllNotificationsAsRead error', err);
      }
    }
    const notifs = getStored<Notification[]>(STORAGE_KEYS.NOTIFICATIONS, []);
    const updated = notifs.map(n => Number(n.user_id) === empIdNum ? { ...n, is_read: true } : n);
    setStored(STORAGE_KEYS.NOTIFICATIONS, updated);
  },

  // -------------------------------------------------------------
  // SAFETY TRAINING RECORDS (ISO compliance)
  // -------------------------------------------------------------
  async getTrainingRecords(): Promise<TrainingRecord[]> {
    return getStored<TrainingRecord[]>(STORAGE_KEYS.TRAINING_RECORDS, []);
  },

  async createTrainingRecord(params: {
    department_id: string;
    number_of_persons: number;
    training_topic: string;
    description: string;
    training_date: string;
    photos: { url: string; file_name: string }[];
    officer_id: string | number;
  }): Promise<TrainingRecord> {
    const records = getStored<TrainingRecord[]>(STORAGE_KEYS.TRAINING_RECORDS, []);
    const now = new Date().toISOString();
    const trainingId = crypto.randomUUID();
    const trainingNumber = `TRN-2026-${String(records.length + 1).padStart(3, '0')}`;

    const newRecord: TrainingRecord = {
      id: trainingId,
      training_number: trainingNumber,
      created_by: Number(params.officer_id),
      department_id: params.department_id,
      dept_id: Number(params.department_id),
      number_of_persons: params.number_of_persons,
      training_topic: params.training_topic,
      description: params.description,
      training_date: params.training_date,
      created_at: now,
      updated_at: now,
      photos: params.photos.map((p, idx) => ({
        id: `tp-${Date.now()}-${idx}`,
        training_id: trainingId,
        photo_url: p.url,
        file_name: p.file_name,
        uploaded_by: Number(params.officer_id),
        created_at: now
      }))
    };

    setStored(STORAGE_KEYS.TRAINING_RECORDS, [newRecord, ...records]);
    return newRecord;
  },

  // -------------------------------------------------------------
  // DASHBOARD METRICS AGGREGATION
  // -------------------------------------------------------------
  async getOfficerDashboardStats() {
    const observations = await this.getObservations();
    const trainings = await this.getTrainingRecords();

    const totalObservations = observations.length;
    const openObservations = observations.filter(o => o.status !== 'COMPLETED' && o.status !== 'CLOSED').length;
    const closedObservations = observations.filter(o => o.status === 'COMPLETED' || o.status === 'CLOSED').length;

    const activeTasks = observations.filter(t => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS').length;
    const awaitingReview = observations.filter(t => t.status === 'SUBMITTED_FOR_REVIEW').length;
    const reworkRequired = observations.filter(t => t.status === 'REWORK_REQUIRED').length;
    const completedTasks = observations.filter(t => t.status === 'COMPLETED').length;
    const overdueTasks = observations.filter(t => t.status === 'OVERDUE').length;

    const highRisk = observations.filter(o => o.priority === 'HIGH').length;
    const mediumRisk = observations.filter(o => o.priority === 'MEDIUM').length;
    const lowRisk = observations.filter(o => o.priority === 'LOW').length;

    const trainingSessions = trainings.length;
    const peopleTrained = trainings.reduce((acc, t) => acc + (t.number_of_persons || 0), 0);

    return {
      totalObservations,
      openObservations,
      closedObservations,
      totalTasks: totalObservations,
      activeTasks,
      awaitingReview,
      reworkRequired,
      completedTasks,
      overdueTasks,
      highRisk,
      mediumRisk,
      lowRisk,
      trainingSessions,
      peopleTrained
    };
  },

  async getEmployeeDashboardStats(employee_id: string | number) {
    const empIdNum = Number(employee_id);
    const observations = await this.getObservations();
    const myTasks = observations.filter(t => Number(t.assigned_to) === empIdNum).map(o => o.task!);

    const activeTasks = myTasks.filter(t => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS').length;
    const awaitingReview = myTasks.filter(t => t.status === 'SUBMITTED_FOR_REVIEW').length;
    const reworkRequired = myTasks.filter(t => t.status === 'REWORK_REQUIRED').length;
    const overdue = myTasks.filter(t => t.status === 'OVERDUE').length;
    const completed = myTasks.filter(t => t.status === 'COMPLETED').length;

    return {
      myTasks,
      activeTasks,
      awaitingReview,
      reworkRequired,
      overdue,
      completed
    };
  },

  /**
   * Upload an inspection photo to the Supabase storage bucket 'observation'
   */
  async uploadObservationPhoto(file: File): Promise<{ url: string; file_name: string; isCloud: boolean; error?: string }> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const cleanBase = file.name
          .substring(0, file.name.lastIndexOf('.'))
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .slice(0, 24);
        const filePath = `obs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${cleanBase}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from('observation')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (!error && data) {
          const { data: publicData } = supabase.storage
            .from('observation')
            .getPublicUrl(filePath);

          return {
            url: publicData.publicUrl,
            file_name: file.name,
            isCloud: true
          };
        } else if (error) {
          console.warn('Supabase storage upload error:', error);
          const fallbackUrl = await this.fileToDataUrl(file);
          return {
            url: fallbackUrl,
            file_name: file.name,
            isCloud: false,
            error: error.message
          };
        }
      } catch (err: any) {
        console.warn('Supabase storage upload exception:', err);
        const fallbackUrl = await this.fileToDataUrl(file);
        return {
          url: fallbackUrl,
          file_name: file.name,
          isCloud: false,
          error: err.message
        };
      }
    }

    const fallbackUrl = await this.fileToDataUrl(file);
    return {
      url: fallbackUrl,
      file_name: file.name,
      isCloud: false
    };
  },

  fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }
};
