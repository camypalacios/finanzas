// api/[...path].js — Router único · 1 sola serverless function
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { query } from './_lib/db.js';
import crypto from 'crypto';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_dev');

async function verifyToken(req) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new Error('No token');
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const seg = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
  const route = seg.join('/');
  const id = seg[1] && /^\d+$/.test(seg[1]) ? seg[1] : null;
  const action = req.query.action || (seg.length > 2 && !/^\d+$/.test(seg[2]) ? seg[2] : null);

  // ── AUTH (público) ───────────────────────────────────────
  if (route === 'auth/login') {
    if (req.method !== 'POST') return res.status(405).end();
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Faltan credenciales' });
    const expectedUser = process.env.APP_USER || 'matias';
    if (username !== expectedUser) return res.status(401).json({ error: 'Credenciales incorrectas' });
    let valid = false;
    try {
      const rows = await query('SELECT password_hash FROM usuarios WHERE username = ? LIMIT 1', [username]);
      const dbHash = rows[0]?.password_hash;
      if (dbHash && !dbHash.startsWith('$2a$10$placeholder')) valid = await bcrypt.compare(password, dbHash);
    } catch (_) {}
    if (!valid) {
      const hash = process.env.APP_PASSWORD_HASH;
      if (hash && !hash.startsWith('$2a$10$placeholder')) valid = await bcrypt.compare(password, hash);
      else valid = password === (process.env.APP_PASSWORD_RAW || 'felipe2026');
    }
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const token = await new SignJWT({ sub: '1', username })
      .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('30d').sign(JWT_SECRET);
    return res.status(200).json({ token, username });
  }

  if (route === 'auth/change-password') {
    if (req.method !== 'POST') return res.status(405).end();
    const { codigo, nuevaPassword } = req.body || {};
    if (!codigo || !nuevaPassword) return res.status(400).json({ error: 'Faltan campos requeridos' });
    if (codigo !== 'Felipe') return res.status(401).json({ error: 'Código de acceso incorrecto' });
    if (nuevaPassword.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    const hash = await bcrypt.hash(nuevaPassword, 10);
    await query('UPDATE usuarios SET password_hash = ? WHERE username = ?', [hash, process.env.APP_USER || 'matias']);
    return res.status(200).json({ ok: true, message: 'Contraseña actualizada correctamente' });
  }

  // ── Requiere auth ─────────────────────────────────────────
  try { req.user = await verifyToken(req); }
  catch { return res.status(401).json({ error: 'No autorizado' }); }

  const resource = seg[0];

  // ── GASTOS ───────────────────────────────────────────────
  if (resource === 'gastos') {
    if (id) {
      if (req.method === 'GET') {
        const rows = await query(
          `SELECT g.*, c.nombre AS categoria_nombre, t.nombre AS tarjeta_nombre,
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
        return rows.length ? res.json(rows[0]) : res.status(404).json({ error: 'No encontrado' });
      }
      if (req.method === 'PUT') {
        const { descripcion, monto, moneda, fecha, categoria_id, tarjeta_id, tercero_id,
                es_fijo, notas, etiquetas = [], propagar_tercero = false } = req.body;
        await query(
          `UPDATE gastos SET descripcion=?, monto=?, moneda=?, fecha=?, categoria_id=?,
            tarjeta_id=?, tercero_id=?, es_fijo=?, notas=? WHERE id=?`,
          [descripcion, monto, moneda, fecha, categoria_id||null, tarjeta_id||null,
           tercero_id||null, es_fijo, notas, id]);
        if (propagar_tercero) {
          const g = await query('SELECT parent_id FROM gastos WHERE id=?', [id]);
          const pid = g[0]?.parent_id || id;
          await query('UPDATE gastos SET tercero_id=? WHERE parent_id=? AND id != ?', [tercero_id||null, pid, id]);
        }
        await query('DELETE FROM gasto_etiquetas WHERE gasto_id=?', [id]);
        for (const etqId of etiquetas)
          await query('INSERT IGNORE INTO gasto_etiquetas (gasto_id, etiqueta_id) VALUES (?,?)', [id, etqId]);
        return res.json({ ok: true });
      }
      if (req.method === 'PATCH') {
        await query('UPDATE gastos SET categoria_id=? WHERE id=?', [req.body.categoria_id, id]);
        return res.json({ ok: true });
      }
      if (req.method === 'DELETE') {
        if (req.query.eliminar_serie === 'true') {
          const g = await query('SELECT parent_id FROM gastos WHERE id=?', [id]);
          const pid = g[0]?.parent_id || id;
          await query('DELETE FROM gastos WHERE parent_id=? OR id=?', [pid, pid]);
        } else {
          await query('DELETE FROM gastos WHERE id=?', [id]);
        }
        return res.json({ ok: true });
      }
      return res.status(405).end();
    }
    if (req.method === 'GET') {
      const { mes, anio, tarjeta_id, tercero_id, categoria_id, estado, es_fijo } = req.query;
      let sql = `SELECT g.*, c.nombre AS categoria_nombre, c.icono AS categoria_icono,
        c.color_hex AS categoria_color, t.nombre AS tarjeta_nombre, t.color_hex AS tarjeta_color,
        te.nombre AS tercero_nombre,
        GROUP_CONCAT(DISTINCT e.nombre ORDER BY e.nombre SEPARATOR ',') AS etiquetas
        FROM gastos g
        LEFT JOIN categorias c ON g.categoria_id = c.id
        LEFT JOIN tarjetas t ON g.tarjeta_id = t.id
        LEFT JOIN terceros te ON g.tercero_id = te.id
        LEFT JOIN gasto_etiquetas ge ON g.id = ge.gasto_id
        LEFT JOIN etiquetas e ON ge.etiqueta_id = e.id WHERE 1=1`;
      const params = [];
      if (mes && anio) { sql += ' AND MONTH(g.fecha)=? AND YEAR(g.fecha)=?'; params.push(mes, anio); }
      if (tarjeta_id) { sql += ' AND g.tarjeta_id=?'; params.push(tarjeta_id); }
      if (tercero_id) { sql += ' AND g.tercero_id=?'; params.push(tercero_id); }
      if (categoria_id) { sql += ' AND g.categoria_id=?'; params.push(categoria_id); }
      if (estado) { sql += ' AND g.estado=?'; params.push(estado); }
      if (es_fijo !== undefined) { sql += ' AND g.es_fijo=?'; params.push(es_fijo); }
      sql += ' GROUP BY g.id ORDER BY g.fecha DESC, g.id DESC';
      return res.json(await query(sql, params));
    }
    if (req.method === 'POST') {
      const { descripcion, monto, moneda = 'ARS', fecha, categoria_id, tarjeta_id,
              tercero_id, es_fijo = 0, notas, cuotas = 1, etiquetas = [] } = req.body;
      if (!descripcion || !monto || !fecha) return res.status(400).json({ error: 'Faltan campos requeridos' });
      const [result] = await query(
        `INSERT INTO gastos (descripcion, monto, moneda, fecha, categoria_id, tarjeta_id, tercero_id,
          es_fijo, es_cuota, cuota_numero, cuota_total, estado) VALUES (?,?,?,?,?,?,?,?,?,?,?,'manual')`,
        [descripcion, monto, moneda, fecha, categoria_id||null, tarjeta_id||null, tercero_id||null,
         es_fijo, cuotas>1?1:0, cuotas>1?1:null, cuotas>1?cuotas:null]);
      const parentId = result.insertId;
      if (cuotas > 1) {
        await query('UPDATE gastos SET parent_id=? WHERE id=?', [parentId, parentId]);
        const baseDate = new Date(fecha);
        for (let i = 2; i <= cuotas; i++) {
          const d = new Date(baseDate);
          d.setMonth(d.getMonth() + (i - 1));
          await query(
            `INSERT INTO gastos (descripcion, monto, moneda, fecha, categoria_id, tarjeta_id, tercero_id,
              es_cuota, cuota_numero, cuota_total, parent_id, estado) VALUES (?,?,?,?,?,?,?,1,?,?,?,'preventivo')`,
            [`${descripcion} (${i}/${cuotas})`, monto, moneda, d.toISOString().split('T')[0],
             categoria_id||null, tarjeta_id||null, tercero_id||null, i, cuotas, parentId]);
        }
      }
      for (const etqId of etiquetas)
        await query('INSERT IGNORE INTO gasto_etiquetas (gasto_id, etiqueta_id) VALUES (?,?)', [parentId, etqId]);
      return res.status(201).json({ id: parentId, cuotas_creadas: cuotas });
    }
    return res.status(405).end();
  }

  // ── INGRESOS ──────────────────────────────────────────────
  if (resource === 'ingresos') {
    if (id) {
      if (req.method === 'GET') {
        const rows = await query('SELECT * FROM ingresos WHERE id=?', [id]);
        return rows.length ? res.json(rows[0]) : res.status(404).json({ error: 'No encontrado' });
      }
      if (req.method === 'PUT') {
        const { descripcion, monto, moneda, fecha, categoria_id, tercero_id, repetir_mensual, notas } = req.body;
        await query(
          `UPDATE ingresos SET descripcion=?,monto=?,moneda=?,fecha=?,categoria_id=?,tercero_id=?,repetir_mensual=?,notas=? WHERE id=?`,
          [descripcion, monto, moneda, fecha, categoria_id||null, tercero_id||null, repetir_mensual, notas, id]);
        return res.json({ ok: true });
      }
      if (req.method === 'DELETE') {
        await query('DELETE FROM ingresos WHERE id=?', [id]);
        return res.json({ ok: true });
      }
      return res.status(405).end();
    }
    if (req.method === 'GET') {
      const { mes, anio } = req.query;
      let sql = `SELECT i.*, c.nombre AS categoria_nombre FROM ingresos i LEFT JOIN categorias c ON i.categoria_id = c.id WHERE 1=1`;
      const params = [];
      if (mes && anio) { sql += ' AND MONTH(i.fecha)=? AND YEAR(i.fecha)=?'; params.push(mes, anio); }
      return res.json(await query(sql + ' ORDER BY i.fecha DESC', params));
    }
    if (req.method === 'POST') {
      const { descripcion, monto, moneda = 'ARS', fecha, categoria_id, tercero_id, repetir_mensual = 0, notas } = req.body;
      const [r] = await query(
        `INSERT INTO ingresos (descripcion, monto, moneda, fecha, categoria_id, tercero_id, repetir_mensual, notas) VALUES (?,?,?,?,?,?,?,?)`,
        [descripcion, monto, moneda, fecha, categoria_id||null, tercero_id||null, repetir_mensual, notas||null]);
      return res.status(201).json({ id: r.insertId });
    }
    return res.status(405).end();
  }

  // ── METAS ─────────────────────────────────────────────────
  if (resource === 'metas') {
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
          [nombre, monto_objetivo, moneda, fecha_limite, descripcion, activa, id]);
        return res.json({ ok: true });
      }
      if (req.method === 'POST' && action === 'aportar') {
        const { monto, moneda = 'ARS', tipo = 'aporte', fecha, notas } = req.body;
        const delta = tipo === 'retiro' ? -parseFloat(monto) : parseFloat(monto);
        await query(
          'INSERT INTO movimientos_meta (meta_id, monto, moneda, tipo, fecha, notas) VALUES (?,?,?,?,?,?)',
          [id, Math.abs(monto), moneda, tipo, fecha, notas||null]);
        await query('UPDATE metas_ahorro SET monto_actual = monto_actual + ? WHERE id=?', [delta, id]);
        return res.json({ ok: true });
      }
      if (req.method === 'DELETE') {
        await query('UPDATE metas_ahorro SET activa=0 WHERE id=?', [id]);
        return res.json({ ok: true });
      }
      return res.status(405).end();
    }
    if (req.method === 'GET') return res.json(await query('SELECT * FROM metas_ahorro ORDER BY activa DESC, fecha_limite'));
    if (req.method === 'POST') {
      const { nombre, monto_objetivo, moneda = 'ARS', fecha_limite, descripcion, icono, color_hex } = req.body;
      const [r] = await query(
        `INSERT INTO metas_ahorro (nombre, monto_objetivo, moneda, fecha_limite, descripcion, icono, color_hex) VALUES (?,?,?,?,?,?,?)`,
        [nombre, monto_objetivo, moneda, fecha_limite, descripcion||null, icono||'target', color_hex||'#00ff87']);
      return res.status(201).json({ id: r.insertId });
    }
    return res.status(405).end();
  }

  // ── CATEGORIAS ────────────────────────────────────────────
  if (resource === 'categorias') {
    if (id) {
      if (req.method === 'PUT') {
        const { nombre, icono, color_hex, parent_id } = req.body;
        await query('UPDATE categorias SET nombre=?,icono=?,color_hex=?,parent_id=? WHERE id=?',
          [nombre, icono, color_hex, parent_id||null, id]);
        return res.json({ ok: true });
      }
      if (req.method === 'DELETE') {
        await query('UPDATE categorias SET activa=0 WHERE id=?', [id]);
        return res.json({ ok: true });
      }
      return res.status(405).end();
    }
    if (req.method === 'GET') return res.json(await query('SELECT * FROM categorias WHERE activa=1 ORDER BY parent_id IS NULL DESC, nombre'));
    if (req.method === 'POST') {
      const { nombre, icono = 'tag', color_hex = '#888888', parent_id } = req.body;
      const [r] = await query('INSERT INTO categorias (nombre, icono, color_hex, parent_id) VALUES (?,?,?,?)',
        [nombre, icono, color_hex, parent_id||null]);
      return res.status(201).json({ id: r.insertId });
    }
    return res.status(405).end();
  }

  // ── DASHBOARD ─────────────────────────────────────────────
  if (resource === 'dashboard') {
    const { mes, anio } = req.query;
    if (!mes || !anio) return res.status(400).json({ error: 'Faltan mes/anio' });
    const [ing] = await query(
      `SELECT COALESCE(SUM(CASE WHEN moneda='ARS' THEN monto ELSE 0 END),0) AS total_ars,
              COALESCE(SUM(CASE WHEN moneda='USD' THEN monto ELSE 0 END),0) AS total_usd
       FROM ingresos WHERE MONTH(fecha)=? AND YEAR(fecha)=?`, [mes, anio]);
    const porTarjeta = await query(
      `SELECT t.id, t.nombre, t.color_hex,
              COALESCE(SUM(CASE WHEN g.moneda='ARS' THEN g.monto ELSE 0 END),0) AS total_ars,
              COALESCE(SUM(CASE WHEN g.moneda='USD' THEN g.monto ELSE 0 END),0) AS total_usd
       FROM gastos g LEFT JOIN tarjetas t ON g.tarjeta_id = t.id
       WHERE MONTH(g.fecha)=? AND YEAR(g.fecha)=? GROUP BY g.tarjeta_id ORDER BY t.id`, [mes, anio]);
    const [totGastos] = await query(
      `SELECT COALESCE(SUM(CASE WHEN moneda='ARS' THEN monto ELSE 0 END),0) AS total_ars,
              COALESCE(SUM(CASE WHEN moneda='USD' THEN monto ELSE 0 END),0) AS total_usd
       FROM gastos WHERE MONTH(fecha)=? AND YEAR(fecha)=?`, [mes, anio]);
    const [propios] = await query(
      `SELECT COALESCE(SUM(monto),0) AS total FROM gastos WHERE MONTH(fecha)=? AND YEAR(fecha)=? AND tercero_id IS NULL AND moneda='ARS'`, [mes, anio]);
    const [ajenos] = await query(
      `SELECT COALESCE(SUM(monto),0) AS total FROM gastos WHERE MONTH(fecha)=? AND YEAR(fecha)=? AND tercero_id IS NOT NULL AND moneda='ARS'`, [mes, anio]);
    const metas = await query('SELECT * FROM metas_ahorro WHERE activa=1 ORDER BY fecha_limite');
    const today = new Date();
    const metasConCalculo = metas.map(m => {
      const limite = new Date(m.fecha_limite);
      const mesesRestantes = Math.max(1, (limite.getFullYear() - today.getFullYear()) * 12 + (limite.getMonth() - today.getMonth()));
      const falta = Math.max(0, parseFloat(m.monto_objetivo) - parseFloat(m.monto_actual));
      return { ...m, meses_restantes: mesesRestantes, aporte_mensual: falta / mesesRestantes };
    });
    return res.json({
      ingresos: ing, gastos: totGastos,
      balance_ars: ing.total_ars - totGastos.total_ars, balance_usd: ing.total_usd - totGastos.total_usd,
      por_tarjeta: porTarjeta, propios_vs_ajenos: { propios: propios.total, ajenos: ajenos.total },
      metas: metasConCalculo,
    });
  }

  // ── ANALITICA ─────────────────────────────────────────────
  if (resource === 'analitica') {
    const evolucion = await query(`
      SELECT periodo, SUM(ingresos) AS ingresos, SUM(gastos) AS gastos FROM (
        SELECT DATE_FORMAT(fecha, '%Y-%m') AS periodo, monto AS ingresos, 0 AS gastos FROM ingresos
        UNION ALL
        SELECT DATE_FORMAT(fecha, '%Y-%m') AS periodo, 0 AS ingresos, monto AS gastos FROM gastos
      ) t
      WHERE periodo >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 12 MONTH), '%Y-%m')
      GROUP BY periodo ORDER BY periodo`);
    const porCategoria = await query(`
      SELECT c.nombre, c.color_hex, SUM(g.monto) AS total, g.moneda
      FROM gastos g LEFT JOIN categorias c ON g.categoria_id = c.id
      WHERE g.moneda='ARS' GROUP BY g.categoria_id, g.moneda ORDER BY total DESC LIMIT 10`);
    const terceros = await query(`
      SELECT te.nombre, te.relacion,
        SUM(CASE WHEN g.moneda='ARS' THEN g.monto ELSE 0 END) AS total_ars,
        SUM(CASE WHEN g.moneda='USD' THEN g.monto ELSE 0 END) AS total_usd,
        COUNT(*) AS qty_gastos
      FROM gastos g JOIN terceros te ON g.tercero_id = te.id
      GROUP BY g.tercero_id ORDER BY total_ars DESC`);
    const fijos = await query(`
      SELECT g.descripcion, g.monto, g.moneda, e.nombre AS etiqueta, e.color_hex, g.fecha
      FROM gastos g
      LEFT JOIN gasto_etiquetas ge ON g.id = ge.gasto_id
      LEFT JOIN etiquetas e ON ge.etiqueta_id = e.id
      WHERE g.es_fijo=1 ORDER BY g.descripcion`);
    return res.json({ evolucion, porCategoria, terceros, fijos });
  }

  // ── ETIQUETAS ─────────────────────────────────────────────
  if (resource === 'etiquetas') {
    if (req.method === 'GET') return res.json(await query('SELECT * FROM etiquetas ORDER BY nombre'));
    if (req.method === 'POST') {
      const { nombre, color_hex = '#888888' } = req.body;
      const [r] = await query('INSERT IGNORE INTO etiquetas (nombre, color_hex) VALUES (?,?)', [nombre, color_hex]);
      return res.status(201).json({ id: r.insertId });
    }
    return res.status(405).end();
  }

  // ── TARJETAS ──────────────────────────────────────────────
  if (resource === 'tarjetas') {
    if (req.method === 'GET') return res.json(await query('SELECT * FROM tarjetas WHERE activa=1 ORDER BY id'));
    if (req.method === 'POST') {
      const { nombre, tipo = 'credito', ultimos_digitos, color_hex } = req.body;
      const [r] = await query('INSERT INTO tarjetas (nombre, tipo, ultimos_digitos, color_hex) VALUES (?,?,?,?)',
        [nombre, tipo, ultimos_digitos||null, color_hex||'#1a73e8']);
      return res.status(201).json({ id: r.insertId });
    }
    return res.status(405).end();
  }

  // ── TERCEROS ──────────────────────────────────────────────
  if (resource === 'terceros') {
    if (req.method === 'GET') {
      return res.json(await query(`
        SELECT t.*, COALESCE(SUM(CASE WHEN g.tercero_id=t.id THEN g.monto ELSE 0 END),0) AS total_gastos
        FROM terceros t LEFT JOIN gastos g ON g.tercero_id = t.id
        WHERE t.activo=1 GROUP BY t.id ORDER BY t.nombre`));
    }
    if (req.method === 'POST') {
      const { nombre, relacion } = req.body;
      const [r] = await query('INSERT INTO terceros (nombre, relacion) VALUES (?,?)', [nombre, relacion||null]);
      return res.status(201).json({ id: r.insertId, nombre, relacion });
    }
    return res.status(405).end();
  }

  // ── CURRENCY ──────────────────────────────────────────────
  if (resource === 'currency') {
    if (req.method === 'GET') {
      const today = new Date().toISOString().split('T')[0];
      const cached = await query('SELECT * FROM tipo_cambio WHERE fecha = ? ORDER BY id DESC LIMIT 1', [today]);
      if (cached.length > 0 && !req.query.refresh) return res.json(cached[0]);
      try {
        const resp = await fetch('https://api.bluelytics.com.ar/v2/latest');
        const data = await resp.json();
        const oficial = parseFloat(data.oficial?.value_sell || data.oficial?.value_avg || 0);
        const blue = parseFloat(data.blue?.value_sell || data.blue?.value_avg || 0);
        const mep = parseFloat(data.oficial_euro?.value_sell || 0);
        await query(
          `INSERT INTO tipo_cambio (fecha, usd_oficial, usd_blue, usd_mep, fuente, manual)
           VALUES (?,?,?,?,'bluelytics',0)
           ON DUPLICATE KEY UPDATE usd_oficial=VALUES(usd_oficial), usd_blue=VALUES(usd_blue), usd_mep=VALUES(usd_mep)`,
          [today, oficial, blue, mep]);
        return res.json({ fecha: today, usd_oficial: oficial, usd_blue: blue, usd_mep: mep });
      } catch {
        const last = await query('SELECT * FROM tipo_cambio ORDER BY fecha DESC LIMIT 1');
        return res.json(last[0] || { usd_oficial: 1000, usd_blue: 1200, usd_mep: 1100 });
      }
    }
    if (req.method === 'POST') {
      const { fecha, usd_oficial, usd_blue, usd_mep } = req.body;
      await query(
        `INSERT INTO tipo_cambio (fecha, usd_oficial, usd_blue, usd_mep, fuente, manual) VALUES (?,?,?,?,'manual',1)
         ON DUPLICATE KEY UPDATE usd_oficial=VALUES(usd_oficial), usd_blue=VALUES(usd_blue), usd_mep=VALUES(usd_mep), manual=1`,
        [fecha, usd_oficial, usd_blue||null, usd_mep||null]);
      return res.json({ ok: true });
    }
    return res.status(405).end();
  }

  // ── CARDS / IMPORT-PDF ────────────────────────────────────
  if (resource === 'cards') {
    if (req.method !== 'POST') return res.status(405).end();
    const { pdf_base64, tarjeta_id, mes, anio } = req.body;
    if (!pdf_base64 || !tarjeta_id || !mes || !anio)
      return res.status(400).json({ error: 'Faltan: pdf_base64, tarjeta_id, mes, anio' });
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return res.status(500).json({ error: 'OPENAI_API_KEY no configurada' });

    const [importResult] = await query(
      `INSERT INTO pdf_imports (tarjeta_id, mes, anio, estado) VALUES (?,?,?,'procesando')`,
      [tarjeta_id, mes, anio]);
    const importId = importResult.insertId;

    let transacciones = [];
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o', max_tokens: 4096,
          messages: [{ role: 'user', content: [
            { type: 'text', text: `Sos un extractor de datos de resúmenes de tarjetas BBVA Argentina. Extraé TODAS las transacciones en JSON estricto. Por cada una: {"fecha":"DD/MM/YYYY","descripcion":"...","cuota_actual":1,"cuota_total":1,"cupon":"...","importe":1234.56}. Respondé SÓLO con el array JSON.` },
            { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdf_base64}`, detail: 'high' } },
          ]}],
        }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      const content = data.choices[0].message.content.trim().replace(/^```json?\n?/, '').replace(/```$/, '').trim();
      transacciones = JSON.parse(content);
    } catch (e) {
      await query(`UPDATE pdf_imports SET estado='error', error_msg=? WHERE id=?`, [e.message, importId]);
      return res.status(500).json({ error: 'Error procesando PDF', detalle: e.message });
    }

    let nuevas = 0, actualizadas = 0, duplicadas = 0;
    const preventivos = await query(
      `SELECT * FROM gastos WHERE tarjeta_id=? AND MONTH(fecha)=? AND YEAR(fecha)=? AND estado='preventivo'`,
      [tarjeta_id, mes, anio]);

    for (const tx of transacciones) {
      const [d, m, y] = tx.fecha.split('/');
      const fechaStr = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
      const importe = parseFloat(tx.importe);
      const hash = crypto.createHash('sha256')
        .update(`${tx.descripcion.toLowerCase().trim()}|${Math.round(importe)}|${fechaStr}`)
        .digest('hex');
      const fechaObj = new Date(fechaStr);

      if ((await query('SELECT id FROM gastos WHERE pdf_hash=?', [hash])).length > 0) { duplicadas++; continue; }

      if (tx.cuota_actual && tx.cuota_total) {
        const descBase = tx.descripcion.replace(/\s+C\.\s*\d+\/\d+/i, '').trim();
        const ex = await query(
          `SELECT id FROM gastos WHERE descripcion LIKE ? AND cuota_numero=? AND YEAR(fecha)=? AND tarjeta_id=? AND es_cuota=1 LIMIT 1`,
          [`%${descBase.substring(0,30)}%`, tx.cuota_actual, anio]);
        if (ex.length > 0) { duplicadas++; continue; }
      }

      let matched = null;
      for (const prev of preventivos) {
        if (Math.abs(parseFloat(prev.monto) - importe) <= 2000 &&
            Math.abs((new Date(prev.fecha) - fechaObj) / 86400000) <= 3) {
          matched = prev; break;
        }
      }

      if (matched) {
        await query(
          `UPDATE gastos SET descripcion=?,monto=?,fecha=?,estado='confirmado',pdf_hash=?,cupon_nro=?,pdf_import_id=?,es_cuota=?,cuota_numero=?,cuota_total=? WHERE id=?`,
          [tx.descripcion, importe, fechaStr, hash, tx.cupon||null, importId,
           tx.cuota_total?1:0, tx.cuota_actual||null, tx.cuota_total||null, matched.id]);
        preventivos.splice(preventivos.findIndex(p => p.id === matched.id), 1);
        actualizadas++;
      } else {
        let parentId = null;
        if (tx.cuota_actual && tx.cuota_total && tx.cuota_actual > 1) {
          const descBase = tx.descripcion.replace(/\s+C\.\s*\d+\/\d+/i, '').trim();
          const parents = await query(
            `SELECT parent_id, id FROM gastos WHERE descripcion LIKE ? AND tarjeta_id=? AND es_cuota=1 AND cuota_numero=1 LIMIT 1`,
            [`%${descBase.substring(0,25)}%`, tarjeta_id]);
          if (parents.length > 0) parentId = parents[0].parent_id || parents[0].id;
        }
        const [ins] = await query(
          `INSERT INTO gastos (descripcion,monto,moneda,fecha,tarjeta_id,estado,es_cuota,cuota_numero,cuota_total,parent_id,pdf_hash,cupon_nro,pdf_import_id)
           VALUES (?,?,'ARS',?,?,'confirmado',?,?,?,?,?,?,?)`,
          [tx.descripcion, importe, fechaStr, tarjeta_id,
           tx.cuota_total?1:0, tx.cuota_actual||null, tx.cuota_total||null,
           parentId, hash, tx.cupon||null, importId]);
        if (tx.cuota_actual === 1 || (!tx.cuota_actual && !parentId))
          await query('UPDATE gastos SET parent_id=id WHERE id=? AND parent_id IS NULL', [ins.insertId]);
        nuevas++;
      }
    }

    await query(
      `UPDATE pdf_imports SET estado='completado',total_transacciones=?,nuevas=?,actualizadas=?,duplicadas=? WHERE id=?`,
      [transacciones.length, nuevas, actualizadas, duplicadas, importId]);
    return res.json({ import_id: importId, total: transacciones.length, nuevas, actualizadas, duplicadas });
  }

  return res.status(404).json({ error: 'Ruta no encontrada' });
}
