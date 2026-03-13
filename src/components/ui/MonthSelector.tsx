// src/components/ui/MonthSelector.tsx
import { useAppStore } from '../../store/appStore';
import styles from './MonthSelector.module.css';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function MonthSelector() {
  const { mes, anio, prevMes, nextMes } = useAppStore();
  return (
    <div className={styles.container}>
      <button className={styles.arrow} onClick={prevMes} aria-label="Mes anterior">‹</button>
      <span className={styles.label}>{MESES[mes - 1]} {anio}</span>
      <button className={styles.arrow} onClick={nextMes} aria-label="Mes siguiente">›</button>
    </div>
  );
}
