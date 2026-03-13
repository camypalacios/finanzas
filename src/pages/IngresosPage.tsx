// src/pages/IngresosPage.tsx
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAppStore } from '../store/appStore';
import MonthSelector from '../components/ui/MonthSelector';
import Modal from '../components/ui/Modal';
import type { Ingreso, Categoria } from '../types';
import styles from './IngresosPage.module.css';

const EMPTY = { descripcion: '', monto: '', moneda: 'ARS' as 'ARS' | 'USD', fecha: new Date().toISOString().split('T')[0], categoria_id: '', repetir_mensual: false, notas: '' };

export default function IngresosPage() {
  const { mes, anio } = useAppStore();
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Ingreso | null>(null);
  const [form, setForm] = useState({ ...EMPTY });

  const cargar = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get(`/ingresos?mes=${mes}&anio=${anio}`),
      api.get('/categorias'),
    ]).then(([i, c]) => { setIngresos(i.data); setCats(c.data); })
      .finally(() => setLoading(false));
  }, [mes, anio]);

  useEffect(() => { cargar(); }, [cargar]);

  const openNew = () => { setEditItem(null); setForm({ ...EMPTY, fecha: new Date().toISOString().split('T')[0] }); setModalOpen(true); };
  const openEdit = (i: Ingreso) => {
    setEditItem(i);
    setForm({ descripcion: i.descripcion, monto: String(i.monto), moneda: i.moneda, fecha: i.fecha, categoria_id: String(i.categoria_id || ''), repetir_mensual: i.repetir_mensual, notas: i.notas || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.descripcion || !form.monto) return toast.error('Completá campos requeridos');
    const body = { ...form, monto: parseFloat(form.monto), categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null };
    if (editItem) { await api.put(`/ingresos/${editItem.id}`, body); toast.success('Actualizado'); }
    else { await api.post('/ingresos', body); toast.success('Ingreso registrado'); }
    setModalOpen(false); cargar();
  };

  const total = ingresos.reduce((s, i) => s + (i.moneda === 'ARS' ? i.monto : 0), 0);

  return (
    <div className={styles.page}>
      <MonthSelector />
      <div className={styles.header}>
        <div>
          <p className="text-muted" style={{ fontSize:'0.75rem' }}>TOTAL INGRESOS</p>
          <p className="amount amount-md text-success">$ {new Intl.NumberFormat('es-AR').format(total)}</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Ingreso</button>
      </div>

      {loading ? <div>{[1,2].map(i=><div key={i} className="skeleton" style={{height:60,marginBottom:10}}/>)}</div>
      : ingresos.length === 0 ? (
        <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}>
          <p>Sin ingresos registrados</p>
        </div>
      ) : (
        <div className={styles.list}>
          {ingresos.map(i => (
            <div key={i.id} className={styles.item} onClick={() => openEdit(i)}>
              <div className={styles.info}>
                <p className={styles.desc}>{i.descripcion}</p>
                <p className="text-muted" style={{ fontSize:'0.75rem' }}>{i.categoria_nombre || 'Sin categoría'}</p>
              </div>
              <span className="amount amount-sm text-success">
                {i.moneda === 'USD' ? 'USD' : '$'} {new Intl.NumberFormat('es-AR').format(i.monto)}
              </span>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Editar Ingreso' : 'Nuevo Ingreso'}>
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          <div className="form-group">
            <label>Descripción</label>
            <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Sueldo, Freelance..." />
          </div>
          <div style={{ display:'flex', gap:'0.75rem' }}>
            <div className="form-group" style={{ flex:2 }}>
              <label>Monto</label>
              <input type="number" step="0.01" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label>Moneda</label>
              <select value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value as 'ARS'|'USD' }))}>
                <option value="ARS">ARS</option><option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div style={{ display:'flex', gap:'0.75rem' }}>
            <div className="form-group" style={{ flex:1 }}>
              <label>Fecha</label>
              <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label>Categoría</label>
              <select value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
                <option value="">Sin categoría</option>
                {cats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:'0.85rem', color:'var(--text-secondary)' }}>
            <input type="checkbox" checked={form.repetir_mensual} onChange={e => setForm(f => ({ ...f, repetir_mensual: e.target.checked }))} style={{ width:16, height:16, accentColor:'var(--accent)' }} />
            Repetir mensualmente
          </label>
          <button className="btn btn-primary" style={{ width:'100%' }} onClick={handleSave}>
            {editItem ? 'Guardar cambios' : 'Registrar ingreso'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
