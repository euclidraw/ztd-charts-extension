import { labelInk } from './print-style.js';
import { PRINT_PROFILE } from './print-profile.js';

// Applied to React's SVG nodes before serialization. No parsing of user markup or geometry.
export function createPrintMarks(style, resolved, patternId) {
  const type = resolved.chartType;
  const id = style.preset?.chart === type ? style.preset.id : '';
  const { spec } = resolved;
  const profile = PRINT_PROFILE[type];
  const field = spec.encoding.series ?? spec.encoding.group ?? spec.encoding.label ?? spec.encoding.x;
  const indices = new Map([...new Set(spec.data.map(row => String(row[field])))].map((label, i) => [label, i]));
  const palette = [style.fill, '#dedede', '#616161', '#fafafa', '#bfbfbf', '#363636'];
  const hatch = Boolean(style.preset?.hatch && profile === 'region');
  const patternFill = `url(#${patternId})`;
  const sliceKeys = [];
  const second = [...indices.keys()][1];
  const dash = ['none', '6 3', '2 2', '7 2 2 2'];
  const seriesDash = key => profile === 'trace' && indices.has(key) ? dash[indices.get(key) % dash.length] : 'none';
  function fill(key) {
    const index = indices.get(key) ?? 0;
    if (hatch && index === 1) return patternFill;
    return palette[index % palette.length];
  }
  let horizontalGrid = null;
  function frame(plotHeight) {
    if (!['bar', 'area', 'bubble'].includes(type) || !horizontalGrid) return '';
    const { x1, x2 } = horizontalGrid;
    // The first/last labelled ticks can be inside the scale domain. Use the
    // 0.13 plot margins, not tick extrema, so the frame encloses the data.
    const top = type === 'bar' ? 8 : spec.options.yLabel ? (type === 'area' ? 22 : 20) : 10;
    const height = plotHeight - (type === 'bubble' ? 24 : 22) - top;
    if (height <= 0 || x2 <= x1) return '';
    return `<rect x="${x1}" y="${top}" width="${x2-x1}" height="${height}" fill="none" stroke="${style.ink}" stroke-width="${style.stroke}" pointer-events="none"/>`;
  }
  function decorate(tag, attrs, key, parent) {
    if (tag === 'line' && attrs.shapeRendering === 'crispEdges' && attrs.y1 === attrs.y2 && [attrs.x1, attrs.x2, attrs.y1].every(Number.isFinite)) {
      horizontalGrid ??= { x1: attrs.x1, x2: attrs.x2 };
    }
    if (id === 'climate' && tag === 'path' && attrs.fill === 'none' && attrs.strokeWidth === 2 && key && !parent?.mark) {
      // Suppress only the optional line series connector, never a data point.
      if ([spec.encoding.line].flat().includes(key)) attrs.stroke = 'none';
    }
    if (attrs.fill === 'transparent') attrs.fill = 'none'; // Noninteractive hit boxes have no print ink.
    // Some print engines ignore SVG paint-order and paint the halo over the glyph.
    if (attrs.paintOrder === 'stroke' && attrs.stroke === style.paper) attrs.stroke = 'none';
    const outline = { stroke: style.ink, strokeWidth: style.stroke };
    const mark = attrs.className?.includes('ztd-mark') || parent?.mark;
    const painted = attrs.fill && attrs.fill !== 'none' && !String(attrs.fill).startsWith('url(');
    const pk = parent?.key ?? '';
    // Scale ordinary strokes proportionally (tracks/whiskers retain their relative widths).
    // Flow widths encode data, not pen weight. Never rewrite those or the cell opacity ramp.
    if (profile !== 'flow' && profile !== 'scale' && typeof attrs.strokeWidth === 'number' && attrs.stroke && attrs.stroke !== 'transparent') {
      attrs.strokeWidth *= style.stroke;
    }
    if (profile === 'region' && !['bar','area'].includes(type)) {
      let category;
      if (/^[sal]:/.test(key)) category = key.slice(2).split('/')[0];
      else if (pk.startsWith('t:')) category = pk.slice(2).split('/')[0];
      else if (/^[sr]:/.test(pk)) category = pk.slice(2);
      else if (type === 'marimekko' && pk.includes('|')) category = pk.split('|').at(-1);
      else if (type === 'waffle' && attrs['data-k'] != null) category = resolved.dataTargets[attrs['data-k']]?.key;
      else if (type === 'segmented' && /^l\d+$/.test(pk)) category = resolved.dataTargets[Number(pk.slice(1))]?.key;
      else if (type === 'donut' && /^\d+$/.test(pk)) category = resolved.dataTargets[Number(pk)]?.key;
      if (category !== undefined && painted && ['path','rect','circle'].includes(tag)) {
        Object.assign(attrs, outline, { fill: fill(category) });
      }
      if (type === 'pie' && tag === 'path' && key.startsWith('s:')) sliceKeys.push(key.slice(2));
      if (tag === 'text') {
        // Only labels printed *inside* a mark. Legends and end labels may
        // name the same series but sit on the paper, not on its swatch.
        const markKey = parent?.markKey ?? '';
        let inside;
        if (type === 'pie' && attrs.textAnchor === 'middle' && /^\d+$/.test(key)) inside = sliceKeys[Number(key)];
        if (type === 'treemap' && markKey.startsWith('t:')) inside = markKey.slice(2).split('/')[0];
        if (type === 'marimekko' && markKey.includes('|')) inside = markKey.split('|').at(-1);
        if (type === 'segmented' && markKey.startsWith('s:')) inside = markKey.slice(2);
        if (['stream','sunburst'].includes(type) && attrs.textAnchor === 'middle' && indices.has(key)) inside = key;
        if (inside !== undefined) {
          const bg = fill(inside);
          if (bg === patternFill) attrs['data-on-hatch'] = 'true';
          attrs.fill = labelInk(bg === patternFill ? '#ffffff' : bg, style.ink);
        }
      }
    }
    if (profile === 'trace' && ['path','line'].includes(tag) && attrs.stroke && attrs.stroke !== 'transparent' && attrs.stroke !== 'none' && !attrs.strokeDasharray) {
      const group = /^[sbr]:/.test(pk) ? pk.slice(2) : type === 'parallel' && key.startsWith('p:') ? String(spec.data[Number(key.slice(2))]?.[field]) : null;
      if (group && indices.has(group)) attrs.strokeDasharray = seriesDash(group);
    }
    if (profile === 'point' && tag === 'circle' && painted && (mark || type === 'beeswarm' && /^b\d+$/.test(key))) {
      Object.assign(attrs, outline);
    }
    if (profile === 'measure' && mark && painted && ['rect','path'].includes(tag) && !attrs.stroke) Object.assign(attrs, outline);
    if (tag === 'line' && (attrs.stroke?.includes('--ztd-line,') || attrs.stroke === style.grid)) {
      attrs.stroke = style.grid;
      attrs.strokeWidth = style.stroke;
      attrs.strokeDasharray = style.dash;
    }
    if (type === 'bar' && parent?.mark && tag === 'path' && attrs.fill !== 'none') {
      const parts = parent.key.split('|');
      Object.assign(attrs, outline, { fill: id === 'climate' ? style.fill : fill(spec.encoding.series ? parts.at(-1) : parts[0]) });
    }
    if (id === 'climate' && parent?.mark && tag === 'circle' && attrs.fill !== 'transparent' && attrs.fill !== 'none') {
      Object.assign(attrs, outline, { fill: style.ink });
    }
    if (type === 'area' && parent?.key.startsWith('s:') && tag === 'path') {
      Object.assign(attrs, outline);
      if (attrs.fill !== 'none') attrs.fill = fill(parent.key.slice(2));
    }
    if (type === 'bubble' && tag === 'circle' && attrs.className?.includes('ztd-mark')) {
      Object.assign(attrs, outline, { fill: fill(key.replace(/^b\d+:/, '')), fillOpacity: 1 });
    }
    if (id === 'periods') {
      if (tag === 'line' && parent?.mark) Object.assign(attrs, outline, { strokeOpacity: 1 });
      if (tag === 'circle' && (parent?.mark || parent?.hidden)) {
        // The renderer emits start then end, both in the legend and in every data group.
        const first = parent.circles++ === 0;
        const { cx, cy, r } = attrs;
        delete attrs.cx; delete attrs.cy; delete attrs.r;
        Object.assign(attrs, outline, { fill: first ? style.paper : style.fill });
        if (!first) {
          Object.assign(attrs, { x: cx - r, y: cy - r, width: 2*r, height: 2*r });
          return 'rect';
        }
        attrs.points = `${cx},${cy-r} ${cx-r},${cy+r} ${cx+r},${cy+r}`;
        return 'polygon';
      }
    }
    return tag;
  }
  const pattern = hatch && second !== undefined
    ? `<pattern id="${patternId}" patternUnits="userSpaceOnUse" width="6" height="6"><rect width="6" height="6" fill="${style.paper}"/><path d="M-1 1L1 -1M0 6L6 0M5 7L7 5" fill="none" stroke="${style.ink}" stroke-width="${style.stroke}"/></pattern>` : '';
  return { decorate, frame, pattern, stroke: style.stroke, seriesDash, climate: id === 'climate',
    legendFill: profile === 'region' ? (key => id === 'climate' ? style.fill : indices.has(key) ? fill(key) : null) : null };
}
