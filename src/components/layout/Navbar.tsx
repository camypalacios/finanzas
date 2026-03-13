// src/components/layout/Navbar.tsx — Navbar hamburguesa fintech
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import styles from './Navbar.module.css';

const SECTIONS = [
  { path: '/',           icon: '◈', label: 'Dashboard' },
  { path: '/gastos',     icon: '↓', label: 'Gastos' },
  { path: '/ingresos',   icon: '↑', label: 'Ingresos' },
  { path: '/tarjetas',   icon: '▣', label: 'Tarjetas' },
  { path: '/metas',      icon: '◎', label: 'Metas de Ahorro' },
  { path: '/analitica',  icon: '◷', label: 'Analítica' },
  { path: '/terceros',   icon: '◉', label: 'Terceros' },
  { path: '/config',     icon: '⚙', label: 'Configuración' },
];

// Bottom nav: solo las secciones principales visibles
const BOTTOM_NAV = [
  { path: '/',          icon: '◈', label: 'Inicio' },
  { path: '/gastos',    icon: '↓', label: 'Gastos' },
  { path: '/ingresos',  icon: '↑', label: 'Ingresos' },
  { path: '/analitica', icon: '◷', label: 'Stats' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore(s => s.logout);

  const currentSection = SECTIONS.find(s => s.path === location.pathname)?.label || 'App';

  const go = (path: string) => { navigate(path); setOpen(false); };

  return (
    <>
      {/* Top bar */}
      <header className={styles.topbar}>
        <span className={styles.logo}>₱ FINANZAS</span>
        <span className={styles.pageTitle}>{currentSection}</span>
        <button className={styles.hamburger} onClick={() => setOpen(true)} aria-label="Menú">
          <span /><span /><span />
        </button>
      </header>

      {/* Drawer overlay */}
      {open && <div className={styles.overlay} onClick={() => setOpen(false)} />}

      {/* Side drawer */}
      <nav className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`}>
        <div className={styles.drawerHeader}>
          <span className={styles.logo}>₱ FINANZAS</span>
          <button className={styles.closeBtn} onClick={() => setOpen(false)}>✕</button>
        </div>
        <ul className={styles.navList}>
          {SECTIONS.map(s => (
            <li key={s.path}>
              <button
                className={`${styles.navItem} ${location.pathname === s.path ? styles.active : ''}`}
                onClick={() => go(s.path)}
              >
                <span className={styles.navIcon}>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <button className={styles.logoutBtn} onClick={logout}>
          ⎋ Cerrar sesión
        </button>
      </nav>

      {/* Bottom tab bar */}
      <nav className={styles.bottomNav}>
        {BOTTOM_NAV.map(s => (
          <button
            key={s.path}
            className={`${styles.bottomItem} ${location.pathname === s.path ? styles.bottomActive : ''}`}
            onClick={() => go(s.path)}
          >
            <span className={styles.bottomIcon}>{s.icon}</span>
            <span className={styles.bottomLabel}>{s.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
