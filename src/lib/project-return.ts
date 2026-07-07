import type { Project } from '@/stores/types';
import { contractStatus } from './decision-contract';

function returnAliases(project: Project): Set<string> {
  const aliases = new Set<string>([project.id]);
  const contract = project.decision_contract;
  if (!contract) return aliases;

  aliases.add(contract.id);
  for (const p of Array.isArray(contract.predicates) ? contract.predicates : []) {
    aliases.add(p.id);
    aliases.add(`${contract.id}:${p.id}`);
  }
  return aliases;
}

export function selectReturnProject(
  projects: Project[],
  rawReturnId: string | null | undefined,
): Project | null {
  const returnId = rawReturnId?.trim();
  if (!returnId) return null;

  for (const project of projects || []) {
    if (!project.decision_contract) continue;
    if (returnAliases(project).has(returnId)) return project;
  }
  return null;
}

/**
 * Resolve an email/browser return handle to the project that can actually show
 * the settle surface now. Accepts all ids a CTA may reasonably carry: project id,
 * contract id, predicate id, or the ledger-shaped contract:predicate id.
 */
export function selectDueReturnProject(
  projects: Project[],
  rawReturnId: string | null | undefined,
  now: number,
): Project | null {
  const returnId = rawReturnId?.trim();
  if (!returnId) return null;

  for (const project of projects || []) {
    const contract = project.decision_contract;
    if (!contract) continue;
    if (!returnAliases(project).has(returnId)) continue;
    if (contractStatus(contract, now).checkInDue) return project;
    return null;
  }
  return null;
}
