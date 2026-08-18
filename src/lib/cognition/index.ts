/**
 * 인지 구조 엔진 — 공개 표면.
 *
 * 재정초 브리프(`ARGUS-REFOUNDATION-BRIEF-2026-08-16`)의 원형 E+B 하이브리드를
 * **일곱 축 × 두 세계**로 일반화한 코어. 브리프가 검토한 "전제 단일축" 설계는
 * 문헌의 절반만 읽은 것이었다 — 판단은 프레임·값·전제·추론·확신·대안·반증
 * 조건으로 되어 있고, 축마다 기계에게 허용된 권한이 다르다 (`axes.ts` 참조).
 *
 * 이 모듈은 **순수**하다. 네트워크·시각·난수 없음. 지속은 `cognition-db.ts`,
 * 화면은 `/method-pilot` 이 담당한다.
 *
 * ── 이미 있는 능력과의 관계 (한 곳에 모아둔다) ───────────────────────
 *
 * 이 저장소에는 이 모듈이 건드리는 능력들이 **이미 살고 있다.** 무엇을 빌리고
 * 무엇을 왜 새로 짓는지 여기서 한 번에 밝힌다. (`docs/receipts/2026-08-16-
 * g-agent-argus/capability-survey.mjs` 가 이 언급을 기계로 강제한다.)
 *
 *   대화 로그 수집   `argus-mcp/src/v2/capture-cli.ts`·`harvest.ts` 가 정본.
 *                    훅이 transcript 경로를 자동으로 준다. 여기 `parseTranscript`
 *                    는 **입력 경로가 아니라 추출기**이고, 갈 자리는
 *                    `argus-mcp/src/v2/candidate-capture.ts` 의
 *                    `CandidateExtractorPort` 새 구현이다.
 *   후보 추출        같은 파일의 `deterministicCandidateExtractor` 가 턴당
 *                    `{quote, typed_span}` 하나를 낸다. 여기 `extractCandidates`
 *                    는 그것을 **일곱 축 + 저자 증명**으로 넓힌 것이다.
 *   저자성 판정      `src/lib/judgment-authorship.ts` 가 정본. `./authorship` 이
 *                    그것을 부르고 깊이(수정 거리·라운드)만 얹는다.
 *   전제 모델        `src/lib/premises-core.ts` 가 정본(결정 단위). `./premise`
 *                    는 그 위의 **지속 계층**이고 동일성 판정은
 *                    `normalizePremiseText()` 를 그대로 빌려 쓴다 — 이유는
 *                    `premise.ts` 헤더에 적어두었다.
 */
export {
  AXES,
  REQUIRED_AXES,
  LOAD_BEARING_AXES,
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
  axisCoverage,
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
  turnsFromOwnWriting,
  isAiWorded,
  authorLine,
  type TranscriptTurn,
  type Candidate,
  type ExtractionResult,
} from './extract';

export {
  SOURCES,
  DEFAULT_SOURCE,
  sourceSpec,
  sourceReport,
  turnsFromPluginCandidates,
  turnsFromPastedWriting,
  turnsFromTranscriptFile,
  type SourceId,
  type SourceSpec,
  type PluginCandidateRow,
} from './sources';

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
