# AGENT.md

이 저장소는 Alid 외부 저장소 확장 계약(`apiVersion: 2`)을 따르는 `euclidraw/ztd-charts-extension`입니다.

## 핵심 불변식

1. **단일 ESM 번들 계약**:
   - `pnpm build`는 단일 파일 `dist/plugin.js`와 SHA-256 해시가 기록된 `alid.extension.json`을 생성해야 합니다.
   - `dist/plugin.js`의 외부 import는 반드시 호스트 importmap(`react`, `react/jsx-runtime`, `react/jsx-dev-runtime`, `react-dom`, `react-dom/client`, `@alid/react`, `@alid/kernel`)에 한정되어야 합니다.
2. **순수 벡터 SVG 출판 (`renderSvg`)**:
   - 36종 모든 차트는 `<foreignObject>`나 HTML 태그 없이 결정론적 순수 SVG로 컴파일되어야 하며, `--ztd-*` CSS 변수는 정적 색상 값으로 인라인되어야 합니다.
3. **승인 기반 코파일럿 변경 (`workspace.tools`)**:
   - 도구 호출 단계에서 정본 월드를 직접 변경하지 않고 반드시 `prepareChange`를 통해 원자적 Undo 그룹으로 적용 가능한 승인 제안을 반환해야 합니다.

## 완료 게이트

변경 후 커밋 전에 반드시 다음 명령이 모두 통과해야 합니다 (`dist/plugin.js` 및 `alid.extension.json` 포함 커밋 필수):

```bash
pnpm test
pnpm check:dist
pnpm test:host
```
