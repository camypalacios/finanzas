// api/categorias/index.js  GET POST /api/categorias  PUT DELETE /api/categorias/:id
import { withAuth } from '../_lib/auth.js';
import { query } from '../_lib/db.js';

async function handler(req, res) {
  const { id } = req.query;

  // ── Rutas con :id ─────────────────────────────────────────
  if (id) {
    if (req.method === 'PUT') {
      const { nombre, icono, color_hex, parent_id } = req.body;
      await query('UPDATE categorias SET nombre=?,icono=?,color_hex=?,parent_id=? WHERE id=?',
        [nombre, icono, color_hex, parent_id || null, id]);
      return res.json({ ok: true });
    }
    if (req.method === 'DELETE') {
      await query('UPDATE categorias SET activa=0 WHERE id=?', [id]);
      return res.json({ ok: true });
    }
    return res.status(405).end();
  }

  // ── Rutas de colección ─────────────────────────────────────
  if (req.method === 'GET') {
    return res.json(await query('SELECT * FROM categorias WHERE activa=1 ORDER BY parent_id IS NULL DESC, nombre'));
  }
  if (req.method === 'POST') {
    const { nombre, icono = 'tag', color_hex = '#888888', parent_id } = req.body;
    const [r] = await query(
      'INSERT INTO categorias (nombre, icono, color_hex, parent_id) VALUES (?,?,?,?)',
      [nombre, icono, color_hex, parent_id || null]
    );
    return res.status(201).json({ id: r.insertId });
  }
  return res.status(405).end();
}
export default withAuth(handler);
