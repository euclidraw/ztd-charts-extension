import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CHART_ASPECT_ID, EXTENSION_ID, STUDIO_PANEL_ID } from './manifest.js';
import {
  CHART_FAMILIES,
  formatRowsAsCsv,
  getChartCatalog,
  parseDataInput,
  resolveChartSpec,
  suggestChartsForRows,
} from './model.js';

function readSelectedChartEntity(world, selectedIds) {
  if (!world || !Array.isArray(selectedIds)) return null;
  for (const id of selectedIds) {
    const props = world.getCanonical?.(id, CHART_ASPECT_ID);
    if (props) return { id, props };
  }
  return null;
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
