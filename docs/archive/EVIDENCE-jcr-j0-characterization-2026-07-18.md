# JCR J0 Characterization Evidence

> 상태: **J0 implementation baseline**
> 기준: `main@cd960536`
> 실행 정본: `DESIGN-judgment-continuity-runtime-v1-2026-07-18.md`
> fixture: `src/lib/__tests__/jcr-j0-characterization.test.ts`

## 1. 목적

J1 이후의 수정이 “좋아 보인다”가 아니라 실제 구조적 debt를 제거했는지 비교할 수 있도록
현재 동작을 고정한다. `known debt` fixture가 green이라는 사실은 현재 위반의 실재를
확인한다는 뜻이며 동작을 승인한다는 뜻이 아니다.

## 2. 기준선

| ID | 현재 사실 | source | 제거 공정 |
|---|---|---|---|
| J0-D1 | support minimum이 서로 다른 model lineage 3개를 요구 | `src/lib/epistemic/control-plane.ts` | J1 |
| J0-D2 | `SupportUnit`/causal cluster가 없음 | `src/lib/epistemic/types.ts` | J1 |
| J0-D3 | memory renderer가 control-plane 내부 string builder | `src/lib/epistemic/control-plane.ts` | J1 |
| J0-D4 | explicit recall/background influence purpose가 타입으로 분리되지 않음 | `src/lib/epistemic/types.ts` | J1 |
| J0-D5 | conflict exclusion state가 없음 | `src/lib/epistemic/types.ts` | J1 |
| J0-D6 | background sweep의 production caller가 없음 | `argus-mcp/src/v2/harvest.ts` | J6 |
| J0-D7 | SessionStart는 실제 consumer 없이 background 처리 문구를 냄 | `argus-plugin-v2/hooks/session-start.js` | J6 |
| J0-D8 | foreground scan과 background가 다른 extractor/writer | plugin ledger + MCP harvest | J6 |
| J0-D9 | account export는 table rows뿐이며 restore가 없음 | account export/settings | J8 |
| J0-D10 | authority/use/artifact user tables가 없음 | `src/lib/user-data-tables.ts` | J4 |
| J0-D11 | legacy Rehearse가 synthetic consensus를 씀 | E-B4 baseline | J2 |
| J0-D12 | strongest dissent/unknowns가 구조적으로 필수가 아님 | E-B5 baseline | J2 |

## 3. 구현 경계

### J1 allowlist

- `src/lib/epistemic/types.ts`
- `src/lib/epistemic/control-plane.ts`
- 신규 `src/lib/epistemic/prompt-renderer.ts`
- `src/lib/__tests__/epistemic-agency-e2-control-plane.test.ts`
- `src/lib/__tests__/jcr-j0-characterization.test.ts`

### J1에서 수정하지 않음

- Supabase migrations/account endpoints
- plugin/MCP harvest
- Rehearse/plugin E4 schemas
- E3B UI
- K v4 namespace
- O3 command/seat-first Boss contract

## 4. fixture 전환 규칙

1. J1은 J0-D1~D5의 `known debt` assertion을 삭제하지 않는다.
2. fixing commit에서 같은 test id를 blocking non-regression assertion으로 뒤집는다.
3. J2/J4/J6/J8 debt는 해당 공정 전까지 characterization으로 유지한다.
4. source wording만 바꿔 detector를 피하지 않는다. runtime behavior test를 함께 둔다.
5. J1 후에도 grant 0 default, scope/revoke/counterexample/trace fail-closed는 유지한다.

## 5. rollback point

J1은 storage schema나 canonical home을 바꾸지 않는다. rollback은 E2 localStorage projection과
기존 control-plane으로 즉시 돌아갈 수 있어야 한다. 새 SupportUnit을 optional migration
input으로 시작하되, old record를 user authority로 보강하거나 존재하지 않은 independence를
합성하지 않는다.
