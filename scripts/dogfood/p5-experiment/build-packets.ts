/**
 * P5 experiment — blind reconstruction packets.
 *
 * Takes the arm artifacts and produces, per (scenario, arm), a packet a blind
 * reconstructor can answer WITHOUT ever seeing ground truth or the original
 * conversation:
 *   - the arm's record ONLY (journal entries | ledger events + projection);
 *   - a fixed questionnaire;
 *   - a deterministic-shuffled probe list of factual items (mixing items known
 *     at seal with items that arrived later) for the hindsight test — labels
 *     are NOT included.
 *
 * Blindness scope note (recorded in the ADR): this cohort measures RECORD-ONLY
 * reconstruction. Neither arm's reconstructor gets the raw transcript, so the
 * comparison isolates record quality; transcript-search baselines (#1/#2 of the
 * preregistered list) are a separate, unrun condition.
 *
 * Usage: npx tsx scripts/dogfood/p5-experiment/build-packets.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { P5_SCENARIOS } from './scenarios';

const EVIDENCE = path.join('scripts', 'dogfood', 'p5-experiment', 'evidence');
const PACKETS = path.join('scripts', 'dogfood', 'p5-experiment', 'packets');

/** Deterministic shuffle (djb2 seed per scenario id) so runs are reproducible. */
function shuffle<T>(items: T[], seedText: string): T[] {
  let h = 5381;
  for (const ch of seedText) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

const QUESTIONNAIRE = `당신은 기록 감사인이다. 이 결정이 있고 몇 달이 지났고, 당신이 가진 것은 아래 record가 전부다.
record에 없는 것은 추측하지 말고 "unknown"으로 답하라 — unknown은 감점이 아니며, 근거 없는 확신이 감점이다.

각 질문에 JSON으로 답하라:
{
  "sealed_statement": "봉인된 판단문을 기록에서 찾은 그대로 (없으면 unknown)",
  "statement_origin": "그 문장을 처음 쓴 주체는? 'ai'(AI 초안을 그대로 채택) | 'human'(사용자 자신의 문장) | 'unknown'",
  "adopted_premises": ["봉인 당시 사용자가 채택한 전제들 (기록 근거가 있는 것만)"],
  "review_question": "돌아보기로 약속한 질문 (없으면 unknown)",
  "review_at": "약속한 확인일 YYYY-MM-DD (없으면 unknown)",
  "was_deferred": true | false | "unknown",
  "resolution_kind": "answered | indeterminate | moot | unknown",
  "answer_summary": "확인한 답의 요지 (없으면 unknown)",
  "criterion_result": "met | not_met | partial | not_applicable | none_recorded | unknown",
  "evidence_items": ["종결의 근거가 된 관찰들"],
  "was_separately_closed": true | false | "unknown",
  "probes": [{ "item": "<probe 문장 그대로>", "known_at_seal": true | false | "unknown" }]
}

probes 규칙: 각 항목에 대해 "이 사실/전제가 봉인 시점에 이미 기록에 존재했는가(사용자가 봉인 당시 알고 채택/인지했는가)"를
기록의 시간 정보만으로 판정하라. 기록이 시점을 구분해주지 않으면 unknown.`;

function main(): void {
  fs.rmSync(PACKETS, { recursive: true, force: true });
  for (const arm of ['baseline', 'dkk_v6'] as const) {
    fs.mkdirSync(path.join(PACKETS, arm), { recursive: true });
  }
  for (const s of P5_SCENARIOS) {
    const probes = shuffle(
      [
        ...s.truth.adopted_premises.map((p) => ({ item: p })),
        ...s.truth.post_seal_facts.map((f) => ({ item: f })),
      ],
      s.id,
    );
    for (const arm of ['baseline', 'dkk_v6'] as const) {
      const artifact = JSON.parse(
        fs.readFileSync(path.join(EVIDENCE, `${s.id}.${arm}.json`), 'utf8'),
      ) as { record: unknown };
      const packet = {
        packet_id: `${s.id}.${arm}`,
        questionnaire: QUESTIONNAIRE,
        probes: probes.map((p) => p.item),
        record: artifact.record,
      };
      fs.writeFileSync(path.join(PACKETS, arm, `${s.id}.json`), JSON.stringify(packet, null, 2));
    }
  }
  console.log(`packets → ${PACKETS}/{baseline,dkk_v6}/ (${P5_SCENARIOS.length} each)`);
}

main();
