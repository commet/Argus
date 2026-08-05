import fs from 'node:fs';

/**
 * 브라우저 실행 파일 경로 — 모든 Playwright 스크립트의 단일 출처.
 *
 * 왜 필요한가: 창업자 기기에는 Playwright가 자기 브라우저를 갖고 있지만,
 * 개발 샌드박스(클라우드 세션)는 고정 경로에 특정 빌드를 둔다. 이 함수 없이
 * `chromium.launch({ headless: true })`만 부르면 샌드박스에서 스크립트가
 * "Executable doesn't exist" 로 죽고 — 앱이 멀쩡한데 검사기가 실패한다.
 *
 * 2026-08-05 발견: e2e/decision-loop 와 e2e/public-surfaces 가 이 처리를
 * 빠뜨려 클라우드 세션에서 실행 불가였고, dogfood 쪽 두 스크립트는 같은
 * 헬퍼를 각자 복사해 갖고 있었다. 하나로 합친다.
 *
 * 반환값이 `undefined` 인 것이 정상 경로다 — Playwright 가 자기 설치본을
 * 찾게 두라는 뜻이며, launch 옵션에 그대로 넘겨도 안전하다.
 */
export function playwrightExecutablePath() {
  if (process.env.PW_EXECUTABLE) return process.env.PW_EXECUTABLE;
  const sandbox = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  return fs.existsSync(sandbox) ? sandbox : undefined;
}
