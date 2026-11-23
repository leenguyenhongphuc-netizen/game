import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], server: { port: 5320, strictPort: true, proxy: { '/api': 'http://localhost:3320' }, fs: { allow: ['..'] } } });
