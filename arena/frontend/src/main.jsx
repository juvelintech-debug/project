import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ToastProvider } from './components/Toast';
import { MetaProvider } from './context/MetaContext';
import './styles/global.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <MetaProvider>
          <Suspense fallback={<div className="page-loading"><span className="spinner spinner--lg" /><span>Loading…</span></div>}>
            <App />
          </Suspense>
        </MetaProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
