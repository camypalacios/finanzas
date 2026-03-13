// src/pages/MetasPage.tsx — Gestión de metas de ahorro
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import Modal from '../components/ui/Modal';
import type { MetaAhorro } from '../types';
import styles from './MetasPage.module.css';

function fmt(n: number) { return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n); }

const EMPTY_META = { nombre:'', monto_objetivo:'', moneda:'ARS' as 'ARS'|'USD', fecha_limite:'', descripcion:'', color_hex:'#00ff87' };
const EMPTY_APORTE = { monto:'', tipo:'aporte' as 'aporte'|'retiro', fecha: new Date().toISOString().split('T')[0], notas:'' };

export default function MetasPage() {
  const [metas, setMetas] = useState<MetaAhorro[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMeta, setModalMeta] = useState(false);
  const [modalAporte, setModalAporte] = useState(false);
  const [editMeta, setEditMeta] = useState<MetaAhorro | null>(null);
  const [aporteMeta, setAporteMeta] = useState<MetaAhorro | null>(null);
  const [form, setForm] = useState({ ...EMPTY_META });
  const [aporteForm, setAporteForm] = useState({ ...EMPTY_APORTE });

  const cargar = useCallback(() => {
    setLoading(true);
    api.get('/metas').then(r => setMetas(r.data)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const openNew = () => { setEditMeta(null); setForm({ ...EMPTY_META }); setModalMeta(true); };
  const openEdit = (m: MetaAhorro) => {
    setEditMeta(m);
    setForm({ nombre: m.nombre, monto_objetivo: String(m.monto_objetivo), moneda: m.moneda, fecha_limite: m.fecha_limite.split('T')[0], descripcion: m.descripcion || '', color_hex: m.color_hex });
    setModalMeta(true);
  };
  const openAporte = (m: MetaAhorro) => { setAporteMeta(m); setAporteForm({ ...EMPTY_APORTE }); setModalAporte(true); };

  const handleSaveMeta = async () => {
    if (!form.nombre || !form.monto_objetivo || !form.fecha_limite) return toast.error('Completá todos los campos');
    const body = { ...form, monto_objetivo: parseFloat(form.monto_objetivo) };
    if (editMeta) { await api.put(`/metas/${editMeta.id}`, { ...body, activa: editMeta.activa }); toast.success('Meta actualizada'); }
    else { await api.post('/metas', body); toast.success('Meta creada 🎯'); }
    setModalMeta(false); cargar();
  };

  const handleAporte = async () => {
    if (!aporteForm.monto || !aporteMeta) return;
    await api.post(`/metas/${aporteMeta.id}?action=aportar`, { ...aporteForm, monto: parseFloat(aporteForm.monto), moneda: aporteMeta.moneda });
    toast.success(aporteForm.tipo === 'aporte' ? '💰 Aporte registrado' : 'Retiro registrado');
    setModalAporte(false); cargar();
  };

  const today = new Date();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>METAS DE AHORRO</h2>
        <button className="btn btn-primary" onClick={openNew}>+ Meta</button>
      </div>

      {loading ? <div>{[1,2].map(i=><div key={i} className="skeleton" style={{height:140,marginBottom:12}}/>)}</div>
      : metas.filter(m => m.activa).length === 0 ? (
        <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}>
          <p style={{ fontSize:'2rem' }}>🎯</p>
          <p>Sin metas activas</p>
          <button className="btn btn-ghost" style={{ marginTop:'1rem' }} onClick={openNew}>Crear primera meta</button>
        </div>
      ) : (
        <div className={styles.list}>
          {metas.filter(m => m.activa).map(meta => {
            const pct = Math.min(100, (meta.monto_actual / meta.monto_objetivo) * 100);
            const limite = new Date(meta.fecha_limite);
            const mesesRestantes = Math.max(1,
              (limite.getFullYear() - today.getFullYear()) * 12 + (limite.getMonth() - today.getMonth()));
            const falta = Math.max(0, meta.monto_objetivo - meta.monto_actual);
            const aporteMensual = falta / mesesRestantes;
            return (
              <div key={meta.id} className={`card ${styles.metaCard}`} style={{ borderTopColor: meta.color_hex }}>
                <div className={styles.metaTop}>
                  <div>
                    <h3 className={styles.metaNombre}>{meta.nombre}</h3>
                    {meta.descripcion && <p className="text-muted" style={{ fontSize:'0.78rem' }}>{meta.descripcion}</p>}
                  </div>
                  <button className="btn btn-ghost btn-icon" onClick={() => openEdit(meta)}>✎</button>
                </div>
                <div className={styles.metaMontos}>
                  <span className="amount amount-md" style={{ color: meta.color_hex }}>{meta.moneda} {fmt(meta.monto_actual)}</span>
                  <span className="text-muted" style={{ fontSize:'0.85rem' }}>/ {meta.moneda} {fmt(meta.monto_objetivo)}</span>
                </div>
                <div className="progress-bar" style={{ margin: '10px 0' }}>
                  <div className="progress-bar-fill" style={{ width: `${pct}%`, background: meta.color_hex }} />
                </div>
                <div className={styles.metaPie}>
                  <span className="text-secondary" style={{ fontSize:'0.78rem' }}>{pct.toFixed(1)}% completado</span>
                  <span className="text-muted" style={{ fontSize:'0.78rem' }}>{mesesRestantes} mes{mesesRestantes !== 1 ? 'es' : ''} restantes</span>
                </div>
                <div className={styles.metaPie} style={{ marginTop:'4px' }}>
                  <span className="text-warning" style={{ fontSize:'0.82rem' }}>
                    Falta: {meta.moneda} {fmt(falta)} → ${fmt(aporteMensual)}/mes
                  </span>
                </div>
                <button className="btn btn-primary" style={{ width:'100%', marginTop:'0.875rem' }} onClick={() => openAporte(meta)}>
                  💰 Apartar dinero
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal nueva/editar meta */}
      <Modal open={modalMeta} onClose={() => setModalMeta(false)} title={editMeta ? 'Editar Meta' : 'Nueva Meta'}>
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          <div className="form-group"><label>Nombre</label><input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} placeholder="Ej: Viaje, Auto, Fondo..." /></div>
          <div style={{ display:'flex', gap:'0.75rem' }}>
            <div className="form-group" style={{ flex:2 }}><label>Monto objetivo</label><input type="number" value={form.monto_objetivo} onChange={e=>setForm(f=>({...f,monto_objetivo:e.target.value}))} /></div>
            <div className="form-group" style={{ flex:1 }}><label>Moneda</label><select value={form.moneda} onChange={e=>setForm(f=>({...f,moneda:e.target.value as 'ARS'|'USD'}))}><option value="ARS">ARS</option><option value="USD">USD</option></select></div>
          </div>
          <div className="form-group"><label>Fecha límite</label><input type="date" value={form.fecha_limite} onChange={e=>setForm(f=>({...f,fecha_limite:e.target.value}))} /></div>
          <div className="form-group"><label>Descripción (opcional)</label><input value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} placeholder="Para qué es esta meta..." /></div>
          <div className="form-group"><label>Color</label><input type="color" value={form.color_hex} onChange={e=>setForm(f=>({...f,color_hex:e.target.value}))} /></div>
          <button className="btn btn-primary" style={{ width:'100%' }} onClick={handleSaveMeta}>{editMeta ? 'Guardar' : 'Crear meta 🎯'}</button>
        </div>
      </Modal>

      {/* Modal aporte */}
      <Modal open={modalAporte} onClose={() => setModalAporte(false)} title={`Apartar para: ${aporteMeta?.nombre}`}>
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          <div style={{ display:'flex', gap:'6px' }}>
            {(['aporte','retiro'] as const).map(t => (
              <button key={t} className={`btn ${aporteForm.tipo === t ? 'btn-primary' : 'btn-ghost'}`} onClick={()=>setAporteForm(f=>({...f,tipo:t}))}>
                {t === 'aporte' ? '+ Apartar' : '− Retirar'}
              </button>
            ))}
          </div>
          <div className="form-group"><label>Monto ({aporteMeta?.moneda})</label><input type="number" step="0.01" value={aporteForm.monto} onChange={e=>setAporteForm(f=>({...f,monto:e.target.value}))} /></div>
          <div className="form-group"><label>Fecha</label><input type="date" value={aporteForm.fecha} onChange={e=>setAporteForm(f=>({...f,fecha:e.target.value}))} /></div>
          <div className="form-group"><label>Notas (opcional)</label><input value={aporteForm.notas} onChange={e=>setAporteForm(f=>({...f,notas:e.target.value}))} /></div>
          <button className="btn btn-primary" style={{ width:'100%' }} onClick={handleAporte}>Confirmar</button>
        </div>
      </Modal>
    </div>
  );
}
