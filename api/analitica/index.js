// api/analitica/index.js — GET /api/analitica?desde=2025-01&hasta=2026-03
import { withAuth } from '../_lib/auth.js';
import { query } from '../_lib/db.js';

async function handler(req, res) {
  const { desde = '', hasta = '' } = req.query;

  // Evolución mensual (ingresos vs gastos últimos 12 meses)
  const evolucion = await query(`
    SELECT periodo, SUM(ingresos) AS ingresos, SUM(gastos) AS gastos FROM (
      SELECT DATE_FORMAT(fecha, '%Y-%m') AS periodo, monto AS ingresos, 0 AS gastos FROM ingresos
      UNION ALL
      SELECT DATE_FORMAT(fecha, '%Y-%m') AS periodo, 0 AS ingresos, monto AS gastos FROM gastos
    ) t
    WHERE periodo >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 12 MONTH), '%Y-%m')
    GROUP BY periodo ORDER BY periodo`);

  // Gastos por categoría (torta)
  const porCategoria = await query(`
    SELECT c.nombre, c.color_hex, SUM(g.monto) AS total, g.moneda
    FROM gastos g
    LEFT JOIN categorias c ON g.categoria_id = c.id
    WHERE g.moneda='ARS'
    GROUP BY g.categoria_id, g.moneda ORDER BY total DESC LIMIT 10`);

  // Terceros: saldo pendiente
  const terceros = await query(`
    SELECT te.nombre, te.relacion,
      SUM(CASE WHEN g.moneda='ARS' THEN g.monto ELSE 0 END) AS total_ars,
      SUM(CASE WHEN g.moneda='USD' THEN g.monto ELSE 0 END) AS total_usd,
      COUNT(*) AS qty_gastos
    FROM gastos g
    JOIN terceros te ON g.tercero_id = te.id
    GROUP BY g.tercero_id ORDER BY total_ars DESC`);

  // Gastos fijos/etiquetados
  const fijos = await query(`
    SELECT g.descripcion, g.monto, g.moneda, e.nombre AS etiqueta, e.color_hex, g.fecha
    FROM gastos g
    LEFT JOIN gasto_etiquetas ge ON g.id = ge.gasto_id
    LEFT JOIN etiquetas e ON ge.etiqueta_id = e.id
    WHERE g.es_fijo=1
    ORDER BY g.descripcion`);

  return res.json({ evolucion, porCategoria, terceros, fijos });
}
export default withAuth(handler);
