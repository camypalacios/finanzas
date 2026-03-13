// src/pages/LoginPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore(s => s.login);

  // Cambio de contraseña
  const [showChange, setShowChange] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [nuevaPass, setNuevaPass] = useState('');
  const [confirmaPass, setConfirmaPass] = useState('');
  const [loadingChange, setLoadingChange] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      login(data.token, data.username);
      navigate('/');
    } catch {
      toast.error('Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nuevaPass !== confirmaPass) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    setLoadingChange(true);
    try {
      await api.post('/auth/change-password', { codigo, nuevaPassword: nuevaPass });
      toast.success('Contraseña actualizada correctamente');
      setShowChange(false);
      setCodigo('');
      setNuevaPass('');
      setConfirmaPass('');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al cambiar la contraseña');
    } finally {
      setLoadingChange(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>₱</div>
        <h1 className={styles.title}>FINANZAS</h1>
        <p className={styles.subtitle}>Gestor financiero personal</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="form-group">
            <label>Usuario</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="matias"
              autoComplete="username"
              required
            />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar →'}
          </button>
        </form>

        {/* ── Cambiar contraseña ── */}
        <div className={styles.changeSection}>
          <button
            type="button"
            className={styles.changeToggle}
            onClick={() => setShowChange(v => !v)}
          >
            {showChange ? '✕ Cancelar' : '🔑 Cambiar contraseña'}
          </button>

          {showChange && (
            <form onSubmit={handleChangePassword} className={styles.changeForm}>
              <div className="form-group">
                <label>Código de acceso</label>
                <input
                  type="password"
                  value={codigo}
                  onChange={e => setCodigo(e.target.value)}
                  placeholder="••••••"
                  required
                />
              </div>
              <div className="form-group">
                <label>Nueva contraseña</label>
                <input
                  type="password"
                  value={nuevaPass}
                  onChange={e => setNuevaPass(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
              <div className="form-group">
                <label>Confirmar contraseña</label>
                <input
                  type="password"
                  value={confirmaPass}
                  onChange={e => setConfirmaPass(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loadingChange}>
                {loadingChange ? 'Guardando...' : 'Guardar nueva contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
