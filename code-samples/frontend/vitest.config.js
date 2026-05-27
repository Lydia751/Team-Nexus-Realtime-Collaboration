import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/setup.js',
        '**/*.d.ts',
      ],
    },
    include: ['tests/**/*.test.{js,jsx}'],
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});