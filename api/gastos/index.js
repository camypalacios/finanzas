// api/gastos/index.js — GET POST /api/gastos  GET PUT PATCH DELETE /api/gastos/:id
import { withAuth } from '../_lib/auth.js';
import { query } from '../_lib/db.js';

async function handler(req, res) {
  const { id } = req.query;

  // ── Rutas con :id ─────────────────────────────────────────
  if (id) {
    if (req.method === 'GET') {
      const rows = await query(
        `SELECT g.*,
          c.nombre AS categoria_nombre,
          t.nombre AS tarjeta_nombre,
          te.nombre AS tercero_nombre,
          GROUP_CONCAT(DISTINCT e.id ORDER BY e.id SEPARATOR ',') AS etiqueta_ids,
          GROUP_CONCAT(DISTINCT e.nombre ORDER BY e.id SEPARATOR ',') AS etiquetas
         FROM gastos g
         LEFT JOIN categorias c ON g.categoria_id = c.id
         LEFT JOIN tarjetas t ON g.tarjeta_id = t.id
         LEFT JOIN terceros te ON g.tercero_id = te.id
         LEFT JOIN gasto_etiquetas ge ON g.id = ge.gasto_id
         LEFT JOIN etiquetas e ON ge.etiqueta_id = e.id
         WHERE g.id=? GROUP BY g.id`, [id]);
      if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
      return res.json(rows[0]);
    }
    if (req.method === 'PUT') {
      const { descripcion, monto, moneda, fecha, categoria_id, tarjeta_id, tercero_id,
              es_fijo, notas, etiquetas = [], propagar_tercero = false } = req.body;
      await query(
        `UPDATE gastos SET descripcion=?, monto=?, moneda=?, fecha=?, categoria_id=?,
          tarjeta_id=?, tercero_id=?, es_fijo=?, notas=? WHERE id=?`,
        [descripcion, monto, moneda, fecha, categoria_id || null, tarjeta_id || null,
         tercero_id || null, es_fijo, notas, id]
      );
      if (propagar_tercero) {
        const gasto = await query('SELECT parent_id FROM gastos WHERE id=?', [id]);
        const pid = gasto[0]?.parent_id || id;
        await query('UPDATE gastos SET tercero_id=? WHERE parent_id=? AND id != ?', [tercero_id || null, pid, id]);
      }
      await query('DELETE FROM gasto_etiquetas WHERE gasto_id=?', [id]);
      for (const etqId of etiquetas) {
        await query('INSERT IGNORE INTO gasto_etiquetas (gasto_id, etiqueta_id) VALUES (?,?)', [id, etqId]);
      }
      return res.json({ ok: true });
    }
    if (req.method === 'PATCH') {
      const { categoria_id } = req.body;
      await query('UPDATE gastos SET categoria_id=? WHERE id=?', [categoria_id, id]);
      return res.json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const { eliminar_serie = false } = req.query;
      if (eliminar_serie === 'true') {
        const gasto = await query('SELECT parent_id FROM gastos WHERE id=?', [id]);
        const pid = gasto[0]?.parent_id || id;
        await query('DELETE FROM gastos WHERE parent_id=? OR id=?', [pid, pid]);
      } else {
        await query('DELETE FROM gastos WHERE id=?', [id]);
      }
      return res.json({ ok: true });
    }
    return res.status(405).end();
  }

  // ── Rutas de colección ─────────────────────────────────────
  if (req.method === 'GET') {
    const { mes, anio, tarjeta_id, tercero_id, categoria_id, estado, es_fijo } = req.query;
    let sql = `
      SELECT g.*,
        c.nombre AS categoria_nombre, c.icono AS categoria_icono, c.color_hex AS categoria_color,
        t.nombre AS tarjeta_nombre, t.color_hex AS tarjeta_color,
        te.nombre AS tercero_nombre,
        GROUP_CONCAT(DISTINCT e.nombre ORDER BY e.nombre SEPARATOR ',') AS etiquetas
      FROM gastos g
      LEFT JOIN categorias c ON g.categoria_id = c.id
      LEFT JOIN tarjetas t ON g.tarjeta_id = t.id
      LEFT JOIN terceros te ON g.tercero_id = te.id
      LEFT JOIN gasto_etiquetas ge ON g.id = ge.gasto_id
      LEFT JOIN etiquetas e ON ge.etiqueta_id = e.id
      WHERE 1=1`;
    const params = [];
    if (mes && anio) { sql += ' AND MONTH(g.fecha)=? AND YEAR(g.fecha)=?'; params.push(mes, anio); }
    if (tarjeta_id) { sql += ' AND g.tarjeta_id=?'; params.push(tarjeta_id); }
    if (tercero_id) { sql += ' AND g.tercero_id=?'; params.push(tercero_id); }
    if (categoria_id) { sql += ' AND g.categoria_id=?'; params.push(categoria_id); }
    if (estado) { sql += ' AND g.estado=?'; params.push(estado); }
    if (es_fijo !== undefined) { sql += ' AND g.es_fijo=?'; params.push(es_fijo); }
    sql += ' GROUP BY g.id ORDER BY g.fecha DESC, g.id DESC';
    const rows = await query(sql, params);
    return res.json(rows);
  }

  if (req.method === 'POST') {
    const {
      descripcion, monto, moneda = 'ARS', fecha, categoria_id, tarjeta_id,
      tercero_id, es_fijo = 0, notas, cuotas = 1, etiquetas = []
    } = req.body;

    if (!descripcion || !monto || !fecha) return res.status(400).json({ error: 'Faltan campos requeridos' });

    // Si es un pago único o la primera cuota
    const [result] = await query(
      `INSERT INTO gastos (descripcion, monto, moneda, fecha, categoria_id, tarjeta_id, tercero_id,
        es_fijo, es_cuota, cuota_numero, cuota_total, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')`,
      [descripcion, monto, moneda, fecha, categoria_id || null, tarjeta_id || null, tercero_id || null,
       es_fijo, cuotas > 1 ? 1 : 0, cuotas > 1 ? 1 : null, cuotas > 1 ? cuotas : null]
    );
    const parentId = result.insertId;

    // Actualizar parent_id al propio id
    if (cuotas > 1) {
      await query('UPDATE gastos SET parent_id=? WHERE id=?', [parentId, parentId]);
    }

    // Crear cuotas futuras
    if (cuotas > 1) {
      const baseDate = new Date(fecha);
      for (let i = 2; i <= cuotas; i++) {
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + (i - 1));
        const fechaCuota = d.toISOString().split('T')[0];
        await query(
          `INSERT INTO gastos (descripcion, monto, moneda, fecha, categoria_id, tarjeta_id, tercero_id,
            es_cuota, cuota_numero, cuota_total, parent_id, estado)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 'preventivo')`,
          [`${descripcion} (${i}/${cuotas})`, monto, moneda, fechaCuota,
           categoria_id || null, tarjeta_id || null, tercero_id || null, i, cuotas, parentId]
        );
      }
    }

    // Etiquetas
    for (const etqId of etiquetas) {
      await query('INSERT IGNORE INTO gasto_etiquetas (gasto_id, etiqueta_id) VALUES (?,?)', [parentId, etqId]);
    }

    return res.status(201).json({ id: parentId, cuotas_creadas: cuotas });
  }

  return res.status(405).end();
}

export default withAuth(handler);
