// src/pages/GastosPage.tsx — CRUD de gastos completo
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAppStore } from '../store/appStore';
import GastoItem from '../components/ui/GastoItem';
import Modal from '../components/ui/Modal';
import MonthSelector from '../components/ui/MonthSelector';
import type { Gasto, Categoria, Tarjeta, Tercero, Etiqueta } from '../types';
import styles from './GastosPage.module.css';

const EMPTY_FORM = {
  descripcion: '', monto: '', moneda: 'ARS' as 'ARS' | 'USD', fecha: new Date().toISOString().split('T')[0],
  categoria_id: '', tarjeta_id: '', tercero_id: '', es_fijo: false, cuotas: 1,
  notas: '', etiquetas: [] as number[], propagar_tercero: false,
};

export default function GastosPage() {
  const { mes, anio } = useAppStore();
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([]);
  const [terceros, setTerceros] = useState<Tercero[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editGasto, setEditGasto] = useState<Gasto | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [filterTarjeta, setFilterTarjeta] = useState('');
  const [nuevoTercero, setNuevoTercero] = useState('');

  const cargar = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ mes: String(mes), anio: String(anio) });
    if (filterTarjeta) params.set('tarjeta_id', filterTarjeta);
    Promise.all([
      api.get(`/gastos?${params}`),
      api.get('/categorias'),
      api.get('/tarjetas'),
      api.get('/terceros'),
      api.get('/etiquetas'),
    ]).then(([g, c, t, te, et]) => {
      setGastos(g.data); setCategorias(c.data); setTarjetas(t.data);
      setTerceros(te.data); setEtiquetas(et.data);
    }).catch(() => toast.error('Error cargando gastos'))
      .finally(() => setLoading(false));
  }, [mes, anio, filterTarjeta]);

  useEffect(() => { cargar(); }, [cargar]);

  const openNew = () => { setEditGasto(null); setForm({ ...EMPTY_FORM, fecha: new Date().toISOString().split('T')[0] }); setModalOpen(true); };
  const openEdit = (g: Gasto) => {
    setEditGasto(g);
    setForm({
      descripcion: g.descripcion, monto: String(g.monto), moneda: g.moneda,
      fecha: g.fecha, categoria_id: String(g.categoria_id || ''),
      tarjeta_id: String(g.tarjeta_id || ''), tercero_id: String(g.tercero_id || ''),
      es_fijo: g.es_fijo, cuotas: g.cuota_total || 1, notas: g.notas || '',
      etiquetas: [], propagar_tercero: false,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.descripcion || !form.monto) return toast.error('Completá descripción y monto');
    try {
      const body = {
        ...form, monto: parseFloat(form.monto),
        categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
        tarjeta_id: form.tarjeta_id ? parseInt(form.tarjeta_id) : null,
        tercero_id: form.tercero_id ? parseInt(form.tercero_id) : null,
      };
      if (editGasto) {
        await api.put(`/gastos/${editGasto.id}`, body);
        toast.success('Gasto actualizado');
      } else {
        await api.post('/gastos', { ...body, cuotas: form.cuotas });
        toast.success(form.cuotas > 1 ? `${form.cuotas} cuotas creadas` : 'Gasto registrado');
      }
      setModalOpen(false); cargar();
    } catch { toast.error('Error al guardar'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    await api.delete(`/gastos/${id}`);
    toast.success('Eliminado'); cargar();
  };

  const addTercero = async () => {
    if (!nuevoTercero.trim()) return;
    const { data } = await api.post('/terceros', { nombre: nuevoTercero.trim() });
    setTerceros(prev => [...prev, data]);
    setForm(f => ({ ...f, tercero_id: String(data.id) }));
    setNuevoTercero('');
    toast.success('Tercero agregado');
  };

  const toggleEtiqueta = (id: number) => {
    setForm(f => ({
      ...f, etiquetas: f.etiquetas.includes(id) ? f.etiquetas.filter(e => e !== id) : [...f.etiquetas, id]
    }));
  };

  const totalMes = gastos.reduce((s, g) => s + (g.moneda === 'ARS' ? g.monto : 0), 0);

  return (
    <div className={styles.page}>
      <MonthSelector />
      <div className={styles.header}>
        <div>
          <p className="text-muted" style={{ fontSize: '0.75rem' }}>TOTAL DEL MES</p>
          <p className="amount amount-md text-danger">$ {new Intl.NumberFormat('es-AR').format(totalMes)}</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Gasto</button>
      </div>

      {/* Filtro por tarjeta */}
      <div className={styles.filters}>
        <button className={`${styles.filterBtn} ${!filterTarjeta ? styles.filterActive : ''}`} onClick={() => setFilterTarjeta('')}>Todos</button>
        {tarjetas.map(t => (
          <button
            key={t.id}
            className={`${styles.filterBtn} ${filterTarjeta === String(t.id) ? styles.filterActive : ''}`}
            style={filterTarjeta === String(t.id) ? { borderColor: t.color_hex, color: t.color_hex } : {}}
            onClick={() => setFilterTarjeta(String(t.id))}
          >{t.nombre}</button>
        ))}
      </div>

      {loading ? (
        <div>{[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 70, marginBottom: 10 }} />)}</div>
      ) : gastos.length === 0 ? (
        <div className={styles.empty}>
          <p>Sin gastos este mes</p>
          <button className="btn btn-ghost" onClick={openNew}>Registrar primer gasto</button>
        </div>
      ) : (
        <div className={styles.list}>
          {gastos.map(g => (
            <div key={g.id} className={styles.itemWrapper}>
              <GastoItem gasto={g} onClick={() => openEdit(g)} />
              <button className={`btn btn-danger btn-icon ${styles.deleteBtn}`} onClick={() => handleDelete(g.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editGasto ? 'Editar Gasto' : 'Nuevo Gasto'}>
        <div className={styles.form}>
          <div className="form-group">
            <label>Descripción</label>
            <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Netflix, Supermercado..." />
          </div>
          <div className={styles.row}>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Monto</label>
              <input type="number" step="0.01" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Moneda</label>
              <select value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value as 'ARS' | 'USD' }))}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div className={styles.row}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Fecha</label>
              <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
            </div>
            {!editGasto && (
              <div className="form-group" style={{ flex: 1 }}>
                <label>Cuotas</label>
                <input type="number" min={1} max={60} value={form.cuotas} onChange={e => setForm(f => ({ ...f, cuotas: parseInt(e.target.value) || 1 }))} />
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Tarjeta</label>
            <select value={form.tarjeta_id} onChange={e => setForm(f => ({ ...f, tarjeta_id: e.target.value }))}>
              <option value="">Sin tarjeta (Contado)</option>
              {tarjetas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Categoría</label>
            <select value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
              <option value="">Sin categoría</option>
              {categorias.filter(c => !c.parent_id).map(c => (
                <optgroup key={c.id} label={c.nombre}>
                  <option value={c.id}>{c.nombre}</option>
                  {categorias.filter(s => s.parent_id === c.id).map(s => (
                    <option key={s.id} value={s.id}>  └ {s.nombre}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Responsable</label>
            <div className={styles.terceroRow}>
              <select value={form.tercero_id} onChange={e => setForm(f => ({ ...f, tercero_id: e.target.value }))}>
                <option value="">Propio</option>
                {terceros.map(t => <option key={t.id} value={t.id}>{t.nombre}{t.relacion ? ` (${t.relacion})` : ''}</option>)}
              </select>
              <input
                value={nuevoTercero}
                onChange={e => setNuevoTercero(e.target.value)}
                placeholder="Nuevo..." style={{ flex: 1 }}
                onKeyDown={e => e.key === 'Enter' && addTercero()}
              />
              <button className="btn btn-ghost" onClick={addTercero} style={{ flexShrink: 0 }}>+</button>
            </div>
          </div>
          {form.tercero_id && editGasto?.es_cuota && (
            <label className={styles.checkRow}>
              <input type="checkbox" checked={form.propagar_tercero} onChange={e => setForm(f => ({ ...f, propagar_tercero: e.target.checked }))} />
              <span>Propagar a cuotas futuras</span>
            </label>
          )}
          <div className="form-group">
            <label>Etiquetas</label>
            <div className={styles.etqRow}>
              {etiquetas.map(e => (
                <button
                  key={e.id}
                  className={`${styles.etqBtn} ${form.etiquetas.includes(e.id) ? styles.etqActive : ''}`}
                  style={form.etiquetas.includes(e.id) ? { borderColor: e.color_hex, color: e.color_hex } : {}}
                  onClick={() => toggleEtiqueta(e.id)}
                >{e.nombre}</button>
              ))}
            </div>
          </div>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={form.es_fijo} onChange={e => setForm(f => ({ ...f, es_fijo: e.target.checked }))} />
            <span>Gasto fijo mensual</span>
          </label>
          <div className="form-group">
            <label>Notas (opcional)</label>
            <textarea rows={2} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} style={{ resize: 'none' }} />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSave}>
            {editGasto ? 'Guardar cambios' : 'Registrar gasto'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
