/**
 * 달력만 앞으로 민다 — 시계는 계속 흐른다 (경과시간 측정은 그대로 동작).
 *
 * **MIT 존의 `argus-mcp/evals/future-clock.mjs` 와 같은 것을 일부러 복제했다.**
 * 존을 넘어 import 하면 argus-mcp 를 따로 떼어 낼 때 루트가 깨지고, 반대로
 * 루트를 참조하게 하면 npm 으로 배포되는 패키지가 저장소에 매인다. 15줄이라
 * 복제가 결합보다 싸다. 한쪽을 고치면 다른 쪽도 고친다.
 *
 * 왜 필요한지는 `scripts/test-future.mjs` 머리에 적었다.
 */
const RealDate = Date;

/** 기본값은 **날짜가 아니라 거리**다 — 고정 날짜를 적으면 이 계측기 자신이 폭탄이 된다. */
const DEFAULT_DAYS = 400;
const target = process.env.FAKE_TODAY
  ? new RealDate(process.env.FAKE_TODAY).getTime()
  : RealDate.now() + DEFAULT_DAYS * 86_400_000;
const SHIFT = target - RealDate.now();

class ShiftedDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(RealDate.now() + SHIFT);
    else super(...args);
  }
  static now() { return RealDate.now() + SHIFT; }
}

globalThis.Date = ShiftedDate;
