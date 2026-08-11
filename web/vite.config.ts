import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy keeps the browser on one origin, so no CORS handling in the app.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
