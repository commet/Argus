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

// --- screen compositions (design-sync-only, NOT production code; added 2026-06-25) ---
export { WorkspaceHome } from './_screens/WorkspaceHome';
export { WorkspaceHomeA } from './_screens/WorkspaceHomeA';
export { WorkspaceHomeB } from './_screens/WorkspaceHomeB';
export { WorkspaceHomeC } from './_screens/WorkspaceHomeC';
