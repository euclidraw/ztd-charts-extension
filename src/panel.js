import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CHART_ASPECT_ID, EXTENSION_ID, STUDIO_PANEL_ID } from './manifest.js';
import {
  CHART_FAMILIES,
  HIGHLIGHT_PRESETS,
  formatRowsAsCsv,
  getChartCatalog,
  isValidHexColor,
  parseDataInput,
  resolveChartSpec,
  suggestChartsForRows,
} from './model.js';

export const COLOR_INSPECTOR_PANEL_ID = `${EXTENSION_ID}.color-inspector`;

const ACCENT_PRESETS = Object.freeze([
  '#3182f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
]);

const BG_PRESETS = Object.freeze([
  { label: '화이트', value: '#ffffff' },
  { label: '슬레이트', value: '#f8fafc' },
  { label: '웜아이보리', value: '#fffbeb' },
  { label: '민트틴트', value: '#f0fdf4' },
  { label: '블루틴트', value: '#eff6ff' },
  { label: '다크네이비', value: '#0f172a' },
  { label: '차콜블랙', value: '#18181b' },
  { label: '딥인디고', value: '#1e1b4b' },
]);

const COMPONENT_PALETTE = Object.freeze([
  '#3182f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
]);

function ensureHexForPicker(color, fallback = '#3182f6') {
  return isValidHexColor(color) ? color.trim() : fallback;
}

function readSelectedChartEntity(world, selectedIds) {
  if (!world || !Array.isArray(selectedIds)) return null;
  for (const id of selectedIds) {
    const props = world.getCanonical?.(id, CHART_ASPECT_ID);
    if (props) return { id, props };
  }
  return null;
}

export function ChartColorAndHighlightControls({ selected, resolved, context }) {
  if (!selected || !resolved) return null;

  const dispatchStyleUpdate = patchArgs => {
    const payload = { entityId: selected.id, ...patchArgs };
    if (typeof context?.executeCommand === 'function') {
      void context.executeCommand(`${EXTENSION_ID}:update-style`, payload);
    }
  };

  const rawHighlight = resolved.highlight;
  const presetIds = HIGHLIGHT_PRESETS.map(p => p.id);
  const activePreset =
    rawHighlight === undefined || rawHighlight === null || rawHighlight === 'auto'
      ? 'auto'
      : typeof rawHighlight === 'string' && presetIds.includes(rawHighlight)
        ? rawHighlight
        : 'custom';

  const customHighlightSet = new Set(
    Array.isArray(rawHighlight)
      ? rawHighlight.map(String)
      : activePreset === 'custom' && rawHighlight !== undefined && rawHighlight !== null
        ? [String(rawHighlight)]
        : [],
  );

  const dataItems = resolved.dataTargets?.items ?? [];
  const itemColors = resolved.itemColors ?? {};
  const hasCustomItemColors = Object.keys(itemColors).length > 0;

  const handleToggleHighlightItem = itemKey => {
    const next = new Set(customHighlightSet);
    if (next.has(itemKey)) {
      next.delete(itemKey);
    } else {
      next.add(itemKey);
    }
    const list = [...next];
    dispatchStyleUpdate({
      highlight: list.length === 0 ? 'none' : list.length === 1 ? list[0] : list,
    });
  };

  const handleAssignPalette = () => {
    if (dataItems.length === 0) return;
    const nextMap = {};
    dataItems.forEach((item, idx) => {
      nextMap[item.key] = COMPONENT_PALETTE[idx % COMPONENT_PALETTE.length];
    });
    dispatchStyleUpdate({ itemColors: nextMap, replaceItemColors: true });
  };

  return React.createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '10px',
        borderRadius: '8px',
        border: '1px solid var(--alid-border-subtle, #e4e4e7)',
        background: 'var(--alid-bg-surface, #ffffff)',
      },
    },
    // Section 1: Background Color
    React.createElement(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement(
          'span',
          { style: { fontWeight: 600, fontSize: '11.5px' } },
          '배경 색상 (Background)',
        ),
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
          React.createElement('input', {
            type: 'color',
            ariaLabel: '배경 색상 선택',
            value: ensureHexForPicker(resolved.backgroundColor, resolved.resolvedTheme?.panel || '#ffffff'),
            onChange: e => dispatchStyleUpdate({ backgroundColor: e.target.value }),
            style: {
              width: '24px',
              height: '22px',
              padding: 0,
              border: '1px solid var(--alid-border-subtle, #d4d4d8)',
              borderRadius: '4px',
              background: 'transparent',
              cursor: 'pointer',
            },
          }),
          resolved.backgroundColor &&
            React.createElement(
              'button',
              {
                type: 'button',
                onClick: () => dispatchStyleUpdate({ backgroundColor: '' }),
                style: {
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid var(--alid-border-subtle, #d4d4d8)',
                  background: 'transparent',
                  color: 'inherit',
                  fontSize: '10px',
                  cursor: 'pointer',
                },
              },
              '기본값',
            ),
        ),
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } },
        ...BG_PRESETS.map(preset =>
          React.createElement('button', {
            key: preset.value,
            type: 'button',
            title: `${preset.label} (${preset.value})`,
            onClick: () => dispatchStyleUpdate({ backgroundColor: preset.value }),
            style: {
              width: '20px',
              height: '20px',
              borderRadius: '5px',
              border:
                resolved.backgroundColor?.toLowerCase() === preset.value.toLowerCase()
                  ? '2px solid #3182f6'
                  : '1px solid var(--alid-border-subtle, #d4d4d8)',
              background: preset.value,
              cursor: 'pointer',
              padding: 0,
            },
          }),
        ),
      ),
    ),

    // Section 2: Accent & Neutral Colors
    React.createElement(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          paddingTop: '8px',
          borderTop: '1px solid var(--alid-border-subtle, #e4e4e7)',
        },
      },
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } },
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
          React.createElement('input', {
            type: 'color',
            ariaLabel: '강조 색상 선택',
            value: ensureHexForPicker(resolved.accentColor, '#3182f6'),
            onChange: e => dispatchStyleUpdate({ accentColor: e.target.value }),
            style: {
              width: '22px',
              height: '20px',
              padding: 0,
              border: '1px solid var(--alid-border-subtle, #d4d4d8)',
              borderRadius: '4px',
              background: 'transparent',
              cursor: 'pointer',
            },
          }),
          React.createElement('span', { style: { fontSize: '11px', fontWeight: 600 } }, '강조색'),
        ),
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
          React.createElement('input', {
            type: 'color',
            ariaLabel: '비강조 기본 데이터 색상 선택',
            value: ensureHexForPicker(resolved.neutralColor, resolved.resolvedTheme?.neutral || '#cbd5e1'),
            onChange: e => dispatchStyleUpdate({ neutralColor: e.target.value }),
            style: {
              width: '22px',
              height: '20px',
              padding: 0,
              border: '1px solid var(--alid-border-subtle, #d4d4d8)',
              borderRadius: '4px',
              background: 'transparent',
              cursor: 'pointer',
            },
          }),
          React.createElement('span', { style: { fontSize: '11px', fontWeight: 600 } }, '기본 데이터색'),
          resolved.neutralColor &&
            React.createElement(
              'button',
              {
                type: 'button',
                onClick: () => dispatchStyleUpdate({ neutralColor: '' }),
                style: {
                  padding: '1px 5px',
                  borderRadius: '4px',
                  border: '1px solid var(--alid-border-subtle, #d4d4d8)',
                  background: 'transparent',
                  color: 'inherit',
                  fontSize: '10px',
                  cursor: 'pointer',
                },
              },
              '초기화',
            ),
        ),
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } },
        ...ACCENT_PRESETS.map(hex =>
          React.createElement('button', {
            key: hex,
            type: 'button',
            title: `강조색 ${hex}`,
            onClick: () => dispatchStyleUpdate({ accentColor: hex }),
            style: {
              width: '18px',
              height: '18px',
              borderRadius: '999px',
              border:
                resolved.accentColor?.toLowerCase() === hex.toLowerCase()
                  ? '2px solid var(--alid-text, #18181b)'
                  : '1px solid rgba(0,0,0,0.15)',
              background: hex,
              cursor: 'pointer',
              padding: 0,
            },
          }),
        ),
      ),
    ),

    // Section 3: Highlighted Data Selection
    React.createElement(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          paddingTop: '8px',
          borderTop: '1px solid var(--alid-border-subtle, #e4e4e7)',
        },
      },
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement(
          'span',
          { style: { fontWeight: 600, fontSize: '11.5px' } },
          '강조 데이터 지정 (Highlight)',
        ),
        activePreset === 'custom' &&
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: () => dispatchStyleUpdate({ highlight: 'auto' }),
              style: {
                padding: '1px 6px',
                borderRadius: '4px',
                border: '1px solid var(--alid-border-subtle, #d4d4d8)',
                background: 'transparent',
                color: 'inherit',
                fontSize: '10px',
                cursor: 'pointer',
              },
            },
            '자동으로',
          ),
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } },
        ...HIGHLIGHT_PRESETS.map(preset => {
          const isSelected = activePreset === preset.id;
          return React.createElement(
            'button',
            {
              key: preset.id,
              type: 'button',
              onClick: () => dispatchStyleUpdate({ highlight: preset.id }),
              style: {
                padding: '3px 7px',
                borderRadius: '5px',
                border: '1px solid var(--alid-border-subtle, #d4d4d8)',
                background: isSelected ? '#3182f6' : 'transparent',
                color: isSelected ? '#ffffff' : 'inherit',
                fontSize: '10.5px',
                fontWeight: isSelected ? 600 : 400,
                cursor: 'pointer',
              },
            },
            preset.labelKo,
          );
        }),
      ),
      dataItems.length > 0 &&
        resolved.dataTargets?.kind !== 'updown' &&
        React.createElement(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' } },
          React.createElement(
            'span',
            { style: { fontSize: '10.5px', color: 'var(--alid-text-muted, #71717a)' } },
            '클릭하여 특정 데이터 항목만 직접 강조:',
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } },
            ...dataItems.map(item => {
              const isChipActive = customHighlightSet.has(item.key);
              return React.createElement(
                'button',
                {
                  key: item.key,
                  type: 'button',
                  onClick: () => handleToggleHighlightItem(item.key),
                  style: {
                    padding: '2px 7px',
                    borderRadius: '999px',
                    border: isChipActive
                      ? `1.5px solid ${resolved.accentColor || '#3182f6'}`
                      : '1px solid var(--alid-border-subtle, #d4d4d8)',
                    background: isChipActive ? 'rgba(49, 130, 246, 0.14)' : 'transparent',
                    color: 'inherit',
                    fontSize: '10.5px',
                    fontWeight: isChipActive ? 600 : 400,
                    cursor: 'pointer',
                  },
                },
                item.label,
              );
            }),
          ),
        ),
    ),

    // Section 4: Per-Data Component Color Picker
    dataItems.length > 0 &&
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            paddingTop: '8px',
            borderTop: '1px solid var(--alid-border-subtle, #e4e4e7)',
          },
        },
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' } },
          React.createElement(
            'span',
            { style: { fontWeight: 600, fontSize: '11.5px' } },
            '세부 데이터 컴포넌트 색상',
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', gap: '4px' } },
            React.createElement(
              'button',
              {
                type: 'button',
                onClick: handleAssignPalette,
                style: {
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid var(--alid-border-subtle, #d4d4d8)',
                  background: 'transparent',
                  color: 'inherit',
                  fontSize: '10px',
                  cursor: 'pointer',
                },
              },
              '팔레트 자동 배정',
            ),
            hasCustomItemColors &&
              React.createElement(
                'button',
                {
                  type: 'button',
                  onClick: () => dispatchStyleUpdate({ itemColors: {}, replaceItemColors: true }),
                  style: {
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid var(--alid-border-subtle, #d4d4d8)',
                    background: 'transparent',
                    color: 'inherit',
                    fontSize: '10px',
                    cursor: 'pointer',
                  },
                },
                '초기화',
              ),
          ),
        ),
        React.createElement(
          'div',
          {
            style: {
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '5px',
              maxHeight: '160px',
              overflowY: 'auto',
              paddingRight: '2px',
            },
          },
          ...dataItems.map((item, idx) => {
            const customHex = itemColors[item.key];
            const defaultFallback =
              item.key === 'up'
                ? resolved.resolvedTheme?.accent || '#3182f6'
                : item.key === 'down'
                  ? resolved.resolvedTheme?.neutralStrong || '#64748b'
                  : customHighlightSet.has(item.key)
                    ? resolved.resolvedTheme?.accent || '#3182f6'
                    : COMPONENT_PALETTE[idx % COMPONENT_PALETTE.length];
            const pickerValue = ensureHexForPicker(customHex, defaultFallback);

            return React.createElement(
              'div',
              {
                key: item.key,
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '4px',
                  padding: '3px 6px',
                  borderRadius: '6px',
                  border: customHex
                    ? `1px solid ${customHex}`
                    : '1px solid var(--alid-border-subtle, #e4e4e7)',
                  background: customHex ? 'rgba(49, 130, 246, 0.04)' : 'transparent',
                },
              },
              React.createElement(
                'label',
                {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    minWidth: 0,
                    flex: 1,
                    cursor: 'pointer',
                  },
                },
                React.createElement('input', {
                  type: 'color',
                  value: pickerValue,
                  onChange: e => dispatchStyleUpdate({ itemColors: { [item.key]: e.target.value } }),
                  style: {
                    width: '18px',
                    height: '18px',
                    padding: 0,
                    border: 'none',
                    borderRadius: '4px',
                    background: 'transparent',
                    cursor: 'pointer',
                    flexShrink: 0,
                  },
                }),
                React.createElement(
                  'span',
                  {
                    title: item.label,
                    style: {
                      fontSize: '11px',
                      fontWeight: customHex ? 600 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    },
                  },
                  item.label,
                ),
              ),
              customHex &&
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    title: '개별 색상 해제',
                    onClick: () => dispatchStyleUpdate({ itemColors: { [item.key]: '' } }),
                    style: {
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--alid-text-muted, #71717a)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      padding: '0 2px',
                      lineHeight: 1,
                    },
                  },
                  '×',
                ),
            );
          }),
        ),
      ),
  );
}

export function ZtdChartStudioView({ context }) {
  const [tick, setTick] = useState(0);
  const [familyFilter, setFamilyFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editorMode, setEditorMode] = useState('csv');
  const [dataDraft, setDataDraft] = useState('');
  const [parseStatus, setParseStatus] = useState(null);

  useEffect(() => {
    if (!context) return undefined;
    const bump = () => setTick(v => v + 1);
    const offSel = context.onSelectionChange?.(bump);
    const offWorld = context.onWorldMutated?.(bump);
    return () => {
      offSel?.();
      offWorld?.();
    };
  }, [context]);

  const selected = useMemo(() => {
    void tick;
    const ids = context?.getSelectedIds?.() ?? [];
    return readSelectedChartEntity(context?.world, ids);
  }, [context, tick]);

  const resolved = useMemo(
    () => (selected ? resolveChartSpec(selected.props) : null),
    [selected],
  );

  useEffect(() => {
    if (!resolved) {
      setDataDraft('');
      setParseStatus(null);
      return;
    }
    const rows = resolved.spec.data ?? [];
    if (editorMode === 'csv') {
      setDataDraft(formatRowsAsCsv(rows));
    } else {
      setDataDraft(JSON.stringify(rows, null, 2));
    }
    setParseStatus(null);
  }, [selected?.id, resolved?.chartType, resolved?.usingSampleData, editorMode]);

  const catalog = useMemo(
    () => getChartCatalog(resolved?.lang ?? 'ko'),
    [resolved?.lang],
  );

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catalog.filter(item => {
      if (familyFilter !== 'all' && item.family !== familyFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q)
        || item.type.toLowerCase().includes(q)
        || item.summary.toLowerCase().includes(q)
      );
    });
  }, [catalog, familyFilter, searchQuery]);

  const recommendations = useMemo(() => {
    if (!resolved) return [];
    return suggestChartsForRows(resolved.spec.data, resolved.lang).suggestions.slice(0, 4);
  }, [resolved]);

  const handleCreateOrSwitchType = chartType => {
    if (selected) {
      void context.executeCommand(`${EXTENSION_ID}:set-chart-type`, {
        entityId: selected.id,
        chartType,
      });
    } else {
      void context.executeCommand(`${EXTENSION_ID}:insert-chart`, { chartType });
    }
  };

  const handleApplyDataDraft = () => {
    if (!selected) return;
    const parsed = parseDataInput(dataDraft, resolved?.lang ?? 'ko');
    if (!parsed.ok) {
      setParseStatus({ ok: false, message: parsed.error || '데이터를 파싱하지 못했습니다.' });
      return;
    }
    setParseStatus({ ok: true, message: `${parsed.rows.length}개 행이 적용되었습니다.` });
    void context.executeCommand(`${EXTENSION_ID}:update-data`, {
      entityId: selected.id,
      rows: parsed.rows,
      ...(parsed.chartType ? { chartType: parsed.chartType } : {}),
      ...(parsed.encoding ? { encoding: parsed.encoding } : {}),
      ...(parsed.options ? { options: parsed.options } : {}),
    });
  };

  const handleResetSampleData = () => {
    if (!selected) return;
    setParseStatus({ ok: true, message: '샘플 데이터로 초기화했습니다.' });
    void context.executeCommand(`${EXTENSION_ID}:reset-sample-data`, {
      entityId: selected.id,
    });
  };

  const handleApplySuggestion = item => {
    if (!selected || !item) return;
    void context.executeCommand(`${EXTENSION_ID}:set-chart-type`, {
      entityId: selected.id,
      chartType: item.type,
      ...(item.spec?.encoding ? { encoding: item.spec.encoding } : {}),
    });
  };

  return React.createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '12px',
        fontSize: '12px',
        lineHeight: 1.45,
        color: 'var(--alid-text, #18181b)',
      },
    },
    // Header section
    React.createElement(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        },
      },
      React.createElement(
        'div',
        null,
        React.createElement(
          'div',
          { style: { fontWeight: 700, fontSize: '13px' } },
          'ZTD 차트 스튜디오 (36종)',
        ),
        React.createElement(
          'div',
          { style: { color: 'var(--alid-text-muted, #71717a)', fontSize: '11px' } },
          selected
            ? `선택됨: ${resolved?.title || selected.id} (${resolved?.chartType})`
            : '차트를 클릭해 즉시 캔버스에 추가하세요',
        ),
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: () => void context.executeCommand(`${EXTENSION_ID}:insert-chart`, { chartType: resolved?.chartType ?? 'bar' }),
          style: {
            padding: '5px 10px',
            borderRadius: '6px',
            border: '1px solid var(--alid-border-subtle, #d4d4d8)',
            background: '#3182f6',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '11.5px',
            cursor: 'pointer',
          },
        },
        '+ 새 차트 추가',
      ),
    ),

    // Category filter & search
    React.createElement('input', {
      type: 'search',
      value: searchQuery,
      onChange: e => setSearchQuery(e.target.value),
      placeholder: '차트 검색 (예: 막대, 라인, 생키, 퍼널, 캔들스틱…)',
      style: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '6px 8px',
        borderRadius: '6px',
        border: '1px solid var(--alid-border-subtle, #d4d4d8)',
        background: 'var(--alid-bg-surface, #ffffff)',
        color: 'inherit',
        fontSize: '12px',
      },
    }),

    React.createElement(
      'div',
      {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
        },
      },
      ...CHART_FAMILIES.map(fam =>
        React.createElement(
          'button',
          {
            key: fam.id,
            type: 'button',
            onClick: () => setFamilyFilter(fam.id),
            style: {
              padding: '3px 8px',
              borderRadius: '999px',
              border: '1px solid var(--alid-border-subtle, #d4d4d8)',
              background: familyFilter === fam.id ? '#3182f6' : 'transparent',
              color: familyFilter === fam.id ? '#ffffff' : 'inherit',
              fontSize: '11px',
              fontWeight: familyFilter === fam.id ? 600 : 400,
              cursor: 'pointer',
            },
          },
          fam.labelKo,
        ),
      ),
    ),

    // 36 chart types grid
    React.createElement(
      'div',
      {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '6px',
          maxHeight: '196px',
          overflowY: 'auto',
          paddingRight: '2px',
        },
      },
      ...filteredCatalog.map(item => {
        const isActive = resolved?.chartType === item.type;
        return React.createElement(
          'button',
          {
            key: item.type,
            type: 'button',
            onClick: () => handleCreateOrSwitchType(item.type),
            title: item.summary,
            style: {
              textAlign: 'left',
              padding: '6px 8px',
              borderRadius: '8px',
              border: isActive
                ? '1.5px solid #3182f6'
                : '1px solid var(--alid-border-subtle, #e4e4e7)',
              background: isActive ? 'rgba(49, 130, 246, 0.08)' : 'var(--alid-bg-surface, #ffffff)',
              color: 'inherit',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            },
          },
          React.createElement(
            'span',
            { style: { fontWeight: 600, fontSize: '11.5px' } },
            item.name,
          ),
          React.createElement(
            'span',
            {
              style: {
                fontSize: '10px',
                color: 'var(--alid-text-muted, #71717a)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              },
            },
            item.type,
          ),
        );
      }),
    ),

    // Data editor & recommendations when a chart is selected
    selected && resolved
      ? React.createElement(
          React.Fragment,
          null,
          React.createElement(ChartColorAndHighlightControls, {
            selected,
            resolved,
            context,
          }),
          recommendations.length > 0 &&
            React.createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid var(--alid-border-subtle, #e4e4e7)',
                },
              },
              React.createElement(
                'div',
                { style: { fontWeight: 600, fontSize: '11.5px' } },
                '데이터 맞춤 추천 차트',
              ),
              ...recommendations.map(rec =>
                React.createElement(
                  'div',
                  {
                    key: rec.type,
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '6px',
                      fontSize: '11px',
                    },
                  },
                  React.createElement(
                    'div',
                    { style: { minWidth: 0, flex: 1 } },
                    React.createElement('strong', null, `${rec.name} (${Math.round((rec.score ?? 0) * 100)}%)`),
                    React.createElement(
                      'div',
                      { style: { color: 'var(--alid-text-muted, #71717a)', fontSize: '10.5px' } },
                      rec.reason,
                    ),
                  ),
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      onClick: () => handleApplySuggestion(rec),
                      style: {
                        padding: '3px 7px',
                        borderRadius: '5px',
                        border: '1px solid var(--alid-border-subtle, #d4d4d8)',
                        background: 'transparent',
                        color: 'inherit',
                        fontSize: '10.5px',
                        cursor: 'pointer',
                      },
                    },
                    '적용',
                  ),
                ),
              ),
            ),

          React.createElement(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              },
            },
            React.createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                },
              },
              React.createElement(
                'span',
                { style: { fontWeight: 600, fontSize: '11.5px' } },
                '데이터 편집 (CSV / JSON)',
              ),
              React.createElement(
                'div',
                { style: { display: 'flex', gap: '4px' } },
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    onClick: () => setEditorMode('csv'),
                    style: {
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: '1px solid var(--alid-border-subtle, #d4d4d8)',
                      background: editorMode === 'csv' ? '#3182f6' : 'transparent',
                      color: editorMode === 'csv' ? '#ffffff' : 'inherit',
                      fontSize: '10.5px',
                      cursor: 'pointer',
                    },
                  },
                  'CSV',
                ),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    onClick: () => setEditorMode('json'),
                    style: {
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: '1px solid var(--alid-border-subtle, #d4d4d8)',
                      background: editorMode === 'json' ? '#3182f6' : 'transparent',
                      color: editorMode === 'json' ? '#ffffff' : 'inherit',
                      fontSize: '10.5px',
                      cursor: 'pointer',
                    },
                  },
                  'JSON',
                ),
              ),
            ),
            React.createElement('textarea', {
              value: dataDraft,
              onChange: e => setDataDraft(e.target.value),
              rows: 7,
              spellCheck: false,
              style: {
                width: '100%',
                boxSizing: 'border-box',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '11px',
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid var(--alid-border-subtle, #d4d4d8)',
                background: 'var(--alid-bg-surface, #ffffff)',
                color: 'inherit',
                resize: 'vertical',
              },
            }),
            parseStatus &&
              React.createElement(
                'div',
                {
                  style: {
                    fontSize: '11px',
                    color: parseStatus.ok ? '#16a34a' : '#dc2626',
                  },
                },
                parseStatus.message,
              ),
            React.createElement(
              'div',
              { style: { display: 'flex', gap: '6px' } },
              React.createElement(
                'button',
                {
                  type: 'button',
                  onClick: handleApplyDataDraft,
                  style: {
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#3182f6',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '11.5px',
                    cursor: 'pointer',
                  },
                },
                '데이터 반영',
              ),
              React.createElement(
                'button',
                {
                  type: 'button',
                  onClick: handleResetSampleData,
                  style: {
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--alid-border-subtle, #d4d4d8)',
                    background: 'transparent',
                    color: 'inherit',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                  },
                },
                '샘플 복원',
              ),
            ),
          ),
        )
      : null,
  );
}

export function ZtdChartColorInspectorView({ context }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!context) return undefined;
    const bump = () => setTick(v => v + 1);
    const offSel = context.onSelectionChange?.(bump);
    const offWorld = context.onWorldMutated?.(bump);
    return () => {
      offSel?.();
      offWorld?.();
    };
  }, [context]);

  const selected = useMemo(() => {
    void tick;
    const ids = context?.getSelectedIds?.() ?? [];
    return readSelectedChartEntity(context?.world, ids);
  }, [context, tick]);

  const resolved = useMemo(
    () => (selected ? resolveChartSpec(selected.props) : null),
    [selected],
  );

  if (!selected || !resolved) return null;
  return React.createElement(ChartColorAndHighlightControls, {
    selected,
    resolved,
    context,
  });
}

export function createColorInspectorPanelSpec() {
  return {
    panelId: COLOR_INSPECTOR_PANEL_ID,
    title: '강조 데이터 및 세부 색상',
    defaultZone: 'right',
    inspectorFor: CHART_ASPECT_ID,
    isolation: 'container',
    mount(hostEl, context) {
      if (!hostEl) return () => {};
      const doc = hostEl.ownerDocument;
      if (!doc || typeof doc.createElement !== 'function') {
        hostEl.textContent = '강조 데이터 및 세부 색상';
        return () => {
          hostEl.textContent = '';
        };
      }
      const root = createRoot(hostEl);
      root.render(React.createElement(ZtdChartColorInspectorView, { context }));
      return () => {
        try {
          root.unmount();
        } catch {
          // Ignore unmount errors
        }
      };
    },
  };
}

export function createStudioPanelSpec() {
  return {
    panelId: STUDIO_PANEL_ID,
    title: 'ZTD 차트 스튜디오',
    icon: {
      paths: [
        'M3 3v14h14',
        'M7 14V9',
        'M11 14V6',
        'M15 14v-4',
      ],
    },
    defaultZone: 'right',
    isolation: 'container',
    navigation: {
      group: 'document',
      order: 45,
    },
    mount(hostEl, context) {
      if (!hostEl) return () => {};
      const doc = hostEl.ownerDocument;
      if (!doc || typeof doc.createElement !== 'function') {
        hostEl.textContent = 'ZTD 차트 스튜디오';
        return () => {
          hostEl.textContent = '';
        };
      }
      const root = createRoot(hostEl);
      root.render(React.createElement(ZtdChartStudioView, { context }));
      return () => {
        try {
          root.unmount();
        } catch {
          // Ignore unmount errors
        }
      };
    },
  };
}
