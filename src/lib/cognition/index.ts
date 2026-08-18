/**
 * 인지 구조 엔진 — 공개 표면.
 *
 * ── 지위 (2026-08-18, 창업자 §6 결정 봉인 — BLUEPRINT R 트랙 절 참조) ──
 *
 * 이 모듈은 **소비자 없는 순수 라이브러리**다. 그것은 결함이 아니라 봉인된
 * 결정의 결과다: 파일럿 화면(/method-pilot/frames)은 원형 선택 전에 지어진
 * §5 수칙 위반이라 철거됐고, 이 엔진의 소비처는 **대화 루프**로 정해졌다 —
 * MCP `argus_predict` 봉인 흐름(MIT 존, 별도 PR)이 `watch.ts`의 사람말 질문을
 * 이식해 전제 결박을 원탭으로 받고, 귀환은 기존 T2 게이트를 탄다.
 * 그 편입 전까지 여기 함수를 새 앱 존 화면에서 소비하는 것은 봉인된 결정
 * 위반이다. (지속: `db.ts`가 왕복 테스트로 검증된 매핑을 갖고 있고, Supabase
 * 테이블 7개는 실재하나 0행이다 — 서버 승격은 계정 이동성·삭제 계약과 함께.)
 *
 * 내용: 일곱 축(축마다 기계 권한을 타입으로), 두 세계(증거 있는 건넘과 철회),
 * 지속 전제(동일성은 premises-core 정규화 재사용), 탐지(CUSUM·ADWIN)와
 * 포트폴리오(fixed-share), 봉인 시점 예측의 보정(Murphy 분해), 거울.
 * 순수 — 네트워크·시각·난수 없음.
 *
 * ── 이미 있는 능력과의 관계 (검사기가 강제하는 언급) ─────────────────
 *   대화 로그 수집   정본은 `argus-mcp/src/v2/capture-cli.ts`·`harvest.ts` —
 *                    훅이 transcript 경로를 자동으로 준다. 여기 `extract.ts`의
 *                    `parseTranscript`/`extractCandidates`는 편입 시
 *                    `argus-mcp/src/v2/candidate-capture.ts`의
 *                    `CandidateExtractorPort` 새 구현으로 들어간다.
 *   저자성 판정      정본은 `src/lib/judgment-authorship.ts` — `./authorship`이
 *                    그것을 부르고 깊이(수정 거리·라운드)만 얹는다.
 *   전제 모델        정본은 `src/lib/premises-core.ts` — 동일성 판정은
 *                    `normalizePremiseText()`를 그대로 빌려 쓴다.
 */
export {
  AXES,
  REQUIRED_AXES,
  axisSpec,
  isKnownAxis,
  type AxisId,
  type AxisAuthority,
  type AxisSpec,
} from './axes';

export { elementAuthorship, revisionDistance, isUneditedMachineText } from './authorship';

export {
  ECHO_THRESHOLD,
  acceptAsIs,
  comprehensionNotRequired,
  echoOverlap,
  evaluateRestatement,
  gateApplies,
} from './comprehension';

export {
  deriveWorld,
  elementsClaimingUnevidencedCrossing,
  isValidCrossing,
  readingToCrossing,
  reconcileWorld,
  worldBalance,
  retractCrossing,
  worldTrajectory,
  type WorldBalance,
  type WorldTransition,
} from './world';

export {
  addElement,
  blockMessage,
  elementsByAxis,
  emptyFrame,
  liveElements,
  makeElement,
  recordReading,
  sealBlocks,
  sealFrame,
  settleFrame,
} from './frame';

export { MIN_SAMPLE, calibration, scorablePredictions, type CalibrationReading, type ScoredPrediction } from './calibration';

export {
  corpusMirror,
  frameMirror,
  type AuthorshipReflection,
  type AxisReflection,
  type ComprehensionReflection,
  type CorpusMirror,
  type FrameMirror,
} from './mirror';

export {
  toNumericSeries,
  cusum,
  adaptiveWindow,
  detectAll,
  anyAlert,
  allInsufficient,
  type NumericSeries,
  type CusumPrior,
  type AdwinPrior,
  type DetectionResult,
  type DetectionVerdict,
} from './detect';

export {
  runPortfolio,
  disagreement,
  type HypothesisId,
  type PortfolioPrior,
  type PortfolioResult,
  type PortfolioStep,
} from './portfolio';

export {
  makePremise,
  appendReading,
  referenceFrom,
  assessPremise,
  returnTriggers,
  premiseIdentityKey,
  isSamePremiseText,
  measureM2,
  measureM3,
  type DurablePremise,
  type PremiseAssessment,
  type PremiseStance,
  type ReturnTrigger,
  type M2Reading,
  type M3Reading,
} from './premise';

export {
  MIN_PER_SIDE,
  attributedSettlements,
  measureM5,
  attributionDrift,
  type AttributedSettlement,
  type AttributionDrift,
  type M5Reading,
  type OutcomeAttribution,
  type PreregisteredAttribution,
} from './attribution';

export {
  MIN_READINGS,
  SLACK_RATIO,
  DECISION_SIGMA,
  LEARNING_RATE,
  SHARE_RATE,
  readNumber,
  readingFrom,
  watchBlocks,
  watchStatus,
  watchToBinding,
  watchToCusumPrior,
  watchToPortfolioPrior,
  type WatchSetup,
} from './watch';

export {
  parseTranscript,
  splitSentences,
  extractCandidates,
  extractionSummary,
  isAiWorded,
  authorLine,
  type TranscriptTurn,
  type Candidate,
  type ExtractionResult,
} from './extract';

export type {
  Authorship,
  CognitiveFrame,
  Comprehension,
  ComprehensionState,
  Crossing,
  CrossingKind,
  ElementWorld,
  FrameElement,
  FrameStatus,
  SealBlock,
  SealResult,
  SealedConfidence,
  Settlement,
  SignalBinding,
  SignalReading,
} from './types';
