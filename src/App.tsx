// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import GastosPage from './pages/GastosPage';
import IngresosPage from './pages/IngresosPage';
import TarjetasPage from './pages/TarjetasPage';
import MetasPage from './pages/MetasPage';
import AnaliticaPage from './pages/AnaliticaPage';
import TercerosPage from './pages/TercerosPage';
import ConfigPage from './pages/ConfigPage';

function PrivateRoute() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated());
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<PrivateRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/gastos" element={<GastosPage />} />
            <Route path="/ingresos" element={<IngresosPage />} />
            <Route path="/tarjetas" element={<TarjetasPage />} />
            <Route path="/metas" element={<MetasPage />} />
            <Route path="/analitica" element={<AnaliticaPage />} />
            <Route path="/terceros" element={<TercerosPage />} />
            <Route path="/config" element={<ConfigPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}