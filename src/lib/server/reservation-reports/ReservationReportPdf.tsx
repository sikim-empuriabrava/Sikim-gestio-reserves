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
    padding: 30,
    backgroundColor: '#fbf6ed',
    color: '#2d2419',
    fontFamily: 'Helvetica',
    fontSize: 9,
    lineHeight: 1.35,
  },
  header: {
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#2d2419',
    color: '#fff1d8',
    marginBottom: 12,
  },
  eyebrow: {
    color: '#d6b57f',
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    marginTop: 5,
  },
  headerMeta: {
    color: '#ead7ba',
    fontSize: 9,
    marginTop: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    marginTop: 11,
  },
  summaryCard: {
    width: '31%',
    marginRight: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fffaf2',
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
    fontSize: 16,
    fontWeight: 700,
    marginTop: 3,
  },
  dayBlock: {
    marginBottom: 11,
  },
  dayHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dec7a6',
    backgroundColor: '#f4e3c9',
    marginBottom: 6,
  },
  dayTitle: {
    fontSize: 14,
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
    borderRadius: 9,
    backgroundColor: '#ffffff',
    marginBottom: 6,
    overflow: 'hidden',
  },
  reservationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 9,
    backgroundColor: '#fff3df',
    borderBottomWidth: 1,
    borderBottomColor: '#eadcca',
  },
  timePill: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d2ad7b',
    color: '#6b4925',
    fontSize: 8,
    fontWeight: 700,
  },
  completedBadge: {
    alignSelf: 'flex-start',
    marginTop: 3,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#99c7a3',
    color: '#166534',
    backgroundColor: '#edf8ef',
    fontSize: 8,
    fontWeight: 700,
  },
  reservationName: {
    fontSize: 13,
    fontWeight: 700,
    marginTop: 5,
    color: '#251d16',
  },
  paxBox: {
    minWidth: 70,
    padding: 7,
    borderRadius: 8,
    backgroundColor: '#8a5b2b',
    color: '#ffffff',
    textAlign: 'right',
  },
  paxLabel: {
    color: '#ffe2b6',
    fontSize: 7,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  paxValue: {
    fontSize: 16,
    fontWeight: 700,
    marginTop: 2,
  },
  cardBody: {
    padding: 9,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  fieldPill: {
    width: '48%',
    marginRight: 5,
    marginBottom: 5,
    padding: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#eadcca',
    backgroundColor: '#fffaf2',
  },
  fieldLabel: {
    color: '#98764c',
    fontSize: 7,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  fieldValue: {
    color: '#2e241a',
    fontSize: 9,
    fontWeight: 700,
    marginTop: 2,
  },
  sectionTitle: {
    color: '#7f592d',
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase',
    marginTop: 2,
    marginBottom: 4,
  },
  offering: {
    padding: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#e2d1bd',
    backgroundColor: '#fffaf2',
    marginBottom: 4,
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
    fontSize: 10,
    fontWeight: 700,
  },
  offeringPax: {
    color: '#8b6842',
    fontSize: 8,
    fontWeight: 700,
  },
  mutedText: {
    color: '#6f6258',
    fontSize: 8,
    marginTop: 2,
  },
  selection: {
    marginTop: 4,
    padding: 5,
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
    marginRight: 5,
    marginBottom: 5,
    padding: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#eadcca',
    backgroundColor: '#fffdf8',
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
        <View>
          <Text style={styles.timePill}>{formatTime(reservation.entry_time)}</Text>
          {reservation.status === 'completed' ? <Text style={styles.completedBadge}>Completada</Text> : null}
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
          <Text style={styles.eyebrow}>Sikim Empuriabrava</Text>
          <Text style={styles.title}>Informe de reservas</Text>
          <Text style={styles.headerMeta}>Rango seleccionado: {rangeLabel}</Text>
          <Text style={styles.headerMeta}>Generado el {formatDateTime(generatedAt)}</Text>
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
