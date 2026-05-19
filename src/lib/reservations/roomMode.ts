export type ReservationRoomOption = {
  id: string;
  name: string;
};

const PARTY_ROOM_NAMES = new Set(['pub', 'disco']);

export function normalizeRoomName(name: string) {
  return name
    .trim()
    .replace(/\s+\(actual\)$/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function isPartyRoomName(name: string) {
  return PARTY_ROOM_NAMES.has(normalizeRoomName(name));
}

export function isPartyRoom(room: ReservationRoomOption) {
  return isPartyRoomName(room.name);
}

export function splitRoomsByReservationMode(rooms: ReservationRoomOption[]) {
  const partyRooms = rooms.filter(isPartyRoom);

  return {
    dinnerRooms: rooms.filter((room) => !isPartyRoom(room)),
    partyRooms,
    privatePartyRooms: partyRooms,
  };
}
