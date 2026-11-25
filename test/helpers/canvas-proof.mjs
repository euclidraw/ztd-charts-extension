import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { renderChartDom } from '../../dist/plugin.js';

const { window } = new JSDOM();
const document = window.document;
export function assertCanvasProof(props, id, expectedSvg) {
  const host = document.createElement('div');
  host.style.cssText = 'transform-origin:0 0;transform:scale(2);width:480px;';
  const before = host.style.cssText;
  const clean = renderChartDom(host, props, undefined, id);
  const root = host.firstElementChild;
  assert.equal(root.localName, 'svg');
  assert.equal(root.getAttribute('viewBox'), '0 0 480 340');
  assert.equal(host.style.cssText, before);
  const expected = new window.DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">'+expectedSvg+'</svg>', 'image/svg+xml');
  const summary = node => Array.from(node.querySelectorAll('text,path,rect,circle,line,use'), el => [el.localName, el.getAttribute('d'), el.getAttribute('fill'), el.getAttribute('stroke'), el.getAttribute('href'), el.textContent]);
  assert.deepEqual(summary(root), summary(expected));
  clean();
  assert.equal(host.childElementCount, 0);
}
