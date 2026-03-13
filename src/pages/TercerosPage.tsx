// src/pages/TercerosPage.tsx
import { useEffect, useState } from 'react';
import api from '../lib/api';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import type { Tercero } from '../types';
import styles from './TercerosPage.module.css';

function fmt(n: number) { return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Number(n)); }

export default function TercerosPage() {
  const [terceros, setTerceros] = useState<Tercero[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', relacion: '' });

  const cargar = () => { setLoading(true); api.get('/terceros').then(r => setTerceros(r.data)).finally(() => setLoading(false)); };
  useEffect(() => { cargar(); }, []);

  const handleSave = async () => {
    if (!form.nombre.trim()) return toast.error('Ingresá un nombre');
    await api.post('/terceros', form);
    toast.success('Tercero agregado');
    setModal(false); setForm({ nombre: '', relacion: '' }); cargar();
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>TERCEROS</h2>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Agregar</button>
      </div>
      <p className="text-muted" style={{ fontSize:'0.8rem', marginBottom:'1rem' }}>
        Personas cuyos gastos manejás o registrás en la app.
      </p>

      {loading ? <div>{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:70,marginBottom:10}}/>)}</div>
      : terceros.length === 0 ? (
        <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}>
          <p>Sin terceros registrados</p>
        </div>
      ) : (
        <div className={styles.list}>
          {terceros.map(t => (
            <div key={t.id} className={styles.item}>
              <div className={styles.avatar}>{t.nombre.charAt(0).toUpperCase()}</div>
              <div className={styles.info}>
                <p className={styles.nombre}>{t.nombre}</p>
                {t.relacion && <p className="text-muted" style={{ fontSize:'0.78rem' }}>{t.relacion}</p>}
              </div>
              {t.total_gastos !== undefined && Number(t.total_gastos) > 0 && (
                <div style={{ textAlign:'right' }}>
                  <p className="text-muted" style={{ fontSize:'0.7rem' }}>Gastos registrados</p>
                  <p className="amount amount-sm text-danger">$ {fmt(t.total_gastos!)}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo Tercero">
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          <div className="form-group"><label>Nombre</label><input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} placeholder="Ej: Mamá, Hermano..." /></div>
          <div className="form-group"><label>Relación (opcional)</label><input value={form.relacion} onChange={e=>setForm(f=>({...f,relacion:e.target.value}))} placeholder="Ej: Familiar, Amigo..." /></div>
          <button className="btn btn-primary" style={{ width:'100%' }} onClick={handleSave}>Agregar</button>
        </div>
      </Modal>
    </div>
  );
}
