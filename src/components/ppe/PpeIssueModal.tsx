import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import { todayIST } from '../../services/fineService';
import { Contractor, ContractorFineService } from '../../services/contractorFineService';
import { PpeIssue, PpeKind, PpeService, validatePpeItems } from '../../services/ppeService';
import { EmployeePicker } from './EmployeePicker';
import { PpeItemsEditor, PpeRow, newPpeRow } from './PpeItemsEditor';

interface Props {
  isOpen: boolean;
  /** 'employee' saves emp_id; 'contractor' saves contracto_id and leaves emp_id blank. */
  kind: PpeKind;
  /** Record to edit; null = create new. */
  issue: PpeIssue | null;
  onClose: () => void;
  onSaved: (issue: PpeIssue, mode: 'create' | 'update') => void;
}

type Emp = { emp_id: string; full_name: string; department?: string | null };
type Errors = { employee?: string; contractor?: string; date?: string; items?: string; form?: string };

export const PpeIssueModal: React.FC<Props> = ({ isOpen, kind, issue, onClose, onSaved }) => {
  const { showToast } = useToast();
  const isEdit = Boolean(issue);
  const isContractor = kind === 'contractor';
  const today = todayIST();

  const [employee, setEmployee] = useState<Emp | null>(null);
  const [conId, setConId] = useState('');
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [contractorsLoading, setContractorsLoading] = useState(false);
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
      setConId(issue.contracto_id != null ? String(issue.contracto_id) : '');
      setIssueDate(issue.issue_date || today);
      setRows(issue.items.length ? issue.items.map((i) => newPpeRow(i.item, String(i.qty), i.color || '', i.size || '')) : [newPpeRow()]);
    } else {
      setEmployee(null);
      setConId('');
      setIssueDate(today);
      setRows([newPpeRow()]);
    }
    setRowErrors({});
    setErrors({});
    setSaving(false);
    savingRef.current = false;
  }, [isOpen, issue?.id, kind]);

  // Contractor dropdown data (only for the contractor form)
  useEffect(() => {
    if (!isOpen || !isContractor) return;
    let cancelled = false;
    setContractorsLoading(true);
    ContractorFineService.getContractors()
      .then((list) => !cancelled && setContractors(list))
      .catch((err) => !cancelled && setErrors((p) => ({ ...p, contractor: err?.message || 'Could not load contractors.' })))
      .finally(() => !cancelled && setContractorsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isOpen, isContractor]);

  const selectedContractor = contractors.find((c) => String(c.id) === conId) || null;

  const handleClose = () => {
    if (savingRef.current) return;
    onClose();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (savingRef.current) return;

    const next: Errors = {};
    if (isContractor) {
      if (!conId) next.contractor = 'Please select a contractor.';
    } else if (!employee) {
      next.employee = 'Please select an employee.';
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) next.date = 'Please select the issue date.';
    else if (issueDate > today) next.date = 'Issue date cannot be in the future.';
    const v = validatePpeItems(rows);
    setRowErrors(v.rowErrors);
    if (v.error) next.items = v.error;
    setErrors(next);
    if (Object.keys(next).length > 0 || !v.items) return;

    savingRef.current = true;
    setSaving(true);
    try {
      let saved: PpeIssue;
      let who: string;
      if (isContractor) {
        const payload = { contracto_id: Number(conId), issue_date: issueDate, items: v.items };
        saved = issue ? await PpeService.updateForContractor(issue.id, payload) : await PpeService.createForContractor(payload);
        who = selectedContractor?.contractor_name || saved.contractor?.contractor_name || 'contractor';
      } else {
        const payload = { emp_id: employee!.emp_id, issue_date: issueDate, items: v.items };
        saved = issue ? await PpeService.update(issue.id, payload) : await PpeService.create(payload);
        who = employee!.full_name;
      }
      showToast({
        type: 'success',
        title: issue ? 'PPE Issue Updated' : 'PPE Issued',
        message: `${v.items.length} item(s) ${issue ? 'updated' : 'issued'} for ${who}.`,
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
      title={isEdit ? (isContractor ? 'Edit Contractor PPE Issue' : 'Edit PPE Issue') : isContractor ? 'Issue PPE to Contractor' : 'Issue PPE'}
      subtitle={
        isEdit ? `Record #${issue!.id}` : isContractor ? 'Record PPE handed over to a contractor' : 'Record PPE handed over to an employee'
      }
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

        {isContractor ? (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="ppe-contractor">
                Contractor <span className="required">*</span>
              </label>
              <select
                id="ppe-contractor"
                className="form-select"
                value={conId}
                disabled={saving || contractorsLoading}
                onChange={(e) => {
                  setConId(e.target.value);
                  setErrors((p) => ({ ...p, contractor: undefined }));
                }}
                aria-invalid={Boolean(errors.contractor)}
              >
                <option value="">{contractorsLoading ? 'Loading contractors...' : 'Select contractor'}</option>
                {contractors.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.contractor_name || `Contractor #${c.id}`}
                  </option>
                ))}
              </select>
              {errors.contractor && <span className="fine-field-error">{errors.contractor}</span>}
            </div>
            <div className="fine-form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="ppe-con-dept">Department</label>
                <input
                  id="ppe-con-dept"
                  className="form-input"
                  value={selectedContractor?.department || ''}
                  placeholder="Auto-filled"
                  readOnly
                  tabIndex={-1}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ppe-con-phone">Phone Number</label>
                <input
                  id="ppe-con-phone"
                  className="form-input"
                  value={selectedContractor?.phone_number || ''}
                  placeholder="Auto-filled"
                  readOnly
                  tabIndex={-1}
                />
              </div>
            </div>
          </>
        ) : (
          <EmployeePicker
            value={employee}
            onChange={(emp) => {
              setEmployee(emp ? { emp_id: emp.emp_id, full_name: emp.full_name, department: emp.department } : null);
              setErrors((p) => ({ ...p, employee: undefined }));
            }}
            error={errors.employee}
            disabled={saving}
          />
        )}

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
