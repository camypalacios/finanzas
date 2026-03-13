// src/pages/AnaliticaPage.tsx — Analítica con gráficos Recharts
import { useEffect, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import api from '../lib/api';
import type { AnaliticaData } from '../types';
import styles from './AnaliticaPage.module.css';

function fmt(n: number) { return new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 }).format(n); }

const TOOLTIP_STYLE = {
  background: 'var(--bg-card)', border: '1px solid var(--border-md)', borderRadius: 8,
  color: 'var(--text-primary)', fontSize: 12,
};

export default function AnaliticaPage() {
  const [data, setData] = useState<AnaliticaData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analitica').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding:'2rem' }}>{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:200,marginBottom:16}}/>)}</div>;
  if (!data) return <p className="text-muted" style={{ padding:'2rem' }}>Error cargando analítica</p>;

  const propios = data.porCategoria.reduce((s, c) => s + Number(c.total), 0);
  const ajenos = data.terceros.reduce((s, t) => s + Number(t.total_ars), 0);
  const propAjenoData = [
    { name: 'Propios', value: propios },
    { name: 'Ajenos', value: ajenos },
  ];

  return (
    <div className={styles.page}>
      <h2 className={styles.pageTitle}>ANALÍTICA</h2>

      {/* Propios vs Ajenos */}
      <div className={`card ${styles.chartCard}`}>
        <h3 className={styles.chartTitle}>PROPIOS VS AJENOS</h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={propAjenoData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" stroke="none">
              <Cell fill="#00ff87" />
              <Cell fill="#0ff0fc" />
            </Pie>
            <Tooltip formatter={(v) => [`$ ${fmt(Number(v))}`, '']} contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
        <div className={styles.legend}>
          <span className={styles.legendItem}><span style={{ background:'#00ff87' }} /> Propios: ${fmt(propios)}</span>
          <span className={styles.legendItem}><span style={{ background:'#0ff0fc' }} /> Ajenos: ${fmt(ajenos)}</span>
        </div>
      </div>

      {/* Gastos por categoría */}
      <div className={`card ${styles.chartCard}`}>
        <h3 className={styles.chartTitle}>GASTOS POR CATEGORÍA</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data.porCategoria} cx="50%" cy="50%" outerRadius={80} dataKey="total" nameKey="nombre" stroke="none">
              {data.porCategoria.map((c, i) => <Cell key={i} fill={c.color_hex || `hsl(${i*35},70%,60%)`} />)}
            </Pie>
            <Tooltip formatter={(v) => [`$ ${fmt(Number(v))}`, '']} contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
        <div className={styles.catList}>
          {data.porCategoria.slice(0,6).map((c, i) => (
            <div key={i} className={styles.catItem}>
              <span className={styles.catDot} style={{ background: c.color_hex }} />
              <span className={styles.catNombre}>{c.nombre}</span>
              <span className={styles.catMonto}>$ {fmt(Number(c.total))}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Evolución mensual */}
      <div className={`card ${styles.chartCard}`}>
        <h3 className={styles.chartTitle}>EVOLUCIÓN (12 MESES)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data.evolucion} margin={{ top:5, right:10, left:-10, bottom:5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="periodo" tick={{ fill:'var(--text-muted)', fontSize:10 }} tickFormatter={p => p.slice(5)} />
            <YAxis tick={{ fill:'var(--text-muted)', fontSize:10 }} tickFormatter={fmt} />
            <Tooltip formatter={(v) => [`$ ${fmt(Number(v))}`]} contentStyle={TOOLTIP_STYLE} labelStyle={{ color:'var(--text-secondary)' }} />
            <Legend wrapperStyle={{ fontSize:12, color:'var(--text-secondary)' }} />
            <Line type="monotone" dataKey="ingresos" stroke="#00ff87" strokeWidth={2} dot={false} name="Ingresos" />
            <Line type="monotone" dataKey="gastos" stroke="#ff5252" strokeWidth={2} dot={false} name="Gastos" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Saldos por tercero */}
      {data.terceros.length > 0 && (
        <div className={`card ${styles.chartCard}`}>
          <h3 className={styles.chartTitle}>SALDO POR TERCERO</h3>
          {data.terceros.map((t, i) => (
            <div key={i} className={styles.terceroRow}>
              <div>
                <p className={styles.terceroNombre}>{t.nombre}</p>
                {t.relacion && <p className="text-muted" style={{ fontSize:'0.72rem' }}>{t.relacion}</p>}
              </div>
              <div style={{ textAlign:'right' }}>
                <p className="amount amount-sm text-danger">$ {fmt(Number(t.total_ars))}</p>
                {Number(t.total_usd) > 0 && <p className="amount amount-sm text-blue">USD {fmt(Number(t.total_usd))}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gastos fijos/etiquetados */}
      {data.fijos.length > 0 && (
        <div className={`card ${styles.chartCard}`}>
          <h3 className={styles.chartTitle}>GASTOS FIJOS</h3>
          {data.fijos.map((f, i) => (
            <div key={i} className={styles.fijoRow}>
              <div className={styles.fijoInfo}>
                <p className={styles.fijoDesc}>{f.descripcion}</p>
                {f.etiqueta && <span className={styles.etqBadge} style={{ background: f.color_hex + '22', color: f.color_hex }}>{f.etiqueta}</span>}
              </div>
              <span className="amount amount-sm text-danger">{f.moneda==='USD'?'USD':'$'} {fmt(Number(f.monto))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
