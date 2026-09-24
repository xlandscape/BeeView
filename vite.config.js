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
      output: {
        // Split the big, rarely-changing vendor code into its own long-cached chunks.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('maplibre-gl')) return 'maplibre-gl';
          if (/[\/](@deck.gl|@luma.gl|@loaders.gl|@math.gl|@probe.gl)[\/]/.test(id)) return 'deckgl';
          if (/[\/](react|react-dom|react-redux|@reduxjs|redux|immer|scheduler)[\/]/.test(id)) return 'react';
          if (/[\/]d3-[^\/]+[\/]/.test(id)) return 'd3';
          return undefined;
        },
      },
    },
    target: 'esnext', // Use modern JavaScript features
  },
}));