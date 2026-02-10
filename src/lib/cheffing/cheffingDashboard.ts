import 'server-only';

import { getMenuEngineeringRows } from '@/lib/cheffing/menuEngineering';
import { type MenuEngineeringVatRate } from '@/lib/cheffing/menuEngineeringVat';

export const DEFAULT_VAT_RATE: MenuEngineeringVatRate = 0.1;
export const MAX_FOOD_COST_PCT = 0.35;
export const MIN_MARGIN_PCT = 0.6;

export type CheffingAlertCode = 'MISSING_PVP' | 'MISSING_COST' | 'LOSS' | 'FOOD_COST_HIGH' | 'MARGIN_LOW';

export type CheffingDishAlert = {
  code: CheffingAlertCode;
  label: string;
  severity: 1 | 2 | 3;
};

export type CheffingDashboardRow = {
  id: string;
  name: string;
  selling_price: number | null;
  cost_per_serving: number | null;
  net_price: number | null;
  margin_unit: number | null;
  food_cost_pct: number | null;
  margin_pct: number | null;
  alerts: CheffingDishAlert[];
  max_severity: 0 | 1 | 2 | 3;
};

export type CheffingDashboardData = {
  vatRate: MenuEngineeringVatRate;
  totalDishes: number;
  missingPvpCount: number;
  missingCostCount: number;
  alertDishesCount: number;
  alertRows: CheffingDashboardRow[];
};

function buildAlerts(row: Pick<CheffingDashboardRow, 'selling_price' | 'cost_per_serving' | 'margin_unit' | 'food_cost_pct' | 'margin_pct'>) {
  const alerts: CheffingDishAlert[] = [];

  if (row.selling_price === null) {
    alerts.push({ code: 'MISSING_PVP', label: 'Sin PVP', severity: 3 });
  }

  if (row.cost_per_serving === null) {
    alerts.push({ code: 'MISSING_COST', label: 'Sin coste', severity: 3 });
  }

  if (row.margin_unit !== null && row.margin_unit < 0) {
    alerts.push({ code: 'LOSS', label: 'Margen negativo', severity: 3 });
  }

  if (row.food_cost_pct !== null && row.food_cost_pct > MAX_FOOD_COST_PCT) {
    alerts.push({ code: 'FOOD_COST_HIGH', label: 'Food cost alto', severity: 2 });
  }

  if (row.margin_pct !== null && row.margin_pct < MIN_MARGIN_PCT) {
    alerts.push({ code: 'MARGIN_LOW', label: 'Margen % bajo', severity: 1 });
  }

  return alerts;
}

export async function getCheffingDashboardData(vatRate: MenuEngineeringVatRate = DEFAULT_VAT_RATE): Promise<CheffingDashboardData> {
  const { rows } = await getMenuEngineeringRows(vatRate);

  const mappedRows: CheffingDashboardRow[] = rows.map((row) => {
    const marginPct =
      row.net_price !== null && row.net_price > 0 && row.margin_unit !== null ? row.margin_unit / row.net_price : null;

    const dashboardRow: CheffingDashboardRow = {
      id: row.id,
      name: row.name,
      selling_price: row.selling_price,
      cost_per_serving: row.cost_per_serving,
      net_price: row.net_price,
      margin_unit: row.margin_unit,
      food_cost_pct: row.food_cost_pct,
      margin_pct: marginPct,
      alerts: [],
      max_severity: 0,
    };

    const alerts = buildAlerts(dashboardRow);
    const maxSeverity = alerts.reduce<0 | 1 | 2 | 3>((highest, alert) => {
      if (alert.severity > highest) {
        return alert.severity;
      }
      return highest;
    }, 0);

    return {
      ...dashboardRow,
      alerts,
      max_severity: maxSeverity,
    };
  });

  const alertRows = mappedRows
    .filter((row) => row.alerts.length > 0)
    .sort((a, b) => {
      if (a.max_severity !== b.max_severity) {
        return b.max_severity - a.max_severity;
      }
      if (a.alerts.length !== b.alerts.length) {
        return b.alerts.length - a.alerts.length;
      }
      return a.name.localeCompare(b.name, 'es');
    });

  return {
    vatRate,
    totalDishes: mappedRows.length,
    missingPvpCount: mappedRows.filter((row) => row.selling_price === null).length,
    missingCostCount: mappedRows.filter((row) => row.cost_per_serving === null).length,
    alertDishesCount: alertRows.length,
    alertRows,
  };
}
