# 시뮬레이션 실험 원장 — Argus로 Argus 개발을 기록한다

`home/`은 실제 Argus 원장이다 (`ARGUS_DIR=<repo>/docs/receipts/sim-ledger/home`).
시뮬레이션 실험의 사전등록을 스크래치 파일이 아니라 **Argus 봉인**으로 하고,
결과가 나오면 **Argus 정산**으로 닫는다 — 제품의 인식론(봉인→정산, 빗나간
예측도 지워지지 않는다)을 제품 개발의 실험 프로그램에 그대로 쓴다.

읽는 법: `ledger.jsonl`의 seal 이벤트가 실행 전 예측, settle 이벤트가 실측
정산이다. 실험 프로그램의 적중률은 여기서 계산한다.

이름이 `.argus`가 아닌 이유: 저장소 전역 `**/.argus/` ignore(사용자 원장
오커밋 방지)와 충돌해서다. 이 원장은 사용자 데이터가 아니라 증거 기록이다.

커밋 방법: Argus는 자기 홈에 `.gitignore`를 만들어 `ledger/`를 막는다 —
사용자 원장 보호로는 옳은 기본값이다. 이 원장은 증거이므로 갱신 때마다
`git add -f docs/receipts/sim-ledger/home/ledger/ledger.jsonl`로 명시적으로
커밋한다. 제품의 프라이버시 기본값을 끄지 않고 예외를 예외로 다룬다.
