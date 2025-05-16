import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // Optional: Alias for cleaner imports
    },
  },
  server: {
    open: true, // Automatically open the browser
    port: 3000, // Specify the development server port
  },
  build: {
    outDir: 'dist', // Output directory for production build
    rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
        },
      },
  },
  
});