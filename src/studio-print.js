import React, { useState } from 'react';
import { EXAMPLE_CSS, PRINT_PRESETS, parsePrintCss } from './print-style.js';

import { PRINT_PROFILE, PROFILE_NOTE } from './print-profile.js';

const h = React.createElement;
export function StudioPrint({ chartType, stylePreset = '', customCss = '', update }) {
  const [draft, setDraft] = useState(customCss);
  const preset = PRINT_PRESETS.find(p => p.id === stylePreset);
  const { error } = parsePrintCss(draft);
  return h('details', null,
    h('summary', null, '수능 인쇄 스타일'),
    h('div', { style: { display: 'grid', gap: 6, marginBlock: 8 } },
      h('label', null, '프리셋 ', h('select', {
        value: stylePreset, onChange: e => update({ stylePreset: e.target.value }),
      }, h('option', { value: '' }, '지정 안 함'), ...PRINT_PRESETS.map(p => h('option', { key: p.id, value: p.id }, p.name)))),
      preset && h('div', null, preset.chart === chartType ? preset.note : PROFILE_NOTE[PRINT_PROFILE[chartType]]),
      h('small', null, '데이터와 축은 그대로 두고 캔버스를 정적 인쇄 보기로 전환합니다. 원래 보기로 돌아가려면 초기화하세요.'),
      h('label', null, '사용자 CSS 선언', h('textarea', { rows: 5, maxLength: 2048, value: draft, spellCheck: false,
        placeholder: EXAMPLE_CSS, onChange: e => setDraft(e.target.value), style: { width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' } })),
      h('small', null, '색상: --exam-ink / fill / paper / grid (#rrggbb) · --exam-stroke: 0.5~3px · --exam-grid-dash: none 또는 4 3 · --exam-font: serif(영문 CMU Serif · 한글 Pretendard) 또는 sans-serif'),
      error && h('small', { role: 'alert' }, error),
      h('div', { style: { display: 'flex', gap: 4 } },
        h('button', { type: 'button', onClick: () => setDraft(EXAMPLE_CSS) }, '예시 입력'),
        h('button', { type: 'button', disabled: !!error || draft === customCss, onClick: () => update({ customCss: draft }) }, 'CSS 적용'),
        h('button', { type: 'button', onClick: () => { setDraft(''); update({ stylePreset: '', customCss: '' }); } }, '인쇄 스타일 초기화'))));
}
