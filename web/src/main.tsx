import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

async function unregisterMSW() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      if (reg.active?.scriptURL.includes('mockServiceWorker')) {
        await reg.unregister();
        console.log('[App] 已注销旧 MSW Service Worker');
      }
    }
  }
}

async function checkBackend(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('/api/v1/auth/me', { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

async function bootstrap() {
  const forceBackend = import.meta.env.VITE_USE_BACKEND === 'true';
  const forceMock = import.meta.env.VITE_USE_MOCK === 'true';

  let useMock = forceMock;

  if (!forceBackend && !forceMock) {
    const backendOk = await checkBackend();
    if (backendOk) {
      console.log('[App] 后端已连接，使用真实爬取数据');
      await unregisterMSW();
      useMock = false;
    } else {
      console.log('[App] 后端未就绪，使用 MSW Mock 数据');
      useMock = true;
    }
  }

  if (forceBackend) {
    await unregisterMSW();
  }

  if (useMock) {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap();
