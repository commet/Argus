/** Deterministic PRNG (mulberry32) so every fuzz finding carries a repro seed. */
export class Rng {
  private state: number;

  constructor(readonly seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)]!;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  id(prefix: string): string {
    return `${prefix}-${Math.floor(this.next() * 0xffffffff).toString(16).padStart(8, '0')}${Math.floor(this.next() * 0xffffffff).toString(16).padStart(8, '0')}`;
  }

  uuid(): string {
    const hex = () => Math.floor(this.next() * 16).toString(16);
    const s = (n: number) => Array.from({ length: n }, hex).join('');
    return `${s(8)}-${s(4)}-4${s(3)}-a${s(3)}-${s(12)}`;
  }
}
