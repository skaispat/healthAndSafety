import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { COMMON_PPE_ITEMS, COMMON_SHOE_SIZES, PPE_LIMITS, isFootwear } from '../../services/ppeService';

export interface PpeRow {
  key: string; // stable React key
  item: string;
  qty: string;
  color: string;
  size: string;
}

let rowSeq = 0;
export const newPpeRow = (item = '', qty = '1', color = '', size = ''): PpeRow => ({
  key: `ppe-row-${++rowSeq}`,
  item,
  qty,
  color,
  size,
});

interface Props {
  rows: PpeRow[];
  onChange: (rows: PpeRow[]) => void;
  rowErrors?: Record<number, string>;
  error?: string;
  disabled?: boolean;
}

/**
 * Key/value editor for issued_ppe: Item | Qty | Color-or-Size per row.
 * Footwear items (shoes / boots, incl. typos like "showes") ask for SIZE instead of colour.
 * Colour and size are kept separately, so switching the item never loses what was typed.
 */
export const PpeItemsEditor: React.FC<Props> = ({ rows, onChange, rowErrors = {}, error, disabled }) => {
  const update = (i: number, patch: Partial<PpeRow>) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => onChange(rows.length === 1 ? [newPpeRow()] : rows.filter((_, idx) => idx !== i));
  const add = () => rows.length < PPE_LIMITS.MAX_ITEMS && onChange([...rows, newPpeRow()]);

  return (
    <div className="form-group">
      <span className="form-label">
        Issued PPE <span className="required">*</span>
      </span>

      <div className="ppe-rows-head" aria-hidden="true">
        <span>Item</span>
        <span>Qty</span>
        <span>Color / Size</span>
        <span />
      </div>

      <div className="ppe-rows">
        {rows.map((r, i) => {
          const footwear = isFootwear(r.item);
          return (
            <div key={r.key} className={`ppe-row ${rowErrors[i] ? 'ppe-row-invalid' : ''}`}>
              <input
                className="form-input ppe-item-input"
                placeholder="Item (e.g. Safety Helmet)"
                list="ppe-item-suggestions"
                value={r.item}
                maxLength={PPE_LIMITS.MAX_ITEM_NAME}
                disabled={disabled}
                aria-label={`Item ${i + 1}`}
                onChange={(e) => update(i, { item: e.target.value })}
              />
              <input
                className="form-input ppe-qty-input"
                placeholder="Qty"
                inputMode="numeric"
                value={r.qty}
                maxLength={3}
                disabled={disabled}
                aria-label={`Quantity ${i + 1}`}
                onChange={(e) => update(i, { qty: e.target.value.replace(/\D/g, '') })}
              />
              {footwear ? (
                <input
                  className="form-input ppe-color-input ppe-size-input"
                  placeholder="Size (e.g. 8)"
                  list="ppe-shoe-sizes"
                  inputMode="text"
                  value={r.size}
                  maxLength={PPE_LIMITS.MAX_SIZE}
                  disabled={disabled}
                  aria-label={`Shoe size ${i + 1}`}
                  onChange={(e) => update(i, { size: e.target.value })}
                />
              ) : (
                <input
                  className="form-input ppe-color-input"
                  placeholder="Color (optional)"
                  value={r.color}
                  maxLength={PPE_LIMITS.MAX_COLOR}
                  disabled={disabled}
                  aria-label={`Color ${i + 1}`}
                  onChange={(e) => update(i, { color: e.target.value })}
                />
              )}
              <button
                type="button"
                className="btn btn-ghost ppe-row-remove"
                onClick={() => remove(i)}
                disabled={disabled}
                aria-label={`Remove item ${i + 1}`}
                title="Remove"
              >
                <Trash2 size={16} />
              </button>
              {rowErrors[i] && <span className="fine-field-error ppe-row-error">{rowErrors[i]}</span>}
            </div>
          );
        })}
      </div>

      <datalist id="ppe-item-suggestions">
        {COMMON_PPE_ITEMS.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <datalist id="ppe-shoe-sizes">
        {COMMON_SHOE_SIZES.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={add} disabled={disabled || rows.length >= PPE_LIMITS.MAX_ITEMS}>
          <Plus size={15} /> Add Item
        </button>
        <span className="form-hint">
          {rows.length}/{PPE_LIMITS.MAX_ITEMS} items · shoes/boots ask for size
        </span>
      </div>
      {error && <span className="fine-field-error">{error}</span>}
    </div>
  );
};
