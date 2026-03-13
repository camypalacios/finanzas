// api/cards/import-pdf.js — POST /api/cards/import-pdf
// Procesa PDF de resumen BBVA usando OpenAI Vision
// Implementa matching anti-duplicación con hash SHA256 + ventana de tolerancia
import { withAuth } from '../_lib/auth.js';
import { query } from '../_lib/db.js';
import crypto from 'crypto';

// Convertir PDF base64 a texto via OpenAI Vision
async function extractTransactionsFromPDF(pdfBase64, openaiKey) {
  // Enviamos el PDF como documento al endpoint de OpenAI
  const payload = {
    model: 'gpt-4o',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Sos un extractor de datos de resúmenes de tarjetas de crédito BBVA Argentina.
Extraé TODAS las transacciones de este resumen en formato JSON estricto.
Por cada transacción, devolvé:
{
  "fecha": "DD/MM/YYYY",
  "descripcion": "descripción original",
  "cuota_actual": 1,  // número después del primer / en "C. X/Y", o null si no es cuota
  "cuota_total": 1,   // número después del segundo / en "C. X/Y", o null si no es cuota
  "cupon": "número de cupón si existe",
  "importe": 1234.56  // número positivo, el signo lo inferís del contexto
}
Respondé SÓLO con el array JSON, sin texto adicional, sin markdown.`,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:application/pdf;base64,${pdfBase64}`,
              detail: 'high',
            },
          },
        ],
      },
    ],
  };

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI error: ${err}`);
  }
  const data = await resp.json();
  const content = data.choices[0].message.content.trim();
  // Limpiar posibles markdown fences
  const clean = content.replace(/^```json?\n?/, '').replace(/```$/, '').trim();
  return JSON.parse(clean);
}

function buildHash(descripcion, importe, fecha) {
  // SHA256 de descripción normalizada + monto redondeado + fecha
  const str = `${descripcion.toLowerCase().trim()}|${Math.round(importe)}|${fecha}`;
  return crypto.createHash('sha256').update(str).digest('hex');
}

function parseDate(fechaStr) {
  // "DD/MM/YYYY" → Date
  const [d, m, y] = fechaStr.split('/');
  return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
}

function dateDiffDays(a, b) {
  return Math.abs((a - b) / 86400000);
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { pdf_base64, tarjeta_id, mes, anio } = req.body;
  if (!pdf_base64 || !tarjeta_id || !mes || !anio) {
    return res.status(400).json({ error: 'Faltan: pdf_base64, tarjeta_id, mes, anio' });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return res.status(500).json({ error: 'OPENAI_API_KEY no configurada' });

  // Crear registro de import
  const [importResult] = await query(
    `INSERT INTO pdf_imports (tarjeta_id, mes, anio, estado) VALUES (?,?,?,'procesando')`,
    [tarjeta_id, mes, anio]
  );
  const importId = importResult.insertId;

  let transacciones = [];
  try {
    transacciones = await extractTransactionsFromPDF(pdf_base64, openaiKey);
  } catch (e) {
    await query(`UPDATE pdf_imports SET estado='error', error_msg=? WHERE id=?`, [e.message, importId]);
    return res.status(500).json({ error: 'Error procesando PDF', detalle: e.message });
  }

  let nuevas = 0, actualizadas = 0, duplicadas = 0;

  // Obtener gastos preventivos del mes para matching
  const preventivos = await query(
    `SELECT * FROM gastos WHERE tarjeta_id=? AND MONTH(fecha)=? AND YEAR(fecha)=? AND estado='preventivo'`,
    [tarjeta_id, mes, anio]
  );

  for (const tx of transacciones) {
    const fecha = parseDate(tx.fecha);
    const fechaStr = fecha.toISOString().split('T')[0];
    const importe = parseFloat(tx.importe);
    const hash = buildHash(tx.descripcion, importe, fechaStr);

    // 1️⃣ Verificar duplicado exacto por hash
    const existing = await query('SELECT id FROM gastos WHERE pdf_hash=?', [hash]);
    if (existing.length > 0) { duplicadas++; continue; }

    // 2️⃣ Intentar matching con preventivo
    // Criterio: |monto_diff| ≤ 2000 ARS (o ≤ 2 USD si moneda=USD) Y fecha ≤ 3 días
    let matched = null;
    const TOLE_MONTO_ARS = 2000;
    for (const prev of preventivos) {
      const montoDiff = Math.abs(parseFloat(prev.monto) - importe);
      const fPrev = new Date(prev.fecha);
      const fechaDiff = dateDiffDays(fPrev, fecha);
      if (montoDiff <= TOLE_MONTO_ARS && fechaDiff <= 3) {
        matched = prev;
        break;
      }
    }

    // 3️⃣ Verificar si ya existe cuota vinculada (anti-duplicación de cuotas)
    if (tx.cuota_actual && tx.cuota_total) {
      // Buscar si ya existe una cuota previa con mismo parent y número
      const descBase = tx.descripcion.replace(/\s+C\.\s*\d+\/\d+/i, '').trim();
      const cuotaExisting = await query(
        `SELECT id FROM gastos WHERE descripcion LIKE ? AND cuota_numero=? AND YEAR(fecha)=?
         AND tarjeta_id=? AND es_cuota=1 LIMIT 1`,
        [`%${descBase.substring(0, 30)}%`, tx.cuota_actual, anio]
      );
      if (cuotaExisting.length > 0) { duplicadas++; continue; }
    }

    if (matched) {
      // Confirmar preventivo con datos del PDF
      await query(
        `UPDATE gastos SET descripcion=?, monto=?, fecha=?, estado='confirmado',
         pdf_hash=?, cupon_nro=?, pdf_import_id=?,
         es_cuota=?, cuota_numero=?, cuota_total=?
         WHERE id=?`,
        [tx.descripcion, importe, fechaStr, hash, tx.cupon || null, importId,
         tx.cuota_total ? 1 : 0, tx.cuota_actual || null, tx.cuota_total || null,
         matched.id]
      );
      // Remover del pool de preventivos para no hacer doble match
      const idx = preventivos.findIndex(p => p.id === matched.id);
      if (idx !== -1) preventivos.splice(idx, 1);
      actualizadas++;
    } else {
      // Insertar como nuevo gasto confirmado
      // Si es cuota, buscar parent_id existente
      let parentId = null;
      if (tx.cuota_actual && tx.cuota_total && tx.cuota_actual > 1) {
        const descBase = tx.descripcion.replace(/\s+C\.\s*\d+\/\d+/i, '').trim();
        const parents = await query(
          `SELECT parent_id, id FROM gastos WHERE descripcion LIKE ? AND tarjeta_id=? AND es_cuota=1 AND cuota_numero=1 LIMIT 1`,
          [`%${descBase.substring(0, 25)}%`, tarjeta_id]
        );
        if (parents.length > 0) parentId = parents[0].parent_id || parents[0].id;
      }

      const [ins] = await query(
        `INSERT INTO gastos (descripcion, monto, moneda, fecha, tarjeta_id, estado,
          es_cuota, cuota_numero, cuota_total, parent_id, pdf_hash, cupon_nro, pdf_import_id)
         VALUES (?,?,?,?,?,'confirmado',?,?,?,?,?,?,?)`,
        [tx.descripcion, importe, 'ARS', fechaStr, tarjeta_id,
         tx.cuota_total ? 1 : 0, tx.cuota_actual || null, tx.cuota_total || null,
         parentId, hash, tx.cupon || null, importId]
      );

      // Si es primera cuota, actualizar parent_id al propio id
      if (tx.cuota_actual === 1 || (!tx.cuota_actual && !parentId)) {
        await query('UPDATE gastos SET parent_id=id WHERE id=? AND parent_id IS NULL', [ins.insertId]);
      }
      nuevas++;
    }
  }

  await query(
    `UPDATE pdf_imports SET estado='completado', total_transacciones=?, nuevas=?, actualizadas=?, duplicadas=? WHERE id=?`,
    [transacciones.length, nuevas, actualizadas, duplicadas, importId]
  );

  return res.json({
    import_id: importId,
    total: transacciones.length,
    nuevas, actualizadas, duplicadas,
  });
}

export default withAuth(handler);
