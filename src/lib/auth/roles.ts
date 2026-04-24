export const VALID_APP_ROLES = ['admin', 'staff', 'viewer', 'porter'] as const;

export type AppRole = (typeof VALID_APP_ROLES)[number];

export function isValidAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && VALID_APP_ROLES.includes(value as AppRole);
}
