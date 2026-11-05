import type { Role } from '../api/client';

export function isStaff(role: Role): boolean {
  return role === 'attorney' || role === 'paralegal';
}

// Every role has one home page, also used when a bookmark belongs to another role.
export function homeFor(role: Role): string {
  if (role === 'plaintiff') {
    return '/plaintiff/leads';
  }
  if (isStaff(role)) {
    return '/firm/leads';
  }
  return '/admin/leads';
}

/** Only restore bookmarks within this user's portal. */
export function returnTo(role: Role, from: unknown): string {
  const home = homeFor(role);
  const portalPrefix = home.slice(0, home.lastIndexOf('/') + 1);
  if (typeof from === 'string' && from.startsWith(portalPrefix)) {
    return from;
  }
  return home;
}
