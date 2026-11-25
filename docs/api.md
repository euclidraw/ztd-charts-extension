# `diagram.ztd-charts` 확장 계약 및 API 레퍼런스

## 1. 정본 어스펙트 (`diagram.ztd-charts.chart`)

| 필드 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `chartType` | `string` | `'bar'` | 47종 `ztd-charts` 차트 종류 식별자 |
| `title` | `string` | `''` | 차트 카드 제목 (비워 두면 차트 유형별 로컬라이즈 기본 제목 사용) |
| `subtitle` | `string` | `''` | 부제목 또는 단위 설명 |
| `takeaway` | `string` | `''` | 하단 핵심 요약 문구 |
| `theme` | `'light' \| 'dark'` | `'light'` | 차트 테마 |
| `locale` | `'ko' \| 'en'` | `'ko'` | 차트 로케일 (`ko-KR` / `en-US`) |
| `variant` | `'card' \| 'bare'` | `'card'` | 카드 프레임(제목·범례·요약 포함) 또는 차트 단독 표시 |
| `legendMode` | `'auto' \| 'true' \| 'false'` | `'auto'` | 자동 범례 표시 여부 |
| `accentColor` | `string` (`#rrggbb`) | `'#3182f6'` | 강조 계열 색상 |
| `stylePreset` | `string` | `''` | [인쇄 스타일](print-styles.md) ID |
| `customCss` | `string` | `''` | 선택 차트에만 적용할 `--exam-*` 선언 |
| `data` | `Record<string, unknown>[]` | `[]` | 커스텀 데이터 행 배열 (비어 있으면 차트별 내장 샘플 데이터 사용) |
| `encoding` | `Record<string, unknown>` | `{}` | 데이터 컬럼 매핑 (`x`, `y`, `series`, `label`, `value` 등) |
| `options` | `Record<string, unknown>` | `{}` | 차트별 세부 옵션 (`layout`, `orientation`, `curve` 등) |

차트를 선택하면 각 범례 박스에 편집용 점선 선택 테두리(러버 밴드)와 오른쪽 위 이동 핸들이 표시된다. 테두리는 범례를 따라 움직이며 내보낸 SVG에는 포함되지 않는다. 이 핸들이나 범례 박스를 끌어 위치를 변경한다. `options.legendOffsets`의 `card`(카드 상단)와 `plot`(도표 내부)는 별도의 `{ x, y }` 값으로, 기본 배치에서 이동한 차트 좌표 거리다. 드래그 중 Esc는 취소하고, 놓으면 한 번의 실행 취소로 되돌릴 수 있다. SVG 내보내기에도 적용된다.

## 2. 명령 (`commands`)

- `diagram.ztd-charts:insert-chart`: 새 ZTD 차트 도형 추가
- `diagram.ztd-charts:set-chart-type`: 선택된 차트의 `chartType` 전환
- `diagram.ztd-charts:update-data`: CSV/JSON/배열 데이터 및 자동 인코딩 반영
- `diagram.ztd-charts:update-style`: `{ entityId, options: { [name]: value } }`로 차트별 표시 옵션 변경 (`null`은 해당 재정의 해제). `stylePreset`과 `customCss`는 `options` 안이 아니라 명령의 최상위 인자로 전달합니다.
- `diagram.ztd-charts:reset-sample-data`: 내장 샘플 데이터로 복원
- `diagram.ztd-charts:apply-top-suggestion`: `suggestCharts` 최상위 추천 차트 및 인코딩 적용
- `diagram.ztd-charts:toggle-theme`: 라이트/다크 테마 전환
- `diagram.ztd-charts:toggle-variant`: 카드형/단독형 전환
- `diagram.ztd-charts:toggle-locale`: 한국어/영어 전환

## 3. 코파일럿 도구 (`workspace.tools`)

- `diagram.ztd-charts:catalog`: 47종 차트 카탈로그 및 용도·권장 인코딩 조회 (읽기 전용)
- `diagram.ztd-charts:suggest`: CSV/JSON 데이터 프로파일링 및 적합 차트 추천 (읽기 전용)
- `diagram.ztd-charts:search`: 캔버스 내 차트 엔티티 검색 (읽기 전용)
- `diagram.ztd-charts:plan-changes`: 차트 생성·수정·이동·삭제 배치 승인 제안(`prepareChange`) 생성
