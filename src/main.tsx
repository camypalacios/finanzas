import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="bottom-center"
      toastOptions={{
        style: {
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          fontFamily: 'var(--font-body)',
          fontSize: '0.85rem',
        },
        success: { iconTheme: { primary: '#00ff87', secondary: '#0a0a0f' } },
        error: { iconTheme: { primary: '#ff4d6d', secondary: '#0a0a0f' } },
      }}
    />
  </StrictMode>,
)
