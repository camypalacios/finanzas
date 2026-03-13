// src/pages/ConfigPage.tsx — Configuración general
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import Modal from '../components/ui/Modal';
import type { Categoria, Etiqueta } from '../types';
import styles from './ConfigPage.module.css';

export default function ConfigPage() {
  const [cats, setCats] = useState<Categoria[]>([]);
  const [etqs, setEtqs] = useState<Etiqueta[]>([]);
  const [tc, setTc] = useState({ usd_oficial: '', usd_blue: '' });
  const [modalCat, setModalCat] = useState(false);
  const [modalEtq, setModalEtq] = useState(false);
  const [formCat, setFormCat] = useState({ nombre: '', color_hex: '#00ff87', parent_id: '' });
  const [formEtq, setFormEtq] = useState({ nombre: '', color_hex: '#f39c12' });

  useEffect(() => {
    Promise.all([api.get('/categorias'), api.get('/etiquetas'), api.get('/currency/rate')])
      .then(([c, e, r]) => { setCats(c.data); setEtqs(e.data); setTc({ usd_oficial: String(r.data.usd_oficial), usd_blue: String(r.data.usd_blue) }); });
  }, []);

  const saveCat = async () => {
    if (!formCat.nombre) return;
    await api.post('/categorias', { ...formCat, parent_id: formCat.parent_id || null });
    toast.success('Categoría creada');
    setModalCat(false);
    api.get('/categorias').then(r => setCats(r.data));
  };

  const deleteCat = async (id: number) => {
    if (!confirm('¿Desactivar categoría?')) return;
    await api.delete(`/categorias/${id}`);
    setCats(prev => prev.filter(c => c.id !== id));
    toast.success('Categoría desactivada');
  };

  const saveEtq = async () => {
    if (!formEtq.nombre) return;
    await api.post('/etiquetas', formEtq);
    toast.success('Etiqueta creada');
    setModalEtq(false);
    api.get('/etiquetas').then(r => setEtqs(r.data));
  };

  const saveTc = async () => {
    await api.post('/currency/rate', { fecha: new Date().toISOString().split('T')[0], usd_oficial: parseFloat(tc.usd_oficial), usd_blue: parseFloat(tc.usd_blue) });
    toast.success('Tipo de cambio actualizado');
  };

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>CONFIGURACIÓN</h2>

      {/* Tipo de cambio */}
      <div className={`card ${styles.section}`}>
        <h3 className={styles.sectionTitle}>💱 Tipo de Cambio</h3>
        <div style={{ display:'flex', gap:'0.75rem', marginBottom:'0.75rem' }}>
          <div className="form-group" style={{ flex:1 }}>
            <label>USD Oficial</label>
            <input type="number" value={tc.usd_oficial} onChange={e=>setTc(t=>({...t,usd_oficial:e.target.value}))} />
          </div>
          <div className="form-group" style={{ flex:1 }}>
            <label>USD Blue</label>
            <input type="number" value={tc.usd_blue} onChange={e=>setTc(t=>({...t,usd_blue:e.target.value}))} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={saveTc}>Guardar tipo de cambio</button>
      </div>

      {/* Categorías */}
      <div className={`card ${styles.section}`}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>🏷 Categorías</h3>
          <button className="btn btn-ghost" onClick={() => setModalCat(true)}>+ Nueva</button>
        </div>
        <div className={styles.chipList}>
          {cats.map(c => (
            <div key={c.id} className={styles.chip} style={{ borderColor: c.color_hex }}>
              <span style={{ color: c.color_hex }}>{c.nombre}</span>
              {c.parent_id && <span className="text-muted" style={{ fontSize:'0.65rem' }}>↳</span>}
              <button className={styles.chipDel} onClick={() => deleteCat(c.id)}>✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* Etiquetas */}
      <div className={`card ${styles.section}`}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>🔖 Etiquetas</h3>
          <button className="btn btn-ghost" onClick={() => setModalEtq(true)}>+ Nueva</button>
        </div>
        <div className={styles.chipList}>
          {etqs.map(e => (
            <div key={e.id} className={styles.chip} style={{ borderColor: e.color_hex }}>
              <span style={{ color: e.color_hex }}>{e.nombre}</span>
            </div>
          ))}
        </div>
      </div>

      <Modal open={modalCat} onClose={() => setModalCat(false)} title="Nueva Categoría">
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          <div className="form-group"><label>Nombre</label><input value={formCat.nombre} onChange={e=>setFormCat(f=>({...f,nombre:e.target.value}))} /></div>
          <div className="form-group"><label>Color</label><input type="color" value={formCat.color_hex} onChange={e=>setFormCat(f=>({...f,color_hex:e.target.value}))} /></div>
          <div className="form-group">
            <label>Categoría padre (subcategoría)</label>
            <select value={formCat.parent_id} onChange={e=>setFormCat(f=>({...f,parent_id:e.target.value}))}>
              <option value="">Raíz (sin padre)</option>
              {cats.filter(c=>!c.parent_id).map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" style={{ width:'100%' }} onClick={saveCat}>Crear categoría</button>
        </div>
      </Modal>

      <Modal open={modalEtq} onClose={() => setModalEtq(false)} title="Nueva Etiqueta">
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          <div className="form-group"><label>Nombre</label><input value={formEtq.nombre} onChange={e=>setFormEtq(f=>({...f,nombre:e.target.value}))} /></div>
          <div className="form-group"><label>Color</label><input type="color" value={formEtq.color_hex} onChange={e=>setFormEtq(f=>({...f,color_hex:e.target.value}))} /></div>
          <button className="btn btn-primary" style={{ width:'100%' }} onClick={saveEtq}>Crear etiqueta</button>
        </div>
      </Modal>
    </div>
  );
}
