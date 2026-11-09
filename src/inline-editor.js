import { CHART_ASPECT_ID, EXTENSION_ID } from './manifest.js';
import { resolveChartSpec } from './model.js';

const CARD_FIELDS = Object.freeze(['title', 'subtitle', 'takeaway']);

const FIELD_LABELS = Object.freeze({
  title: '차트 제목',
  subtitle: '차트 부제목·단위',
  takeaway: '핵심 요약 (Takeaway)',
});

/**
 * Merges a local draft with concurrent remote updates so changes outside
 * the locally edited span survive remote updates during IME composition.
 */
export function mergeDraft(base, local, remote) {
  if (remote === base || local === remote) return local;
  if (local === base) return remote;
  let a = 0;
  let z = 0;
  while (a < base.length && a < local.length && base[a] === local[a]) a++;
  while (
    z < base.length - a
    && z < local.length - a
    && base[base.length - 1 - z] === local[local.length - 1 - z]
  ) {
    z++;
  }
  let r = 0;
  let t = 0;
  while (r < base.length && r < remote.length && base[r] === remote[r]) r++;
  while (
    t < base.length - r
    && t < remote.length - r
    && base[base.length - 1 - t] === remote[remote.length - 1 - t]
  ) {
    t++;
  }
  const end = base.length - z;
  const remoteEnd = base.length - t;
  const insert = local.slice(a, local.length - z);
  const delta = remote.length - base.length;
  if (remoteEnd <= a) {
    return remote.slice(0, a + delta) + insert + remote.slice(end + delta);
  }
  if (r >= end) {
    return remote.slice(0, a) + insert + remote.slice(end);
  }
  return (
    remote.slice(0, Math.min(a, r))
    + remote.slice(r, remote.length - t)
    + insert
    + remote.slice(Math.max(remoteEnd, end) + delta)
  );
}

/**
 * Parses a displayed numeric label (e.g. "1,240", "42.5%", "+18", "₩3,200") into a finite number.
 */
export function parseDisplayedNumber(text) {
  if (typeof text !== 'string') return null;
  const cleaned = text
    .trim()
    .replace(/[,%\s₩$€¥£원건명개점]/g, '')
    .replace(/^[+]/, '');
  if (!cleaned || !/^-?\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * Matches a clicked text string from inside the chart SVG or legend to data cells in `rows`.
 */
export function matchTextToChartData(rawText, rows, localeTag = 'ko-KR') {
  if (typeof rawText !== 'string') return null;
  const trimmed = rawText.trim();
  if (!trimmed || !Array.isArray(rows) || rows.length === 0) return null;

  // 1. Check exact string cell matches (categories, series names, stages, nodes)
  const stringMatches = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!row || typeof row !== 'object') continue;
    for (const [colKey, val] of Object.entries(row)) {
      if (typeof val === 'string' && val.trim() === trimmed) {
        stringMatches.push({ rowIndex, colKey });
      }
    }
  }
  if (stringMatches.length > 0) {
    const first = stringMatches[0];
    return {
      kind: 'data',
      cellKind: 'string',
      colKey: first.colKey,
      rowIndex: first.rowIndex,
      matches: stringMatches,
      initialValue: String(rows[first.rowIndex][first.colKey] ?? trimmed),
      label: `데이터 라벨 (${first.colKey})`,
    };
  }

  // 2. Check numeric cell matches (bar/line/pie values, KPI numbers)
  const parsedNum = parseDisplayedNumber(trimmed);
  if (parsedNum !== null) {
    const numMatches = [];
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!row || typeof row !== 'object') continue;
      for (const [colKey, val] of Object.entries(row)) {
        if (typeof val !== 'number' || !Number.isFinite(val)) continue;
        const formatted = val.toLocaleString(localeTag);
        if (
          val === parsedNum
          || Math.abs(val - parsedNum) < 1e-6
          || Number(val.toFixed(1)) === parsedNum
          || formatted === trimmed
        ) {
          numMatches.push({ rowIndex, colKey });
        }
      }
    }
    if (numMatches.length > 0) {
      const first = numMatches[0];
      return {
        kind: 'data',
        cellKind: 'number',
        colKey: first.colKey,
        rowIndex: first.rowIndex,
        matches: [first],
        initialValue: String(rows[first.rowIndex][first.colKey]),
        label: `데이터 값 (${first.colKey})`,
      };
    }
  }

  return null;
}

function readTargetValue(props, target) {
  if (!props || !target) return '';
  const resolved = resolveChartSpec(props);
  if (target.kind === 'field') {
    const field = target.field;
    const raw = props[field];
    if (typeof raw === 'string' && raw.length > 0) return raw;
    return String(resolved[field] ?? '');
  }
  if (target.kind === 'data') {
    const rows = resolved.spec.data ?? [];
    const row = rows[target.rowIndex];
    if (!row || typeof row !== 'object') return target.initialValue ?? '';
    const val = row[target.colKey];
    return val !== undefined && val !== null ? String(val) : '';
  }
  return '';
}

function buildPatchForTarget(props, target, rawValue) {
  if (!props || !target) return null;
  const resolved = resolveChartSpec(props);

  if (target.kind === 'field') {
    const currentVal = readTargetValue(props, target);
    if (rawValue === currentVal && props[target.field] === rawValue) return null;
    return { [target.field]: rawValue };
  }

  if (target.kind === 'data') {
    const sourceRows = resolved.spec.data ?? [];
    if (sourceRows.length === 0) return null;
    const nextRows = sourceRows.map(row => ({ ...row }));
    let changed = false;

    if (target.cellKind === 'number') {
      const num = parseDisplayedNumber(rawValue);
      if (num === null) return null;
      for (const m of target.matches) {
        if (nextRows[m.rowIndex] && nextRows[m.rowIndex][m.colKey] !== num) {
          nextRows[m.rowIndex][m.colKey] = num;
          changed = true;
        }
      }
    } else {
      const nextText = rawValue;
      if (!nextText.trim()) return null;
      for (const m of target.matches) {
        if (nextRows[m.rowIndex] && nextRows[m.rowIndex][m.colKey] !== nextText) {
          nextRows[m.rowIndex][m.colKey] = nextText;
          changed = true;
        }
      }
    }

    if (!changed) return null;
    return {
      data: nextRows,
      encoding: { ...(resolved.spec.encoding ?? {}) },
    };
  }

  return null;
}

function findIslandElement(surfaceEl, entityId) {
  if (!surfaceEl || typeof surfaceEl.querySelector !== 'function') return null;
  return surfaceEl.querySelector(`[data-entity-id="${entityId}"]`);
}

function findFieldElementInIsland(islandEl, field) {
  if (!islandEl || typeof islandEl.querySelector !== 'function') return null;
  const tagged = islandEl.querySelector(`[data-chart-field="${field}"]`);
  if (tagged) return tagged;
  if (field === 'title') {
    return islandEl.querySelector('.ztd-card > header h1, .ztd-card > header h2, .ztd-card > header h3');
  }
  if (field === 'subtitle') {
    const rows = islandEl.querySelectorAll('.ztd-card > header > div');
    return rows?.[1]?.querySelector?.('span:first-child') ?? null;
  }
  if (field === 'takeaway') {
    return islandEl.querySelector('.ztd-card > footer > span:first-child');
  }
  return null;
}

function resolveHitTargetInIsland(islandEl, clientX, clientY, eventTarget, props, bounds, worldPoint) {
  const resolved = resolveChartSpec(props);
  const rows = resolved.spec.data ?? [];
  const doc = islandEl?.ownerDocument;

  const candidates = [];
  if (eventTarget && islandEl?.contains?.(eventTarget)) {
    candidates.push(eventTarget);
  }
  if (doc && typeof doc.elementsFromPoint === 'function' && Number.isFinite(clientX) && Number.isFinite(clientY)) {
    for (const el of doc.elementsFromPoint(clientX, clientY)) {
      if (islandEl?.contains?.(el) && !candidates.includes(el)) {
        candidates.push(el);
      }
    }
  } else if (doc && typeof doc.elementFromPoint === 'function' && Number.isFinite(clientX) && Number.isFinite(clientY)) {
    const el = doc.elementFromPoint(clientX, clientY);
    if (el && islandEl?.contains?.(el) && !candidates.includes(el)) {
      candidates.push(el);
    }
  }

  // Fallback scan by bounding rect when pointer capture retargets the event to the surface
  if (candidates.length === 0 && islandEl && typeof islandEl.querySelectorAll === 'function' && Number.isFinite(clientX) && Number.isFinite(clientY)) {
    const nodes = islandEl.querySelectorAll('[data-chart-field], svg text, .ztd-card > header h2, .ztd-card > header span, .ztd-card > footer span');
    for (const node of nodes) {
      const rect = node.getBoundingClientRect?.();
      if (rect && rect.width > 0 && rect.height > 0 && clientX >= rect.left - 4 && clientX <= rect.right + 4 && clientY >= rect.top - 4 && clientY <= rect.bottom + 4) {
        candidates.push(node);
      }
    }
  }

  for (const el of candidates) {
    const fieldEl = el.closest?.('[data-chart-field]');
    if (fieldEl) {
      const field = fieldEl.getAttribute('data-chart-field');
      if (CARD_FIELDS.includes(field)) {
        return { kind: 'field', field, label: FIELD_LABELS[field] };
      }
    }

    const svgTextEl = el.closest?.('svg text') ?? (el.tagName?.toLowerCase?.() === 'tspan' ? el.parentElement : null);
    if (svgTextEl) {
      const rawText = svgTextEl.textContent?.trim() ?? '';
      const matched = matchTextToChartData(rawText, rows, resolved.localeTag);
      if (matched) {
        const rect = svgTextEl.getBoundingClientRect?.();
        return {
          ...matched,
          anchorText: rawText,
          lastRect: rect && rect.width > 0 ? rect : null,
        };
      }
    }

    const headerTitle = el.closest?.('.ztd-card > header h1, .ztd-card > header h2, .ztd-card > header h3');
    if (headerTitle) {
      return { kind: 'field', field: 'title', label: FIELD_LABELS.title };
    }

    const footerSpan = el.closest?.('.ztd-card > footer');
    if (footerSpan) {
      return { kind: 'field', field: 'takeaway', label: FIELD_LABELS.takeaway };
    }

    const spanEl = el.closest?.('span');
    if (spanEl && islandEl?.contains?.(spanEl)) {
      const spanText = spanEl.textContent?.trim() ?? '';
      if (spanText && spanText === resolved.subtitle) {
        return { kind: 'field', field: 'subtitle', label: FIELD_LABELS.subtitle };
      }
      const matchedLegend = matchTextToChartData(spanText, rows, resolved.localeTag);
      if (matchedLegend) {
        const rect = spanEl.getBoundingClientRect?.();
        return {
          ...matchedLegend,
          anchorText: spanText,
          lastRect: rect && rect.width > 0 ? rect : null,
        };
      }
    }
  }

  // Fallback by local Y coordinate within the card bounds
  if (bounds && worldPoint && resolved.variant === 'card') {
    const localY = worldPoint.y - bounds.y;
    if (localY >= 42 && localY < 68) {
      return { kind: 'field', field: 'subtitle', label: FIELD_LABELS.subtitle };
    }
    if (localY > bounds.height - 48) {
      return { kind: 'field', field: 'takeaway', label: FIELD_LABELS.takeaway };
    }
  }

  return { kind: 'field', field: 'title', label: FIELD_LABELS.title };
}

/**
 * Mounts an IME-safe inline text editor onto the active Alid canvas HUD for
 * double-click and `Enter` editing of chart titles, subtitles, takeaways, and SVG data labels.
 */
export function mountInlineEditor(context) {
  const provider = context?.services?.get?.('canvas.active-tool-surface');
  const frames = context?.services?.get?.('canvas.frames');
  const textHistory = context?.services?.get?.('canvas.text-history');

  let closeCurrent = () => {};
  let openCurrent = () => false;
  let detachCurrent = () => {};

  function mount() {
    closeCurrent();
    detachCurrent();

    const s = provider?.get?.();
    if (!s?.surface?.hud || !s?.surface?.element || typeof document === 'undefined') {
      return;
    }

    let session = null;
    let composing = false;
    let until = 0;
    let offWorld = () => {};

    const doc = s.surface.hud.ownerDocument ?? document;
    const container = doc.createElement('div');
    container.dataset.canvasUi = 'true';
    container.dataset.ztdChartEditorContainer = 'true';
    Object.assign(container.style, {
      position: 'absolute',
      display: 'none',
      pointerEvents: 'auto',
      zIndex: '25',
      boxSizing: 'border-box',
    });

    const badge = doc.createElement('div');
    Object.assign(badge.style, {
      position: 'absolute',
      left: '0',
      top: '-20px',
      padding: '1px 6px',
      borderRadius: '4px',
      background: '#3182f6',
      color: '#ffffff',
      fontSize: '10px',
      fontWeight: '600',
      lineHeight: '15px',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
    });

    const input = doc.createElement('input');
    input.type = 'text';
    input.dataset.canvasEditor = 'true';
    input.dataset.ztdChartEditor = 'true';
    input.dataset.escapeOwner = 'true';
    input.spellcheck = false;
    input.setAttribute('aria-label', '차트 텍스트 편집');
    Object.assign(input.style, {
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      margin: '0',
      padding: '2px 8px',
      border: '2px solid #3182f6',
      borderRadius: '6px',
      outline: 'none',
      background: 'rgba(255, 255, 255, 0.96)',
      color: '#191f28',
      fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      fontSize: '14px',
      fontWeight: '700',
      lineHeight: '1.3',
      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.14)',
    });

    container.append(badge, input);
    s.surface.hud.append(container);

    let hiddenElements = [];
    function restoreHiddenElements() {
      for (const el of hiddenElements) {
        if (el && el.style) el.style.visibility = '';
      }
      hiddenElements = [];
    }

    function positionEditor() {
      if (!session) return;
      const props = context.world.getCanonical?.(session.id, CHART_ASPECT_ID);
      if (!props) return;
      const resolved = resolveChartSpec(props);
      const isDark = resolved.themeName === 'dark';

      input.style.background = isDark ? 'rgba(23, 27, 34, 0.96)' : 'rgba(255, 255, 255, 0.97)';
      input.style.color = isDark ? '#f3f5f8' : '#191f28';
      input.style.borderColor = resolved.accentColor || '#3182f6';
      badge.style.background = resolved.accentColor || '#3182f6';

      const hudRect = s.surface.hud.getBoundingClientRect?.() ?? { left: 0, top: 0, width: 0, height: 0 };
      const zoom = Math.max(0.1, s.host?.getZoom?.() ?? 1);
      const islandEl = findIslandElement(s.surface.element, session.id);

      restoreHiddenElements();

      if (session.target.kind === 'field') {
        const field = session.target.field;
        const fieldEl = findFieldElementInIsland(islandEl, field);
        const fieldRect = fieldEl?.getBoundingClientRect?.();
        const islandRect = islandEl?.getBoundingClientRect?.();

        const fontSizePx = (field === 'title' ? 18 : field === 'takeaway' ? 14 : 12.5) * zoom;
        input.style.fontSize = `${Math.max(11, Math.round(fontSizePx))}px`;
        input.style.fontWeight = field === 'subtitle' ? '500' : '700';
        input.style.textAlign = 'left';

        if (fieldRect && fieldRect.width > 0 && fieldRect.height > 0) {
          fieldEl.style.visibility = 'hidden';
          hiddenElements.push(fieldEl);
          const availWidth = islandRect && islandRect.width > 0
            ? Math.max(fieldRect.width + 20, islandRect.width - 36 * zoom)
            : Math.max(160, fieldRect.width + 40);
          container.style.left = `${fieldRect.left - hudRect.left - 4}px`;
          container.style.top = `${fieldRect.top - hudRect.top - 3}px`;
          container.style.width = `${Math.max(120, availWidth)}px`;
          container.style.height = `${Math.max(26, fieldRect.height + 8)}px`;
          container.style.transform = 'none';
          return;
        }
      } else if (session.target.kind === 'data') {
        input.style.fontSize = `${Math.max(11, Math.round(12.5 * zoom))}px`;
        input.style.fontWeight = '600';
        input.style.textAlign = 'center';

        let matchedSvgText = null;
        if (islandEl && typeof islandEl.querySelectorAll === 'function') {
          for (const node of islandEl.querySelectorAll('svg text')) {
            if (node.textContent?.trim() === session.target.anchorText) {
              matchedSvgText = node;
              break;
            }
          }
        }
        const rect = matchedSvgText?.getBoundingClientRect?.() ?? session.target.lastRect;
        if (rect && rect.width > 0 && rect.height > 0) {
          if (matchedSvgText) {
            matchedSvgText.style.visibility = 'hidden';
            hiddenElements.push(matchedSvgText);
          }
          const boxWidth = Math.max(84 * zoom, rect.width + 28 * zoom);
          const boxHeight = Math.max(26, rect.height + 10);
          container.style.left = `${rect.left + rect.width / 2 - hudRect.left}px`;
          container.style.top = `${rect.top - hudRect.top - 4}px`;
          container.style.width = `${boxWidth}px`;
          container.style.height = `${boxHeight}px`;
          container.style.transform = 'translateX(-50%)';
          return;
        }
      }

      // World-coordinate fallback (bare mode, empty subtitle/takeaway, or headless test env)
      const b = context.world.getComputed?.(session.id, 'computed.layoutBounds') ?? {
        x: 0,
        y: 0,
        width: 480,
        height: 340,
        rotation: 0,
      };
      const field = session.target.kind === 'field' ? session.target.field : 'title';
      const localY = field === 'title' ? 26 : field === 'subtitle' ? 54 : b.height - 28;
      const angle = b.rotation ?? 0;
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      const dy = localY - b.height / 2;
      const screenPt = { x: 0, y: 0 };
      s.host?.worldToScreen?.(cx - dy * Math.sin(angle), cy + dy * Math.cos(angle), screenPt);

      container.style.width = `${Math.max(140, (b.width - 40) * zoom)}px`;
      container.style.height = `${Math.max(28, 28 * zoom)}px`;
      container.style.left = `${screenPt.x - hudRect.left}px`;
      container.style.top = `${screenPt.y - hudRect.top}px`;
      container.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
    }

    function save() {
      if (!session || composing) return;
      const current = context.world.getCanonical?.(session.id, CHART_ASPECT_ID);
      if (!current) {
        finish(false);
        return;
      }
      const remoteValue = readTargetValue(current, session.target);
      const merged = mergeDraft(session.base, input.value, remoteValue);
      const patch = buildPatchForTarget(current, session.target, merged);
      if (patch) {
        textHistory?.change?.();
        context.world.applyCanonicalTransaction(`${EXTENSION_ID}:edit-chart`, [
          {
            id: session.id,
            aspect: CHART_ASPECT_ID,
            patch,
          },
        ]);
        if (session.target.kind === 'data') {
          session.target.anchorText = merged.trim();
        }
      }
      session.base = merged;
      if (input.value !== merged) {
        input.value = merged;
      }
    }

    function finish(commit = true) {
      if (!session || composing) return;
      if (commit) save();
      session = null;
      until = 0;
      restoreHiddenElements();
      container.style.display = 'none';
      delete input.dataset.editing;
      s.host?.requestRender?.();
      textHistory?.seal?.();
    }

    closeCurrent = () => {
      composing = false;
      finish(true);
      offWorld();
    };

    openCurrent = (id, targetOrField = 'title') => {
      const props = context.world.getCanonical?.(id, CHART_ASPECT_ID);
      if (!props || context.world.isEntityReadOnly?.(id)) return false;

      finish(true);

      const target = typeof targetOrField === 'string'
        ? {
            kind: 'field',
            field: CARD_FIELDS.includes(targetOrField) ? targetOrField : 'title',
            label: FIELD_LABELS[targetOrField] ?? FIELD_LABELS.title,
          }
        : targetOrField;

      const initial = readTargetValue(props, target);
      session = {
        id,
        target,
        base: initial,
      };

      const hint = target.kind === 'field' ? ' · Tab으로 다음 항목' : ' · Enter로 적용';
      badge.textContent = `${target.label || '텍스트 편집'}${hint}`;
      input.setAttribute('aria-label', target.label || '차트 텍스트 편집');
      input.dataset.editing = 'true';
      input.value = initial;
      container.style.display = 'block';
      positionEditor();
      s.host?.requestRender?.();
      input.focus();
      input.select?.();
      return true;
    };

    const locked = e =>
      composing
      || e.isComposing
      || e.keyCode === 229
      || e.key === 'Process'
      || Date.now() < until;

    input.addEventListener('compositionstart', () => {
      composing = true;
    });
    input.addEventListener('compositionend', () => {
      composing = false;
      until = Date.now() + 16;
      save();
    });
    input.addEventListener('input', () => {
      save();
    });
    input.addEventListener('blur', () => {
      if (!composing) finish(true);
    });
    input.addEventListener('keydown', e => {
      if (locked(e)) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (session) {
          input.value = session.base;
        }
        finish(false);
        s.surface.element.focus?.();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        finish(true);
        s.surface.element.focus?.();
      } else if (e.key === 'Tab' && session) {
        e.preventDefault();
        e.stopPropagation();
        const { id, target } = session;
        finish(true);
        if (target.kind === 'field') {
          const idx = CARD_FIELDS.indexOf(target.field);
          const nextField = CARD_FIELDS[(idx + (e.shiftKey ? CARD_FIELDS.length - 1 : 1)) % CARD_FIELDS.length];
          openCurrent(id, nextField);
        } else {
          openCurrent(id, 'title');
        }
      }
    });

    const onDoubleClick = e => {
      if (
        composing
        || e.defaultPrevented
        || e.target?.closest?.('input,textarea,button,select,[contenteditable],[data-canvas-editor]')
      ) {
        return;
      }

      const worldPoint = { x: 0, y: 0 };
      s.host?.screenToWorld?.(e.clientX, e.clientY, worldPoint);

      let targetEntityId = null;
      const selected = s.selection?.getSelection?.() ?? [];
      if (selected.length === 1 && context.world.getCanonical?.(selected[0], CHART_ASPECT_ID)) {
        const b = context.world.getComputed?.(selected[0], 'computed.layoutBounds');
        if (!b || (worldPoint.x >= b.x && worldPoint.x <= b.x + b.width && worldPoint.y >= b.y && worldPoint.y <= b.y + b.height)) {
          targetEntityId = selected[0];
        }
      }

      if (!targetEntityId) {
        const fromDom = e.target?.closest?.('[data-entity-id]')?.getAttribute?.('data-entity-id');
        if (fromDom && context.world.getCanonical?.(fromDom, CHART_ASPECT_ID)) {
          targetEntityId = fromDom;
        }
      }

      if (!targetEntityId) {
        for (const candidateId of context.world.listEntityIds?.() ?? []) {
          if (!context.world.getCanonical?.(candidateId, CHART_ASPECT_ID)) continue;
          const b = context.world.getComputed?.(candidateId, 'computed.layoutBounds');
          if (b && worldPoint.x >= b.x && worldPoint.x <= b.x + b.width && worldPoint.y >= b.y && worldPoint.y <= b.y + b.height) {
            targetEntityId = candidateId;
            break;
          }
        }
      }

      if (!targetEntityId) return;

      const props = context.world.getCanonical(targetEntityId, CHART_ASPECT_ID);
      if (!props) return;
      const bounds = context.world.getComputed?.(targetEntityId, 'computed.layoutBounds');
      const islandEl = findIslandElement(s.surface.element, targetEntityId);
      const hitTarget = resolveHitTargetInIsland(
        islandEl,
        e.clientX,
        e.clientY,
        e.target,
        props,
        bounds,
        worldPoint,
      );

      if (openCurrent(targetEntityId, hitTarget)) {
        e.preventDefault();
      }
    };

    s.surface.element.addEventListener('dblclick', onDoubleClick);

    offWorld = context.world.subscribe?.(() => {
      if (!session || composing) return;
      const current = context.world.getCanonical?.(session.id, CHART_ASPECT_ID);
      if (!current) {
        session = null;
        restoreHiddenElements();
        container.style.display = 'none';
        return;
      }
      const remoteValue = readTargetValue(current, session.target);
      const merged = mergeDraft(session.base, input.value, remoteValue);
      session.base = remoteValue;
      if (input.value !== merged) {
        input.value = merged;
      }
    }) ?? (() => {});

    const offFrame = frames?.subscribe?.(() => {
      if (session) positionEditor();
    }) ?? (() => {});

    detachCurrent = () => {
      offWorld();
      offFrame();
      restoreHiddenElements();
      s.surface.element.removeEventListener('dblclick', onDoubleClick);
      container.remove();
    };
  }

  mount();
  const offSurface = provider?.subscribe?.(mount);

  return {
    open(id, targetOrField = 'title') {
      return openCurrent(id, targetOrField);
    },
    close() {
      closeCurrent();
    },
    dispose() {
      offSurface?.();
      closeCurrent();
      detachCurrent();
    },
  };
}
