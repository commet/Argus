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
  parseTranscript,
  splitSentences,
  extractCandidates,
  extractionSummary,
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
