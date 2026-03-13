// src/types/index.ts — Tipos globales de la aplicación
export type Moneda = 'ARS' | 'USD';
export type EstadoGasto = 'preventivo' | 'confirmado' | 'manual';

export interface Tarjeta {
  id: number;
  nombre: string;
  tipo: 'credito' | 'debito';
  ultimos_digitos?: string;
  color_hex: string;
  activa: boolean;
}

export interface Categoria {
  id: number;
  nombre: string;
  icono: string;
  color_hex: string;
  parent_id: number | null;
  activa: boolean;
}

export interface Etiqueta {
  id: number;
  nombre: string;
  color_hex: string;
}

export interface Tercero {
  id: number;
  nombre: string;
  relacion?: string;
  total_gastos?: number;
}

export interface Gasto {
  id: number;
  descripcion: string;
  monto: number;
  moneda: Moneda;
  fecha: string;
  categoria_id?: number;
  categoria_nombre?: string;
  categoria_icono?: string;
  categoria_color?: string;
  tarjeta_id?: number;
  tarjeta_nombre?: string;
  tarjeta_color?: string;
  tercero_id?: number;
  tercero_nombre?: string;
  es_fijo: boolean;
  es_cuota: boolean;
  cuota_numero?: number;
  cuota_total?: number;
  parent_id?: number;
  estado: EstadoGasto;
  etiquetas?: string;
  notas?: string;
  creado_en: string;
}

export interface Ingreso {
  id: number;
  descripcion: string;
  monto: number;
  moneda: Moneda;
  fecha: string;
  categoria_id?: number;
  categoria_nombre?: string;
  tercero_id?: number;
  repetir_mensual: boolean;
  notas?: string;
}

export interface MetaAhorro {
  id: number;
  nombre: string;
  monto_objetivo: number;
  monto_actual: number;
  moneda: Moneda;
  fecha_limite: string;
  activa: boolean;
  descripcion?: string;
  icono: string;
  color_hex: string;
  meses_restantes?: number;
  aporte_mensual?: number;
}

export interface TipoCambio {
  fecha: string;
  usd_oficial: number;
  usd_blue: number;
  usd_mep?: number;
}

export interface DashboardSummary {
  ingresos: { total_ars: number; total_usd: number };
  gastos: { total_ars: number; total_usd: number };
  balance_ars: number;
  balance_usd: number;
  por_tarjeta: Array<{ id: number; nombre: string; color_hex: string; total_ars: number; total_usd: number }>;
  propios_vs_ajenos: { propios: number; ajenos: number };
  metas: MetaAhorro[];
}

export interface AnaliticaData {
  evolucion: Array<{ periodo: string; ingresos: number; gastos: number }>;
  porCategoria: Array<{ nombre: string; color_hex: string; total: number; moneda: Moneda }>;
  terceros: Array<{ nombre: string; relacion: string; total_ars: number; total_usd: number; qty_gastos: number }>;
  fijos: Array<{ descripcion: string; monto: number; moneda: Moneda; etiqueta: string; color_hex: string; fecha: string }>;
}
