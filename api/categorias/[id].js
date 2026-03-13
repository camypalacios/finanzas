// api/categorias/[id].js  PUT DELETE /api/categorias/:id
import { withAuth } from '../_lib/auth.js';
import { query } from '../_lib/db.js';

async function handler(req, res) {
  const { id } = req.query;
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
export default withAuth(handler);
