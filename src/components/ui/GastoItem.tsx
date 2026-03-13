// src/components/ui/GastoItem.tsx — Item de gasto en lista
import type { Gasto } from '../../types';
import styles from './GastoItem.module.css';

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n);
}

interface Props {
  gasto: Gasto;
  onClick?: () => void;
}

export default function GastoItem({ gasto, onClick }: Props) {
  return (
    <div className={styles.item} onClick={onClick}>
      <div
        className={styles.categoryDot}
        style={{ background: gasto.categoria_color || 'var(--text-muted)' }}
      />
      <div className={styles.content}>
        <div className={styles.desc}>
          <span className={styles.title}>{gasto.descripcion}</span>
          {gasto.es_cuota && gasto.cuota_numero && (
            <span className={styles.cuota}>{gasto.cuota_numero}/{gasto.cuota_total}</span>
          )}
          {gasto.estado === 'preventivo' && <span className={styles.prev}>prev.</span>}
        </div>
        <div className={styles.meta}>
          {gasto.tarjeta_nombre && <span className={styles.tag}>{gasto.tarjeta_nombre}</span>}
          {gasto.tercero_nombre && <span className={`${styles.tag} ${styles.tercero}`}>{gasto.tercero_nombre}</span>}
          {gasto.etiquetas && gasto.etiquetas.split(',').map(e => (
            <span key={e} className={`${styles.tag} ${styles.etq}`}>{e}</span>
          ))}
        </div>
      </div>
      <div className={styles.monto}>
        <span className={styles.montoValue} style={{ color: 'var(--danger)' }}>
          {gasto.moneda === 'USD' ? 'USD' : '$'} {fmt(gasto.monto)}
        </span>
      </div>
    </div>
  );
}
