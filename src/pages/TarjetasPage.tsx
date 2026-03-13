// src/pages/TarjetasPage.tsx — Gestión de tarjetas + importación PDF
import { useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import api from '../lib/api';
import Modal from '../components/ui/Modal';
import type { Tarjeta } from '../types';
import styles from './TarjetasPage.module.css';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const now = new Date();

export default function TarjetasPage() {
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([]);
  const [modalPDF, setModalPDF] = useState(false);
  const [selectedTarjeta, setSelectedTarjeta] = useState<number | null>(null);
  const [pdfMes, setPdfMes] = useState(now.getMonth() + 1);
  const [pdfAnio, setPdfAnio] = useState(now.getFullYear());
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<{nuevas:number;actualizadas:number;duplicadas:number} | null>(null);

  useEffect(() => { api.get('/tarjetas').then(r => setTarjetas(r.data)); }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDrop: (files) => { if (files[0]) setPdfFile(files[0]); },
  });

  const toBase64 = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res((reader.result as string).split(',')[1]);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });

  const handleImport = async () => {
    if (!pdfFile || !selectedTarjeta) return toast.error('Seleccioná tarjeta y archivo PDF');
    setProcesando(true);
    setResultado(null);
    try {
      const b64 = await toBase64(pdfFile);
      const { data } = await api.post('/cards/import-pdf', {
        pdf_base64: b64, tarjeta_id: selectedTarjeta, mes: pdfMes, anio: pdfAnio,
      });
      setResultado(data);
      toast.success(`PDF importado: ${data.nuevas} nuevas, ${data.actualizadas} actualizadas`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error procesando PDF');
    } finally { setProcesando(false); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.title}>MIS TARJETAS</h2>
        <button className="btn btn-primary" onClick={() => setModalPDF(true)}>Importar PDF</button>
      </div>

      <div className={styles.list}>
        {tarjetas.map(t => (
          <div key={t.id} className={styles.card} style={{ borderLeftColor: t.color_hex }}>
            <div className={styles.cardInfo}>
              <p className={styles.cardName}>{t.nombre}</p>
              <p className={styles.cardType}>{t.tipo === 'credito' ? 'Crédito' : 'Débito'} {t.ultimos_digitos ? `····${t.ultimos_digitos}` : ''}</p>
            </div>
            <button
              className="btn btn-ghost"
              onClick={() => { setSelectedTarjeta(t.id); setModalPDF(true); }}
            >PDF ↑</button>
          </div>
        ))}
      </div>

      <Modal open={modalPDF} onClose={() => { setModalPDF(false); setPdfFile(null); setResultado(null); }} title="Importar Resumen PDF">
        <div className={styles.pdfForm}>
          <div className="form-group">
            <label>Tarjeta</label>
            <select value={selectedTarjeta || ''} onChange={e => setSelectedTarjeta(parseInt(e.target.value))}>
              <option value="">Elegir tarjeta...</option>
              {tarjetas.filter(t => t.tipo === 'credito').map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', gap:'0.75rem' }}>
            <div className="form-group" style={{ flex:2 }}>
              <label>Mes del resumen</label>
              <select value={pdfMes} onChange={e => setPdfMes(parseInt(e.target.value))}>
                {MESES.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label>Año</label>
              <input type="number" value={pdfAnio} min={2020} max={2030} onChange={e => setPdfAnio(parseInt(e.target.value))} />
            </div>
          </div>

          <div {...getRootProps()} className={`${styles.dropzone} ${isDragActive ? styles.dropzoneActive : ''} ${pdfFile ? styles.dropzoneReady : ''}`}>
            <input {...getInputProps()} />
            {pdfFile ? (
              <p>📄 {pdfFile.name}</p>
            ) : isDragActive ? (
              <p>Soltá el PDF aquí...</p>
            ) : (
              <p>Arrastrá el PDF del resumen o tocá para buscar</p>
            )}
          </div>

          {resultado && (
            <div className={styles.resultado}>
              <div className={styles.resultItem}><span>Nuevas</span><span className="text-success">{resultado.nuevas}</span></div>
              <div className={styles.resultItem}><span>Actualizadas</span><span className="text-neon">{resultado.actualizadas}</span></div>
              <div className={styles.resultItem}><span>Duplicadas</span><span className="text-muted">{resultado.duplicadas}</span></div>
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width:'100%' }}
            onClick={handleImport}
            disabled={procesando || !pdfFile || !selectedTarjeta}
          >
            {procesando ? '⟳ Procesando...' : 'Procesar PDF con IA'}
          </button>
          <p className="text-muted" style={{ fontSize:'0.72rem', textAlign:'center' }}>
            El PDF se analiza con GPT-4o Vision. La importación puede tardar 20-40 segundos.
          </p>
        </div>
      </Modal>
    </div>
  );
}
