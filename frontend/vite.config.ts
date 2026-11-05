import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Keep browser requests on one origin; Vite forwards /api to the local backend.
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
});
