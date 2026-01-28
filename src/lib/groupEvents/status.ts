export const GROUP_EVENT_STATUSES = [
  'draft',
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
] as const;

export type GroupEventStatus = (typeof GROUP_EVENT_STATUSES)[number];

export function isValidGroupEventStatus(v: unknown): v is GroupEventStatus {
  return GROUP_EVENT_STATUSES.includes(v as GroupEventStatus);
}
