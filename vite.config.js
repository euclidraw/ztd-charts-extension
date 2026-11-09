import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * Bare module specifiers provided by the Alid host runtime via `<script type="importmap">`.
 * Everything else (including `ztd-charts` and `ztd-charts/spec`) is bundled into `dist/plugin.js`.
 */
export const sharedImports = [
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-dom',
  'react-dom/client',
  '@alid/react',
  '@alid/kernel',
];

export const SHARED_IMPORTS = sharedImports;

function isSharedImport(id) {
  return sharedImports.includes(id);
}

/**
 * Patches `ztd-charts` DOM measurement helpers so that charts mounted inside
 * Alid's CSS-scaled (`transform: scale(camera.zoom)`) DOM islands measure
 * layout width in local island coordinates rather than screen-scaled rect width,
 * and never cache stale bounding rects across canvas wheel pan/zoom gestures.
 */
export function ztdChartsCanvasZoomPatch() {
  return {
    name: 'ztd-charts-canvas-zoom-patch',
    transform(code, id) {
      if (!id.includes('ztd-charts')) return null;
      let next = code.replace(/^"use client";\s*/m, '');
      // 1. Responsive container width: prefer unscaled layout width (clientWidth) over screen-transformed getBoundingClientRect().width
      next = next.replace(
        'const r = el.getBoundingClientRect().width;',
        'const r = el.clientWidth || el.getBoundingClientRect().width;',
      );
      // 2. Tooltip offset scale: avoid multiplying tooltip position by camera.zoom a second time
      next = next.replace(
        'const scale = c && c.width > 0 ? c.node.getBoundingClientRect().width / c.width || 1 : 1;',
        'const scale = c && c.width > 0 ? (c.node.clientWidth || c.width) / c.width || 1 : 1;',
      );
      // 3. Pointer-to-SVG viewBox conversion: always read live rect in case canvas panned/zoomed while hovering
      next = next.replace(
        'const r = svgRect.current ?? (svgRect.current = e.currentTarget.getBoundingClientRect());',
        'const r = e.currentTarget.getBoundingClientRect();',
      );
      return next === code ? null : { code: next, map: null };
    },
  };
}

export default defineConfig({
  plugins: [ztdChartsCanvasZoomPatch()],
  build: {
    target: 'es2022',
    sourcemap: false,
    minify: false,
    emptyOutDir: true,
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.js'),
      formats: ['es'],
      fileName: () => 'plugin.js',
    },
    rollupOptions: {
      external: isSharedImport,
      output: {
        codeSplitting: false,
      },
    },
  },
});
