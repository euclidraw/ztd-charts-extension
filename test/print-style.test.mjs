import test from 'node:test';
import { assertCanvasProof } from './helpers/canvas-proof.mjs';
import assert from 'node:assert/strict';
import { renderChartSvg } from '../dist/plugin.js';
import { EXAMPLE_CSS, PRINT_PRESETS, parsePrintCss } from '../src/print-style.js';

const render = (props, id = 'test-chart') => renderChartSvg(props, undefined, id).svg;
test('print CSS is a bounded declaration list, never raw CSS or HTML', () => {
  assert.deepEqual(parsePrintCss('--exam-ink: #000000; --exam-ink: #112233').values, { ink: '#112233' });
  assert.ok(parsePrintCss(EXAMPLE_CSS).values);
  for (const invalid of [null, 'a'.repeat(2049), 'body { display:none }', '--exam-fill: url(x)', '--exam-font: serif!important', '--exam-stroke: 5px', '--exam-paper: #ffffff; x: y']) {
    assert.ok(parsePrintCss(invalid).error);
    assert.equal(render({ customCss: invalid }), render({}));
  }
});

test('each reference preset renders deterministic vectors and uses the same SVG in the canvas proof', () => {
  for (const { id, chart } of PRINT_PRESETS) {
    const props = { chartType: chart, stylePreset: id, customCss: '--exam-ink: #234567; --exam-paper: #fdfdfd; --exam-stroke: 1.5px' };
    const svg = render(props);
    assert.equal(svg, render(props));
    assert.match(svg, /#234567/);
    assert.match(svg, /fill="#fdfdfd"/);
    assert.match(svg, /stroke-width="1.5"/);
    assert.doesNotMatch(svg, /NaN|--exam-|var\(--ztd-|<foreignObject|<image|<style/);
    assertCanvasProof(props, 'test-chart', svg);
    if (id === 'periods') assert.match(svg, /<polygon [^>]*points=/);
    if (id === 'bars' || id === 'energy') assert.match(svg, /fill="url\(#ztd-hatch-/);
  }
  const one = render({ chartType: 'bar', stylePreset: 'bars' }, '시험 A').match(/<pattern id="([^"]+)"/)[1];
  const two = render({ chartType: 'bar', stylePreset: 'bars' }, '시험 B').match(/<pattern id="([^"]+)"/)[1];
  assert.notEqual(one, two);
});

test('climate preset only draws points supplied by a real line encoding', () => {
  const props = { chartType: 'bar', stylePreset: 'climate', variant: 'bare', data: [{ month: '1월', a: -4, b: 2 }, { month: '7월', a: 5, b: 1 }] };
  assert.doesNotMatch(render({ ...props, encoding: { x: 'month', y: 'a' } }), /<circle /);
  const withPoints = render({ ...props, encoding: { x: 'month', y: 'a', line: 'b' } });
  assert.equal(withPoints.match(/<circle [^>]*r="3"/g)?.length, 2);
});
