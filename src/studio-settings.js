import React from 'react';

const h = React.createElement;
const stack = { display: 'grid', gap: 6 };

// Use the installed catalog: each chart exposes only its own supported controls.
export function StudioChartSettings({ resolved, storedOptions = {}, onOption }) {
  const { def, spec, usingSampleData } = resolved;
  const controls = def.options.filter(o => o.type === 'boolean' || (o.type === 'enum' && o.enum?.length));
  return h('section', { style: stack },
    h('strong', null, def.name),
    h('div', null, def.useWhen),
    h('details', { key: def.type + '-fields' },
      h('summary', null, `데이터 열 안내 · ${usingSampleData ? '샘플' : '사용자 데이터'} ${spec.data.length}행`),
      h('dl', null, def.encoding.map(field => h(React.Fragment, { key: field.name },
        h('dt', null, h('code', null, field.name), field.required ? ' · 필수' : ' · 선택'),
        h('dd', { style: { margin: '0 0 6px 8px' } }, field.description,
          spec.encoding[field.name] != null && h('div', null, '연결된 열: ', String(spec.encoding[field.name]))),
      ))),
    ),
    controls.length > 0 && h('details', { key: def.type + '-options' },
      h('summary', null, '차트 표시 옵션'),
      h('div', { style: { ...stack, marginTop: 6 } }, controls.map(o => {
        const choices = o.type === 'boolean' ? [true, false] : o.enum;
        const label = v => v === true ? '켜기' : v === false ? '끄기' : String(v);
        const fallback = def.example.options?.[o.name] ?? o.default;
        const current = storedOptions?.[o.name];
        return h('label', { key: o.name, style: stack },
          h('span', null, o.description, ' (', o.name, ')'),
          h('select', {
            value: current == null ? '' : String(current),
            onChange: e => onOption(o.name, choices.find(v => String(v) === e.target.value) ?? null),
          },
          h('option', { value: '' }, fallback == null ? '기본 설정' : '기본 설정 · ' + label(fallback)),
          current != null && !choices.includes(current) && h('option', { value: String(current) }, '사용자 설정 · ' + label(current)),
          choices.map(v => h('option', { key: String(v), value: String(v) }, label(v)))),
        );
      })),
    ),
  );
}
