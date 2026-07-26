---
description: Argus 설치·배선 자가진단 — 판단 기록, 바인딩, LOGBOOK 최신 상태, 잠금 상태를 읽기 전용으로 점검
allowed-tools: Bash(node:*)
---

다음을 실행하고 출력을 **그대로** 사용자에게 전달하라 (요약·재해석·평가 금지 —
진단은 스크립트가 결정론적으로 끝냈고, 각 줄에 수리 손잡이가 이미 적혀 있다):

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js"
```

출력 후, 스크립트가 원리상 볼 수 없는 **발사 사슬 세 가지**만 네가 직접 확인해
한 줄씩 덧붙여라 (이 셋은 호스트 세션 안에서만 보인다):

1. **MCP 연결 — 세 상태를 구별하라** (미연결과 구버전은 처방이 다르다):
   - 툴 목록에 `argus_predict`/`argus_capture`/`argus_resolve`가 **있다** → 연결 OK.
   - 그 셋은 없는데 옛 이름(`argus_seal`·`argus_settle`·`argus_open_decision`)이 있다 = **구버전** 신호 →
     "⚠ Argus MCP가 구버전으로 연결됐다(옛 도구 이름이 보인다). 미연결이 아니라
     낡은 배선이다 — npx가 캐시된 옛 설치본을 재사용하고 있다.
     `npx clear-npx-cache` 또는 캐시 디렉터리 삭제 후 세션 재시작."
   - 어느 쪽도 **없다** → "⚠ Argus MCP 서버 미연결 — 감지가 도구를 잃었다.
     `/mcp`로 연결 상태를 확인하라."
2. **돌고 있는 버전**: 툴이 있으면 `argus_check_in`을 호출하고(읽기 전용)
   `data.server_version`을 [10]의 핀한 버전과 대조해 전달하라 — 같으면 "배선
   버전 일치 (x.y.z)", 다르면 "⚠ 지금 돌고 있는 건 A인데 플러그인이 핀한 건
   B — 낡은 배선이다(캐시 재사용). 캐시를 비우고 세션을 재시작할 것." 이 한
   줄이 [10]의 결정론적 추정을 사실로 확정한다.
3. **픽커(원탭 확인) 지원**: 같은 `argus_check_in` 응답의 `data.picker`를
   전달하라 — `one_tap`이면 "픽커 OK — AI 초안 예측은 Accept/Decline 원탭으로
   확인받는다(Accept 빈칸=그대로, reword=내 문구, check_by=확인일만 조정)",
   `text_fallback`이면 "⚠ 이 호스트는 elicitation 미지원 — 확인은 대화
   텍스트로 폴백된다(기능은 동작)".

그 외에는, ⚠ 줄이 있으면 그 줄에 적힌 공개 복구 도구(예: `argus_settings`,
`argus_check_in`)를 실행할지 사용자에게 물어라 — 대신 실행하지 말 것.
⚠가 없으면 "정상"이라고 덧붙이지 말고 출력만 전달하라 (스크립트가 이미 말했다).
