import {
  conservativeTokenizer,
  type TokenizerAdapter,
} from './context-compiler';

export type ProviderTokenCounter = (text: string, model: string) => number;

/**
 * Provider SDK/tokenizer integrations register here at the adapter edge. An
 * absent, throwing, or nonsensical provider counter always falls back to the
 * conservative deterministic counter; it never silently reports zero.
 */
export class TokenizerRegistry implements TokenizerAdapter {
  readonly name = 'provider-registry-with-conservative-fallback-v1';
  private readonly counters = new Map<string, ProviderTokenCounter>();

  register(provider: string, counter: ProviderTokenCounter): void {
    const key = provider.trim().toLowerCase();
    if (!key) throw new Error('TOKENIZER_PROVIDER_REQUIRED');
    this.counters.set(key, counter);
  }

  count(text: string, provider: string, model: string): number {
    const counter = this.counters.get(provider.trim().toLowerCase());
    if (counter) {
      try {
        const value = counter(text, model);
        if (Number.isInteger(value) && value > 0) return value;
      } catch {
        // Fall through to a conservative, deterministic estimate.
      }
    }
    return conservativeTokenizer.count(text, provider, model);
  }
}
