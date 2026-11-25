// Editor-only handles live on the unscaled HUD, not in chart markup or exports.
export function legendGizmos(selector) {
  const handles = new Map();
  const targets = new WeakMap();
  function clear() {
    for (const {node,band} of handles.values()) { node.remove(); band.remove(); }
    handles.clear();
  }
  function paint(active, world) {
    const { element, hud } = active?.surface ?? {};
    const selected = active?.selection?.getSelection?.() ?? [];
    if (!hud || !selected.length || active.host?.isSelectionEnabled?.() === false) { clear(); return; }
    const seen = new Set();
    const bounds = hud.getBoundingClientRect();
    const ids = new Set(selected);
    for (const host of element.querySelectorAll('[data-chart-type][data-entity-id]')) {
      const id = host.dataset.entityId;
      if (!ids.has(id) || world.isEntityReadOnly?.(id)) continue;
      for (const legend of host.querySelectorAll(selector)) {
        const box = legend.querySelector('[data-chart-legend-frame]') ?? legend;
        const r = box.getBoundingClientRect();
        if (!r.width || !r.height || r.right <= bounds.left || r.left >= bounds.right || r.bottom <= bounds.top || r.top >= bounds.bottom) continue;
        const key = JSON.stringify([id, legend.dataset.legendKind ?? 'card']);
        seen.add(key);
        let {node,band} = handles.get(key) ?? {};
        if (!node) {
          node = hud.ownerDocument.createElement('span');
          node.dataset.ztdLegendGizmo = 'move'; node.dataset.canvasUi = 'true';
          node.title = '드래그하여 범례 이동';
          node.innerHTML = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1v14M1 8h14M5.5 3.5 8 1l2.5 2.5M5.5 12.5 8 15l2.5-2.5M3.5 5.5 1 8l2.5 2.5M12.5 5.5 15 8l-2.5 2.5"/></svg>';
          node.style.cssText = 'position:absolute;box-sizing:border-box;width:20px;height:20px;display:grid;place-items:center;border-radius:4px;border:1px solid white;background:var(--alid-accent,#2563eb);color:white;font:16px/1 system-ui;pointer-events:auto;touch-action:none;user-select:none;cursor:grab;';
          band = hud.ownerDocument.createElement('span');
          band.dataset.ztdLegendRubberBand = 'true';
          band.setAttribute('aria-hidden','true');
          Object.assign(band.style, { position:'absolute', left:'0', top:'0', boxSizing:'border-box', border:'1px dashed currentColor', color:'var(--alid-accent,#2563eb)', pointerEvents:'none', transformOrigin:'center' });
          handles.set(key,{node,band}); hud.append(band,node);
        }
        targets.set(node,legend);
        // getBoundingClientRect gives the centre, but its axis-aligned width
        // grows on rotation. Recover the actual screen-space edge lengths.
        const matrix = box.getScreenCTM?.();
        const zoom = active.host?.getZoom?.() ?? 1;
        const angle = matrix ? Math.atan2(matrix.b,matrix.a) : world.getCanonical?.(id,'core.transform')?.rotation ?? 0;
        const local = box.getBBox?.();
        const w = (matrix && local ? local.width * Math.hypot(matrix.a,matrix.b) : box.offsetWidth * zoom) || r.width;
        const h = (matrix && local ? local.height * Math.hypot(matrix.c,matrix.d) : box.offsetHeight * zoom) || r.height;
        const cx = r.left + r.width/2 - bounds.left, cy = r.top + r.height/2 - bounds.top;
        // Two pixels of separation keep the permanent frame visible beneath the band.
        band.style.width = (w+4)+'px'; band.style.height = (h+4)+'px';
        band.style.transform = `translate(${cx-w/2-2}px,${cy-h/2-2}px) rotate(${angle}rad)`;
        const right = cx + (Math.cos(angle)*w + Math.sin(angle)*h)/2;
        const top = cy + (Math.sin(angle)*w - Math.cos(angle)*h)/2;
        const transform = `translate(${Math.max(0, Math.min(bounds.width-20,right-10))}px,${Math.max(0, Math.min(bounds.height-20,top-10))}px)`;
        node.style.left = '0'; node.style.top = '0';
        if (node.style.transform !== transform) node.style.transform = transform;
      }
    }
    for (const [key,{node,band}] of handles) if (!seen.has(key)) { node.remove(); band.remove(); handles.delete(key); }
  }
  return { paint, clear, target: el => targets.get(el) };
}
