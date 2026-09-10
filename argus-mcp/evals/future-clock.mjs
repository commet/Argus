/**
 * 달력만 앞으로 민다 — 시계는 계속 흐른다 (경과시간 측정은 그대로 동작).
 *
 * `--import` 로 미리 실어서 vitest 워커까지 이 Date 를 쓰게 한다.
 * 왜 필요한지는 `test-future.mjs` 머리에 적었다.
 */
const RealDate = Date;

/**
 * 기본값은 **날짜가 아니라 거리**다 (오늘 +400일).
 *
 * 여기에 `'2027-03-01'` 이라고 적을 뻔했다 — 그러면 **이 계측기 자신이**
 * 잡으려는 바로 그 폭탄이 된다. 2027-03 이 지나면 "미래로 밀었다"는 것이
 * 거짓이 되고, 게이트는 아무것도 안 미룬 채 초록을 낸다.
 */
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
