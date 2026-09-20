import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    // the shared css/ folder lives one level above react-app/
    fs: { allow: ['..'] }
  }
});
