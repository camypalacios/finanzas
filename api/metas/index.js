// api/metas/index.js  GET POST /api/metas  GET PUT POST DELETE /api/metas/:id
import { withAuth } from '../_lib/auth.js';
import { query } from '../_lib/db.js';

async function handler(req, res) {
  const { id } = req.query;

  // ── Rutas con :id ─────────────────────────────────────────
  if (id) {
    if (req.method === 'GET') {
      const [meta] = await query('SELECT * FROM metas_ahorro WHERE id=?', [id]);
      if (!meta) return res.status(404).json({ error: 'No encontrada' });
      const movimientos = await query('SELECT * FROM movimientos_meta WHERE meta_id=? ORDER BY fecha DESC', [id]);
      return res.json({ ...meta, movimientos });
    }
    if (req.method === 'PUT') {
      const { nombre, monto_objetivo, moneda, fecha_limite, descripcion, activa } = req.body;
      await query(
        'UPDATE metas_ahorro SET nombre=?,monto_objetivo=?,moneda=?,fecha_limite=?,descripcion=?,activa=? WHERE id=?',
        [nombre, monto_objetivo, moneda, fecha_limite, descripcion, activa, id]
      );
      return res.json({ ok: true });
    }
    if (req.method === 'POST' && req.query.action === 'aportar') {
      const { monto, moneda = 'ARS', tipo = 'aporte', fecha, notas } = req.body;
      const delta = tipo === 'retiro' ? -parseFloat(monto) : parseFloat(monto);
      await query(
        'INSERT INTO movimientos_meta (meta_id, monto, moneda, tipo, fecha, notas) VALUES (?,?,?,?,?,?)',
        [id, Math.abs(monto), moneda, tipo, fecha, notas || null]
      );
      await query('UPDATE metas_ahorro SET monto_actual = monto_actual + ? WHERE id=?', [delta, id]);
      return res.json({ ok: true });
    }
    if (req.method === 'DELETE') {
      await query('UPDATE metas_ahorro SET activa=0 WHERE id=?', [id]);
      return res.json({ ok: true });
    }
    return res.status(405).end();
  }

  // ── Rutas de colección ─────────────────────────────────────
  if (req.method === 'GET') {
    return res.json(await query('SELECT * FROM metas_ahorro ORDER BY activa DESC, fecha_limite'));
  }
  if (req.method === 'POST') {
    const { nombre, monto_objetivo, moneda = 'ARS', fecha_limite, descripcion, icono, color_hex } = req.body;
    const [r] = await query(
      `INSERT INTO metas_ahorro (nombre, monto_objetivo, moneda, fecha_limite, descripcion, icono, color_hex)
       VALUES (?,?,?,?,?,?,?)`,
      [nombre, monto_objetivo, moneda, fecha_limite, descripcion || null,
       icono || 'target', color_hex || '#00ff87']
    );
    return res.status(201).json({ id: r.insertId });
  }
  return res.status(405).end();
}
export default withAuth(handler);
