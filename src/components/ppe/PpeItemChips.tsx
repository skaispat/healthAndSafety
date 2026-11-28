import React from 'react';
import { PpeItem, formatPpeItem, isFootwear } from '../../services/ppeService';

/* ==========================================================================
   PPE item chips with icons
   - Helmets: helmet icon filled with the issued colour (yellow / red / blue / white …)
   - Footwear: black safety-shoe icon
   ========================================================================== */

export const isHelmet = (item: string): boolean => /\b(helmets?|hard ?hats?|safety ?caps?)\b/i.test(item);

/** Colour words (English + common Hindi/Hinglish) → CSS colour. */
const COLOR_MAP: Record<string, string> = {
  yellow: '#facc15', peela: '#facc15', pila: '#facc15', peeli: '#facc15',
  red: '#dc2626', lal: '#dc2626', laal: '#dc2626',
  blue: '#2563eb', neela: '#2563eb', nila: '#2563eb', neeli: '#2563eb',
  'sky blue': '#38bdf8', 'light blue': '#7dd3fc', 'navy blue': '#1e3a8a', navy: '#1e3a8a',
  white: '#ffffff', safed: '#ffffff', sufed: '#ffffff', safeed: '#ffffff',
  green: '#16a34a', hara: '#16a34a', hari: '#16a34a',
  orange: '#f97316', narangi: '#f97316', kesariya: '#f97316', saffron: '#f97316',
  black: '#111827', kala: '#111827', kaala: '#111827', kali: '#111827',
  grey: '#9ca3af', gray: '#9ca3af', silver: '#cbd5e1',
  brown: '#92400e', bhura: '#92400e',
  pink: '#ec4899', gulabi: '#ec4899',
  purple: '#9333ea', jamuni: '#9333ea', violet: '#7c3aed',
  maroon: '#7f1d1d',
};

/** Resolve a typed colour name to a CSS colour, or null if unknown. */
export const resolvePpeColor = (name?: string | null): string | null => {
  const key = (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return null;
  if (COLOR_MAP[key]) return COLOR_MAP[key];
  // Last word fallback: "dark red" → red, "helmet yellow" → yellow
  const last = key.split(' ').pop()!;
  if (COLOR_MAP[last]) return COLOR_MAP[last];
  // Any valid CSS colour name / hex the user typed (e.g. "teal", "#ff0")
  if (typeof CSS !== 'undefined' && CSS.supports?.('color', key)) return key;
  return null;
};

/** Light colours need a visible outline. */
const isLight = (color: string) => {
  const c = color.toLowerCase();
  return ['#ffffff', 'white', '#facc15', '#cbd5e1', '#7dd3fc', 'yellow', 'silver'].includes(c);
};

export const HelmetIcon: React.FC<{ color: string; size?: number; title?: string }> = ({ color, size = 18, title }) => {
  const stroke = isLight(color) ? '#64748b' : 'rgba(0,0,0,0.45)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title} className="ppe-icon">
      {title && <title>{title}</title>}
      {/* dome */}
      <path d="M4.5 15.5a7.5 7.5 0 0 1 15 0v.5h-15z" fill={color} stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />
      {/* centre ridge */}
      <path d="M10.5 8.6V6.6a1.5 1.5 0 0 1 3 0v2" fill="none" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
      {/* brim */}
      <rect x="2" y="16" width="20" height="3" rx="1.5" fill={color} stroke={stroke} strokeWidth="1.2" />
      {/* shine */}
      <path d="M7.5 13a4.8 4.8 0 0 1 2.4-3" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
};

export const SafetyShoeIcon: React.FC<{ size?: number; title?: string }> = ({ size = 18, title }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title} className="ppe-icon">
    {title && <title>{title}</title>}
    {/* upper */}
    <path d="M3 16.5V7.5a1 1 0 0 1 1-1h3.5l1.2 3.2 4.6 1.6 5.6 1.4a2.4 2.4 0 0 1 2.1 2.4v1.4z" fill="#111827" />
    {/* laces */}
    <path d="M8.4 9.6l1.6-.9M9.4 11.2l1.7-.8" stroke="#9ca3af" strokeWidth="1" strokeLinecap="round" />
    {/* sole */}
    <rect x="2.5" y="16.5" width="19.5" height="2.6" rx="1.1" fill="#374151" />
  </svg>
);

/** Icon for one item, or null if the item has no special icon. */
export const PpeItemIcon: React.FC<{ item: PpeItem; size?: number }> = ({ item, size }) => {
  if (isFootwear(item.item)) return <SafetyShoeIcon size={size} title={`${item.item}${item.size ? `, size ${item.size}` : ''}`} />;
  if (isHelmet(item.item)) {
    const color = resolvePpeColor(item.color);
    return <HelmetIcon color={color || '#e5e7eb'} size={size} title={`${item.item}${item.color ? ` (${item.color})` : ''}`} />;
  }
  return null;
};

/** Chips for a list of issued PPE items. */
export const PpeItemChips: React.FC<{ items: PpeItem[] }> = ({ items }) =>
  items.length === 0 ? (
    <span className="form-hint">No items</span>
  ) : (
    <div className="ppe-chips">
      {items.map((i, idx) => {
        const footwear = isFootwear(i.item);
        const helmet = !footwear && isHelmet(i.item);
        const helmetColor = helmet ? resolvePpeColor(i.color) : null;
        return (
          <span key={idx} className="ppe-chip" title={formatPpeItem(i)}>
            <strong>{i.item}</strong>
            <span className="ppe-chip-qty">×{i.qty}</span>

            {/* Footwear: black shoe icon + size */}
            {footwear && (
              <span className="ppe-chip-icon-slot">
                <SafetyShoeIcon title={`${i.item}${i.size ? `, size ${i.size}` : ''}`} />
                {i.size && <span className="ppe-chip-color ppe-chip-size">Size {i.size}</span>}
              </span>
            )}

            {/* Helmet: colour name replaced by a helmet icon in that colour */}
            {helmet &&
              (helmetColor ? (
                <span className="ppe-chip-icon-slot" aria-label={`${i.color} helmet`}>
                  <HelmetIcon color={helmetColor} title={`${i.color} helmet`} />
                </span>
              ) : i.color ? (
                /* Unknown colour word: show a neutral helmet plus the typed name */
                <span className="ppe-chip-icon-slot">
                  <HelmetIcon color="#e5e7eb" title={`${i.color} helmet`} />
                  <span className="ppe-chip-color">{i.color}</span>
                </span>
              ) : (
                <span className="ppe-chip-icon-slot">
                  <HelmetIcon color="#e5e7eb" title="Helmet (colour not recorded)" />
                </span>
              ))}

            {/* Everything else: unchanged text labels */}
            {!footwear && !helmet && i.size && <span className="ppe-chip-color ppe-chip-size">Size {i.size}</span>}
            {!footwear && !helmet && i.color && <span className="ppe-chip-color">{i.color}</span>}
          </span>
        );
      })}
    </div>
  );
