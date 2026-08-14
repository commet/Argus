/**
 * 계측기가 제품의 말을 지우지 못하게 한다.
 *
 *   node evals/model-channel.mjs
 *
 * 여정 하네스(first-user-journey)가 피검체 모델에게 넘기는 **채널**의 정본이자,
 * 그 채널이 무손실인지 검사하는 게이트다. 둘을 한 파일에 둔 것은 의도다 —
 * 변환이 이 파일에만 있으면 하네스와 게이트가 다른 것을 잴 수 없다.
 *
 * WHY. 같은 계열의 결함이 세 번 반복됐고, 매번 **제품이 아니라 계측기가**
 * 만든 거짓이었다. 셋 다 "조용히 잘랐다"는 한 가지 모양이다:
 *
 *   1. (2026-08-11) 페르소나 발화가 max_tokens에서 잘려 한국어 실행이 0/4로
 *      기록됐다. 어시스턴트는 "문장이 끊겼어요"라고 옳게 답했는데 점수만 읽으면
 *      "제품이 실패한다"가 된다.
 *   2. (2026-08-12, PR #380) 거절 봉투에서 `recovery`와 `data`를 버렸다. 그래서
 *      한 세션 내내 쓴 복구문이 측정에서 **한 번도 모델에 닿지 않았다.**
 *      하네스만 고치자 같은 발행 패키지에서 정산이 0/3 → 3/3이 됐다.
 *   3. (2026-08-12, 이 파일) 도구 표면을 700/200자로 잘라 넘겼다. 실측:
 *      발행본 2.0.23의 도구 표면 11,946B 중 **3,473B(29%)가 삭제된 채** 모델에
 *      도달했다 — 필드 설명 9개 1,181자, enum 14곳 54개 값. 무엇이 잘렸는지가
 *      특히 나쁘다 —
 *        · `argus_resolve.outcome`: 449자 손실. held/avoided/partial/missed를
 *          가르는 정의 용어집 전체가 "Definition"에서 잘렸고, 스키마를
 *          {type, description}으로 재조립하면서 **enum 다섯 값도 사라졌다.**
 *        · `argus_capture.action`: enum 8개 값(open/add_context/…/close)이
 *          통째로. 포착 도구의 동작 어휘 전부다.
 *        · `argus_predict.predicate`: 147자 손실. 묶음을 만났을 때 무엇을 하라는
 *          지시와 좋은/나쁜 예시가 절 중간에서 잘렸다.
 *        · `premises[].text`(287자) 등 중첩 필드는 잘린 게 아니라 **0자 도달** —
 *          재조립이 상위 properties만 옮겼다.
 *      그 상태로 잰 "묶음 봉인이 남는다"·"정산이 빗나간다"는 전부 제품이 아니라
 *      이 절단에 대한 관찰이었다.
 *
 * 세 번 다 사후에야 알았다. 지금까지 이걸 빨간불로 만드는 것은 아무것도 없었다.
 * 그래서 이 게이트가 있다.
 *
 *   C1 도구 설명이 한 글자도 빠짐없이 모델에 도달한다
 *   C2 필드 설명이 한 글자도 빠짐없이 모델에 도달한다
 *   C3 값 제약(enum)이 스키마 재조립에 지워지지 않는다
 *   C4 성공 응답의 모델 대면 본문이 `data`를 담는다 (surface만이 아니라)
 *
 * C4가 오늘의 결함을 정확히 겨눈다: 봉인 성공 봉투에는 `data.id`와
 * `data.open_predictions[{id,predicate,check_by}]`가 들어 있는데 `surface`는
 * 술어와 날짜만 말하고 id는 한 번도 말하지 않는다. surface만 넘기면 모델은
 * 정산 때 id를 알 길이 없어 술어에서 지어내고 NO_PRIOR_SEAL을 맞는다.
 * 제품은 id를 주고 있었고 계측기가 버렸다.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── 채널 정본 (하네스가 import 한다) ─────────────────────────────────────────

/**
 * tools/list를 모델 컨텍스트로 옮기는 변환. 실제 호스트는 페이로드를 통째로
 * 넣는다 — 도구 표면에 17,000B 예산 테스트가 있는 이유가 그것이다. 예산 안에서
 * 고른 문장을 계측기가 다시 자르면, 무엇을 고르든 의미가 없어진다.
 */
export function toolsForModel(toolList) {
  return toolList.map((t) => ({
    name: t.name,
    description: t.description ?? '',
    input_schema: t.inputSchema ?? { type: 'object', properties: {} },
  }));
}

/**
 * 도구 결과를 모델 컨텍스트로 옮기는 변환. envelope()와 toolError()는 대칭으로
 * `content[0].text`에 봉투 전문을 JSON으로 싣고, 실제 호스트는 그것을 모델에게
 * 보여준다. 성공만 `surface`로 줄이면 손잡이(id·saved_ids·claims)가 사라진다.
 */
export function resultForModel(result) {
  const text = result?.content?.[0]?.text;
  if (typeof text === 'string' && text.length) return text;
  return JSON.stringify(result?.structuredContent ?? result ?? {});
}

// ── 게이트 ───────────────────────────────────────────────────────────────────

/** 서버가 내보낸 문장 중 모델 채널에서 사라진 것을 찾는다. */
export function channelViolations(toolList) {
  const forModel = toolsForModel(toolList);
  const out = [];
  let checks = 0;
  // 삭제된 **산문 글자 수**만 센다. 봉투 바이트 차이를 그냥 빼면 annotations나
  // outputSchema처럼 일부러 안 넘기는 구조까지 "삭제"로 세어, 게이트가 자기
  // 숫자로 거짓말을 하게 된다.
  let lostChars = 0;

  for (const tool of toolList) {
    const mine = forModel.find((t) => t.name === tool.name);
    checks++;
    if (!mine) { out.push(`C1 ${tool.name}: 도구가 채널에서 통째로 사라짐`); continue; }

    const desc = String(tool.description ?? '');
    checks++;
    if (desc && !String(mine.description).includes(desc)) {
      lostChars += Math.max(0, desc.length - String(mine.description).length);
      out.push(`C1 ${tool.name}: 도구 설명 ${desc.length}자 중 ${String(mine.description).length}자만 도달`);
    }

    // 중첩까지 내려간다 (premises[] 안의 필드들이 여기 산다). 지금 변환은
    // inputSchema를 그대로 넘기니 top-level만 봐도 초록이지만, "지금 구조상
    // 안전하니 얕게 봐도 된다"는 것이 게이트가 거짓말을 시작하는 방식이다.
    walk(tool.inputSchema, mine.input_schema, `${tool.name}`);
  }

  // 실경로의 toolList는 파싱된 JSON이라 순환이 있을 수 없지만, 순환이 오면 이
  // 함수는 "Maximum call stack size exceeded"로 죽는다 — 게이트가 자기가 못 본
  // 것을 이름 없이 터뜨리는 셈이다. 깊이를 재서 이름 붙여 돌려준다.
  function walk(served, reached, at, depth = 0) {
    if (!served || typeof served !== 'object') return;
    if (depth > 12) {
      checks++;
      out.push(`C2 ${at}: 스키마가 12단계보다 깊거나 순환이다 — 이 게이트가 끝까지 못 봤다`);
      return;
    }
    for (const [field, spec] of Object.entries(served.properties ?? {})) {
      const got = reached?.properties?.[field];
      const fieldDesc = String(spec?.description ?? '');
      checks++;
      if (fieldDesc && !String(got?.description ?? '').includes(fieldDesc)) {
        const reachedDesc = String(got?.description ?? '');
        lostChars += Math.max(0, fieldDesc.length - reachedDesc.length);
        out.push(`C2 ${at}.${field}: 필드 설명 ${fieldDesc.length}자 중 ${reachedDesc.length}자만 도달`);
      }
      if (Array.isArray(spec?.enum)) {
        checks++;
        if (!Array.isArray(got?.enum) || got.enum.length !== spec.enum.length) {
          out.push(`C3 ${at}.${field}: enum ${spec.enum.length}개 값이 채널에서 사라짐 (${JSON.stringify(spec.enum)})`);
        }
      }
      walk(spec?.items, got?.items, `${at}.${field}[]`, depth + 1);
      walk(spec, got, `${at}.${field}`, depth + 1);
      for (const branch of ['anyOf', 'oneOf', 'allOf']) {
        (spec?.[branch] ?? []).forEach((s, i) => walk(s, got?.[branch]?.[i], `${at}.${field}.${branch}[${i}]`, depth + 1));
      }
    }
  }

  return { checks, violations: out, lostChars };
}

/** 이 파일을 직접 실행했을 때만 게이트로 돈다 (하네스는 import만 한다). */
if (path.resolve(process.argv[1] ?? '') === path.resolve(fileURLToPath(import.meta.url))) {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

  if (process.env.MODEL_CHANNEL_SKIP_BUILD !== '1') execSync('npm run build', { cwd: ROOT, stdio: 'ignore' });

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-channel-'));
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (typeof v === 'string') env[k] = v;
  env['ARGUS_DIR'] = path.join(dir, '.argus');
  env['ARGUS_HOME'] = dir;

  const client = new Client({ name: 'model-channel-gate', version: '1' }, { capabilities: {} });
  await client.connect(new StdioClientTransport({
    command: process.execPath, args: [path.join(ROOT, 'dist', 'index.js')], env,
  }));

  const toolList = (await client.listTools()).tools;
  const { checks: surfaceChecks, violations, lostChars } = channelViolations(toolList);
  let checks = surfaceChecks;

  // C4 — 성공 봉투의 손잡이가 모델 대면 본문에 남는가. 오늘의 결함을 그대로
  // 재연한다: 봉인은 성공하고, surface는 id를 말하지 않고, data는 말한다.
  const id = 'model-channel-gate-probe';
  const sealed = await client.callTool({
    name: 'argus_predict',
    arguments: {
      argus_dir: env['ARGUS_DIR'], id,
      predicate: 'Cutover downtime stays under 5 minutes.',
      check_by: '2099-01-01', predicate_owner: 'user',
    },
  });
  const forModel = resultForModel(sealed);
  const surface = String(sealed.structuredContent?.surface ?? '');
  // 봉인이 실제로 성공했는지 먼저 확인한다. 거절 봉투에도 data와 사용자 입력이
  // 실리므로, 이걸 빼면 봉인이 죽어도 C4가 통과하는 가짜 초록이 된다 — 이번
  // 세션의 자동 리뷰가 잡은 것과 정확히 같은 결함(성공을 전제한 단언).
  checks++;
  if (sealed.structuredContent?.ok !== true) {
    violations.push(`C4 argus_predict: 봉인 자체가 실패해 채널을 검사할 수 없다 — ${String(sealed.content?.[0]?.text ?? '').slice(0, 200)}`);
  }
  checks++;
  if (!forModel.includes(id)) {
    violations.push(`C4 argus_predict: 모델 대면 본문에 봉인 id("${id}")가 없다 — 정산 때 지어낼 수밖에 없다`);
  }
  checks++;
  if (surface.includes(id)) {
    // 그렇다면 이 게이트의 전제(surface는 id를 말하지 않는다)가 바뀐 것이다.
    // 결함은 아니지만 근거가 낡았으니 사람이 봐야 한다.
    console.log(`  note surface가 이제 id를 직접 말한다 — C4의 근거 문단을 갱신할 것`);
  }
  checks++;
  if (!forModel.includes('"data"')) {
    violations.push('C4 argus_predict: 모델 대면 본문에 data가 통째로 없다 (surface만 넘기고 있다)');
  }

  await client.close();
  fs.rmSync(dir, { recursive: true, force: true });

  for (const v of violations) console.log(`  FAIL ${v}`);
  const wire = Buffer.byteLength(JSON.stringify(toolsForModel(toolList)), 'utf8');
  // 위반이 있는데 "무손실"이라고 인쇄하면, 이 게이트가 이 게이트가 막으려는 바로
  // 그 짓을 하는 것이다. 상태에 따라 문장을 바꾼다.
  console.log(violations.length
    ? `\n모델 채널: 도구 ${toolList.length}종 · ${wire}B 전달 · 설명 ${lostChars}자가 모델에 닿지 못함`
    : `\n모델 채널: 도구 ${toolList.length}종 · ${wire}B 무손실 전달`);
  console.log(`${checks} checks · ${violations.length} violations`);
  process.exit(violations.length ? 1 : 0);
}
