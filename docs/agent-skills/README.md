# Agent Skills — 세션용 참고 규칙집

skills.sh 생태계에서 선별해 들여온 규칙집이다 (전부 MIT, 문서 전용, 출처·해시는
`skills-lock.json`). 세션이 해당 작업을 하기 **전에** 읽는 것이 용법이다:

| 디렉토리 | 언제 읽나 |
|---|---|
| `supabase-postgres-best-practices/` | 스키마·컬럼·마이그레이션·RLS·인덱스 등 **Postgres를 만지기 전** (이 리포가 네 번 물린 조용한 실패 계열의 예방 규칙) |
| `vercel-react-best-practices/` | React/Next.js 성능 관점의 작성·리뷰·리팩터링 |
| `find-skills/` | 새 도메인의 스킬이 필요할 때 `npx skills find <검색어>` 사용법 |

## 왜 `.claude/skills/`가 아닌가

Claude Code가 자동 발견하는 `.claude/skills/`는 **플러그인 검증 게이트가 비어
있음을 강제한다** (`argus-plugin-v2/scripts/validate-plugin.js` — 리포 로컬
자동 발견 표면이 플러그인의 5-명령 계약을 조용히 우회할 수 있기 때문, v3
CHANGELOG 참조). 그래서 여기는 자동 로드가 아니라 **읽으러 오는 문서**다.
CLAUDE.md가 입구를 가리킨다.

## 갱신

원본이 갱신되면 `npx skills add <source> --skill <name> --copy` 로 임시 설치한 뒤
이 디렉토리로 옮기고 `skills-lock.json`의 해시를 함께 갱신한다. `.claude/skills/`
에 남겨두면 CI의 플러그인 검증이 빨간불이 된다.
