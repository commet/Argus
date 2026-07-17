import type { AuthorityCommand, AuthorityCommandReceipt } from './commands';
import type { ArtifactDescriptor, ArtifactState } from './artifacts';
import type { AuthorityEvent } from './events';
import type {
  InfluenceUseReservation,
  ReserveInfluenceUse,
} from './use-receipts';

export interface EpistemicAuthorityGateway {
  execute(command: unknown): AuthorityCommandReceipt;
  readEvents(claimId: string): readonly AuthorityEvent[];
}

export interface AuthorityCommandOutboxPort {
  enqueue(command: AuthorityCommand): Promise<void>;
  acknowledge(commandId: string): Promise<void>;
}

export interface InfluenceUseReceiptPort {
  reserve(input: ReserveInfluenceUse): InfluenceUseReservation;
  markDispatch(receiptId: string, state: 'dispatched' | 'provider_failed'): boolean;
}

export interface ArtifactGateway {
  stage(descriptor: ArtifactDescriptor): Promise<void>;
  transition(
    artifactId: string,
    state: ArtifactState,
    verification?: { sha256: string; byte_length: number },
  ): Promise<ArtifactDescriptor>;
}

export interface CandidateExtractorPort<TSource = unknown, TCandidate = unknown> {
  extract(source: TSource): Promise<readonly TCandidate[]>;
}

export interface LocalSearchPort<TDocument = unknown, TQuery = unknown, TResult = unknown> {
  replace(documents: readonly TDocument[]): Promise<void>;
  search(query: TQuery): Promise<readonly TResult[]>;
  health(): Promise<{ ready: boolean; detail?: string }>;
}
