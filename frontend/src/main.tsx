import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  const [status, setStatus] = useState('Checking backend…');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/ready', { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Backend or database unavailable');
        await response.json();
        setStatus('Backend and database connected');
      })
      .catch(error => {
        if (error.name !== 'AbortError') setStatus('Backend or database unavailable');
      });
    return () => controller.abort();
  }, []);
  return <main><h1>Lead Management</h1><p>React + FastAPI scaffold</p><p role="status">{status}</p><p>Plaintiff, firm, and admin workflows will be added here.</p></main>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
