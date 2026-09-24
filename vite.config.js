import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Keep console output in dev, strip it from production bundles.
  esbuild: command === 'build' ? { drop: ['console', 'debugger'] } : {},
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // Optional: Alias for cleaner imports
    },
  },
  server: {
    open: true, // Automatically open the browser
    port: 3000, // Specify the development server port
    allowedHosts: ['.'], // Allow all hosts
  },
  build: {
    outDir: 'dist', // Output directory for production build
    rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
        },
      },
    target: 'esnext', // Use modern JavaScript features
  },
}));