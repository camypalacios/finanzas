// api/currency/rate.js — GET /api/currency/rate
import { withAuth } from '../_lib/auth.js';
import { query } from '../_lib/db.js';

async function handler(req, res) {
  if (req.method === 'GET') {
    // Intentar obtener rate de hoy en BD
    const today = new Date().toISOString().split('T')[0];
    const cached = await query('SELECT * FROM tipo_cambio WHERE fecha = ? ORDER BY id DESC LIMIT 1', [today]);
    if (cached.length > 0 && !req.query.refresh) {
      return res.json(cached[0]);
    }

    // Consultar bluelytics
    try {
      const resp = await fetch('https://api.bluelytics.com.ar/v2/latest');
      const data = await resp.json();
      const oficial = parseFloat(data.oficial?.value_sell || data.oficial?.value_avg || 0);
      const blue = parseFloat(data.blue?.value_sell || data.blue?.value_avg || 0);
      const mep = parseFloat(data.oficial_euro?.value_sell || 0);

      await query(
        `INSERT INTO tipo_cambio (fecha, usd_oficial, usd_blue, usd_mep, fuente, manual)
         VALUES (?, ?, ?, ?, 'bluelytics', 0)
         ON DUPLICATE KEY UPDATE usd_oficial=VALUES(usd_oficial), usd_blue=VALUES(usd_blue), usd_mep=VALUES(usd_mep)`,
        [today, oficial, blue, mep]
      );
      return res.json({ fecha: today, usd_oficial: oficial, usd_blue: blue, usd_mep: mep });
    } catch {
      // Si falla la API externa, devolver el último que tengamos
      const last = await query('SELECT * FROM tipo_cambio ORDER BY fecha DESC LIMIT 1');
      return res.json(last[0] || { usd_oficial: 1000, usd_blue: 1200, usd_mep: 1100 });
    }
  }

  if (req.method === 'POST') {
    // Override manual del tipo de cambio
    const { fecha, usd_oficial, usd_blue, usd_mep } = req.body;
    await query(
      `INSERT INTO tipo_cambio (fecha, usd_oficial, usd_blue, usd_mep, fuente, manual)
       VALUES (?, ?, ?, ?, 'manual', 1)
       ON DUPLICATE KEY UPDATE usd_oficial=VALUES(usd_oficial), usd_blue=VALUES(usd_blue), usd_mep=VALUES(usd_mep), manual=1`,
      [fecha, usd_oficial, usd_blue || null, usd_mep || null]
    );
    return res.json({ ok: true });
  }

  return res.status(405).end();
}

export default withAuth(handler);
