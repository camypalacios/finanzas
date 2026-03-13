// api/dashboard/summary.js — GET /api/dashboard/summary?mes=3&anio=2026
import { withAuth } from '../_lib/auth.js';
import { query } from '../_lib/db.js';

async function handler(req, res) {
  const { mes, anio } = req.query;
  if (!mes || !anio) return res.status(400).json({ error: 'Faltan mes/anio' });

  // Ingresos del mes
  const [ing] = await query(
    `SELECT COALESCE(SUM(CASE WHEN moneda='ARS' THEN monto ELSE 0 END),0) AS total_ars,
            COALESCE(SUM(CASE WHEN moneda='USD' THEN monto ELSE 0 END),0) AS total_usd
     FROM ingresos WHERE MONTH(fecha)=? AND YEAR(fecha)=?`, [mes, anio]);

  // Gastos del mes agrupados por tarjeta
  const porTarjeta = await query(
    `SELECT t.id, t.nombre, t.color_hex,
            COALESCE(SUM(CASE WHEN g.moneda='ARS' THEN g.monto ELSE 0 END),0) AS total_ars,
            COALESCE(SUM(CASE WHEN g.moneda='USD' THEN g.monto ELSE 0 END),0) AS total_usd
     FROM gastos g
     LEFT JOIN tarjetas t ON g.tarjeta_id = t.id
     WHERE MONTH(g.fecha)=? AND YEAR(g.fecha)=?
     GROUP BY g.tarjeta_id
     ORDER BY t.id`, [mes, anio]);

  // Total gastos
  const [totGastos] = await query(
    `SELECT COALESCE(SUM(CASE WHEN moneda='ARS' THEN monto ELSE 0 END),0) AS total_ars,
            COALESCE(SUM(CASE WHEN moneda='USD' THEN monto ELSE 0 END),0) AS total_usd
     FROM gastos WHERE MONTH(fecha)=? AND YEAR(fecha)=?`, [mes, anio]);

  // Propios vs Ajenos
  const [propios] = await query(
    `SELECT COALESCE(SUM(monto),0) AS total FROM gastos
     WHERE MONTH(fecha)=? AND YEAR(fecha)=? AND tercero_id IS NULL AND moneda='ARS'`, [mes, anio]);
  const [ajenos] = await query(
    `SELECT COALESCE(SUM(monto),0) AS total FROM gastos
     WHERE MONTH(fecha)=? AND YEAR(fecha)=? AND tercero_id IS NOT NULL AND moneda='ARS'`, [mes, anio]);

  // Metas activas
  const metas = await query('SELECT * FROM metas_ahorro WHERE activa=1 ORDER BY fecha_limite');

  // Aporte mensual necesario por meta
  const today = new Date();
  const metasConCalculo = metas.map(m => {
    const limite = new Date(m.fecha_limite);
    const mesesRestantes = Math.max(1,
      (limite.getFullYear() - today.getFullYear()) * 12 + (limite.getMonth() - today.getMonth()));
    const falta = Math.max(0, parseFloat(m.monto_objetivo) - parseFloat(m.monto_actual));
    return { ...m, meses_restantes: mesesRestantes, aporte_mensual: falta / mesesRestantes };
  });

  return res.json({
    ingresos: ing,
    gastos: totGastos,
    balance_ars: ing.total_ars - totGastos.total_ars,
    balance_usd: ing.total_usd - totGastos.total_usd,
    por_tarjeta: porTarjeta,
    propios_vs_ajenos: { propios: propios.total, ajenos: ajenos.total },
    metas: metasConCalculo,
  });
}
export default withAuth(handler);
