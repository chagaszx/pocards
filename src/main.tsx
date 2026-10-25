import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { applyToDocument } from './lib/settings'
import './index.css'

applyToDocument()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Última rede de segurança: nada de tela branca se o próprio menu quebrar */}
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
