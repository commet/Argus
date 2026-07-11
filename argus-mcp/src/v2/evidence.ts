/**
 * 증거 포인터 (P6-1) — 정본 II-C의 구현, P0 스파이크 evidence-pointer의 졸업.
 *
 * 계약 (스파이크에서 실증한 것):
 *  - offset은 **UTF-8 byte** 기준 (문자 index 아님 — 한글에서 실측으로 갈라짐).
 *  - 지문은 전체 파일 해시가 아니라 **prefix 해시** — transcript가 계속
 *    자라도(append) 검증이 깨지지 않는다. prefix는 quote 끝까지 덮어서
 *    quote 본문도 지문 안에 들어간다.
 *  - 대조 실패는 조용한 강등이 아니라 **QUOTE_NOT_FOUND 명시 값** — 호출자가
 *    반드시 분기해야 한다 (byte_verified를 사칭할 방법이 없다: zod가
 *    byte_verified에 evidence를 강제하고, evidence는 여기서만 발행된다).
 *  - byte_verified ≠ 안전 — 렌더 전 sanitize(규칙 19)는 별도 단계다.
 */
import { createHash } from 'node:crypto';

export const HOST_SCHEMA_VERSION = 'claude-code-transcript-1';
/** raw bytes 그대로 대조 — 정규화 없음. 정규화를 도입하면 버전을 올린다. */
export const NORMALIZATION_VERSION = 'raw-bytes-1';

const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex');

export interface EvidencePointer {
  host_schema_version: string;
  source_ref: string;
  source_prefix_length: number;
  source_prefix_sha256: string;
  role: 'user' | 'assistant';
  quote_byte_start: number;
  quote_byte_end: number;
  raw_quote: string;
  raw_quote_sha256: string;
  normalization_version: string;
}

/** source 안에서 quote를 byte 대조로 찾아 포인터를 발행한다.
 *  없으면 null — 포인터 없는 byte_verified는 존재할 수 없다 (사칭 봉쇄). */
export function makeEvidencePointer(
  source: Buffer, sourceRef: string, quote: string, role: 'user' | 'assistant',
): EvidencePointer | null {
  const qb = Buffer.from(quote, 'utf8');
  if (qb.length === 0) return null;
  const start = source.indexOf(qb);
  if (start < 0) return null;
  const end = start + qb.length;
  return {
    host_schema_version: HOST_SCHEMA_VERSION,
    source_ref: sourceRef,
    source_prefix_length: end,
    source_prefix_sha256: sha256(source.subarray(0, end)),
    role,
    quote_byte_start: start,
    quote_byte_end: end,
    raw_quote: quote,
    raw_quote_sha256: sha256(qb),
    normalization_version: NORMALIZATION_VERSION,
  };
}

/** 재검증 — 파일이 자랐어도 prefix 지문으로 판정. 실패는 명시 값. */
export function verifyEvidencePointer(
  source: Buffer, ptr: EvidencePointer,
): 'byte_verified' | 'QUOTE_NOT_FOUND' {
  if (source.length < ptr.source_prefix_length) return 'QUOTE_NOT_FOUND';
  if (sha256(source.subarray(0, ptr.source_prefix_length)) !== ptr.source_prefix_sha256) return 'QUOTE_NOT_FOUND';
  if (sha256(source.subarray(ptr.quote_byte_start, ptr.quote_byte_end)) !== ptr.raw_quote_sha256) return 'QUOTE_NOT_FOUND';
  return 'byte_verified';
}
