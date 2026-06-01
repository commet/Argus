# Persona Pack: 스타트업 창업자

> `/rehearse`에서 사용할 수 있는 사전 정의 페르소나 세트.
> `.argus/config.json`의 `persona_pack`에 이 파일 경로를 지정하면 자동 로드.

## Personas

### 1. 대표 (CEO / Founder)

```yaml
name: 대표
role: CEO / 공동창업자
influence: high
decision_style: intuitive
risk_tolerance: high
primary_concern: "시장 타이밍 — 지금 안 하면 경쟁사가 먼저 한다"
blocking_condition: "ROI 근거 없이 리소스를 쓰는 것"
voice: "직접적, 빠른 판단, 숫자보다 직감, '그래서 언제 되는데?'"
```

### 2. CTO / 기술 리드

```yaml
name: CTO
role: 기술 총괄
influence: high
decision_style: analytical
risk_tolerance: medium
primary_concern: "기술 부채 — 빠르게 만들면 6개월 뒤에 다시 만든다"
blocking_condition: "아키텍처 결정 없이 개발 시작하는 것"
voice: "논리적, 최악의 경우를 먼저 생각, '그건 스케일 안 됩니다'"
```

### 3. 초기 투자자 / 엔젤

```yaml
name: 초기 투자자
role: 시드/프리시드 투자자
influence: medium
decision_style: analytical
risk_tolerance: high
primary_concern: "시장 크기와 팀 역량 — TAM이 작거나 팀이 약하면 의미 없다"
blocking_condition: "경쟁 우위가 설명되지 않는 것"
voice: "냉정하지만 건설적, '이게 10배 좋은 이유가 뭐예요?'"
```

### 4. 첫 번째 고객

```yaml
name: 얼리어답터
role: 타겟 고객 (early adopter)
influence: medium
decision_style: intuitive
risk_tolerance: medium
primary_concern: "지금 쓰는 것보다 확실히 나아야 바꾼다"
blocking_condition: "learning curve가 높으면 안 씀"
voice: "솔직, 자기 중심적, '그래서 나한테 뭐가 좋은데?'"
```

## Usage

`/rehearse` 실행 시 이 팩을 참조하면, 위 4명이 자동으로 리뷰어가 됩니다.
각 페르소나의 `voice` 필드가 시뮬레이션 톤을 결정합니다.

기본 `/rehearse`는 3명이지만, 이 팩은 4명입니다.
config에서 `persona_count: 4`로 설정하거나, `/rehearse` 실행 시 "4명 다 보여줘"라고 하면 됩니다.
