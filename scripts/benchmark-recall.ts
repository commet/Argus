import { performance } from 'node:perf_hooks';
import { PureJsLocalSearchIndex, executeRecallQuery } from '../src/lib/epistemic/recall-index';
import type { RecallDocument } from '../src/lib/epistemic/recall-types';

async function main(): Promise<void> {
  const sizes = (process.env.ARGUS_RECALL_BENCH_SIZES ?? '1000,10000,100000')
    .split(',').map(Number).filter((value) => Number.isInteger(value) && value > 0 && value <= 100000);

  for (const size of sizes) {
  const documents: RecallDocument[] = Array.from({ length: size }, (_, index) => ({
    document_id: `judgment:bench:${index}`,
    kind: 'judgment',
    canonical_refs: [`semantic-event:${index}`],
    project_id: `project:${index % 20}`,
    authority: 'user',
    lifecycle_status: index % 9 === 0 ? 'superseded' : 'sealed',
    title: `Storage decision ${index}`,
    searchable_text: `We chose ${index % 3 === 0 ? 'postgres' : 'sqlite'} for session storage shard ${index % 100}.`,
    occurred_at: new Date(Date.UTC(2026, 0, 1) + index * 1000).toISOString(),
    source_hashes: [`source:${index % 500}`],
    sensitivity: 'sensitive',
    projection_version: 1,
  }));
  const index = new PureJsLocalSearchIndex();
  const replaceStart = performance.now();
  await index.replace(documents);
  const replaceMs = performance.now() - replaceStart;
  // Model steady-state index memory, not the rebuild moment where canonical
  // source documents and the freshly built projection coexist.
  documents.length = 0;
  const latencies: number[] = [];
  for (let run = 0; run < 25; run += 1) {
    const started = performance.now();
    await executeRecallQuery(index, {
      text: run % 2 === 0 ? 'postgres storage' : 'sqlite session',
      intent: 'explicit_recall',
      filters: { authorities: ['user'], lifecycle_statuses: ['sealed', 'superseded'] },
      limit: 5,
    }, '2026-07-18T00:00:00.000Z');
    latencies.push(performance.now() - started);
  }
  latencies.sort((a, b) => a - b);
  const memory = process.memoryUsage();
    process.stdout.write(JSON.stringify({
    documents: size,
    replace_ms: Number(replaceMs.toFixed(2)),
    query_p50_ms: Number(latencies[Math.floor(latencies.length * 0.5)].toFixed(2)),
    query_p95_ms: Number(latencies[Math.floor(latencies.length * 0.95)].toFixed(2)),
    heap_used_mb: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
    health: await index.health(),
    }) + '\n');
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
