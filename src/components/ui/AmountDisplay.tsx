// src/components/ui/AmountDisplay.tsx — Muestra monto con conversión ARS/USD
import { useAppStore } from '../../store/appStore';
import styles from './AmountDisplay.module.css';

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(n);
}

interface Props {
  ars: number;
  usd?: number;
  size?: 'lg' | 'md' | 'sm';
  positive?: boolean;
  negative?: boolean;
}

export default function AmountDisplay({ ars, usd, size = 'md', positive, negative }: Props) {
  const { monedaVista, tipoCambio } = useAppStore();

  let value: number;
  let symbol: string;

  if (monedaVista === 'USD') {
    if (usd !== undefined) { value = usd; symbol = 'USD'; }
    else { value = ars / (tipoCambio?.usd_blue || 1200); symbol = 'USD'; }
  } else {
    value = ars + (usd !== undefined ? usd * (tipoCambio?.usd_blue || 1200) : 0);
    symbol = 'ARS';
  }

  const colorClass = positive ? styles.positive : negative ? styles.negative : '';

  return (
    <span className={`amount amount-${size} ${styles.amount} ${colorClass}`}>
      <span className={styles.symbol}>{symbol} </span>
      {fmt(value)}
    </span>
  );
}
