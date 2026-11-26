import type { User } from '../types/database';

const normalise = (v: unknown): string =>
  String(v ?? '')
    .trim()
    .toUpperCase()
    .replace(/[_\s]+/g, ' ')
    .replace(/\s*&\s*/g, ' AND ');

const FINE_ALLOWED = new Set(['HEALTH AND SAFETY', 'SUPER ADMIN', 'SUPERADMIN']);

/**
 * Fine (Penalty) page access: position "Health And Safety" or "Super Admin".
 * The existing system ADMIN role (username/role = admin) is treated as Super Admin.
 */
export const canManageFines = (user: User | null | undefined): boolean => {
  if (!user) return false;
  const position = normalise(user.position);
  const rawRole = normalise((user as any).raw_role ?? user.role);
  return (
    FINE_ALLOWED.has(position) ||
    FINE_ALLOWED.has(rawRole) ||
    rawRole === 'ADMIN' ||
    user.role === 'ADMIN'
  );
};
