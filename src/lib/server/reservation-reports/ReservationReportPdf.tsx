import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import {
  cleanText,
  DONENESS_LABELS,
  DONENESS_ORDER,
  formatDateTime,
  formatLongDate,
  formatShortDate,
  formatTime,
  getReportTotals,
  groupByDate,
  roomName,
  type DonenessRow,
  type OfferingRow,
  type ReportData,
  type ReservationRow,
  type RoomAllocationRow,
  type SelectionRow,
} from './reportData';

const SELECTIONS_PER_PDF_GROUP = 3;

const styles = StyleSheet.create({
  page: {
    padding: 28,
    backgroundColor: '#ffffff',
    color: '#2d2419',
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    lineHeight: 1.28,
  },
  header: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d6b98f',
    backgroundColor: '#ffffff',
    color: '#2d2419',
    marginBottom: 10,
  },
  eyebrow: {
    color: '#8a5b2b',
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    marginTop: 4,
    lineHeight: 1.12,
  },
  headerMeta: {
    color: '#6b4925',
    fontSize: 8.5,
    marginTop: 5,
    lineHeight: 1.25,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerTitleBlock: {
    width: '66%',
    paddingRight: 10,
  },
  headerMetaBlock: {
    width: '34%',
    padding: 7,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#e1cdb6',
    backgroundColor: '#ffffff',
  },
  summaryRow: {
    flexDirection: 'row',
    marginTop: 9,
  },
  summaryCard: {
    width: '24%',
    marginRight: 7,
    paddingVertical: 6,
    paddingHorizontal: 7,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#e1cdb6',
    backgroundColor: '#ffffff',
    color: '#2d2419',
  },
  summaryLabel: {
    color: '#8a5b2b',
    fontSize: 7,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 2,
  },
  dayBlock: {
    marginBottom: 9,
  },
  dayHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#dec7a6',
    backgroundColor: '#ffffff',
    marginBottom: 5,
  },
  dayTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#2d2419',
  },
  dayMeta: {
    color: '#6b4925',
    fontSize: 9,
    fontWeight: 700,
    textAlign: 'right',
  },
  reservationCard: {
    borderWidth: 1,
    borderColor: '#dfcdb7',
    borderRadius: 7,
    backgroundColor: '#ffffff',
    marginBottom: 5,
    overflow: 'hidden',
  },
  reservationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e6d7c3',
  },
  reservationMain: {
    flexGrow: 1,
    paddingRight: 8,
  },
  reservationMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  timePill: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d2ad7b',
    color: '#6b4925',
    fontSize: 7.5,
    fontWeight: 700,
  },
  completedBadge: {
    alignSelf: 'flex-start',
    marginLeft: 5,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#99c7a3',
    color: '#166534',
    backgroundColor: '#ffffff',
    fontSize: 7.5,
    fontWeight: 700,
  },
  reservationName: {
    fontSize: 12,
    fontWeight: 700,
    color: '#251d16',
    lineHeight: 1.15,
  },
  paxBox: {
    minWidth: 58,
    paddingVertical: 5,
    paddingHorizontal: 7,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#d2ad7b',
    backgroundColor: '#ffffff',
    color: '#2d2419',
    textAlign: 'right',
  },
  paxLabel: {
    color: '#8a5b2b',
    fontSize: 7,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  paxValue: {
    fontSize: 14,
    fontWeight: 700,
  },
  cardBody: {
    padding: 7,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  fieldPill: {
    width: '48%',
    marginRight: 4,
    marginBottom: 4,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#eadcca',
    backgroundColor: '#ffffff',
  },
  fieldLabel: {
    color: '#98764c',
    fontSize: 7,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  fieldValue: {
    color: '#2e241a',
    fontSize: 8.5,
    fontWeight: 700,
    marginTop: 1,
  },
  sectionTitle: {
    color: '#7f592d',
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase',
    marginTop: 1,
    marginBottom: 3,
  },
  offering: {
    padding: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2d1bd',
    backgroundColor: '#ffffff',
    marginBottom: 3,
  },
  continuedLabel: {
    color: '#98764c',
    fontSize: 7,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  offeringHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  offeringName: {
    color: '#2e241a',
    fontSize: 9.5,
    fontWeight: 700,
  },
  offeringPax: {
    color: '#8b6842',
    fontSize: 8,
    fontWeight: 700,
  },
  mutedText: {
    color: '#6f6258',
    fontSize: 7.7,
    marginTop: 1,
  },
  selection: {
    marginTop: 3,
    padding: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#eadcca',
    backgroundColor: '#ffffff',
  },
  selectionTitle: {
    color: '#30261d',
    fontSize: 9,
    fontWeight: 700,
  },
  textSection: {
    width: '48%',
    marginRight: 4,
    marginBottom: 4,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#eadcca',
    backgroundColor: '#ffffff',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 16,
    left: 30,
    right: 30,
    color: '#9a8874',
    fontSize: 8,
    textAlign: 'right',
  },
});

function FieldPill({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null;

  return (
    <View style={styles.fieldPill} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{String(value)}</Text>
    </View>
  );
}

function TextSection({ title, value }: { title: string; value: string | null | undefined }) {
  const text = cleanText(value);
  if (!text) return null;
  const shouldKeepTogether = text.length <= 360;

  return (
    <View style={styles.textSection} wrap={shouldKeepTogether ? false : undefined}>
      <Text style={styles.fieldLabel}>{title}</Text>
      <Text style={styles.mutedText}>{text}</Text>
    </View>
  );
}

function getSelectionKindLabel(kind: SelectionRow['selection_kind']) {
  if (kind === 'kids_menu') return 'Infantil';
  if (kind === 'custom_menu') return 'Personalizado';
  return 'Segundo';
}

function chunkSelections(selections: SelectionRow[]) {
  if (selections.length === 0) return [[]];

  const chunks: SelectionRow[][] = [];
  for (let index = 0; index < selections.length; index += SELECTIONS_PER_PDF_GROUP) {
    chunks.push(selections.slice(index, index + SELECTIONS_PER_PDF_GROUP));
  }
  return chunks;
}

function getReservationContentSize({
  reservation,
  offerings,
  selectionsByOffering,
}: {
  reservation: ReservationRow;
  offerings: OfferingRow[];
  selectionsByOffering: Map<string, SelectionRow[]>;
}) {
  const selectionCount = offerings.reduce(
    (total, offering) => total + (selectionsByOffering.get(offering.id)?.length ?? 0),
    0,
  );
  const textLength = [
    reservation.menu_text,
    reservation.second_course_type,
    reservation.allergens_and_diets,
    reservation.extras,
    reservation.setup_notes,
    reservation.service_outcome_notes,
    reservation.invoice_data,
  ].reduce((total, value) => total + (cleanText(value)?.length ?? 0), 0);

  return { selectionCount, textLength };
}

function SelectionList({
  offering,
  selections,
  donenessBySelection,
  continued = false,
}: {
  offering: OfferingRow;
  selections: SelectionRow[];
  donenessBySelection: Map<string, DonenessRow[]>;
  continued?: boolean;
}) {
  return (
    <View style={styles.offering} wrap={false}>
      <View style={styles.offeringHeader} wrap={false}>
        <View>
          <Text style={styles.offeringName}>{offering.display_name_snapshot}</Text>
          {continued ? <Text style={styles.continuedLabel}>Continuación</Text> : null}
        </View>
        <Text style={styles.offeringPax}>{offering.assigned_pax} pax</Text>
      </View>
      {cleanText(offering.notes) && !continued ? <Text style={styles.mutedText}>{offering.notes}</Text> : null}

      {selections.map((selection) => {
        const points = (donenessBySelection.get(selection.id) ?? [])
          .slice()
          .sort((a, b) => DONENESS_ORDER.indexOf(a.point) - DONENESS_ORDER.indexOf(b.point));
        const pointText = points
          .filter((point) => point.quantity > 0)
          .map((point) => `${DONENESS_LABELS[point.point] ?? point.point}: ${point.quantity}`)
          .join(' / ');

        return (
          <View key={selection.id} style={styles.selection} wrap={false}>
            <Text style={styles.selectionTitle}>
              {selection.quantity}x {selection.display_name_snapshot} · {getSelectionKindLabel(selection.selection_kind)}
            </Text>
            {cleanText(selection.description_snapshot) ? (
              <Text style={styles.mutedText}>{selection.description_snapshot}</Text>
            ) : null}
            {pointText ? <Text style={styles.mutedText}>Puntos: {pointText}</Text> : null}
            {cleanText(selection.notes) ? <Text style={styles.mutedText}>Notas: {selection.notes}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function ReservationCard({
  reservation,
  room,
  offerings,
  selectionsByOffering,
  donenessBySelection,
}: {
  reservation: ReservationRow;
  room: RoomAllocationRow | undefined;
  offerings: OfferingRow[];
  selectionsByOffering: Map<string, SelectionRow[]>;
  donenessBySelection: Map<string, DonenessRow[]>;
}) {
  const roomLabel = cleanText(roomName(room?.room ?? null));
  const roomNotes = cleanText(room?.notes);
  const peopleParts = [
    reservation.adults ? `${reservation.adults} adultos` : null,
    reservation.children ? `${reservation.children} niños` : null,
  ].filter(Boolean);
  const flags = [
    reservation.has_private_dining_room ? 'Comedor privado' : null,
    reservation.has_private_party ? 'Fiesta privada' : null,
  ].filter(Boolean);
  const { selectionCount, textLength } = getReservationContentSize({
    reservation,
    offerings,
    selectionsByOffering,
  });
  const shouldKeepReservationTogether = selectionCount <= 4 && textLength <= 420;

  return (
    <View style={styles.reservationCard} wrap={shouldKeepReservationTogether ? false : undefined}>
      <View style={styles.reservationHeader} wrap={false} minPresenceAhead={120}>
        <View style={styles.reservationMain}>
          <View style={styles.reservationMetaRow}>
            <Text style={styles.timePill}>{formatTime(reservation.entry_time)}</Text>
            {reservation.status === 'completed' ? <Text style={styles.completedBadge}>Completada</Text> : null}
          </View>
          <Text style={styles.reservationName}>{reservation.name}</Text>
        </View>
        <View style={styles.paxBox}>
          <Text style={styles.paxLabel}>Comensales</Text>
          <Text style={styles.paxValue}>{reservation.total_pax ?? 0}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.fieldGrid} wrap={false}>
          <FieldPill label="Sala" value={roomLabel ?? 'Sin sala asignada'} />
          <FieldPill label="Mesa / zona" value={roomNotes} />
          <FieldPill label="Personas" value={peopleParts.length > 0 ? peopleParts.join(' / ') : `${reservation.total_pax ?? 0} pax`} />
          <FieldPill label="Tipo" value={flags.length > 0 ? flags.join(' / ') : null} />
        </View>

        {offerings.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle} minPresenceAhead={70}>
              Oferta y selecciones
            </Text>
            {offerings.flatMap((offering) =>
              chunkSelections(selectionsByOffering.get(offering.id) ?? []).map((selectionChunk, chunkIndex) => (
                <SelectionList
                  key={`${offering.id}-${chunkIndex}`}
                  offering={offering}
                  selections={selectionChunk}
                  donenessBySelection={donenessBySelection}
                  continued={chunkIndex > 0}
                />
              )),
            )}
          </View>
        ) : (
          <View style={styles.fieldGrid} wrap={false}>
            <TextSection title="Menú / carta" value={reservation.menu_text} />
            <TextSection title="Segundo plato" value={reservation.second_course_type} />
          </View>
        )}

        <View style={styles.fieldGrid}>
          <TextSection title="Intolerancias / alergias" value={reservation.allergens_and_diets} />
          <TextSection title="Notas cocina" value={reservation.extras} />
          <TextSection title="Notas sala / montaje" value={reservation.setup_notes} />
          <TextSection title="Notas de servicio" value={reservation.service_outcome_notes} />
          <TextSection title="Facturación" value={reservation.invoice_data} />
          {reservation.service_outcome && reservation.service_outcome !== 'normal' ? (
            <TextSection title="Resultado servicio" value={reservation.service_outcome} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function ReservationReportPdf({
  reportData,
  from,
  to,
  generatedAt,
}: {
  reportData: ReportData;
  from: string;
  to: string;
  generatedAt: Date;
}) {
  const reservationsByDate = groupByDate(reportData.reservations);
  const totals = getReportTotals(reportData);
  const rangeLabel = `${formatShortDate(from)} - ${formatShortDate(to)}`;

  return (
    <Document
      title={from === to ? `Informe de reservas ${from}` : `Informe de reservas ${from} - ${to}`}
      author="Sikim Empuriabrava"
      subject="Informe de reservas"
      creator="Sikim Gestio Reserves"
      producer="Sikim Gestio Reserves"
      language="es-ES"
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.eyebrow}>Sikim Empuriabrava</Text>
              <Text style={styles.title}>Informe de reservas</Text>
            </View>
            <View style={styles.headerMetaBlock}>
              <Text style={styles.headerMeta}>Rango seleccionado: {rangeLabel}</Text>
              <Text style={styles.headerMeta}>Generado el {formatDateTime(generatedAt)}</Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Reservas</Text>
              <Text style={styles.summaryValue}>{totals.totalReservations}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Comensales</Text>
              <Text style={styles.summaryValue}>{totals.totalPax}</Text>
            </View>
          </View>
        </View>

        {Array.from(reservationsByDate.entries()).map(([date, dayReservations]) => {
          const dayPax = dayReservations.reduce((sum, reservation) => sum + (reservation.total_pax ?? 0), 0);
          return (
            <View key={date} style={styles.dayBlock}>
              <View style={styles.dayHeading} wrap={false} minPresenceAhead={90}>
                <Text style={styles.dayTitle}>{formatLongDate(date)}</Text>
                <Text style={styles.dayMeta}>
                  {dayReservations.length} {dayReservations.length === 1 ? 'reserva' : 'reservas'} · {dayPax} pax
                </Text>
              </View>
              {dayReservations.map((reservation) => (
                <ReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  room={reportData.roomsByReservation.get(reservation.id)}
                  offerings={reportData.offeringsByReservation.get(reservation.id) ?? []}
                  selectionsByOffering={reportData.selectionsByOffering}
                  donenessBySelection={reportData.donenessBySelection}
                />
              ))}
            </View>
          );
        })}

        <Text
          fixed
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} / ${totalPages}`}
        />
      </Page>
    </Document>
  );
}
