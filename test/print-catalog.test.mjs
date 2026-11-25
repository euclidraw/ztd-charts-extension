import test from 'node:test';
import { assertCanvasProof } from './helpers/canvas-proof.mjs';
import assert from 'node:assert/strict';
import { CHART_TYPES, renderChartSvg } from '../dist/plugin.js';
import { PRINT_PRESETS } from '../src/print-style.js';
import { PRINT_PROFILE } from '../src/print-profile.js';

const render = props => renderChartSvg(props, undefined, 'proof').svg;

test('every catalog type × reference preset exports a portable monochrome plot and identical canvas proof', () => {
  assert.deepEqual(Object.keys(PRINT_PROFILE).sort(), [...CHART_TYPES].sort());
  for (const chartType of CHART_TYPES) {
    for (const { id: stylePreset } of PRINT_PRESETS) {
      const props = { chartType, stylePreset, theme: 'dark', customCss: '--exam-fill: #aaaaaa; --exam-stroke: 1.5px;', options: { upColor: '#ff0000', downColor: '#00ff00' } };
      const svg = render(props);
      const hint = `${chartType}/${stylePreset}`;
      assert.match(svg, /<svg [^>]+>[\s\S]*?<(?:path|line|polygon|circle|rect)\b/, hint);
      assert.doesNotMatch(svg, /[\x00-\x08\x0b\x0c\x0e-\x1f]|NaN|var\(--|<foreignObject|<canvas|color-mix\(/, hint);
      for (const [, paint] of svg.matchAll(/\b(?:fill|stroke|stop-color)="([^"]+)"/g)) {
        assert.match(paint, /^(?:#(..)\1\1|#000|none|transparent|url\(#[\w-]+\))$/i, `${hint}: ${paint}`);
        if (paint.startsWith('url(')) assert.ok(svg.includes(`id="${paint.slice(5,-1)}"`), hint);
      }
      assertCanvasProof(props, 'proof', svg);
      if (PRINT_PROFILE[chartType] === 'region' && ['bars','energy'].includes(stylePreset)) assert.match(svg, /fill="url\(#ztd-hatch-/, hint);
    }
  }
});

test('line legend repeats the data dash; width and density encodings are not replaced by pen settings', () => {
  const line = render({ chartType: 'line', stylePreset: 'bars' });
  assert.match(line, /<line x1="0" x2="12"[^>]*stroke-dasharray="6 3"/);
  assert.match(line, /<path [^>]*stroke-dasharray="6 3"/);
  for (const chartType of ['flowMap','network','heatmap','choropleth','cohort']) {
    const attrs = css => [...render({chartType, stylePreset: 'bars', customCss: css}).matchAll(/<(?:rect|path)\b[^>]+>/g)].flatMap(([tag]) => [...tag.matchAll(/ (?:stroke-width|fill-opacity|opacity)="[^"]*"/g)].map(m => m[0]));
    assert.deepEqual(attrs('--exam-stroke: 0.5px'), attrs('--exam-stroke: 3px'), chartType);
  }
});
