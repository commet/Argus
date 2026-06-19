// Generated bundle entry for design-sync (synth-entry shape).
// Re-exports all scoped components so esbuild bundles them onto window.ArgusDS.
// Passed via --entry; mirrors componentSrcMap in config.json. Regenerate if scope changes.

// MUST be first: shims `process` before Next's app-router-context evaluates it.
import './_process-shim';

// --- design-sync preview provider (not a card; wired via cfg.provider) ---
export { DesignRouterProvider } from './_design-providers';

export { Button } from '../src/components/ui/Button';
export { Card } from '../src/components/ui/Card';
export { Badge } from '../src/components/ui/Badge';
export { Field } from '../src/components/ui/Field';
export { Modal } from '../src/components/ui/Modal';
export { Tab } from '../src/components/ui/Tab';
export { ModeToggle } from '../src/components/ui/ModeToggle';
export { StepEntry } from '../src/components/ui/StepEntry';
export { LoadingSteps } from '../src/components/ui/LoadingSteps';
export { AnimatedPlaceholder } from '../src/components/ui/AnimatedPlaceholder';
export { SyncStatus } from '../src/components/ui/SyncStatus';
export { ForkLimitToast } from '../src/components/ui/ForkLimitToast';
export { StorageErrorToast } from '../src/components/ui/StorageErrorToast';
export { Compass } from '../src/components/landing/voyage/illustrations/Compass';
export { ForkPath } from '../src/components/landing/voyage/illustrations/ForkPath';
export { SailingShip } from '../src/components/landing/voyage/illustrations/SailingShip';
export { ShipCutaway } from '../src/components/landing/voyage/illustrations/ShipCutaway';
export { HelmScene } from '../src/components/landing/voyage/illustrations/HelmScene';
export { Cartouche } from '../src/components/landing/voyage/ui/Cartouche';
export { PlateLabel } from '../src/components/landing/voyage/ui/PlateLabel';
export { StationCard } from '../src/components/landing/voyage/ui/StationCard';
export { HorizonGlow } from '../src/components/landing/voyage/atmosphere/HorizonGlow';
export { PaperGrain } from '../src/components/landing/voyage/atmosphere/PaperGrain';
export { SeaRipples } from '../src/components/landing/voyage/atmosphere/SeaRipples';

// --- landing sections (added 2026-06-18) ---
export { SirenHero } from '../src/components/landing/SirenHero';
export { LandingHeader } from '../src/components/landing/LandingHeader';
export { Act1Voyage } from '../src/components/landing/voyage/Act1Voyage';
export { Act2DecisionVoyage } from '../src/components/landing/voyage/Act2DecisionVoyage';
export { Act3OnDeck } from '../src/components/landing/voyage/Act3OnDeck';

// --- ui components (added 2026-06-18) ---
export { CopyButton } from '../src/components/ui/CopyButton';
export { EmailButton } from '../src/components/ui/EmailButton';
export { ExecutionReadiness } from '../src/components/ui/ExecutionReadiness';
export { GuidedInput } from '../src/components/ui/GuidedInput';
export { InterviewInput } from '../src/components/ui/InterviewInput';
export { NextStepGuide } from '../src/components/ui/NextStepGuide';
export { OutputSelector } from '../src/components/ui/OutputSelector';
export { RateLimitBadge } from '../src/components/ui/RateLimitBadge';
export { ShareBar } from '../src/components/ui/ShareBar';
export { SlackChannelPicker } from '../src/components/ui/SlackChannelPicker';

// --- chart/voyage illustration primitives from VoyageElements.tsx (added 2026-06-18) ---
export { Graticule, ChartEdge, VoyageShip } from '../src/components/ui/VoyageElements';

// --- workspace/app surfaces (added 2026-06-19) ---
export { ReframeStep } from '../src/components/workspace/ReframeStep';
export { QuestionDiff } from '../src/components/workspace/QuestionDiff';
export { StepIntro } from '../src/components/workspace/StepIntro';
export { RehearseStep } from '../src/components/workspace/RehearseStep';
export { InteractiveDemo } from '../src/components/workspace/InteractiveDemo';
export { WorkflowGraph } from '../src/components/workspace/WorkflowGraph';
export { QuickChatBar } from '../src/components/workspace/QuickChatBar';
export { FinalCard } from '../src/components/workspace/progressive/FinalCard';
export { BranchMap } from '../src/components/workspace/progressive/BranchMap';
export { WorkerReportBlock } from '../src/components/workspace/progressive/WorkerCard';
export { CrisisConcernBanner } from '../src/components/workspace/progressive/CrisisConcernBanner';
export { MixPreview } from '../src/components/workspace/progressive/MixPreview';
export { TypingDots, AvatarRipple, ShimmerBar, AttentionFlash } from '../src/components/workspace/progressive/shared/AgentVisuals';
export { QuestionCard } from '../src/components/workspace/progressive/shared/QuestionCard';
export { UpdateSummaryChip } from '../src/components/workspace/progressive/shared/UpdateSummaryChip';
export { AnalysisCard } from '../src/components/workspace/progressive/shared/AnalysisCard';
export { WorkerPanel, WorkerDrawer } from '../src/components/workspace/progressive/WorkerPanel';
export { ProgressiveFlow } from '../src/components/workspace/progressive/ProgressiveFlow';
export { AgentSidebar } from '../src/components/workspace/progressive/AgentSidebar';
export { AttributedSection } from '../src/components/workspace/progressive/AttributedSection';
export { VerificationGate } from '../src/components/workspace/progressive/VerificationGate';
export { PingToast } from '../src/components/workspace/progressive/PingToast';
export { DMFeedback } from '../src/components/workspace/progressive/DMFeedback';
export { TrialSail } from '../src/components/workspace/progressive/TrialSail';
export { PersonaPoolModal } from '../src/components/workspace/progressive/PersonaPoolModal';
export { Falsification } from '../src/components/workspace/progressive/Falsification';
export { Logbook, LogbookDrawer } from '../src/components/workspace/progressive/Logbook';
export { WorkerAvatar, AvatarRow } from '../src/components/workspace/progressive/WorkerAvatar';
export { CurrentBearingCard } from '../src/components/workspace/progressive/CurrentBearingCard';
export { VoyageChart } from '../src/components/workspace/progressive/VoyageChart';
export { SealMoment } from '../src/components/workspace/progressive/SealMoment';
export { CrewAtWork } from '../src/components/workspace/progressive/CrewAtWork';
export { TeamDeployBanner } from '../src/components/workspace/progressive/TeamDeployBanner';
export { SynthesizeStep } from '../src/components/workspace/SynthesizeStep';
export { NavigatorStrip } from '../src/components/workspace/NavigatorStrip';
export { NavigatorInline } from '../src/components/workspace/NavigatorInline';
export { ContextChainBlock } from '../src/components/workspace/ContextChainBlock';
export { VersionHistoryDrawer } from '../src/components/workspace/VersionHistoryDrawer';
export { RecastStep } from '../src/components/workspace/RecastStep';
export { SettlementModal } from '../src/components/projects/SettlementModal';
export { DecisionContractCard } from '../src/components/projects/DecisionContractCard';
export { AgentCard } from '../src/components/agents/AgentCard';
export { PersonaRefinementSection } from '../src/components/agents/PersonaRefinementSection';
export { UnlockToast } from '../src/components/agents/UnlockToast';
export { AgentProfile } from '../src/components/agents/AgentProfile';
export { AgentHub } from '../src/components/agents/AgentHub';
export { CollectionProgress } from '../src/components/boss/CollectionProgress';
export { SajuPreview } from '../src/components/boss/SajuPreview';
export { PostVerdictPanel } from '../src/components/boss/PostVerdictPanel';
export { InnerMonologueCard } from '../src/components/boss/InnerMonologueCard';
export { VerdictShareCard } from '../src/components/boss/VerdictShareCard';
export { BossSetup } from '../src/components/boss/BossSetup';
export { BossConfirmation } from '../src/components/boss/BossConfirmation';
export { PastVerdictRecap } from '../src/components/boss/PastVerdictRecap';
export { DailyMoodIndicator } from '../src/components/boss/DailyMoodIndicator';
export { TypeToggle } from '../src/components/boss/TypeToggle';
export { BehavioralToggle } from '../src/components/boss/BehavioralToggle';
export { BossChat } from '../src/components/boss/BossChat';
export { ChatMessage } from '../src/components/boss/ChatMessage';
export { Footer } from '../src/components/layout/Footer';
export { Header } from '../src/components/layout/Header';
export { Sidebar } from '../src/components/layout/Sidebar';
export { FeedbackRequest } from '../src/components/tools/FeedbackRequest';
export { PersonaAvatar, FeedbackMessage } from '../src/components/tools/FeedbackMessage';
export { PersonaCard } from '../src/components/tools/PersonaCard';
export { DiscussionThread } from '../src/components/tools/DiscussionThread';
export { PersonaForm } from '../src/components/tools/PersonaForm';
export { FeedbackResult } from '../src/components/tools/FeedbackResult';
