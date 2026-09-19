import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Health & Safety Vite configuration
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react-is', 'recharts', 'jspdf', 'html2canvas'],
  },
  server: {
    port: 5173,
    host: true
  }
});
