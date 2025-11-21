export type Turno = 'comida' | 'cena';

export type EstadoReserva = 'pendiente' | 'confirmada' | 'cancelada';

export interface MenuOption {
  id: string;
  nombre: string;
  descripcion?: string;
}

export interface MenuDefinido {
  id: string;
  nombre: string;
  primeros: MenuOption[];
  segundos: MenuOption[];
  postres?: MenuOption[];
}

export interface EleccionSegundoPlato {
  segundoId: string;
  nombre: string;
  cantidad: number;
}

export interface Reserva {
  id: string;
  fecha: string; // ISO string
  turno: Turno;
  nombreCliente: string;
  telefono?: string;
  email?: string;
  numeroPersonas: number;
  menuId: string; // referencia a MenuDefinido
  segundosSeleccionados: EleccionSegundoPlato[];
  intolerancias: string;
  notasSala?: string;
  notasCocina?: string;
  mesa?: string;
  estado: EstadoReserva;
  createdAt: string; // ISO
}
