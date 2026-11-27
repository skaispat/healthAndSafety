import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import { todayIST } from '../../services/fineService';
import { PpeIssue, PpeService, validatePpeItems } from '../../services/ppeService';
import { EmployeePicker } from './EmployeePicker';
import { PpeItemsEditor, PpeRow, newPpeRow } from './PpeItemsEditor';

interface Props {
  isOpen: boolean;
  /** Record to edit; null = create new. */
  issue: PpeIssue | null;
  onClose: () => void;
  onSaved: (issue: PpeIssue, mode: 'create' | 'update') => void;
}

type Emp = { emp_id: string; full_name: string; department?: string | null };
type Errors = { employee?: string; date?: string; items?: string; form?: string };

export const PpeIssueModal: React.FC<Props> = ({ isOpen, issue, onClose, onSaved }) => {
  const { showToast } = useToast();
  const isEdit = Boolean(issue);
  const today = todayIST();

  const [employee, setEmployee] = useState<Emp | null>(null);
  const [issueDate, setIssueDate] = useState(today);
  const [rows, setRows] = useState<PpeRow[]>([newPpeRow()]);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Load record (edit) or reset (create) each time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    if (issue) {
      setEmployee(
        issue.emp_id
          ? {
              emp_id: issue.emp_id,
              full_name: issue.employee?.full_name || `Emp #${issue.emp_id}`,
              department: issue.employee?.department,
            }
          : null
      );
      setIssueDate(issue.issue_date || today);
      setRows(issue.items.length ? issue.items.map((i) => newPpeRow(i.item, String(i.qty), i.color || '', i.size || '')) : [newPpeRow()]);
    } else {
      setEmployee(null);
      setIssueDate(today);
      setRows([newPpeRow()]);
    }
    setRowErrors({});
    setErrors({});
    setSaving(false);
    savingRef.current = false;
  }, [isOpen, issue?.id]);

  const handleClose = () => {
    if (savingRef.current) return;
    onClose();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (savingRef.current) return;

    const next: Errors = {};
    if (!employee) next.employee = 'Please select an employee.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) next.date = 'Please select the issue date.';
    else if (issueDate > today) next.date = 'Issue date cannot be in the future.';
    const v = validatePpeItems(rows);
    setRowErrors(v.rowErrors);
    if (v.error) next.items = v.error;
    setErrors(next);
    if (Object.keys(next).length > 0 || !v.items || !employee) return;

    savingRef.current = true;
    setSaving(true);
    try {
      const payload = { emp_id: employee.emp_id, issue_date: issueDate, items: v.items };
      const saved = issue ? await PpeService.update(issue.id, payload) : await PpeService.create(payload);
      showToast({
        type: 'success',
        title: issue ? 'PPE Issue Updated' : 'PPE Issued',
        message: `${v.items.length} item(s) ${issue ? 'updated' : 'issued'} for ${employee.full_name}.`,
      });
      savingRef.current = false;
      setSaving(false);
      onSaved(saved, issue ? 'update' : 'create');
    } catch (err: any) {
      const msg = err?.message || 'Could not save. Please try again.';
      setErrors({ form: msg });
      showToast({ type: 'error', title: 'Not Saved', message: msg });
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      title={isEdit ? 'Edit PPE Issue' : 'Issue PPE'}
      subtitle={isEdit ? `Record #${issue!.id}` : 'Record PPE handed over to an employee'}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="ppe-issue-form" className="btn btn-primary" disabled={saving}>
            {saving ? (
              <>
                <Loader2 size={16} className="spin" /> Saving...
              </>
            ) : isEdit ? (
              'Save Changes'
            ) : (
              'Issue PPE'
            )}
          </button>
        </>
      }
    >
      <form id="ppe-issue-form" onSubmit={handleSubmit} noValidate>
        {errors.form && (
          <div className="fine-form-error" role="alert">
            <AlertCircle size={16} />
            <span>{errors.form}</span>
          </div>
        )}

        <EmployeePicker
          value={employee}
          onChange={(emp) => {
            setEmployee(emp ? { emp_id: emp.emp_id, full_name: emp.full_name, department: emp.department } : null);
            setErrors((p) => ({ ...p, employee: undefined }));
          }}
          error={errors.employee}
          disabled={saving}
        />

        <div className="form-group">
          <label className="form-label" htmlFor="ppe-date">
            Issue Date <span className="required">*</span>
          </label>
          <input
            id="ppe-date"
            type="date"
            className="form-input"
            value={issueDate}
            max={today}
            disabled={saving}
            onChange={(e) => setIssueDate(e.target.value)}
            aria-invalid={Boolean(errors.date)}
            style={{ maxWidth: 260 }}
          />
          {errors.date && <span className="fine-field-error">{errors.date}</span>}
        </div>

        <PpeItemsEditor rows={rows} onChange={setRows} rowErrors={rowErrors} error={errors.items} disabled={saving} />
      </form>
    </Modal>
  );
};
