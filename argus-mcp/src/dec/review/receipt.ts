import { foldDecisions } from '../fold.js';
import { planInjection } from '../inject/select.js';
import type { EmitResult } from '../export/emit.js';

/**
 * 영수증 — **닫고 나면 무엇이 달라졌는지 말한다** (기획 v5 §"정산").
 *
 * 정산은 답 한 줄로 끝나는데, 그 한 줄이 어디로 갔는지 안 보이면 사람은
 * 자기가 방금 한 일이 무슨 일인지 모른다. 기획서의 예시가 그 형태다 —
 * *"규칙 1개 은퇴 → 활성 12개, 교훈 1줄이 내일 아침 주입됩니다."*
 *
 * **약속하지 않고 잰다.** 교훈이 다음에 앞에 나오는 자리는 2개뿐이다
 * (`inject/select.ts` 의 `SLOT_SIZE.lesson`). 그래서 "주입됩니다"라고 적어
 * 두면 자리가 찬 날에는 그 문장이 거짓이 된다. 대신 **실제로 뽑아 보고**
 * 뽑혔을 때만 나온다고 말한다 — 이 저장소가 반복해서 겪은 병(생산된 필드가
 * 아무도 안 읽는 채로 약속만 남는 것)의 반대편이다.
 */

export interface ReceiptFacts {
  id: string;
  outcome: 'keep' | 'later' | 'sunset';
  next_review?: string;
  lesson_written: boolean;
  prevented_written: boolean;
  exported: EmitResult;
}

const OUTCOME_SAY: Record<ReceiptFacts['outcome'], (r: ReceiptFacts) => string> = {
  keep: (r) => `${r.id} 을 그대로 둔다. 다음에 볼 날은 ${r.next_review}.`,
  later: (r) => `${r.id} 은 지금 정하지 않는다. ${r.next_review}에 다시 묻는다.`,
  sunset: (r) => `${r.id} 을 그만둔다. 이제 법이 아니다.`,
};

export function sayReceipt(argusDir: string, facts: ReceiptFacts, today: string): string[] {
  const fold = foldDecisions(argusDir);
  const live = fold.records.filter((r) => r.status === 'active').length;
  const lines: string[] = [OUTCOME_SAY[facts.outcome](facts)];

  lines.push(live === 0
    ? '  이제 살아 있는 결정이 없다.'
    : `  살아 있는 결정은 ${live}개다.`);

  if (facts.lesson_written) {
    // **재 본다** — 적었다고 반드시 나오는 것이 아니다 (창이 15개로 잘린다).
    //
    // 처음엔 `slot === 'lesson'` 인지 봤는데 **그게 틀렸다.** 교훈 줄은
    // `inject/say.ts` 가 **뽑힌 결정이면 어느 자리든** 렌더한다. 교훈 자리는
    // 교훈 때문에 *추가로* 뽑아 주는 자리일 뿐이다. 그래서 rotation 으로 이미
    // 뽑힌 결정은 교훈 자리에 못 가고, 나는 "자리가 차 있다"고 **거짓을 적었다**
    // — 화면을 눈으로 읽어서 잡았다 (2026-09-10). 뽑혔는지만 보면 된다.
    const plan = planInjection(fold.records, { cwd_rel: '', today, max: 15, last_shown: undefined });
    const willShow = plan.picks.some((p) => p.record.id === facts.id);
    lines.push(willShow
      ? '  배운 것 한 줄을 적었다 — 다음에 열 때 이 결정과 함께 앞에 나온다.'
      : '  배운 것 한 줄을 적었다 — 결정 파일에 남는다. 다음에 열 때 이 결정이 창에 안 들어오면 안 보인다.');
  }
  if (facts.prevented_written) {
    lines.push('  이게 뭘 막았는지도 적었다. 결정 파일에 남는다.');
  }

  // 방출본이 따라갔나 — 안 따라갔으면 **그 사실이 중요하다** (남의 도구가
  // 읽는 파일이 옛 법을 들고 있게 된다).
  if (facts.exported.action === 'written') {
    lines.push('  같이 읽히는 파일도 고쳤다.');
  } else if (facts.exported.action === 'held') {
    lines.push('  같이 읽히는 파일은 누가 손으로 고쳐 놔서 안 건드렸다 — `dec-export --check` 로 본다.');
  }

  return lines;
}
