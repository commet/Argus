import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * 인라인 표면 em-dash 금지 게이트 (1.4.6 재진단 발견).
 *
 * surface-no-em-dash.test.ts는 SURFACES 트리의 잎만 대조한다 — 그래서 툴 파일
 * 안에 인라인으로 지은 사용자 대면 문자열(recall의 빈-요약 문장, seal의 elicit
 * 폼 설명, premises의 확인 문장 등)에 em-dash cadence가 CI 사각으로 살아남았다.
 * 이 게이트는 그 사각을 덮는다:
 *
 *  - lib 사용자-카피 모듈(스키마 산문이 없는 파일들): 모든 문자열 리터럴 대조.
 *  - tools 파일: 한글이 든 리터럴만 대조 (영문 스키마 describe() 산문은
 *    모델-대면이라 대상 밖 — 하우스 스타일 금지는 사용자 표면 cadence다).
 *
 * 허용: 값-없음 글리프('—' 단독, '— (' 접두)와 리터럴 앞부분에 내용이 없는 경우.
 * 주석은 제거 후 검사한다 (소스 주석의 em-dash는 사용자에게 안 보인다).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', '..');

// 스키마 산문이 없는, 사용자-읽기 카피가 사는 lib 모듈들 — 전체 리터럴 대조.
const LIB_FULL_SCAN = [
  'lib/ambient-elicit.ts',
  'lib/locale-mismatch.ts',
  'lib/continuity.ts',
  'lib/localize-result.ts',
  'lib/telemetry.ts',
  'lib/validate-seal.ts',
  'lib/validate-crux.ts',
  'lib/state-machine.ts',
  'lib/numeric-drift.ts',
  'lib/surfaces.ts',
  'lib/render-receipt.ts',
  'lib/tool-presentation.ts',
  'lib/review/render.ts',
  'lib/review/routing.ts',
  'lib/review/extract-file-node.ts',
];

// 한글 리터럴만 대조하는 tools 파일들 (영문 describe() 산문은 모델-대면).
const TOOLS_KO_SCAN = [
  'tools/recall.ts',
  'tools/seal.ts',
  'tools/settle.ts',
  'tools/premises.ts',
  'tools/amend-dismiss.ts',
  'tools/recheck.ts',
  'tools/check-in.ts',
  'tools/open-decision.ts',
  'tools/review.ts',
  'tools/public-tools.ts',
  'tools/tool-types.ts',
  'tools/init-config.ts',
  'tools/errors.ts',
];

function stripComments(src: string): string {
  // 블록 주석은 줄 수를 보존하며 공백화, 라인 주석은 그 지점부터 제거.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => {
      // 문자열 안의 // (예: https://)를 오인하지 않게, 따옴표 밖의 //만 자른다.
      let inS: string | null = null;
      for (let i = 0; i < l.length; i++) {
        const ch = l[i];
        if (inS) {
          if (ch === '\\') i++;
          else if (ch === inS) inS = null;
        } else if (ch === '"' || ch === "'" || ch === '`') inS = ch;
        else if (ch === '/' && l[i + 1] === '/') return l.slice(0, i);
      }
      return l;
    })
    .join('\n');
}

function literalsWithEmDash(file: string): Array<{ line: number; literal: string }> {
  const src = stripComments(fs.readFileSync(path.join(SRC, file), 'utf8'));
  const out: Array<{ line: number; literal: string }> = [];
  src.split('\n').forEach((raw, i) => {
    if (!raw.includes('—')) return;
    // 템플릿 보간 ${...} 내부는 값 표현식이지 표면 카피가 아니다 — 안의
    // '—' 글리프(예: `${c.outcome ? label : '—'}`)가 오검출되지 않게 비운다.
    const l = raw.replace(/\$\{[^}]*\}/g, '${}');
    if (!l.includes('—')) return;
    // 같은 줄의 리터럴들을 단순 추출 (이 코드베이스의 표면 문자열은 한 줄이다).
    const re = /(["'`])((?:\\.|(?!\1).)*)\1/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(l)) !== null) {
      const body = m[2] ?? '';
      if (body.includes('—')) out.push({ line: i + 1, literal: body });
    }
  });
  return out;
}

// cadence = 리터럴 안에서 em-dash 앞에 내용이 있는 경우. 값-없음 글리프는 허용.
function isCadence(body: string): boolean {
  if (body === '—') return false;
  if (body.startsWith('— (')) return false;
  return /\S[^—]*—/.test(body);
}

describe('인라인 표면 em-dash cadence 금지 (SURFACES 트리 밖, 1.4.6 재진단)', () => {
  it('lib 사용자-카피 모듈의 문자열 리터럴에 cadence em-dash가 없다', () => {
    const offenders: string[] = [];
    for (const f of LIB_FULL_SCAN) {
      for (const hit of literalsWithEmDash(f)) {
        if (isCadence(hit.literal)) offenders.push(`${f}:${hit.line} ${hit.literal.slice(0, 80)}`);
      }
    }
    expect(offenders, `em-dash cadence가 남은 인라인 표면:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('tools 파일의 한글 문자열 리터럴에 cadence em-dash가 없다', () => {
    const offenders: string[] = [];
    for (const f of TOOLS_KO_SCAN) {
      for (const hit of literalsWithEmDash(f)) {
        if (/[가-힣]/.test(hit.literal) && isCadence(hit.literal)) {
          offenders.push(`${f}:${hit.line} ${hit.literal.slice(0, 80)}`);
        }
      }
    }
    expect(offenders, `em-dash cadence가 남은 한글 인라인 표면:\n${offenders.join('\n')}`).toEqual([]);
  });
});
