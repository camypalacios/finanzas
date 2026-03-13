// src/pages/Dashboard.tsx — Dashboard principal
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import MonthSelector from '../components/ui/MonthSelector';
import type { DashboardSummary, Gasto } from '../types';
import styles from './Dashboard.module.css';

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Math.abs(n));
}

export default function Dashboard() {
  const { mes, anio, tipoCambio, setTipoCambio, monedaVista, setMonedaVista } = useAppStore();
  const isAuth = useAuthStore(s => s.isAuthenticated());
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuth) return;

    // Cargar tipo de cambio
    api.get('/currency/rate').then(r => setTipoCambio(r.data)).catch(() => {});

    // Cargar summary del mes
    Promise.all([
      api.get(`/dashboard/summary?mes=${mes}&anio=${anio}`),
      api.get(`/gastos?mes=${mes}&anio=${anio}`),
    ]).then(([sRes, gRes]) => {
      setSummary(sRes.data);
      setGastos(gRes.data);
    }).catch(() => toast.error('Error cargando datos'))
      .finally(() => setLoading(false));
  }, [mes, anio, isAuth]);

  const rate = tipoCambio?.usd_blue || 1200;
  const toDisplay = (ars: number, usd: number) =>
    monedaVista === 'USD' ? (ars / rate + usd) : (ars + usd * rate);

  const ingresos = summary ? toDisplay(summary.ingresos.total_ars, summary.ingresos.total_usd) : 0;
  const gastosTot = summary ? toDisplay(summary.gastos.total_ars, summary.gastos.total_usd) : 0;
  const balance = ingresos - gastosTot;

  // Agrupar gastos por tarjeta para la lista vertical
  const TARJETAS_ORDEN = ['Contado', 'VISA', 'MASTERCARD'];
  const porTarjeta = summary?.por_tarjeta || [];

  return (
    <div className={styles.page}>
      <MonthSelector />

      {/* Toggle moneda */}
      <div className={styles.currencyToggle}>
        <button
          className={`${styles.currBtn} ${monedaVista === 'ARS' ? styles.currActive : ''}`}
          onClick={() => setMonedaVista('ARS')}
        >ARS</button>
        <button
          className={`${styles.currBtn} ${monedaVista === 'USD' ? styles.currActive : ''}`}
          onClick={() => setMonedaVista('USD')}
        >USD</button>
        {tipoCambio && (
          <span className={styles.rateHint}>Blue: ${fmt(tipoCambio.usd_blue)}</span>
        )}
      </div>

      {loading ? (
        <div className={styles.skeletons}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 90, marginBottom: 12 }} />)}
        </div>
      ) : (
        <>
          {/* Widget Balance */}
          <div className={`card card-glow ${styles.balanceCard}`}>
            <p className={styles.balanceLabel}>Balance disponible</p>
            <p className={`amount amount-lg ${balance >= 0 ? 'text-neon' : 'text-danger'}`}>
              {monedaVista} {fmt(balance)}
            </p>
            <div className={styles.balanceRow}>
              <div>
                <p className={styles.subLabel}>Ingresos</p>
                <p className="amount amount-sm text-success">+ {fmt(ingresos)}</p>
              </div>
              <div>
                <p className={styles.subLabel}>Gastos</p>
                <p className="amount amount-sm text-danger">- {fmt(gastosTot)}</p>
              </div>
            </div>
          </div>

          {/* Metas de ahorro */}
          {summary?.metas && summary.metas.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>METAS DE AHORRO</h3>
              {summary.metas.map(meta => {
                const pct = Math.min(100, (meta.monto_actual / meta.monto_objetivo) * 100);
                return (
                  <div key={meta.id} className={`card ${styles.metaCard}`}>
                    <div className={styles.metaHeader}>
                      <span className={styles.metaName}>{meta.nombre}</span>
                      <span className="text-secondary" style={{ fontSize: '0.8rem' }}>
                        {meta.moneda} {fmt(meta.monto_actual)} / {fmt(meta.monto_objetivo)}
                      </span>
                    </div>
                    <div className="progress-bar" style={{ margin: '8px 0' }}>
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className={styles.metaFooter}>
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>{pct.toFixed(0)}% completado</span>
                      {meta.aporte_mensual && (
                        <span className="text-secondary" style={{ fontSize: '0.75rem' }}>
                          ${fmt(meta.aporte_mensual)}/mes restante
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Lista por tarjeta */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>GASTOS DEL MES</h3>
            {TARJETAS_ORDEN.map(nombre => {
              const tData = porTarjeta.find(t => t.nombre?.includes(nombre));
              const tGastos = gastos.filter(g =>
                nombre === 'Contado'
                  ? !g.tarjeta_id || g.tarjeta_nombre?.includes('Contado')
                  : g.tarjeta_nombre?.includes(nombre)
              );
              if (!tGastos.length) return null;
              const total = tData ? toDisplay(tData.total_ars, tData.total_usd) : 0;
              const tarjetaColor = tData?.color_hex || '#555';
              return (
                <div key={nombre} className={styles.tarjetaGroup}>
                  <div className={styles.tarjetaHeader}>
                    <span className={styles.tarjetaDot} style={{ background: tarjetaColor }} />
                    <span className={styles.tarjetaNombre}>{tData?.nombre || nombre}</span>
                    <span className={`amount amount-sm`} style={{ color: tarjetaColor }}>
                      {monedaVista} {fmt(total)}
                    </span>
                  </div>
                  <div className={styles.gastosList}>
                    {tGastos.slice(0, 5).map(g => (
                      <div key={g.id} className={styles.gastoRow}>
                        <span className={styles.gastoDot} style={{ background: g.categoria_color || 'var(--text-muted)' }} />
                        <span className={styles.gastoDesc}>{g.descripcion}</span>
                        {g.es_cuota && <span className={styles.cuotaBadge}>{g.cuota_numero}/{g.cuota_total}</span>}
                        <span className={`amount amount-sm text-danger`}>{g.moneda==='USD'?'USD':'$'} {fmt(g.monto)}</span>
                      </div>
                    ))}
                    {tGastos.length > 5 && (
                      <p className="text-muted" style={{ fontSize: '0.75rem', padding: '4px 0' }}>
                        +{tGastos.length - 5} más...
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
