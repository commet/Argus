import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_REGISTRY } from '@/lib/agent-registry';

/**
 * webapp ↔ plugin 로스터 패리티 (drift guard).
 *
 * 플러그인 argus-plugin-v2/data/agents.yaml은 webapp AGENT_REGISTRY를 손으로
 * 베낀 복제본이다. 헤더는 "one-way sync, regenerate via extract-from-webapp"라
 * 선언하지만 그 스크립트는 실재하지 않는다(glob extract* → 0건). 그래서 지금까지
 * 이 복제본을 읽는 테스트가 0개였다 — 두 surface(웹앱·플러그인)를 동시에 배포하는데
 * 가장 크게 벌어질 수 있던 미가드 표면이다. sujin_hr의 people 도메인이 조용히
 * 증발했던 바로 그곳.
 *
 * 이 가드는 (a) 17명 로스터와 (b) ID 매핑(persona_id / framework_key)이 양
 * surface에서 정확히 같도록 강제한다. 한쪽을 바꾸면 같은 변경에서 다른 쪽도
 * 갱신해야 하고, 안 하면 CI가 red. (capability/prose 같은 본문 텍스트는 이
 * 가드의 범위 밖 — 로스터·매핑 어긋남이 조용히 깨지는 부류라 먼저 막는다.)
 */

const YAML = readFileSync(
  join(process.cwd(), 'argus-plugin-v2/data/agents.yaml'),
  'utf8',
);

interface YamlAgent { id?: string; personaId?: string; frameworkKey?: string }

// js-yaml 의존성이 없어 crisis-taxonomy-parity와 같이 정규식으로 파싱한다.
// 각 에이전트 블록은 "- id: <x>"로 시작 → 블록별로 매핑 키를 뽑는다.
const yamlAgents: YamlAgent[] = YAML.split(/^\s*- id:\s*/m).slice(1).map(block => ({
  id: block.match(/^([\w]+)/)?.[1],
  personaId: block.match(/persona_id:\s*([\w]+)/)?.[1],
  frameworkKey: block.match(/framework_key:\s*([\w]+)/)?.[1],
}));

describe('webapp ↔ plugin agents.yaml 패리티 (drift guard)', () => {
  it('파서 sanity — yaml 에이전트가 추출되고 모두 id를 가진다', () => {
    expect(yamlAgents.length).toBe(AGENT_REGISTRY.length);
    expect(yamlAgents.every(a => a.id)).toBe(true);
  });

  it('로스터: yaml id 집합 ↔ registry agentId 집합 정확히 일치', () => {
    const reg = new Set(AGENT_REGISTRY.map(a => a.agentId));
    const yaml = new Set(yamlAgents.map(a => a.id!));
    expect([...reg].filter(id => !yaml.has(id))).toEqual([]); // registry엔 있는데 yaml에 없음(누락)
    expect([...yaml].filter(id => !reg.has(id))).toEqual([]); // yaml엔 있는데 registry에 없음(유령)
  });

  it('ID 매핑: yaml persona_id / framework_key가 registry와 일치', () => {
    const byId = new Map(AGENT_REGISTRY.map(a => [a.agentId, a]));
    for (const ya of yamlAgents) {
      const reg = byId.get(ya.id!);
      expect(reg, `yaml agent "${ya.id}" not in registry`).toBeDefined();
      expect(ya.personaId, `${ya.id} persona_id drift`).toBe(reg!.personaId);
      expect(ya.frameworkKey, `${ya.id} framework_key drift`).toBe(reg!.frameworkKey);
    }
  });
});
