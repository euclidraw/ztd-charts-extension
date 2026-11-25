import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { renderChartSvg } from '../dist/plugin.js';

const plot = props => new JSDOM(`<svg>${renderChartSvg(props).svg}</svg>`).window.document;

test('only the label on a hatched segment gets paper; legend and solid labels stay unboxed', () => {
  const props = {chartType:'segmented', stylePreset:'bars', customCss:'--exam-fill:#202020'};
  const doc = plot(props);
  const inside = [...doc.querySelectorAll('g.ztd-mark > text')];
  assert.ok(inside.length >= 2);
  assert.equal(inside[0].getAttribute('fill'), '#ffffff');
  const papers = doc.querySelectorAll('[data-label-paper]');
  assert.equal(papers.length, 1);
  assert.equal(papers[0].nextElementSibling, inside[1]);
  assert.equal(papers[0].getAttribute('fill'), '#ffffff');
  assert.equal(inside[1].getAttribute('fill'), '#171717');
  for (const stylePreset of ['', 'population']) assert.equal(plot({...props, stylePreset}).querySelector('[data-label-paper]'), null);
});

test('hatching a legend swatch does not box adjacent labels, and dark paper has white text', () => {
  const doc = plot({chartType:'area', stylePreset:'energy', customCss:'--exam-paper:#151515'});
  assert.ok(doc.querySelector('pattern'));
  assert.equal(doc.querySelector('[data-label-paper]'), null);
  assert.equal(doc.querySelector('[data-chart-field=title]').getAttribute('fill'), '#ffffff');
});
