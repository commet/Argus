/**
 * 여정 하네스의 시계 — 세션2를 "확인일이 온 날"로 옮기기 위한 날짜 하나.
 *
 * WHY THIS FILE EXISTS (계측기 결함 6호, 2026-08-18).
 * 이 하네스의 15바퀴가 `plan_check` 를 한 번도 못 본 이유는 모델이 아니라
 * 계측기였다. 7단계 "재시작"은 **프로세스** 재시작이지 날짜 이동이 아니어서,
 * `+7d` 로 채택된 단계의 확인일이 온 적이 없다. 확인일이 안 오면 `check_in`
 * 은 옳게 침묵하고, 침묵하면 모델은 부를 계기가 없다.
 *
 * WHY IT IS A MODULE, NOT INLINE. 인라인이면 이 계산은 **모델 없이는 한 번도
 * 실행되지 않는다** — API 키가 있는 환경에서 라이브 여정을 돌릴 때만 돈다.
 * 시계가 틀리면 그때 나오는 빨간불을 제품 결함으로 오독하게 되고, 그것이
 * 정확히 이 파일이 고치려는 병이다. 여기 있으면 `plan-clock.test.ts` 가
 * 모델 없이 잰다. (같은 이유로 `model-channel.mjs` 가 분리돼 있다.)
 */
import fs from 'node:fs';
import path from 'node:path';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 원장 폴더 전체를 훑어 `plan_adopt` 의 날짜 붙은 단계들을 모은다. */
export function collectPlanDues(ledgerDir) {
  const dues = [];
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) { walk(fp); continue; }
      if (!e.name.endsWith('.jsonl')) continue;
      let text;
      try { text = fs.readFileSync(fp, 'utf8'); } catch { continue; }
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        let ev;
        // 파싱 불가 줄은 증거로 쓰지 않는다 (원장 읽기 전반의 규칙).
        try { ev = JSON.parse(line); } catch { continue; }
        if (ev?.event !== 'plan_adopt' || !Array.isArray(ev.steps)) continue;
        for (const st of ev.steps) {
          if (st && typeof st.due === 'string' && DATE.test(st.due)) dues.push(st.due);
        }
      }
    }
  };
  walk(ledgerDir);
  return dues;
}

/**
 * 세션2의 논리적 '오늘'. 없으면 null 이고, 그때 하네스는 시계를 옮기지 않는다.
 *
 * 가장 이른 확인일을 고르는 이유 둘: ① 도래 조건이 `due <= today` 라 그날
 * 당일이면 충분하다 ② 예약은 이른 순 `PLAN_MAX_SCHEDULED` 개이므로 **가장 이른
 * 단계는 언제나 `scheduled`** 다 — 임의의 단계를 골랐다가 예약 안 된 날짜로
 * 가면 아무것도 안 뜨고, 그것을 제품 침묵으로 오독하게 된다.
 */
export function earliestPlanDue(ledgerDir) {
  const dues = collectPlanDues(ledgerDir);
  if (!dues.length) return null;
  return dues.sort()[0];
}
