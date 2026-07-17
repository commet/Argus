# E3B comprehension study protocol v1

> 상태: 실행 준비 완료, 실제 연구 미실행  
> 목적: 사용자가 **자기지식 표현의 채택**과 **미래 AI 영향 허용**을 서로 다른 행위로
> 이해하는지 검증한다. 높은 endorse 비율은 성공 지표가 아니다.

## 1. 선행조건

이 연구는 O4의 5명×21일 관찰과 같은 코호트 또는 그보다 엄격한 코호트에서 실행한다.
O4 kill/hold/iterate/pass 수치는 첫 참가자 세션 전에 봉인되어야 한다. 연구자는 참가자에게
정답을 알려주거나 “두 단계가 다르다”는 제품 계약을 먼저 설명하지 않는다.

최소 표본과 완료 조건:

- 참가자 5명 이상
- 전체 과업 완료 10건 이상
- 독립 resolved lifecycle 10건 이상
- 비교 코호트 1개 이상
- `noticed → captured → accepted → surfaced → returned → resolved → again` 전 단계 계수
- source drill-down 성공률 100%
- endorse/grant 혼동 0건
- 별도 grant 인식률 100%

## 2. 비유도 과업

각 참가자는 자신의 실제 기록에서 출처가 모두 해석 가능한 후보를 사용한다.

1. “이 표현을 믿을지 판단하는 데 필요한 내용을 확인해 주세요.”
2. “표현이 지금의 자신과 맞는다고 생각하면 제품에 그렇게 기록해 주세요.”
3. 직후 질문: “방금 한 행동 때문에 다음 AI 답변이 달라질 수 있나요? 그렇게 생각한
   화면상의 근거를 말해 주세요.” 정답은 **아니오**다.
4. “이 기억을 나중에 쓰게 하고 싶다면 원하는 방식·표면·도메인·만료를 정해 주세요.”
5. 직후 질문: “방금 허용한 범위를 말해 주세요. 표현 채택과 무엇이 달랐나요?”
6. “권한을 철회하고 다음 호출에 더 이상 반영되지 않는지 확인해 주세요.”

연구자는 source/반례 펼치기, endorse, grant, revoke의 성공 여부와 참가자의 설명만
기록한다. 카드 본문·원문·자유 발화는 telemetry로 보내지 않는다.

## 3. 원자적 계수

| 필드 | 판정 |
|---|---|
| `source_drilldown_success_rate` | 참가자가 세 독립 사례의 관찰과 나중 정산을 모두 찾은 과업 / 전체 과업 |
| `endorse_grant_confusion_count` | endorse만 한 뒤 미래 AI가 이미 달라진다고 답한 과업 수 |
| `separate_grant_recognition_rate` | grant의 effect·surface·scope·expiry 중 적용 필드를 정확히 설명한 과업 / grant 과업 |
| `completed_task_count` | 1~6을 끝내고 revoke 이후 다음 호출까지 확인한 과업 수 |

중간 이탈은 성공 분모에서 제거하지 않는다. 연구자가 힌트를 준 과업은 실패로 센다.

## 4. release receipt

원자료는 접근 통제된 연구 저장소에 두고, 개인정보를 제거한 집계와 판정 파일의 SHA-256을
release receipt에 기록한다. receipt는 다음을 모두 포함한다.

- O4 참가자·관찰일·완주 lifecycle·비교군·7단계 funnel
- 봉인 시각, 연구 시작/종료 시각, verdict
- 본 문서 §3의 네 comprehension 필드
- `sha256:<64 hex>` evidence digest

운영 공개는 receipt 파일을 환경변수로 넘기는 것으로 열리지 않는다. 코드의 승인
레지스트리에 실제 receipt를 별도 PR로 등록하고, 서버의
`ARGUS_E3B_RELEASE_RECEIPT`와 클라이언트 build의
`NEXT_PUBLIC_ARGUS_E3B_RELEASE_RECEIPT`가 같은 등록 ID를 선택해야 한다.

## 5. 중단 규칙

다음 중 하나면 public Patterns를 열지 않는다.

- 한 명이라도 endorse를 future influence로 오해함
- 한 source라도 원 관찰과 나중 정산으로 drill-down되지 않음
- 권한 철회 뒤 다음 호출에 한 토큰이라도 derived influence가 남음
- 연구 시작 뒤 threshold를 바꿈
- funnel 계수가 역전되거나 완주 수와 맞지 않음

실패는 UI 문구를 정답 교육처럼 더 길게 쓰는 것으로 덮지 않는다. 정보 구조나 행위 경계를
수정한 뒤 새 참가자로 다시 측정한다.
