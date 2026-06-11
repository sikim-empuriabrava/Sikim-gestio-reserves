'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReservationEventMode, Turno } from '@/types/reservation';
import {
  RESERVATION_EVENT_MODE_LABELS,
  usesDinnerRoom,
  usesFood,
  usesPartyRoom,
} from '@/lib/reservations/eventMode';
import { splitRoomsByReservationMode } from '@/lib/reservations/roomMode';
import { CalendarDaysIcon, CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

type ReservationOfferingKind = 'cheffing_menu' | 'cheffing_card';

type ReservationOfferingCatalogItem = {
  id: string;
  kind: ReservationOfferingKind;
  display_name: string;
  price_eur: number | null;
  source_id: string;
  segundos: {
    id: string;
    code: string;
    nombre: string;
    descripcion: string;
    needsDonenessPoints: boolean;
    menu_item_id?: string;
  }[];
};

type EntrecotPoints = {
  crudo: number;
  poco: number;
  alPunto: number;
  hecho: number;
  muyHecho: number;
};

type CustomSecondKind = 'custom_menu' | 'kids_menu';

type CustomSecond = {
  id: string;
  name: string;
  cantidad: number;
  kind: CustomSecondKind;
  notes?: string;
};

type SelectedSecond = {
  dishId: string;
  menuItemId: string | null;
  nombre: string;
  descripcion: string;
  needsDonenessPoints: boolean;
  cantidad: number;
};

type OfferingAssignmentDraft = {
  id: string;
  catalogId: string;
  assignedPax: number;
  notes?: string | null;
  isExpanded: boolean;
  menuDetails: AssignmentMenuDetails;
};

type AssignmentMenuDetails = {
  segundosSeleccionados: SelectedSecond[];
  customSeconds: CustomSecond[];
  entrecotPoints: EntrecotPoints;
  donenessCollapsed: boolean;
};

type RoomOption = {
  id: string;
  name: string;
};

type CreateReservationStatus = 'confirmed' | 'draft';

const EVENT_MODE_OPTIONS: ReservationEventMode[] = ['dinner', 'dinner_private_party', 'private_party_only'];
const toNonNegativeInt = (value: number | null | undefined) => Math.max(0, Math.floor(Number(value ?? 0) || 0));
const toPositiveInt = (value: number | null | undefined) => Math.max(1, toNonNegativeInt(value));
const createEmptyAssignmentMenuDetails = (): AssignmentMenuDetails => ({
  segundosSeleccionados: [],
  customSeconds: [],
  entrecotPoints: {
    crudo: 0,
    poco: 0,
    alPunto: 0,
    hecho: 0,
    muyHecho: 0,
  },
  donenessCollapsed: true,
});

const createOfferingAssignmentDraft = (catalogId = '', assignedPax = 1): OfferingAssignmentDraft => ({
  id:
    globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `offering-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  catalogId,
  assignedPax: toPositiveInt(assignedPax),
  notes: null,
  isExpanded: true,
  menuDetails: createEmptyAssignmentMenuDetails(),
});

const parseIntegerDraft = (value: string, min: number) => {
  if (value === '') {
    return { draft: '', parsed: null };
  }

  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Math.max(min, parseInt(value, 10));
  return { draft: String(parsed), parsed };
};

const omitRecordKey = (record: Record<string, string>, key: string) => {
  const next = { ...record };
  delete next[key];
  return next;
};

function ReservasNewPilotStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          body:has(.reservas-new-pilot) {
            background: #11100e;
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) {
            max-width: none;
            gap: 0;
            padding: 0;
            background:
              radial-gradient(circle at 18% 0%, rgba(156, 117, 70, 0.10), transparent 26rem),
              linear-gradient(135deg, #171614 0%, #11100e 52%, #0f0e0d 100%);
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) > aside {
            width: 18.5rem;
            border-right: 1px solid rgba(120, 103, 82, 0.30);
            background: linear-gradient(180deg, rgba(29, 28, 25, 0.98), rgba(20, 19, 17, 0.98));
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) > aside > div {
            top: 0;
            min-height: 100dvh;
            padding: 1rem;
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) > div {
            min-width: 0;
            gap: 0;
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) > div > header {
            border-radius: 0;
            border-width: 0 0 1px 0;
            border-color: rgba(120, 103, 82, 0.28);
            background: rgba(18, 17, 15, 0.88);
            box-shadow: none;
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) > div > header > div > div:first-child {
            display: none;
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) > div > header > div {
            justify-content: flex-end;
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) footer {
            display: none;
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) aside nav > div {
            border-color: rgba(120, 103, 82, 0.22);
            background: transparent;
            box-shadow: none;
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) aside nav button {
            background: rgba(28, 27, 24, 0.62);
            color: #efe8dc;
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) aside nav a[aria-current="page"] {
            background: rgba(150, 112, 66, 0.22);
            color: #f1c98f;
            box-shadow: inset 0 0 0 1px rgba(194, 144, 82, 0.20);
          }

          .aforo-standalone-shell:has(.reservas-new-pilot) a {
            color: inherit;
          }

          .reservas-new-pilot .card {
            border-color: rgba(74, 63, 50, 0.72);
            background: rgba(24, 23, 21, 0.95);
            box-shadow: 0 24px 80px -56px rgba(0, 0, 0, 0.95), inset 0 1px 0 rgba(255, 255, 255, 0.035);
            backdrop-filter: none;
          }

          .reservas-new-pilot .input {
            border-color: rgba(74, 63, 50, 0.82);
            background: rgba(18, 17, 15, 0.90);
            color: #f4ede3;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025);
          }

          .reservas-new-pilot .input::placeholder {
            color: #786f64;
          }

          .reservas-new-pilot .input:focus {
            border-color: rgba(214, 167, 110, 0.78);
            outline: none;
            box-shadow: 0 0 0 2px rgba(214, 167, 110, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.035);
          }

          .reservas-new-pilot .label {
            color: #cfc4b5;
            font-weight: 500;
          }

          .reservas-new-pilot [class*="text-slate-500"] {
            color: #786f64;
          }

          .reservas-new-pilot [class*="text-slate-400"] {
            color: #9d9285;
          }

          .reservas-new-pilot [class*="text-slate-300"],
          .reservas-new-pilot [class*="text-slate-200"],
          .reservas-new-pilot [class*="text-slate-100"],
          .reservas-new-pilot .text-white {
            color: #efe8dc;
          }

          .reservas-new-pilot [class*="border-slate-800"],
          .reservas-new-pilot [class*="border-slate-700"] {
            border-color: rgba(74, 63, 50, 0.72);
          }

          .reservas-new-pilot [class*="bg-slate-950"] {
            background-color: rgba(18, 17, 15, 0.78);
          }

          .reservas-new-pilot [class*="bg-slate-900"],
          .reservas-new-pilot [class*="bg-slate-800"] {
            background-color: rgba(31, 29, 25, 0.74);
          }

          .reservas-new-pilot [class*="text-primary"] {
            color: #f0c58b;
          }

          .reservas-new-pilot [class*="bg-primary"] {
            background-color: rgba(125, 89, 50, 0.30);
          }

          .reservas-new-pilot [class*="border-primary"] {
            border-color: rgba(214, 167, 110, 0.38);
          }

          .reservas-new-pilot .private-party-mode-card {
            border-color: rgba(151, 113, 72, 0.72) !important;
            background: linear-gradient(135deg, rgba(31, 28, 23, 0.98), rgba(20, 18, 15, 0.98)) !important;
            color: #f5eee4 !important;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.045);
          }

          .reservas-new-pilot .private-party-mode-card:hover {
            border-color: rgba(214, 167, 110, 0.82) !important;
            background: linear-gradient(135deg, rgba(38, 33, 27, 0.98), rgba(24, 22, 18, 0.98)) !important;
          }

          .reservas-new-pilot .private-party-mode-card--active {
            border-color: rgba(232, 177, 107, 0.86) !important;
            background: linear-gradient(135deg, rgba(83, 45, 18, 0.98), rgba(45, 30, 18, 0.98)) !important;
            box-shadow: 0 18px 42px -34px rgba(232, 177, 107, 0.82), inset 0 1px 0 rgba(255,255,255,0.06);
          }

          .reservas-new-pilot .private-party-mode-title {
            color: #fff4df !important;
          }

          .reservas-new-pilot .private-party-mode-description {
            color: #d9c7b4 !important;
          }

          .reservas-new-pilot .private-party-mode-switch {
            border-color: rgba(143, 112, 78, 0.86) !important;
            background: #11100e !important;
          }

          .reservas-new-pilot .private-party-mode-switch--active {
            border-color: rgba(246, 204, 145, 0.76) !important;
            background: linear-gradient(180deg, #f0bd73, #c47a2e) !important;
          }

          .reservas-new-pilot .private-party-mode-knob {
            background: #fff8ec !important;
            box-shadow: 0 1px 4px rgba(0,0,0,0.28);
          }

          :root[data-theme="light"] .reservas-new-pilot .private-party-mode-card {
            border-color: #d4b38c !important;
            background: linear-gradient(135deg, #fffaf1, #fbf0df) !important;
            color: #302820 !important;
            box-shadow: 0 16px 36px -30px rgba(121, 78, 34, 0.48), inset 0 1px 0 rgba(255,255,255,0.9);
          }

          :root[data-theme="light"] .reservas-new-pilot .private-party-mode-card:hover {
            border-color: #bd8547 !important;
            background: linear-gradient(135deg, #fff7ea, #f6dfbf) !important;
          }

          :root[data-theme="light"] .reservas-new-pilot .private-party-mode-card--active {
            border-color: #c97d32 !important;
            background: linear-gradient(135deg, #ffe6bf, #f7c98e) !important;
            box-shadow: 0 18px 42px -30px rgba(143, 74, 24, 0.52), inset 0 1px 0 rgba(255,255,255,0.86);
          }

          :root[data-theme="light"] .reservas-new-pilot .private-party-mode-title {
            color: #29231d !important;
          }

          :root[data-theme="light"] .reservas-new-pilot .private-party-mode-description {
            color: #635242 !important;
          }

          :root[data-theme="light"] .reservas-new-pilot .private-party-mode-switch {
            border-color: #c5a37a !important;
            background: #efe0cc !important;
          }

          :root[data-theme="light"] .reservas-new-pilot .private-party-mode-switch--active {
            border-color: #b96524 !important;
            background: linear-gradient(180deg, #d98535, #b76522) !important;
          }

          .reservas-new-pilot .button-primary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            border-radius: 0.75rem;
            border: 1px solid rgba(225, 181, 121, 0.55);
            background: #d9b27c;
            color: #19120b;
            padding: 0.75rem 1.25rem;
            font-size: 0.875rem;
            font-weight: 700;
            transition: background-color 160ms ease, border-color 160ms ease, transform 160ms ease;
          }

          .reservas-new-pilot .button-primary:hover {
            background: #e4bf89;
            border-color: rgba(239, 202, 146, 0.75);
          }

          .reservas-new-pilot .button-primary:active {
            transform: translateY(1px);
          }

          .reservas-new-pilot .button-primary:disabled {
            opacity: 0.58;
            cursor: not-allowed;
          }

          .reservas-new-pilot .button-secondary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            border-radius: 0.75rem;
            border: 1px solid rgba(74, 63, 50, 0.85);
            background: rgba(21, 20, 18, 0.86);
            color: #efe8dc;
            padding: 0.625rem 0.95rem;
            font-size: 0.875rem;
            font-weight: 600;
            transition: background-color 160ms ease, border-color 160ms ease, transform 160ms ease;
          }

          .reservas-new-pilot .button-secondary:hover {
            border-color: rgba(139, 106, 67, 0.70);
            background: #211f1b;
          }

          .reservas-new-pilot .button-secondary:active {
            transform: translateY(1px);
          }

          .reservas-new-pilot .reservation-modal-overlay {
            background: rgba(8, 7, 5, 0.76);
            backdrop-filter: blur(8px);
          }

          .reservas-new-pilot .reservation-modal-panel {
            border-color: rgba(91, 73, 52, 0.75);
            background: #181715;
            color: #efe8dc;
            box-shadow: 0 28px 90px -48px rgba(0, 0, 0, 0.98), inset 0 1px 0 rgba(255, 255, 255, 0.04);
          }
        `,
      }}
    />
  );
}

export default function NuevaReservaClient() {
  const router = useRouter();
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 16));
  const [turno, setTurno] = useState<Turno>('cena');
  const [nombreReserva, setNombreReserva] = useState('');
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [numeroPersonas, setNumeroPersonas] = useState(2);
  const [numeroPersonasInput, setNumeroPersonasInput] = useState('2');
  const [eventMode, setEventMode] = useState<ReservationEventMode>('dinner');
  const [offeringAssignments, setOfferingAssignments] = useState<OfferingAssignmentDraft[]>([
    {
      id: 'new-offering-initial',
      catalogId: '',
      assignedPax: 2,
      notes: null,
      isExpanded: true,
      menuDetails: createEmptyAssignmentMenuDetails(),
    },
  ]);
  const [intolerancias, setIntolerancias] = useState('');
  const [notasSala, setNotasSala] = useState('');
  const [notasCocina, setNotasCocina] = useState('');
  const [mesa, setMesa] = useState('');
  const [segundosSeleccionados] = useState<SelectedSecond[]>([]);
  const [segundoQuantityDrafts, setSegundoQuantityDrafts] = useState<Record<string, string>>({});
  const [customSecondQuantityDrafts, setCustomSecondQuantityDrafts] = useState<Record<string, string>>({});
  const [entrecotPoints] = useState<EntrecotPoints>({
    crudo: 0,
    poco: 0,
    alPunto: 0,
    hecho: 0,
    muyHecho: 0,
  });
  const [customSeconds, setCustomSeconds] = useState<CustomSecond[]>([]);
  const [isCustomMenuModalOpen, setIsCustomMenuModalOpen] = useState(false);
  const [isKidsMenuModalOpen, setIsKidsMenuModalOpen] = useState(false);
  const [customMenuName, setCustomMenuName] = useState('');
  const [customMenuCantidad, setCustomMenuCantidad] = useState(1);
  const [customMenuCantidadDraft, setCustomMenuCantidadDraft] = useState('1');
  const [customMenuNotes, setCustomMenuNotes] = useState('');
  const [customSecondTargetAssignmentId, setCustomSecondTargetAssignmentId] = useState<string | null>(null);
  const [kidsMenuName, setKidsMenuName] = useState('Menú infantil');
  const [kidsMenuCantidad, setKidsMenuCantidad] = useState(1);
  const [kidsMenuCantidadDraft, setKidsMenuCantidadDraft] = useState('1');
  const [kidsMenuNotes, setKidsMenuNotes] = useState('');
  const [warningMenus, setWarningMenus] = useState<string | null>(null);
  const [warningEntrecot, setWarningEntrecot] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [roomId, setRoomId] = useState<string>('');
  const [partyRoomId, setPartyRoomId] = useState<string>('');
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [loadRoomsError, setLoadRoomsError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingStatus, setSubmittingStatus] = useState<CreateReservationStatus | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [calendarWarning, setCalendarWarning] = useState<string | null>(null);
  const [offerings, setOfferings] = useState<ReservationOfferingCatalogItem[]>([]);
  const [offeringsLoading, setOfferingsLoading] = useState(true);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const [donenessCollapsed, setDonenessCollapsed] = useState(true);
  const isSubmittingRef = useRef(false);

  const primaryOfferingAssignment = useMemo(
    () => offeringAssignments.find((assignment) => assignment.catalogId) ?? offeringAssignments[0] ?? null,
    [offeringAssignments],
  );
  const selectedOffering = useMemo(
    () =>
      primaryOfferingAssignment?.catalogId
        ? offerings.find((offering) => offering.id === primaryOfferingAssignment.catalogId) ?? null
        : null,
    [offerings, primaryOfferingAssignment],
  );
  const finalizeSubmit = () => {
    setIsSubmitting(false);
    setSubmittingStatus(null);
    isSubmittingRef.current = false;
  };
  const isSelectedOfferingMenu = selectedOffering?.kind === 'cheffing_menu';
  const isPrivatePartyOnly = eventMode === 'private_party_only';
  const shouldUseDinnerRoom = usesDinnerRoom(eventMode);
  const shouldUsePartyRoom = usesPartyRoom(eventMode);
  const shouldUseFood = usesFood(eventMode);
  const { dinnerRooms, partyRooms } = useMemo(() => splitRoomsByReservationMode(rooms), [rooms]);
  const isRoomSelectionValid = !shouldUseDinnerRoom || Boolean(roomId && dinnerRooms.some((room) => room.id === roomId));
  const isPartyRoomSelectionValid =
    !shouldUsePartyRoom || Boolean(partyRoomId && partyRooms.some((room) => room.id === partyRoomId));
  const customMenusCount = useMemo(
    () =>
      offeringAssignments.reduce(
        (sum, assignment) => sum + assignment.menuDetails.customSeconds.reduce((lineSum, custom) => lineSum + custom.cantidad, 0),
        0,
      ),
    [offeringAssignments],
  );
  const totalAssignedPax = useMemo(
    () =>
      offeringAssignments
        .filter((assignment) => assignment.catalogId)
        .reduce((sum, assignment) => sum + toPositiveInt(assignment.assignedPax), 0),
    [offeringAssignments],
  );
  const hasOfferingPaxMismatch = shouldUseFood && totalAssignedPax !== numeroPersonas;
  const primaryAssignedPax = primaryOfferingAssignment?.catalogId
    ? toPositiveInt(primaryOfferingAssignment.assignedPax)
    : numeroPersonas;

  const parsePositivePaxInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 1) return null;

    return parsed;
  };

  const handleNumeroPersonasChange = (value: string) => {
    setNumeroPersonasInput(value);

    const parsed = parsePositivePaxInput(value);
    if (parsed !== null) {
      setNumeroPersonas(parsed);
      setOfferingAssignments((prev) =>
        prev.length === 1 ? prev.map((assignment) => ({ ...assignment, assignedPax: parsed })) : prev,
      );
    }
  };

  const updateOfferingAssignment = (id: string, updates: Partial<OfferingAssignmentDraft>) => {
    setOfferingAssignments((prev) =>
      prev.map((assignment) => (assignment.id === id ? { ...assignment, ...updates } : assignment)),
    );
  };

  const updateAssignmentMenuDetails = (
    assignmentId: string,
    updater: (details: AssignmentMenuDetails) => AssignmentMenuDetails,
  ) => {
    setOfferingAssignments((prev) =>
      prev.map((assignment) =>
        assignment.id === assignmentId
          ? {
              ...assignment,
              menuDetails: updater(assignment.menuDetails),
            }
          : assignment,
      ),
    );
  };

  const handleOfferingCatalogChange = (id: string, catalogId: string) => {
    updateOfferingAssignment(id, {
      catalogId,
      isExpanded: true,
      menuDetails: createEmptyAssignmentMenuDetails(),
    });
  };

  const toggleOfferingAssignmentExpanded = (id: string) => {
    setOfferingAssignments((prev) =>
      prev.map((assignment) =>
        assignment.id === id ? { ...assignment, isExpanded: !assignment.isExpanded } : assignment,
      ),
    );
  };

  const handleOfferingPaxChange = (id: string, value: string) => {
    const parsed = parseIntegerDraft(value, 1);
    if (!parsed || parsed.parsed === null) return;
    updateOfferingAssignment(id, { assignedPax: parsed.parsed });
  };

  const addOfferingAssignment = () => {
    const usedCatalogIds = new Set(offeringAssignments.map((assignment) => assignment.catalogId).filter(Boolean));
    const nextCatalogId = offerings.find((offering) => !usedCatalogIds.has(offering.id))?.id ?? '';
    const remainingPax = Math.max(1, numeroPersonas - totalAssignedPax);
    setOfferingAssignments((prev) => [...prev, createOfferingAssignmentDraft(nextCatalogId, remainingPax)]);
  };

  const removeOfferingAssignment = (id: string) => {
    const isPrimaryRow = primaryOfferingAssignment?.id === id;
    setOfferingAssignments((prev) => {
      const next = prev.filter((assignment) => assignment.id !== id);
      return next.length > 0 ? next : [createOfferingAssignmentDraft('', numeroPersonas)];
    });
    if (isPrimaryRow) {
      resetMenuDependentState();
    }
  };

  const updateEntrecotPoint = (assignmentId: string, key: keyof EntrecotPoints, value: number) => {
    updateAssignmentMenuDetails(assignmentId, (details) => ({
      ...details,
      entrecotPoints: {
        ...details.entrecotPoints,
        [key]: Math.max(0, value),
      },
    }));
  };

  const handleSegundoChange = (
    assignmentId: string,
    segundo: ReservationOfferingCatalogItem['segundos'][number],
    cantidad: number,
  ) => {
    updateAssignmentMenuDetails(assignmentId, (details) => {
      const existing = details.segundosSeleccionados.find((s) => s.dishId === segundo.id);
      const segundosSeleccionados = existing
        ? details.segundosSeleccionados.map((s) =>
            s.dishId === segundo.id
              ? {
                  ...s,
                  cantidad,
                  menuItemId: segundo.menu_item_id ?? null,
                  descripcion: segundo.descripcion,
                  needsDonenessPoints: segundo.needsDonenessPoints,
                }
              : s,
          )
        : [
            ...details.segundosSeleccionados,
            {
              dishId: segundo.id,
              menuItemId: segundo.menu_item_id ?? null,
              nombre: segundo.nombre,
              descripcion: segundo.descripcion,
              needsDonenessPoints: segundo.needsDonenessPoints,
              cantidad,
            },
          ];

      return {
        ...details,
        segundosSeleccionados,
      };
    });
  };

  const handleSegundoQuantityChange = (
    assignmentId: string,
    segundo: ReservationOfferingCatalogItem['segundos'][number],
    value: string,
  ) => {
    const parsed = parseIntegerDraft(value, 0);
    if (!parsed) return;

    const draftKey = `${assignmentId}:${segundo.id}`;
    setSegundoQuantityDrafts((prev) => ({ ...prev, [draftKey]: parsed.draft }));
    if (parsed.parsed !== null) {
      handleSegundoChange(assignmentId, segundo, parsed.parsed);
    }
  };

  const handleSegundoQuantityBlur = (
    assignmentId: string,
    segundo: ReservationOfferingCatalogItem['segundos'][number],
  ) => {
    const assignment = offeringAssignments.find((entry) => entry.id === assignmentId);
    const quantity =
      assignment?.menuDetails.segundosSeleccionados.find((selection) => selection.dishId === segundo.id)?.cantidad ?? 0;
    const draftKey = `${assignmentId}:${segundo.id}`;
    setSegundoQuantityDrafts((prev) => omitRecordKey(prev, draftKey));
    handleSegundoChange(assignmentId, segundo, Math.max(0, quantity));
  };

  const handleCustomSecondQuantityChange = (assignmentId: string, id: string, value: string) => {
    const parsed = parseIntegerDraft(value, 1);
    if (!parsed) return;

    const draftKey = `${assignmentId}:${id}`;
    setCustomSecondQuantityDrafts((prev) => ({ ...prev, [draftKey]: parsed.draft }));
    if (parsed.parsed !== null) {
      updateCustomSecond(assignmentId, id, { cantidad: parsed.parsed });
    }
  };

  const handleCustomSecondQuantityBlur = (assignmentId: string, custom: CustomSecond) => {
    const quantity = Math.max(1, custom.cantidad || 1);
    updateCustomSecond(assignmentId, custom.id, { cantidad: quantity });
    setCustomSecondQuantityDrafts((prev) => omitRecordKey(prev, `${assignmentId}:${custom.id}`));
  };

  const handleModalQuantityChange = (value: string, setter: (value: number) => void, draftSetter: (value: string) => void) => {
    const parsed = parseIntegerDraft(value, 1);
    if (!parsed) return;

    draftSetter(parsed.draft);
    if (parsed.parsed !== null) {
      setter(parsed.parsed);
    }
  };

  const handleCreateCustomMenu = () => {
    if (!customMenuName.trim() || !customSecondTargetAssignmentId) {
      return;
    }
    updateAssignmentMenuDetails(customSecondTargetAssignmentId, (details) => ({
      ...details,
      customSeconds: [
        ...details.customSeconds,
        {
          id: crypto.randomUUID(),
          kind: 'custom_menu',
          name: customMenuName.trim(),
          cantidad: Math.max(1, customMenuCantidad || 1),
          notes: customMenuNotes.trim() || undefined,
        },
      ],
    }));
    setCustomMenuName('');
    setCustomMenuCantidad(1);
    setCustomMenuCantidadDraft('1');
    setCustomMenuNotes('');
    setCustomSecondTargetAssignmentId(null);
    setIsCustomMenuModalOpen(false);
  };

  const handleCloseCustomMenuModal = () => {
    setCustomMenuName('');
    setCustomMenuCantidad(1);
    setCustomMenuCantidadDraft('1');
    setCustomMenuNotes('');
    setCustomSecondTargetAssignmentId(null);
    setIsCustomMenuModalOpen(false);
  };

  const handleCreateKidsMenu = () => {
    if (!customSecondTargetAssignmentId) {
      return;
    }
    const trimmedName = kidsMenuName.trim() || 'Menú infantil';
    updateAssignmentMenuDetails(customSecondTargetAssignmentId, (details) => ({
      ...details,
      customSeconds: [
        ...details.customSeconds,
        {
          id: crypto.randomUUID(),
          kind: 'kids_menu',
          name: trimmedName,
          cantidad: Math.max(1, kidsMenuCantidad || 1),
          notes: kidsMenuNotes.trim() || undefined,
        },
      ],
    }));
    setKidsMenuName('Menú infantil');
    setKidsMenuCantidad(1);
    setKidsMenuCantidadDraft('1');
    setKidsMenuNotes('');
    setCustomSecondTargetAssignmentId(null);
    setIsKidsMenuModalOpen(false);
  };

  const handleCloseKidsMenuModal = () => {
    setKidsMenuName('Menú infantil');
    setKidsMenuCantidad(1);
    setKidsMenuCantidadDraft('1');
    setKidsMenuNotes('');
    setCustomSecondTargetAssignmentId(null);
    setIsKidsMenuModalOpen(false);
  };

  function updateCustomSecond(assignmentId: string, id: string, updates: Partial<CustomSecond>) {
    updateAssignmentMenuDetails(assignmentId, (details) => ({
      ...details,
      customSeconds: details.customSeconds.map((custom) => (custom.id === id ? { ...custom, ...updates } : custom)),
    }));
  }

  function removeCustomSecond(assignmentId: string, id: string) {
    updateAssignmentMenuDetails(assignmentId, (details) => ({
      ...details,
      customSeconds: details.customSeconds.filter((custom) => custom.id !== id),
    }));
    setCustomSecondQuantityDrafts((prev) => omitRecordKey(prev, `${assignmentId}:${id}`));
  }

  const resetMenuDependentState = useCallback(() => {
    setOfferingAssignments((prev) =>
      prev.map((assignment) => ({
        ...assignment,
        menuDetails: createEmptyAssignmentMenuDetails(),
      })),
    );
    setSegundoQuantityDrafts({});
    setCustomSecondQuantityDrafts({});
    setWarningMenus(null);
    setWarningEntrecot(null);
    setIsCustomMenuModalOpen(false);
    setIsKidsMenuModalOpen(false);
    setCustomSecondTargetAssignmentId(null);
  }, []);

  const validateMenus = useCallback(() => {
    if (isPrivatePartyOnly) {
      setWarningMenus(null);
      setWarningEntrecot(null);
      return true;
    }

    if (!isSelectedOfferingMenu || !selectedOffering) {
      setWarningMenus(null);
      setWarningEntrecot(null);
      return true;
    }

    const totalSegundosBase = segundosSeleccionados.reduce((sum, s) => sum + s.cantidad, 0);
    const totalCustom = customSeconds.reduce((sum, s) => sum + s.cantidad, 0);
    const totalMenusAsignados = totalSegundosBase + totalCustom;

    const totalPuntosEntrecot =
      entrecotPoints.crudo +
      entrecotPoints.poco +
      entrecotPoints.alPunto +
      entrecotPoints.hecho +
      entrecotPoints.muyHecho;

    const donenessSecondsIds = selectedOffering.segundos.filter((s) => s.needsDonenessPoints).map((s) => s.id);
    const donenessSelection = segundosSeleccionados.find((s) => donenessSecondsIds.includes(s.dishId));
    const totalDonenessPeople = donenessSelection?.cantidad ?? 0;

    if (totalMenusAsignados !== primaryAssignedPax) {
      setWarningMenus(
        `Hay ${primaryAssignedPax} pax en la primera oferta, pero has asignado ${totalMenusAsignados} menús. Revisa si falta alguien o si sobra algún menú.`,
      );
    } else {
      setWarningMenus(null);
    }

    if (totalDonenessPeople > 0 && totalPuntosEntrecot !== totalDonenessPeople) {
      setWarningEntrecot(
        `Has pedido ${totalDonenessPeople} platos con puntos de cocción pero la suma de puntos es ${totalPuntosEntrecot}.`,
      );
    } else {
      setWarningEntrecot(null);
    }

    return (
      totalMenusAsignados === primaryAssignedPax &&
      (totalDonenessPeople === 0 || totalPuntosEntrecot === totalDonenessPeople)
    );
  }, [
    customSeconds,
    entrecotPoints,
    isPrivatePartyOnly,
    isSelectedOfferingMenu,
    primaryAssignedPax,
    segundosSeleccionados,
    selectedOffering,
  ]);

  const validateMenuAssignments = useCallback(() => {
    if (isPrivatePartyOnly) {
      setWarningMenus(null);
      setWarningEntrecot(null);
      return true;
    }

    const menuAssignments = offeringAssignments
      .map((assignment) => ({
        assignment,
        offering: offerings.find((offering) => offering.id === assignment.catalogId) ?? null,
      }))
      .filter(
        (entry): entry is { assignment: OfferingAssignmentDraft; offering: ReservationOfferingCatalogItem } =>
          entry.offering?.kind === 'cheffing_menu',
      );

    if (menuAssignments.length === 0) {
      setWarningMenus(null);
      setWarningEntrecot(null);
      return true;
    }

    const menuWarnings: string[] = [];
    const donenessWarnings: string[] = [];

    menuAssignments.forEach(({ assignment, offering }) => {
      const totalSegundosBase = assignment.menuDetails.segundosSeleccionados.reduce((sum, s) => sum + s.cantidad, 0);
      const totalCustom = assignment.menuDetails.customSeconds.reduce((sum, s) => sum + s.cantidad, 0);
      const totalMenusAsignados = totalSegundosBase + totalCustom;
      const assignedPax = toPositiveInt(assignment.assignedPax);

      if (totalMenusAsignados !== assignedPax) {
        menuWarnings.push(`${offering.display_name}: ${assignedPax} pax asignados, ${totalMenusAsignados} menús/platos repartidos.`);
      }

      const totalPuntosEntrecot =
        assignment.menuDetails.entrecotPoints.crudo +
        assignment.menuDetails.entrecotPoints.poco +
        assignment.menuDetails.entrecotPoints.alPunto +
        assignment.menuDetails.entrecotPoints.hecho +
        assignment.menuDetails.entrecotPoints.muyHecho;
      const donenessSecondsIds = offering.segundos.filter((s) => s.needsDonenessPoints).map((s) => s.id);
      const totalDonenessPeople = assignment.menuDetails.segundosSeleccionados
        .filter((s) => donenessSecondsIds.includes(s.dishId))
        .reduce((sum, s) => sum + s.cantidad, 0);

      if (totalDonenessPeople > 0 && totalPuntosEntrecot !== totalDonenessPeople) {
        donenessWarnings.push(
          `${offering.display_name}: ${totalDonenessPeople} platos con puntos de cocción, ${totalPuntosEntrecot} puntos asignados.`,
        );
      }
    });

    setWarningMenus(menuWarnings.length > 0 ? menuWarnings.join('\n') : null);
    setWarningEntrecot(donenessWarnings.length > 0 ? donenessWarnings.join('\n') : null);

    return menuWarnings.length === 0 && donenessWarnings.length === 0;
  }, [isPrivatePartyOnly, offeringAssignments, offerings]);
  void validateMenus;

  useEffect(() => {
    const loadOfferings = async () => {
      setOfferingsLoading(true);
      setOfferingsError(null);
      let responseStatus: number | null = null;
      try {
        const response = await fetch('/api/reservas/offering-catalog', { cache: 'no-store' });

        responseStatus = response.status;
        if (!response.ok) {
          const body = await response.text();
          console.error('menus load failed', response.status, body);
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as {
          offerings?: ReservationOfferingCatalogItem[];
          error?: string;
        };
        const offeringsResponse = data.offerings ?? [];

        if (offeringsResponse.length === 0) {
          throw new Error(data.error ?? 'No se ha podido cargar el catálogo de ofertas.');
        }

        setOfferings(offeringsResponse);
        setOfferingAssignments((prev) =>
          prev.some((assignment) => assignment.catalogId)
            ? prev
            : prev.map((assignment, index) =>
                index === 0 ? { ...assignment, catalogId: offeringsResponse[0]?.id || '' } : assignment,
              ),
        );
      } catch (error) {
        console.error('[Nueva reserva] Error cargando catálogo de ofertas', error);
        setOfferingsError(
          `No se ha podido cargar el catálogo de ofertas.${responseStatus ? ` (status ${responseStatus})` : ''}`,
        );
      } finally {
        setOfferingsLoading(false);
      }
    };

    loadOfferings();
  }, []);

  useEffect(() => {
    const loadRooms = async () => {
      setIsLoadingRooms(true);
      setLoadRoomsError(null);
      try {
        const response = await fetch('/api/rooms', { cache: 'no-store' });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as { rooms?: RoomOption[]; error?: string };
        const roomsResponse = data.rooms ?? [];

        if (roomsResponse.length === 0) {
          throw new Error(data.error ?? 'No se han podido cargar las salas.');
        }

        setRooms(roomsResponse);
      } catch (error) {
        console.error('[Nueva reserva] Error cargando rooms', error);
        setLoadRoomsError('No se han podido cargar las salas.');
      } finally {
        setIsLoadingRooms(false);
      }
    };

    loadRooms();
  }, []);

  useEffect(() => {
    if (rooms.length === 0) return;

    setRoomId((prev) => {
      if (!shouldUseDinnerRoom) {
        return '';
      }

      const currentSelectionIsValid = Boolean(prev && dinnerRooms.some((room) => room.id === prev));

      if (currentSelectionIsValid) {
        return prev;
      }

      if (prev) {
        return '';
      }

      return dinnerRooms[0]?.id ?? '';
    });
  }, [dinnerRooms, rooms.length, shouldUseDinnerRoom]);

  useEffect(() => {
    if (rooms.length === 0) return;

    setPartyRoomId((prev) => {
      if (!shouldUsePartyRoom) {
        return '';
      }

      const currentSelectionIsValid = Boolean(prev && partyRooms.some((room) => room.id === prev));
      return currentSelectionIsValid ? prev : '';
    });
  }, [partyRooms, rooms.length, shouldUsePartyRoom]);

  useEffect(() => {
    validateMenuAssignments();
  }, [validateMenuAssignments]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPrivatePartyOnly && isSubmittingRef.current) {
      return;
    }
    setSubmitError(null);
    setSubmitSuccess(null);
    setCalendarWarning(null);
    if (isPrivatePartyOnly) {
      isSubmittingRef.current = true;
    }
    setIsSubmitting(true);

    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const requestedStatus: CreateReservationStatus = submitter?.value === 'draft' ? 'draft' : 'confirmed';
    setSubmittingStatus(requestedStatus);

    const normalizedNumeroPersonas = parsePositivePaxInput(numeroPersonasInput);
    if (normalizedNumeroPersonas === null) {
      setSubmitError('Indica un numero de personas valido, minimo 1.');
      finalizeSubmit();
      return;
    }

    setNumeroPersonas(normalizedNumeroPersonas);
    setNumeroPersonasInput(String(normalizedNumeroPersonas));

    if (!isRoomSelectionValid) {
      setSubmitError(
        shouldUseDinnerRoom ? 'Selecciona una sala de restaurante para continuar.' : 'La sala de cena no es válida.',
      );
      finalizeSubmit();
      return;
    }

    if (!isPartyRoomSelectionValid) {
      setSubmitError(
        shouldUsePartyRoom ? 'Selecciona Pub o Disco como zona de fiesta.' : 'La zona de fiesta no es válida.',
      );
      finalizeSubmit();
      return;
    }

    const [datePart, timePart] = fecha.split('T');
    const eventDate = datePart;
    const entryTime = timePart ? `${timePart}:00` : null;

    const normalizedOfferingAssignments = shouldUseFood
      ? offeringAssignments.reduce<
          { draft: OfferingAssignmentDraft; offering: ReservationOfferingCatalogItem; assignedPax: number }[]
        >((acc, draft) => {
          if (!draft.catalogId) return acc;
          const offering = offerings.find((catalogOffering) => catalogOffering.id === draft.catalogId);
          if (!offering) return acc;
          acc.push({ draft, offering, assignedPax: toPositiveInt(draft.assignedPax) });
          return acc;
        }, [])
      : [];
    const duplicateOfferingIds = normalizedOfferingAssignments
      .map((assignment) => assignment.offering.id)
      .filter((catalogId, index, list) => list.indexOf(catalogId) !== index);

    if (duplicateOfferingIds.length > 0) {
      setSubmitError('Hay menús/cartas duplicados. Agrupa los pax en una sola línea para cada oferta.');
      finalizeSubmit();
      return;
    }

    const normalizedTotalAssignedPax = normalizedOfferingAssignments.reduce(
      (sum, assignment) => sum + assignment.assignedPax,
      0,
    );
    const selectedOfferingSnapshot = normalizedOfferingAssignments[0]?.offering ?? null;

    const isValid = validateMenuAssignments();

    if (shouldUseFood && normalizedTotalAssignedPax !== normalizedNumeroPersonas) {
      const proceed = window.confirm(
        'Hay descuadres entre pax de la reserva y menús/cartas asignadas. ¿Quieres guardar igualmente?',
      );

      if (!proceed) {
        finalizeSubmit();
        return;
      }
    }

    if (!isValid) {
      const proceed = window.confirm(
        'Hay descuadres entre número de personas, menús asignados o puntos de cocción. ¿Quieres guardar la reserva igualmente?',
      );

      if (!proceed) {
        finalizeSubmit();
        return;
      }
    }

    const assignmentSummaryText =
      normalizedOfferingAssignments.length > 0
        ? normalizedOfferingAssignments
            .map((assignment) => `- ${assignment.offering.display_name}: ${assignment.assignedPax} pax`)
            .join('\n')
        : null;

    let menuText: string | null = null;

    if (selectedOfferingSnapshot?.kind === 'cheffing_card') {
      menuText = assignmentSummaryText ? `Menús / cartas asignadas:\n${assignmentSummaryText}` : null;
    }

    if (selectedOfferingSnapshot?.kind === 'cheffing_menu') {
      const donenessSecondsIds = selectedOfferingSnapshot.segundos
        .filter((s) => s.needsDonenessPoints)
        .map((s) => s.id);
      const donenessSelection = segundosSeleccionados.find((s) => donenessSecondsIds.includes(s.dishId));
      const totalDonenessPeople = donenessSelection?.cantidad ?? 0;
      const segundosBaseTexto = segundosSeleccionados
        .filter((s) => s.cantidad > 0)
        .map((s) => `- ${s.nombre}: ${s.cantidad}`)
        .join('\n');

      let detalleEntrecot: string | null = null;

      if (totalDonenessPeople > 0) {
        const partes: string[] = [];

        if (entrecotPoints.crudo > 0) partes.push(`Crudo: ${entrecotPoints.crudo}`);
        if (entrecotPoints.poco > 0) partes.push(`Poco hecho: ${entrecotPoints.poco}`);
        if (entrecotPoints.alPunto > 0) partes.push(`Al punto: ${entrecotPoints.alPunto}`);
        if (entrecotPoints.hecho > 0) partes.push(`Hecho: ${entrecotPoints.hecho}`);
        if (entrecotPoints.muyHecho > 0) partes.push(`Muy hecho: ${entrecotPoints.muyHecho}`);

        if (partes.length > 0) {
          detalleEntrecot = `Puntos de cocción:\n${partes.map((p) => `  · ${p}`).join('\n')}`;
        }
      }

      const customMenus = customSeconds.filter((s) => s.kind === 'custom_menu');
      const kidsMenus = customSeconds.filter((s) => s.kind === 'kids_menu');

      const customMenusTexto =
        customMenus.length > 0
          ? [
              'Menús personalizados:',
              ...customMenus.map(
                (s) => `- ${s.name}: ${s.cantidad}${s.notes ? ` — ${s.notes}` : ''}`,
              ),
            ].join('\n')
          : null;

      const kidsMenusTexto =
        kidsMenus.length > 0
          ? [
              'Menús infantiles:',
              ...kidsMenus.map(
                (s) => `- ${s.name}: ${s.cantidad}${s.notes ? ` — ${s.notes}` : ''}`,
              ),
            ].join('\n')
          : null;

      const partesMenuText = [
        assignmentSummaryText ? `Menús / cartas asignadas:\n${assignmentSummaryText}` : null,
        segundosBaseTexto ? 'Plato principal:' : null,
        segundosBaseTexto || null,
        detalleEntrecot,
        customMenusTexto,
        kidsMenusTexto,
      ];

      menuText = partesMenuText
        .filter((p) => p && p.toString().trim().length > 0)
        .join('\n\n') || null;
    }

    const structuredMenuDetailsText = normalizedOfferingAssignments
      .filter((assignment) => assignment.offering.kind === 'cheffing_menu')
      .map((assignment) => {
        const baseSeconds = assignment.draft.menuDetails.segundosSeleccionados
          .filter((selection) => selection.cantidad > 0)
          .map((selection) => `- ${selection.nombre}: ${selection.cantidad}`)
          .join('\n');
        const customMenus = assignment.draft.menuDetails.customSeconds.filter((custom) => custom.kind === 'custom_menu');
        const kidsMenus = assignment.draft.menuDetails.customSeconds.filter((custom) => custom.kind === 'kids_menu');
        const customText =
          customMenus.length > 0
            ? ['Menús personalizados:', ...customMenus.map((custom) => `- ${custom.name}: ${custom.cantidad}${custom.notes ? ` — ${custom.notes}` : ''}`)].join('\n')
            : null;
        const kidsText =
          kidsMenus.length > 0
            ? ['Menús infantiles:', ...kidsMenus.map((custom) => `- ${custom.name}: ${custom.cantidad}${custom.notes ? ` — ${custom.notes}` : ''}`)].join('\n')
            : null;
        const points = assignment.draft.menuDetails.entrecotPoints;
        const pointsText = [
          points.crudo > 0 ? `Crudo: ${points.crudo}` : null,
          points.poco > 0 ? `Poco hecho: ${points.poco}` : null,
          points.alPunto > 0 ? `Al punto: ${points.alPunto}` : null,
          points.hecho > 0 ? `Hecho: ${points.hecho}` : null,
          points.muyHecho > 0 ? `Muy hecho: ${points.muyHecho}` : null,
        ].filter((entry): entry is string => Boolean(entry));

        return [
          `${assignment.offering.display_name} (${assignment.assignedPax} pax)`,
          baseSeconds ? `Plato principal:\n${baseSeconds}` : null,
          pointsText.length > 0 ? `Puntos de cocción:\n${pointsText.map((entry) => `  · ${entry}`).join('\n')}` : null,
          customText,
          kidsText,
        ].filter((entry): entry is string => Boolean(entry)).join('\n');
      })
      .filter((entry) => entry.trim().length > 0);

    menuText = [
      assignmentSummaryText ? `Menús / cartas asignadas:\n${assignmentSummaryText}` : null,
      ...structuredMenuDetailsText,
    ]
      .filter((entry): entry is string => Boolean(entry))
      .join('\n\n') || null;

    const setupNotesLines = [
      shouldUseDinnerRoom && mesa ? `Mesa / zona: ${mesa}` : null,
      notasSala ? `Notas sala: ${notasSala}` : null,
    ].filter(Boolean);

    const setupNotes = setupNotesLines.length > 0 ? setupNotesLines.join('\n') : null;

    const extras = notasCocina ? `Notas cocina: ${notasCocina}` : null;

    const secondSelections =
      selectedOfferingSnapshot?.kind === 'cheffing_menu'
        ? [
            ...selectedOfferingSnapshot.segundos
              .map((segundo, index) => {
                const selected = segundosSeleccionados.find((entry) => entry.dishId === segundo.id);
                if (!selected || selected.cantidad <= 0) {
                  return null;
                }

                const doneness = segundo.needsDonenessPoints
                  ? [
                      { point: 'crudo', quantity: entrecotPoints.crudo },
                      { point: 'poco', quantity: entrecotPoints.poco },
                      { point: 'al_punto', quantity: entrecotPoints.alPunto },
                      { point: 'hecho', quantity: entrecotPoints.hecho },
                      { point: 'muy_hecho', quantity: entrecotPoints.muyHecho },
                    ].filter((point) => point.quantity > 0)
                  : [];

                return {
                  selectionKind: 'menu_second',
                  dishId: segundo.id,
                  menuItemId: segundo.menu_item_id ?? null,
                  quantity: selected.cantidad,
                  notes: null,
                  sortOrder: index,
                  doneness,
                };
              })
              .filter((selection): selection is NonNullable<typeof selection> => selection !== null),
            ...customSeconds.map((custom, index) => ({
              selectionKind: custom.kind,
              displayName: custom.name.trim() || (custom.kind === 'kids_menu' ? 'Menú infantil' : 'Menú personalizado'),
              quantity: Math.max(1, custom.cantidad),
              notes: custom.notes?.trim() || null,
              sortOrder: selectedOfferingSnapshot.segundos.length + index,
            })),
          ]
        : [];

    const buildSecondSelectionsForAssignment = (
      assignment: OfferingAssignmentDraft,
      offering: ReservationOfferingCatalogItem,
    ) =>
      offering.kind === 'cheffing_menu'
        ? [
            ...offering.segundos
              .map((segundo, index) => {
                const selected = assignment.menuDetails.segundosSeleccionados.find((entry) => entry.dishId === segundo.id);
                if (!selected || selected.cantidad <= 0) {
                  return null;
                }

                const doneness = segundo.needsDonenessPoints
                  ? [
                      { point: 'crudo', quantity: assignment.menuDetails.entrecotPoints.crudo },
                      { point: 'poco', quantity: assignment.menuDetails.entrecotPoints.poco },
                      { point: 'al_punto', quantity: assignment.menuDetails.entrecotPoints.alPunto },
                      { point: 'hecho', quantity: assignment.menuDetails.entrecotPoints.hecho },
                      { point: 'muy_hecho', quantity: assignment.menuDetails.entrecotPoints.muyHecho },
                    ].filter((point) => point.quantity > 0)
                  : [];

                return {
                  selectionKind: 'menu_second',
                  dishId: segundo.id,
                  menuItemId: segundo.menu_item_id ?? null,
                  quantity: selected.cantidad,
                  notes: null,
                  sortOrder: index,
                  doneness,
                };
              })
              .filter((selection): selection is NonNullable<typeof selection> => selection !== null),
            ...assignment.menuDetails.customSeconds.map((custom, index) => ({
              selectionKind: custom.kind,
              displayName: custom.name.trim() || (custom.kind === 'kids_menu' ? 'Menú infantil' : 'Menú personalizado'),
              quantity: Math.max(1, custom.cantidad),
              notes: custom.notes?.trim() || null,
              sortOrder: offering.segundos.length + index,
            })),
          ]
        : [];
    void secondSelections;

    const offeringAssignmentsPayload = shouldUseFood
      ? normalizedOfferingAssignments.map((assignment, index) => ({
          offeringKind: assignment.offering.kind,
          offeringId: assignment.offering.source_id,
          assignedPax: assignment.assignedPax,
          sortOrder: index,
          notes: assignment.draft.notes?.trim() || null,
          secondSelections:
            assignment.offering.kind === 'cheffing_menu'
              ? buildSecondSelectionsForAssignment(assignment.draft, assignment.offering)
              : undefined,
        }))
      : [];

    try {
      const resCreate = await fetch('/api/group-events/create', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: nombreReserva,
          customer_name: nombreCliente || null,
          customer_phone: telefono || null,
          customer_email: email || null,
          event_date: eventDate,
          entry_time: entryTime,
          adults: normalizedNumeroPersonas,
          children: 0,
          event_mode: eventMode,
          menu_text: menuText,
          offeringAssignments: offeringAssignmentsPayload,
          allergens_and_diets: intolerancias || null,
          extras,
          setup_notes: setupNotes,
          second_course_type: null,
          room_id: shouldUseDinnerRoom ? roomId : null,
          party_room_id: shouldUsePartyRoom ? partyRoomId : null,
          override_capacity: false,
          notes: mesa || null,
          status: requestedStatus,
        }),
      });

      const createResult = (await resCreate.json()) as { groupEventId?: string; error?: string };

      if (!resCreate.ok || !createResult.groupEventId) {
        const message = createResult.error ?? 'No se ha podido crear la reserva. Inténtalo de nuevo.';
        console.error('[Nueva reserva] Error creando reserva', message);
        setSubmitError(message);
        finalizeSubmit();
        return;
      }

      const groupEventId = createResult.groupEventId;

      if (requestedStatus === 'confirmed') {
        try {
          const resCalendar = await fetch('/api/calendar-sync', {
            method: 'POST',
            cache: 'no-store',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ groupEventId }),
          });

          if (!resCalendar.ok) {
            console.error('[Nueva reserva] Error sincronizando con Google Calendar', resCalendar.statusText);
            setCalendarWarning(
            'La reserva se ha creado, pero ha habido un problema al sincronizar con Google Calendar. Revisa el calendario o inténtalo más tarde.',
            );
        }
        } catch (e) {
          console.error('[Nueva reserva] Error sincronizando con Google Calendar', e);
          setCalendarWarning(
          'La reserva se ha creado, pero ha habido un problema al sincronizar con Google Calendar. Revisa el calendario o inténtalo más tarde.',
          );
          }
      }

      setSubmitSuccess(
        requestedStatus === 'draft'
          ? 'Borrador guardado. No se ha sincronizado con Google Calendar.'
          : 'Reserva creada correctamente.',
      );
      router.refresh();
    } catch (error) {
      console.error('[Nueva reserva] Error creando reserva', error);
      setSubmitError('No se ha podido crear la reserva. Inténtalo de nuevo.');
    } finally {
      finalizeSubmit();
    }
  };

  return (
    <div className="reservas-new-pilot min-h-[calc(100dvh-4.5rem)] space-y-7 bg-[#12110f] px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-[#efe8dc] md:px-6 lg:px-8">
      <ReservasNewPilotStyles />
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d6a76e]">Nueva reserva</p>
          <h1 className="mt-2 text-[2rem] font-semibold leading-tight tracking-normal text-[#f6f0e8]">Crear reserva</h1>
        <p className="text-sm text-slate-400">Introduce los datos básicos y asigna menús para cocina.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
          <Link
            href="/reservas?view=week"
            className="inline-flex w-full items-center justify-center rounded-xl border border-[#4a3f32]/75 bg-[#151412]/90 px-5 py-3 text-sm font-semibold text-[#efe8dc] transition-colors hover:border-[#8b6a43]/70 hover:bg-[#211f1b] active:translate-y-px sm:w-auto"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            form="nueva-reserva-form"
            name="reservationStatus"
            value="draft"
            className="button-secondary w-full min-w-[10rem] sm:w-auto"
            disabled={isSubmitting}
          >
            {isSubmitting && submittingStatus === 'draft' ? 'Guardando...' : 'Guardar borrador'}
          </button>
          <button
            type="submit"
            form="nueva-reserva-form"
            name="reservationStatus"
            value="confirmed"
            className="button-primary w-full min-w-[12rem] sm:w-auto"
            disabled={isSubmitting}
          >
            {isSubmitting && submittingStatus === 'confirmed' ? 'Creando...' : 'Crear reserva confirmada'}
          </button>
        </div>
      </div>

      <form id="nueva-reserva-form" onSubmit={handleSubmit} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_27rem]">
        <div className="card space-y-6 rounded-2xl p-5 lg:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#6f5434]/60 bg-[#3a2d20]/70 text-[#e0b77b]">
              <CalendarDaysIcon className="h-5 w-5 stroke-[1.7]" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-[#f6f0e8]">Detalles de la reserva</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2">
              <span className="label">Fecha y hora</span>
              <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} className="input" required />
            </label>
            <label className="space-y-2">
              <span className="label">Turno</span>
              <div className="relative">
                <select value={turno} onChange={(e) => setTurno(e.target.value as Turno)} className="input appearance-none pr-10">
                  <option value="comida">Comida</option>
                  <option value="cena">Cena</option>
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-3 top-3.5 h-5 w-5 text-slate-500" />
              </div>
            </label>
            <label className="space-y-2">
              <span className="label">Nombre de la reserva</span>
              <input
                value={nombreReserva}
                onChange={(e) => setNombreReserva(e.target.value)}
                className="input"
                placeholder="Ej: Cumpleanos Laura"
                required
              />
              <span className="block text-xs leading-5 text-slate-500">
                Nombre que vera el equipo en calendario e informes. Ej.: Cumpleanos Laura, Graduacion INS Castello.
              </span>
            </label>
            <div className="space-y-1 border-t border-slate-800/80 pt-5 lg:col-span-2">
              <h3 className="text-sm font-semibold text-[#f6f0e8]">Datos del cliente/contacto</h3>
              <p className="text-xs leading-5 text-slate-500">
                Persona que gestiona la reserva. Estos datos serviran para contacto y futuro CRM.
              </p>
            </div>
            <label className="space-y-2">
              <span className="label">Nombre del cliente/contacto</span>
              <input
                value={nombreCliente}
                onChange={(e) => setNombreCliente(e.target.value)}
                className="input"
                placeholder="Ej: Marta Perez"
              />
            </label>
            <label className="space-y-2">
              <span className="label">Teléfono</span>
              <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="input" placeholder="+34..." />
            </label>
            <label className="space-y-2">
              <span className="label">Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
            </label>
            <label className="space-y-2">
              <span className="label">Número de personas</span>
              <input
                type="number"
                min={1}
                step={1}
                value={numeroPersonasInput}
                onChange={(e) => handleNumeroPersonasChange(e.target.value)}
                className="input"
              />
            </label>
            {shouldUseDinnerRoom && (
              <>
                <label className="space-y-2">
                  <span className="label">Sala de cena</span>
                  <div className="relative">
                    <select
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      className="input appearance-none pr-10"
                      disabled={isLoadingRooms || dinnerRooms.length === 0}
                      required
                    >
                      <option value="">Selecciona una sala de cena</option>
                      {dinnerRooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute right-3 top-3.5 h-5 w-5 text-slate-500" />
                  </div>
                  {loadRoomsError && <p className="text-xs text-red-400">{loadRoomsError}</p>}
                </label>
                <label className="space-y-2">
                  <span className="label">Mesa / zona de cena</span>
                  <input value={mesa} onChange={(e) => setMesa(e.target.value)} className="input" placeholder="Terraza 1, Interior 3..." />
                </label>
              </>
            )}
            {shouldUsePartyRoom && (
              <label className="space-y-2">
                <span className="label">Zona de fiesta</span>
                <div className="relative">
                  <select
                    value={partyRoomId}
                    onChange={(e) => setPartyRoomId(e.target.value)}
                    className="input appearance-none pr-10"
                    disabled={isLoadingRooms || partyRooms.length === 0}
                    required
                  >
                    <option value="">Selecciona Pub o Disco</option>
                    {partyRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-3 top-3.5 h-5 w-5 text-slate-500" />
                </div>
                <p className="text-xs text-[#e8c18c]">Obligatorio para reservas con fiesta privada.</p>
                {loadRoomsError && <p className="text-xs text-red-400">{loadRoomsError}</p>}
              </label>
            )}
            <div className="space-y-2 lg:col-span-2">
              <span className="label">Modalidad</span>
              <div className="grid gap-2 lg:grid-cols-3">
                {EVENT_MODE_OPTIONS.map((mode) => {
                  const active = eventMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setEventMode(mode);
                        if (!usesFood(mode)) {
                          resetMenuDependentState();
                        }
                      }}
                      className={`private-party-mode-card flex min-h-[5.5rem] items-start justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                        active ? 'private-party-mode-card--active' : ''
                      }`}
                      aria-pressed={active}
                    >
                      <span>
                        <span className="private-party-mode-title block text-sm font-semibold">
                          {RESERVATION_EVENT_MODE_LABELS[mode]}
                        </span>
                        <span className="private-party-mode-description mt-1 block text-xs">
                          {mode === 'dinner'
                            ? 'Sala de cena y comida. Sin zona de fiesta.'
                            : mode === 'dinner_private_party'
                              ? 'Cena con menús y zona de fiesta Pub/Disco.'
                              : 'Sin cena ni selección de comida. Conserva fecha, hora, pax, ubicación, notas y sincronización.'}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {shouldUseFood && (
              <label className="space-y-2">
                <span className="label">Intolerancias / alergias</span>
                <textarea
                  value={intolerancias}
                  onChange={(e) => setIntolerancias(e.target.value)}
                  className="input min-h-[90px]"
                  placeholder="Sin gluten, sin lácteos, vegano..."
                />
              </label>
            )}
            <label className="space-y-2">
              <span className="label">{isPrivatePartyOnly ? 'Notas' : 'Notas sala'}</span>
              <textarea value={notasSala} onChange={(e) => setNotasSala(e.target.value)} className="input min-h-[90px]" placeholder="Preferencia de mesa, timings..." />
            </label>
            {shouldUseFood && (
              <label className="space-y-2 lg:col-span-2">
                <span className="label">Notas cocina</span>
                <textarea
                  value={notasCocina}
                  onChange={(e) => setNotasCocina(e.target.value)}
                  className="input min-h-[90px]"
                  placeholder="Cocciones, salsas aparte, alérgenos específicos..."
                />
              </label>
            )}
          </div>
        </div>

        <aside className="card max-h-none space-y-5 overflow-y-auto rounded-2xl p-5 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-7.5rem)]">
          {shouldUseFood && (
            <div className="space-y-3">
              <div>
                <p className="label">Menús / cartas asignadas</p>
                <p className="text-xs text-slate-400">La primera línea se usa para el detalle de segundos.</p>
              </div>
              <div className="space-y-2">
                {offeringAssignments.map((assignment, index) => (
                  <div key={assignment.id} className="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3 sm:grid-cols-[minmax(0,1fr)_6rem_auto]">
                    <div className="relative">
                      <select
                        value={assignment.catalogId}
                        onChange={(e) => handleOfferingCatalogChange(assignment.id, e.target.value)}
                        className="input appearance-none pr-10"
                        disabled={offeringsLoading || !!offeringsError || offerings.length === 0}
                      >
                        <option value="">
                          {offeringsLoading ? 'Cargando catálogo...' : 'Selecciona menú/carta'}
                        </option>
                        {offerings.map((offering) => (
                          <option
                            key={offering.id}
                            value={offering.id}
                            disabled={offeringAssignments.some(
                              (other) => other.id !== assignment.id && other.catalogId === offering.id,
                            )}
                          >
                            {offering.display_name} {offering.kind === 'cheffing_card' ? '· Carta' : '· Menú'}
                          </option>
                        ))}
                      </select>
                      <ChevronDownIcon className="pointer-events-none absolute right-3 top-3.5 h-5 w-5 text-slate-500" />
                    </div>
                    <label className="space-y-1">
                      <span className="sr-only">Pax asignados</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={assignment.assignedPax}
                        onChange={(e) => handleOfferingPaxChange(assignment.id, e.target.value)}
                        className="input"
                        aria-label={`Pax asignados a la oferta ${index + 1}`}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeOfferingAssignment(assignment.id)}
                      className="rounded-md border border-red-800/70 px-3 py-2 text-xs font-semibold text-red-200 transition-colors hover:bg-red-950/60 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={offeringAssignments.length === 1}
                    >
                      Eliminar
                    </button>
                    {(() => {
                      const offering = offerings.find((entry) => entry.id === assignment.catalogId);
                      if (!offering) return null;
                      const totalLineSelections =
                        assignment.menuDetails.segundosSeleccionados.reduce((sum, selection) => sum + selection.cantidad, 0) +
                        assignment.menuDetails.customSeconds.reduce((sum, custom) => sum + custom.cantidad, 0);

                      return (
                        <div className="space-y-3 border-t border-slate-800 pt-3 sm:col-span-3">
                          <button
                            type="button"
                            onClick={() => toggleOfferingAssignmentExpanded(assignment.id)}
                            className="flex w-full items-center justify-between text-left text-xs font-semibold uppercase tracking-wide text-slate-300"
                          >
                            <span>
                              Detalle de {offering.kind === 'cheffing_menu' ? 'menú' : 'carta'} · {totalLineSelections}/{toPositiveInt(assignment.assignedPax)} pax
                            </span>
                            <ChevronDownIcon className={`h-4 w-4 transition-transform ${assignment.isExpanded ? 'rotate-180' : ''}`} />
                          </button>

                          {assignment.isExpanded && offering.kind === 'cheffing_card' && (
                            <p className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300">
                              Oferta tipo carta: no aplica selección de segundos.
                            </p>
                          )}

                          {assignment.isExpanded && offering.kind === 'cheffing_menu' && (
                            <div className="space-y-3">
                              <div className="space-y-2">
                                {offering.segundos.map((segundo) => {
                                  const selectedQuantity =
                                    assignment.menuDetails.segundosSeleccionados.find((selection) => selection.dishId === segundo.id)
                                      ?.cantidad ?? 0;
                                  const quantityValue = segundoQuantityDrafts[`${assignment.id}:${segundo.id}`] ?? String(selectedQuantity);

                                  return (
                                    <div key={segundo.id} className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <p className="font-semibold text-white">{segundo.nombre}</p>
                                          <p className="text-xs text-slate-400">{segundo.descripcion}</p>
                                        </div>
                                        <input
                                          type="number"
                                          min={0}
                                          className="input w-24"
                                          value={quantityValue}
                                          onChange={(e) => handleSegundoQuantityChange(assignment.id, segundo, e.target.value)}
                                          onBlur={() => handleSegundoQuantityBlur(assignment.id, segundo)}
                                        />
                                      </div>

                                      {segundo.needsDonenessPoints && (
                                        <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateAssignmentMenuDetails(assignment.id, (details) => ({
                                                ...details,
                                                donenessCollapsed: !details.donenessCollapsed,
                                              }))
                                            }
                                            className="flex w-full items-center justify-between text-left text-xs uppercase tracking-wide text-slate-400"
                                          >
                                            <span>Puntos de cocción</span>
                                            <ChevronDownIcon
                                              className={`h-4 w-4 transition-transform ${
                                                assignment.menuDetails.donenessCollapsed ? '' : 'rotate-180'
                                              }`}
                                            />
                                          </button>

                                          {!assignment.menuDetails.donenessCollapsed && (
                                            <div className="space-y-2">
                                              {(
                                                [
                                                  { key: 'crudo', label: 'Crudo' },
                                                  { key: 'poco', label: 'Poco hecho' },
                                                  { key: 'alPunto', label: 'Al punto' },
                                                  { key: 'hecho', label: 'Hecho' },
                                                  { key: 'muyHecho', label: 'Muy hecho' },
                                                ] as { key: keyof EntrecotPoints; label: string }[]
                                              ).map((punto) => {
                                                const currentValue = assignment.menuDetails.entrecotPoints[punto.key];
                                                const maxEntrecotPeople = Math.max(selectedQuantity, toPositiveInt(assignment.assignedPax), currentValue, 10);

                                                return (
                                                  <label key={punto.key} className="grid grid-cols-[1fr_5rem] items-center gap-2 text-xs text-slate-300">
                                                    <span>{punto.label}</span>
                                                    <input
                                                      type="number"
                                                      min={0}
                                                      max={maxEntrecotPeople}
                                                      className="input text-sm"
                                                      value={currentValue}
                                                      onChange={(e) =>
                                                        updateEntrecotPoint(assignment.id, punto.key, parseInt(e.target.value, 10) || 0)
                                                      }
                                                    />
                                                  </label>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    className="button-secondary"
                                    onClick={() => {
                                      setCustomSecondTargetAssignmentId(assignment.id);
                                      setIsCustomMenuModalOpen(true);
                                    }}
                                  >
                                    + Crear menú
                                  </button>
                                  <button
                                    type="button"
                                    className="button-secondary"
                                    onClick={() => {
                                      setCustomSecondTargetAssignmentId(assignment.id);
                                      setIsKidsMenuModalOpen(true);
                                    }}
                                  >
                                    + Menú infantil
                                  </button>
                                </div>

                                {assignment.menuDetails.customSeconds.map((custom) => {
                                  const quantityValue = customSecondQuantityDrafts[`${assignment.id}:${custom.id}`] ?? String(custom.cantidad);

                                  return (
                                    <div key={custom.id} className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                                      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                                        <span>{custom.kind === 'custom_menu' ? 'Menú personalizado' : 'Menú infantil'}</span>
                                        <button
                                          type="button"
                                          className="text-xs text-red-300 hover:text-red-200"
                                          onClick={() => removeCustomSecond(assignment.id, custom.id)}
                                        >
                                          Eliminar
                                        </button>
                                      </div>
                                      <input
                                        className="input"
                                        value={custom.name}
                                        onChange={(e) => updateCustomSecond(assignment.id, custom.id, { name: e.target.value })}
                                      />
                                      <input
                                        type="number"
                                        min={1}
                                        className="input"
                                        value={quantityValue}
                                        onChange={(e) => handleCustomSecondQuantityChange(assignment.id, custom.id, e.target.value)}
                                        onBlur={() => handleCustomSecondQuantityBlur(assignment.id, custom)}
                                      />
                                      <input
                                        className="input"
                                        value={custom.notes ?? ''}
                                        placeholder="Notas"
                                        onChange={(e) => updateCustomSecond(assignment.id, custom.id, { notes: e.target.value })}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className={`text-sm font-semibold ${hasOfferingPaxMismatch ? 'text-amber-200' : 'text-emerald-200'}`}>
                  Total asignado: {totalAssignedPax} / {numeroPersonas} pax
                </p>
                {hasOfferingPaxMismatch && (
                  <p className="rounded-md border border-amber-700/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                    Hay {numeroPersonas} personas en la reserva, pero solo {totalAssignedPax} pax asignados a menús/cartas.
                  </p>
                )}
                <button
                  type="button"
                  onClick={addOfferingAssignment}
                  className="button-secondary w-full justify-center"
                  disabled={
                    offeringsLoading ||
                    !!offeringsError ||
                    offerings.every((offering) =>
                      offeringAssignments.some((assignment) => assignment.catalogId === offering.id),
                    )
                  }
                >
                  + Añadir menú/carta
                </button>
              </div>
              {offeringsError && <p className="text-xs text-red-400">{offeringsError}</p>}
              {submitError && <p className="text-sm text-red-400">{submitError}</p>}
              {submitSuccess && <p className="text-sm text-green-400">{submitSuccess}</p>}
              {calendarWarning && <p className="text-sm text-amber-300">{calendarWarning}</p>}
              {warningMenus && <p className="whitespace-pre-line text-sm text-amber-300">{warningMenus}</p>}
              {warningEntrecot && <p className="whitespace-pre-line text-sm text-amber-300">{warningEntrecot}</p>}

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <button
                  type="submit"
                  name="reservationStatus"
                  value="confirmed"
                  className="button-primary justify-center"
                  disabled={isSubmitting}
                >
                  {isSubmitting && submittingStatus === 'confirmed' ? 'Creando...' : 'Crear reserva confirmada'}
                </button>
                <button
                  type="submit"
                  name="reservationStatus"
                  value="draft"
                  className="button-secondary justify-center"
                  disabled={isSubmitting}
                >
                  {isSubmitting && submittingStatus === 'draft' ? 'Guardando...' : 'Guardar borrador'}
                </button>
              </div>
            </div>
          )}

          {shouldUseFood && offeringsLoading && <p className="text-sm text-slate-300">Cargando catálogo...</p>}

          {!shouldUseFood && (
            <div className="space-y-4">
              <div className="rounded-lg border border-[#d6a76e]/35 bg-[#3a2d20]/35 p-4 text-sm text-[#fff1d8]">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckIcon className="h-5 w-5" />
                  {RESERVATION_EVENT_MODE_LABELS[eventMode]}
                </div>
                <p className="mt-2 text-[#d8cfc2]">
                  Se guardará sin ofertas, menús ni selecciones de cocina. La reserva seguirá apareciendo en calendario
                  interno y se sincronizará con Google Calendar si queda confirmada.
                </p>
              </div>

              {submitError && <p className="text-sm text-red-400">{submitError}</p>}
              {submitSuccess && <p className="text-sm text-green-400">{submitSuccess}</p>}
              {calendarWarning && <p className="text-sm text-amber-300">{calendarWarning}</p>}

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <button
                  type="submit"
                  name="reservationStatus"
                  value="confirmed"
                  className="button-primary justify-center"
                  disabled={isSubmitting}
                >
                  {isSubmitting && submittingStatus === 'confirmed' ? 'Creando...' : 'Crear reserva confirmada'}
                </button>
                <button
                  type="submit"
                  name="reservationStatus"
                  value="draft"
                  className="button-secondary justify-center"
                  disabled={isSubmitting}
                >
                  {isSubmitting && submittingStatus === 'draft' ? 'Guardando...' : 'Guardar borrador'}
                </button>
              </div>
            </div>
          )}

          {false && shouldUseFood && selectedOffering && !offeringsLoading && !offeringsError && (
            <div className="space-y-4">
              {isSelectedOfferingMenu && (
                <div>
                  <p className="text-sm font-semibold text-white">Segundos disponibles</p>
                  <p className="text-xs text-slate-400">Indica cantidades para cocina.</p>
                  <div className="mt-3 space-y-2">
                    {selectedOffering?.segundos.map((segundo) => {
                      const selectedQuantity = segundosSeleccionados.find((s) => s.dishId === segundo.id)?.cantidad ?? 0;
                      const quantityValue = segundoQuantityDrafts[segundo.id] ?? String(selectedQuantity);

                      return (
                    <div
                      key={segundo.id}
                      className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{segundo.nombre}</p>
                          <p className="text-xs text-slate-400">{segundo.descripcion}</p>
                        </div>
                        <input
                          type="number"
                          min={0}
                          className="input w-24"
                          value={quantityValue}
                          onChange={(e) => handleSegundoQuantityChange(primaryOfferingAssignment?.id ?? '', segundo, e.target.value)}
                          onBlur={() => handleSegundoQuantityBlur(primaryOfferingAssignment?.id ?? '', segundo)}
                        />
                      </div>

                      {segundo.needsDonenessPoints && (
                        <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                          <button
                            type="button"
                            onClick={() => setDonenessCollapsed((prev) => !prev)}
                            className="flex w-full items-center justify-between text-left text-xs uppercase tracking-wide text-slate-400"
                          >
                            <span>Puntos de cocción (opcional)</span>
                            <ChevronDownIcon
                              className={`h-4 w-4 transition-transform ${donenessCollapsed ? '' : 'rotate-180'}`}
                            />
                          </button>

                          {!donenessCollapsed && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-wide text-slate-400">
                                <span>Puntos de cocción (asigna personas)</span>
                                <span>
                                  {`${segundo.nombre}: ${
                                    segundosSeleccionados.find((s) => s.dishId === segundo.id)?.cantidad ?? 0
                                  } · Puntos: ${
                                    entrecotPoints.crudo +
                                    entrecotPoints.poco +
                                    entrecotPoints.alPunto +
                                    entrecotPoints.hecho +
                                    entrecotPoints.muyHecho
                                  }`}
                                </span>
                              </div>

                              {(
                                [
                                  { key: 'crudo', label: 'Crudo' },
                                  { key: 'poco', label: 'Poco hecho' },
                                  { key: 'alPunto', label: 'Al punto' },
                                  { key: 'hecho', label: 'Hecho' },
                                  { key: 'muyHecho', label: 'Muy hecho' },
                                ] as { key: keyof EntrecotPoints; label: string }[]
                              ).map((punto) => {
                                const currentValue = entrecotPoints[punto.key];
                                const maxEntrecotPeople = Math.max(
                                  segundosSeleccionados.find((s) => s.dishId === segundo.id)?.cantidad ?? 0,
                                  primaryAssignedPax,
                                  currentValue,
                                  10,
                                );
                                const options = Array.from({ length: maxEntrecotPeople + 1 }, (_, i) => i);

                                return (
                                  <div
                                    key={punto.key}
                                    className="flex flex-col gap-1 rounded-md border border-slate-800/60 bg-slate-950/40 px-3 py-2 md:flex-row md:items-center md:justify-between"
                                  >
                                    <div>
                                      <p className="text-sm font-semibold text-white">{punto.label}</p>
                                      <p className="text-xs text-slate-400">Personas en este punto</p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        className="rounded-md border border-slate-700 px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                                        onClick={() => updateEntrecotPoint(primaryOfferingAssignment?.id ?? '', punto.key, currentValue - 1)}
                                        aria-label={`Restar ${punto.label}`}
                                      >
                                        -
                                      </button>

                                      <select
                                        className="input w-28 appearance-none pr-8 text-sm"
                                        value={currentValue}
                                        onChange={(e) => updateEntrecotPoint(primaryOfferingAssignment?.id ?? '', punto.key, parseInt(e.target.value) || 0)}
                                      >
                                        {options.map((option) => (
                                          <option key={option} value={option}>
                                            {option} persona{option === 1 ? '' : 's'}
                                          </option>
                                        ))}
                                      </select>

                                      <button
                                        type="button"
                                        className="rounded-md border border-slate-700 px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                                        onClick={() => updateEntrecotPoint(primaryOfferingAssignment?.id ?? '', punto.key, Math.min(currentValue + 1, maxEntrecotPeople))}
                                        aria-label={`Sumar ${punto.label}`}
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {isSelectedOfferingMenu && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-white">Menús personalizados e infantiles</p>
                  <div className="flex gap-2">
                    <button type="button" className="button-secondary" onClick={() => setIsCustomMenuModalOpen(true)}>
                      + Crear menú
                    </button>
                    <button type="button" className="button-secondary" onClick={() => setIsKidsMenuModalOpen(true)}>
                      + Menú infantil
                    </button>
                  </div>

                  <div className="space-y-3">
                    {customSeconds.map((custom) => {
                      const quantityValue = customSecondQuantityDrafts[custom.id] ?? String(custom.cantidad);

                      return (
                    <div
                      key={custom.id}
                      className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3"
                    >
                      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                        <span>{custom.kind === 'custom_menu' ? 'Menú personalizado' : 'Menú infantil'}</span>
                        <button
                          type="button"
                          className="text-xs text-red-300 hover:text-red-200"
                          onClick={() => setCustomSeconds((prev) => prev.filter((c) => c.id !== custom.id))}
                        >
                          Eliminar
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1 text-sm text-slate-200">
                          <span className="label text-xs">Nombre</span>
                          <input
                            className="input"
                            value={custom.name}
                            onChange={(e) => updateCustomSecond(primaryOfferingAssignment?.id ?? '', custom.id, { name: e.target.value })}
                            placeholder="Ej: Vegano sin soja"
                          />
                        </label>
                        <div className="space-y-1 text-sm text-slate-200">
                          <span className="label text-xs">Cantidad</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="rounded-md border border-slate-700 px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                              onClick={() =>
                                {
                                  updateCustomSecond(primaryOfferingAssignment?.id ?? '', custom.id, {
                                    cantidad: Math.max(1, custom.cantidad - 1),
                                  });
                                  setCustomSecondQuantityDrafts((prev) => omitRecordKey(prev, custom.id));
                                }
                              }
                              aria-label="Restar cantidad"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              className="input w-20 text-center"
                              value={quantityValue}
                              onChange={(e) => handleCustomSecondQuantityChange(primaryOfferingAssignment?.id ?? '', custom.id, e.target.value)}
                              onBlur={() => handleCustomSecondQuantityBlur(primaryOfferingAssignment?.id ?? '', custom)}
                            />
                            <button
                              type="button"
                              className="rounded-md border border-slate-700 px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                              onClick={() => {
                                updateCustomSecond(primaryOfferingAssignment?.id ?? '', custom.id, { cantidad: custom.cantidad + 1 });
                                setCustomSecondQuantityDrafts((prev) => omitRecordKey(prev, custom.id));
                              }}
                              aria-label="Sumar cantidad"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      <label className="space-y-1 text-sm text-slate-200">
                        <span className="label text-xs">Notas (opcional)</span>
                        <input
                          className="input"
                          value={custom.notes ?? ''}
                          onChange={(e) => updateCustomSecond(primaryOfferingAssignment?.id ?? '', custom.id, { notes: e.target.value })}
                          placeholder="Indicaciones específicas"
                        />
                      </label>
                    </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {isCustomMenuModalOpen && (
                <div className="reservation-modal-overlay fixed inset-0 z-50 flex items-end justify-center px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:items-center sm:px-4">
                  <div className="reservation-modal-panel max-h-[calc(100dvh-2rem)] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border p-5 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                    <div>
                      <p className="text-lg font-semibold text-white">Crear menú personalizado</p>
                      <p className="text-sm text-slate-400">Añade un nombre y cantidad para este menú.</p>
                    </div>
                    <form
                      className="space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleCreateCustomMenu();
                      }}
                    >
                      <label className="space-y-1 text-sm text-slate-200">
                        <span className="label text-xs">Nombre</span>
                        <input
                          className="input"
                          value={customMenuName}
                          onChange={(e) => setCustomMenuName(e.target.value)}
                          placeholder="Ej: Menú vegano"
                          required
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-200">
                        <span className="label text-xs">Cantidad</span>
                        <input
                          type="number"
                          min={1}
                          className="input"
                          value={customMenuCantidadDraft}
                          onChange={(e) =>
                            handleModalQuantityChange(e.target.value, setCustomMenuCantidad, setCustomMenuCantidadDraft)
                          }
                          onBlur={() => setCustomMenuCantidadDraft(String(Math.max(1, customMenuCantidad || 1)))}
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-200">
                        <span className="label text-xs">Notas (opcional)</span>
                        <input
                          className="input"
                          value={customMenuNotes}
                          onChange={(e) => setCustomMenuNotes(e.target.value)}
                          placeholder="Indicaciones específicas"
                        />
                      </label>
                      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <button type="button" className="button-secondary" onClick={handleCloseCustomMenuModal}>
                          Cancelar
                        </button>
                        <button type="submit" className="button-primary" disabled={!customMenuName.trim()}>
                          Crear menú
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {isKidsMenuModalOpen && (
                <div className="reservation-modal-overlay fixed inset-0 z-50 flex items-end justify-center px-3 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:items-center sm:px-4">
                  <div className="reservation-modal-panel max-h-[calc(100dvh-2rem)] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border p-5 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                    <div>
                      <p className="text-lg font-semibold text-white">Crear menú infantil</p>
                      <p className="text-sm text-slate-400">Indica cantidad y notas para este menú.</p>
                    </div>
                    <form
                      className="space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleCreateKidsMenu();
                      }}
                    >
                      <label className="space-y-1 text-sm text-slate-200">
                        <span className="label text-xs">Nombre (opcional)</span>
                        <input
                          className="input"
                          value={kidsMenuName}
                          onChange={(e) => setKidsMenuName(e.target.value)}
                          placeholder="Menú infantil"
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-200">
                        <span className="label text-xs">Cantidad</span>
                        <input
                          type="number"
                          min={1}
                          className="input"
                          value={kidsMenuCantidadDraft}
                          onChange={(e) =>
                            handleModalQuantityChange(e.target.value, setKidsMenuCantidad, setKidsMenuCantidadDraft)
                          }
                          onBlur={() => setKidsMenuCantidadDraft(String(Math.max(1, kidsMenuCantidad || 1)))}
                        />
                      </label>
                      <label className="space-y-1 text-sm text-slate-200">
                        <span className="label text-xs">Notas (opcional)</span>
                        <input
                          className="input"
                          value={kidsMenuNotes}
                          onChange={(e) => setKidsMenuNotes(e.target.value)}
                          placeholder="Indicaciones específicas"
                        />
                      </label>
                      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <button type="button" className="button-secondary" onClick={handleCloseKidsMenuModal}>
                          Cancelar
                        </button>
                        <button type="submit" className="button-primary">
                          Crear menú
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-primary-500/30 bg-primary-500/10 p-4 text-sm text-primary-100">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckIcon className="h-5 w-5" />
                  Resumen rápido
                </div>
                <p className="mt-2 text-primary-50">
                  {selectedOffering?.kind === 'cheffing_card'
                    ? offeringAssignments
                        .filter((assignment) => assignment.catalogId)
                        .map((assignment) => {
                          const offering = offerings.find((entry) => entry.id === assignment.catalogId);
                          return offering ? `${offering.display_name} · ${toPositiveInt(assignment.assignedPax)} pax` : null;
                        })
                        .filter((entry): entry is string => Boolean(entry))
                        .join(' · ') || 'Añade menús/cartas para organizar la reserva.'
                    : segundosSeleccionados.length > 0
                      ? selectedOffering?.segundos
                          .map((segundo) => {
                            const selected = segundosSeleccionados.find((entry) => entry.dishId === segundo.id);
                            if (!selected || selected.cantidad <= 0) return null;
                            return `${selected.cantidad}× ${segundo.nombre}`;
                          })
                          .filter((entry): entry is string => Boolean(entry))
                          .join(' · ')
                      : 'Añade cantidades para organizar la comanda.'}
                </p>
                {selectedOffering?.kind === 'cheffing_menu' && (
                  <p className="mt-1 text-primary-50">Especiales/infantiles: {customMenusCount}</p>
                )}
              </div>

              {submitError && <p className="text-sm text-red-400">{submitError}</p>}
              {submitSuccess && <p className="text-sm text-green-400">{submitSuccess}</p>}
              {calendarWarning && <p className="text-sm text-amber-300">{calendarWarning}</p>}
              {warningMenus && <p className="text-sm text-amber-300">{warningMenus}</p>}
              {warningEntrecot && <p className="text-sm text-amber-300">{warningEntrecot}</p>}

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <button
                  type="submit"
                  name="reservationStatus"
                  value="confirmed"
                  className="button-primary justify-center"
                  disabled={isSubmitting}
                >
                  {isSubmitting && submittingStatus === 'confirmed' ? 'Creando...' : 'Crear reserva confirmada'}
                </button>
                <button
                  type="submit"
                  name="reservationStatus"
                  value="draft"
                  className="button-secondary justify-center"
                  disabled={isSubmitting}
                >
                  {isSubmitting && submittingStatus === 'draft' ? 'Guardando...' : 'Guardar borrador'}
                </button>
              </div>
            </div>
          )}
        </aside>
      </form>
    </div>
  );
}
