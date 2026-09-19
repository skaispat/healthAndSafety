export type UserRole = 'HEALTH_SAFETY_OFFICER' | 'EMPLOYEE';

export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type TaskStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED_FOR_REVIEW'
  | 'REWORK_REQUIRED'
  | 'COMPLETED'
  | 'OVERDUE'
  | 'CLOSED';

export type ObservationStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED_FOR_REVIEW'
  | 'REWORK_REQUIRED'
  | 'COMPLETED'
  | 'OVERDUE'
  | 'CLOSED';

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'CORRECTIVE_SUBMITTED'
  | 'REWORK_REQUESTED'
  | 'TASK_COMPLETED'
  | 'TASK_OVERDUE'
  | 'CHAT_MESSAGE'
  | 'USER_MENTIONED'
  | 'PARTICIPANT_ADDED';

export type ParticipantReason = 'MENTION' | 'MANUALLY_ADDED';

export interface Department {
  dept_id: number;
  dept_name?: string; // column in departments table
  id: string; // alias for String(dept_id)
  name: string; // alias for dept_name
  code?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  // Exact columns from public.users table (PK: emp_id):
  emp_id: number;
  created_at: string;
  full_name: string;
  username: string;
  password?: string | null;
  department?: Department | string;
  department_name?: string | null;
  role: string;
  status: string; // 'active'
  user_access?: string | null;
  dept_id?: number | null;
  mobile_number?: string | null;
  retail_access?: string | null;
  position?: string | null;

  // Frontend compatibility helpers:
  id: string; // String(emp_id)
  employee_id: string; // String(emp_id)
  email: string; // username
  phone?: string | null;
  department_id?: string | null;
  is_active: boolean;
  profile_photo?: string | null;
  auth_user_id?: string | null;
  updated_at?: string;
}

export interface ObservationPhoto {
  id: string;
  observation_id: string;
  photo_url: string;
  file_name?: string;
  photo_type?: 'INITIAL' | 'CORRECTIVE';
  uploaded_by?: number | string | null;
  created_at: string;
}

// Unified Single Table for Observation & Assigned Task
export interface Observation {
  id: string;
  sr_no?: number;
  observation_number?: string;
  created_by: number | string; // references users(emp_id)
  dept_id: number; // references departments(dept_id)
  department_id?: string; // String(dept_id)
  area: string;
  observation_text: string;
  solution_text?: string | null;
  priority: PriorityLevel;
  risk_min: number;
  risk_max: number;
  assigned_to: number | string; // references users(emp_id)
  due_date?: string;
  status: ObservationStatus;
  corrective_action?: string | null;
  rework_reason?: string | null;
  is_personal: boolean;
  closed_by?: number | string | null;
  closed_at?: string | null;
  completed_at?: string | null;
  completed_by?: number | string | null;
  created_at: string;
  updated_at: string;

  // Relations
  department?: Department;
  creator?: User;
  assignee?: User;
  photos?: ObservationPhoto[];
  initial_photos?: ObservationPhoto[];
  corrective_photos?: ObservationPhoto[];
  all_photos?: ObservationPhoto[];
  history?: ObservationHistoryItem[];
  task?: Task; // Backwards compatibility alias
}

export interface CorrectiveActionPhoto {
  id: string;
  corrective_action_id: string;
  photo_url: string;
  file_name?: string;
  uploaded_by?: number | string;
  created_at: string;
}

export interface CorrectiveAction {
  id: string;
  task_id: string;
  submitted_by: number | string;
  action_description: string;
  attempt_number: number;
  submitted_at: string;
  rework_reason?: string | null;
  reworked_at?: string | null;
  reworked_by?: number | string | null;
  status?: string; // 'SUBMITTED' | 'REWORK_REQUIRED' | 'APPROVED'

  // Relations
  submitter?: User;
  photos?: CorrectiveActionPhoto[];
}

export interface ObservationHistoryItem {
  id: string;
  observation_id: string;
  action_type: string;
  attempt_number: number;
  description: string;
  rework_reason?: string | null;
  performed_by: number | string;
  previous_status?: string | null;
  new_status?: string | null;
  photos?: { url: string; file_name?: string }[];
  created_at: string;

  // Relations
  performer?: User;
}

export interface TaskHistory {
  id: string;
  task_id: string;
  action_type: string;
  attempt_number?: number;
  description: string;
  rework_reason?: string | null;
  performed_by: number | string;
  previous_status?: string | null;
  new_status?: string | null;
  photos?: { url: string; file_name?: string }[];
  created_at: string;

  // Relations
  performer?: User;
}

export interface TaskParticipant {
  id: string;
  task_id: string;
  user_id: number | string;
  added_by: number | string;
  reason: ParticipantReason;
  created_at: string;

  // Relations
  user?: User;
  added_by_user?: User;
}

export interface TaskMessage {
  id: string;
  task_id: string;
  sender_id: number | string;
  message: string;
  created_at: string;
  updated_at: string;

  // Relations
  sender?: User;
}

export interface Task {
  id: string;
  task_number: string;
  observation_id: string;
  assigned_to: number | string;
  assigned_by: number | string;
  status: TaskStatus | ObservationStatus;
  due_date: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  completed_by?: number | string | null;
  rework_reason?: string | null;

  // Relations
  observation?: Observation;
  assignee?: User;
  assigner?: User;
  completer?: User;
  photos?: ObservationPhoto[];
  initial_photos?: ObservationPhoto[];
  corrective_photos?: ObservationPhoto[];
  all_photos?: ObservationPhoto[];
  corrective_actions?: CorrectiveAction[];
  history?: TaskHistory[];
  participants?: TaskParticipant[];
  messages?: TaskMessage[];
}

export interface Notification {
  id: string;
  user_id: number | string; // references users(emp_id)
  task_id?: string | null;
  observation_id?: string | null;
  notification_type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface TrainingPhoto {
  id: string;
  training_id: string;
  photo_url: string;
  file_name?: string;
  uploaded_by?: number | string;
  created_at: string;
}

export interface TrainingRecord {
  id: string;
  training_number: string;
  created_by: number | string;
  department_id: string;
  dept_id?: number;
  number_of_persons: number;
  training_topic: string;
  description: string;
  training_date: string;
  created_at: string;
  updated_at: string;

  // Relations
  department?: Department;
  creator?: User;
  photos?: TrainingPhoto[];
}

// Priority to Risk Mapping constant
export const PRIORITY_RISK_MAP: Record<PriorityLevel, { min: number; max: number; label: string }> = {
  LOW: { min: 1.0, max: 3.0, label: '1% – 3%' },
  MEDIUM: { min: 3.0, max: 6.0, label: '3% – 6%' },
  HIGH: { min: 6.0, max: 9.0, label: '6% – 9%' },
};

export type OfficerTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'PARTIALLY_DONE' | 'DONE';

export interface OfficerSelfTask {
  id: string;
  task_number: string; // e.g. "ST-2026-001"
  title: string;
  description?: string;
  department: string;
  dept_id?: number;
  area: string;
  priority: PriorityLevel;
  status: OfficerTaskStatus;
  progress_percent: number; // 0, 25, 50, 75, 100
  due_date: string;
  remarks?: string;
  observation?: string;
  solution?: string;
  completed_at?: string;
  created_by: number; // officer emp_id
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

