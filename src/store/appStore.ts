// src/store/appStore.ts — Estado global de la app
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TipoCambio } from '../types';

interface AppState {
  mes: number;
  anio: number;
  setMes: (mes: number) => void;
  setAnio: (anio: number) => void;
  prevMes: () => void;
  nextMes: () => void;
  tipoCambio: TipoCambio | null;
  setTipoCambio: (tc: TipoCambio) => void;
  monedaVista: 'ARS' | 'USD';
  setMonedaVista: (m: 'ARS' | 'USD') => void;
}

const now = new Date();

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      mes: now.getMonth() + 1,
      anio: now.getFullYear(),
      setMes: (mes) => set({ mes }),
      setAnio: (anio) => set({ anio }),
      prevMes: () => {
        const { mes, anio } = get();
        if (mes === 1) set({ mes: 12, anio: anio - 1 });
        else set({ mes: mes - 1 });
      },
      nextMes: () => {
        const { mes, anio } = get();
        if (mes === 12) set({ mes: 1, anio: anio + 1 });
        else set({ mes: mes + 1 });
      },
      tipoCambio: null,
      setTipoCambio: (tc) => set({ tipoCambio: tc }),
      monedaVista: 'ARS',
      setMonedaVista: (m) => set({ monedaVista: m }),
    }),
    { name: 'app-storage' }
  )
);
