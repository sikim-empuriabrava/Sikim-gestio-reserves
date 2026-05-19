import type { ReservationEventMode } from '@/types/reservation';

export const RESERVATION_EVENT_MODE_LABELS: Record<ReservationEventMode, string> = {
  dinner: 'Cena',
  dinner_private_party: 'Cena + fiesta privada',
  private_party_only: 'Solo fiesta privada',
};

export function getReservationEventModeLabel(eventMode?: ReservationEventMode | null) {
  return RESERVATION_EVENT_MODE_LABELS[eventMode ?? 'dinner'];
}

export function usesDinnerRoom(eventMode?: ReservationEventMode | null) {
  return eventMode !== 'private_party_only';
}

export function usesPartyRoom(eventMode?: ReservationEventMode | null) {
  return eventMode === 'dinner_private_party' || eventMode === 'private_party_only';
}

export function usesFood(eventMode?: ReservationEventMode | null) {
  return eventMode !== 'private_party_only';
}
