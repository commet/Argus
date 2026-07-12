/**
 * Boss store probe — offline round-trip verification.
 *
 * Runs a sequence of deterministic checks against the actual useBossStore /
 * useAgentStore code to verify the 4.1–4.5 globalization changes work end to
 * end at the store layer (no browser, no LLM).
 *
 * Usage:
 *   npx tsx scripts/probe-boss-store.ts
 *
 * Exit code 0 on all pass, 1 on any fail.
 */

import { getWesternZodiac, getChineseZodiac, buildZodiacProfile } from '../src/lib/boss/zodiac';
import { getLocalizedPersonalityType, getLocalizedAxes, PERSONALITY_TYPES_EN } from '../src/lib/boss/personality-types';
import { useBossStore } from '../src/stores/useBossStore';
import { useAgentStore } from '../src/stores/useAgentStore';

const C = { ok: '\x1b[32m', fail: '\x1b[31m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' };

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ${C.ok}✓${C.reset} ${label}${detail ? C.dim + ' — ' + detail + C.reset : ''}`);
  } else {
    failed++;
    const msg = `${label}${detail ? ' — ' + detail : ''}`;
    failures.push(msg);
    console.log(`  ${C.fail}✗${C.reset} ${msg}`);
  }
}

function section(title: string) {
  console.log('\n' + C.bold + title + C.reset);
}

// ─── 1. Zodiac pure-function correctness ──────────────────────────────────

section('1. Zodiac computation');

const westCases: Array<[number, number, string]> = [
  // [month, day, expected sign]
  [1, 19, 'capricorn'],  // last day of Capricorn
  [1, 20, 'aquarius'],   // first day of Aquarius
  [3, 20, 'pisces'],
  [3, 21, 'aries'],
  [7, 15, 'cancer'],     // mid-Cancer
  [12, 21, 'sagittarius'],
  [12, 22, 'capricorn'], // Capricorn wrap start
  [12, 31, 'capricorn'],
];
for (const [m, d, expected] of westCases) {
  const r = getWesternZodiac(m, d);
  check(`getWesternZodiac(${m},${d}) = ${expected}`, r?.sign === expected, r?.sign || 'null');
}

// Chinese zodiac — sample known mappings
const chineseCases: Array<[number, string]> = [
  [1985, 'ox'],
  [1988, 'dragon'],
  [1990, 'horse'],
  [2000, 'dragon'],
  [2008, 'rat'],
];
for (const [year, expected] of chineseCases) {
  const r = getChineseZodiac(year);
  check(`getChineseZodiac(${year}) = ${expected}`, r?.animal === expected, r?.animal || 'null');
}

// Combined profile — English summary format
const profile = buildZodiacProfile(1985, 7, 15);
check('buildZodiacProfile has both layers', !!(profile?.western && profile?.chinese));
check('summaryEn contains Born 1985', !!profile?.summaryEn.includes('Born 1985'), profile?.summaryEn);
check('summaryKo contains 1985년생', !!profile?.summaryKo.includes('1985년생'), profile?.summaryKo);
check('traitsEn has 2 entries', profile?.traitsEn.length === 2, `${profile?.traitsEn.length} entries`);

// Edge: year only, no month
const yearOnly = buildZodiacProfile(1990);
check('year-only profile has chinese, no western', !!yearOnly?.chinese && !yearOnly?.western);

// Edge: invalid year
const outOfRange = buildZodiacProfile(1850);
check('out-of-range year returns null', outOfRange === null);

// ─── 2. Localized personality types ───────────────────────────────────────

section('2. Localized personality types');

const typeCodes = ['ISTJ', 'ENTJ', 'INFP', 'ESFP', 'INTJ', 'ENFP'];
for (const code of typeCodes) {
  const ko = getLocalizedPersonalityType(code, 'ko');
  const en = getLocalizedPersonalityType(code, 'en');
  check(`${code} ko has name`, !!ko?.name, ko?.name);
  check(`${code} en has name`, !!en?.name, en?.name);
  check(`${code} names differ by locale`, ko?.name !== en?.name);
  check(`${code} en speechPatterns has 5`, en?.speechPatterns.length === 5, `${en?.speechPatterns.length}`);
  // English version should NOT have Korean characters in critical fields
  const combinedText = [en?.name, en?.communicationStyle, en?.feedbackStyle, en?.bossVibe, ...(en?.speechPatterns || []), en?.exampleDialogues, en?.innerMonologueExample].join(' ');
  const hasKorean = /[가-힣]/.test(combinedText);
  check(`${code} en fields have no Korean chars`, !hasKorean);
  check(`${code} en exampleDialogues present`, !!en?.exampleDialogues?.trim());
}

// All 16 types covered
const allCodes = Object.keys(PERSONALITY_TYPES_EN);
check('PERSONALITY_TYPES_EN has all 16', allCodes.length === 16, `${allCodes.length} codes`);

// Axes localization
const axesKo = getLocalizedAxes('ko');
const axesEn = getLocalizedAxes('en');
check('axes ko left[0] is 외향', axesKo[0].left.label === '외향');
check('axes en left[0] is Extraversion', axesEn[0].left.label === 'Extraversion');

// ─── 3. Boss store: birth setter updates zodiac ───────────────────────────

section('3. Boss store birth setter');

const bossStore = useBossStore.getState();
bossStore.setBirth(1985, 7, 15);
const afterBirth = useBossStore.getState();
check('birthYear stored', afterBirth.birthYear === 1985);
check('birthMonth stored', afterBirth.birthMonth === 7);
check('birthDay stored', afterBirth.birthDay === 15);
check('zodiacProfile computed', !!afterBirth.zodiacProfile);
check('zodiacProfile.chinese.animal = ox', afterBirth.zodiacProfile?.chinese?.animal === 'ox');
check('zodiacProfile.western.sign = cancer', afterBirth.zodiacProfile?.western?.sign === 'cancer');
check('yearMonthProfile still computed for KO compat', !!afterBirth.yearMonthProfile);

// Clear day → should recompute zodiac without precise day
bossStore.setBirth(1985, 7, 0);
const noDayState = useBossStore.getState();
check('no-day → zodiacProfile still set (falls back to day 15)', !!noDayState.zodiacProfile);
check('no-day → western sign derived from month mid', noDayState.zodiacProfile?.western?.sign === 'cancer');

// Out of range → null profiles
bossStore.setBirth(1900, 1, 1);
const outOfBounds = useBossStore.getState();
check('out-of-range birthYear → zodiac null', outOfBounds.zodiacProfile === null);
check('out-of-range birthYear → yearMonth null', outOfBounds.yearMonthProfile === null);

// Reset for next phase
bossStore.reset();
bossStore.setBirth(1985, 7, 15);

// ─── 4. Agent create → load round-trip ────────────────────────────────────

section('4. Agent round-trip (create → load)');

// Configure English boss setup
bossStore.setAxis('ei', 'E');
bossStore.setAxis('sn', 'N');
bossStore.setAxis('tf', 'T');
bossStore.setAxis('jp', 'J');
bossStore.setGender('남');
bossStore.setBirth(1985, 7, 15);

// Force English locale for this test by overriding getCurrentLanguage
// (can't easily — the store calls getCurrentLanguage() at save time which
// reads from getStorage. In Node without window, it returns default 'ko'.)
// So we manually call createBossAgent with locale='en' to simulate.
const agentStore = useAgentStore.getState();
const enType = getLocalizedPersonalityType('ENTJ', 'en')!;
const enAgentId = agentStore.createBossAgent({
  name: `${enType.name} Boss`,
  typeCode: 'ENTJ',
  gender: '남',
  personalityProfile: {
    communicationStyle: enType.communicationStyle,
    decisionPattern: enType.decisionPattern,
    conflictStyle: enType.conflictStyle,
    feedbackStyle: enType.feedbackStyle,
    triggers: enType.triggers,
    speechPatterns: enType.speechPatterns,
    bossVibe: enType.bossVibe,
  },
  zodiacProfile: useBossStore.getState().zodiacProfile ?? undefined,
  birthYear: 1985,
  birthMonth: 7,
  birthDay: 15,
  locale: 'en',
});

const enAgent = agentStore.getAgent(enAgentId);
check('EN agent created', !!enAgent);
check('EN agent name is English', enAgent?.name === 'The Bold Commander Boss', enAgent?.name);
check('EN agent role is Boss (EN)', enAgent?.role === 'Boss', enAgent?.role);
check('EN agent personality_code stored', enAgent?.personality_code === 'ENTJ');
check('EN agent boss_locale = en', enAgent?.boss_locale === 'en');
check('EN agent birth_day stored', enAgent?.birth_day === 15);
check('EN agent zodiac_profile present', !!enAgent?.zodiac_profile);
check('EN agent saju_profile absent', !enAgent?.saju_profile);

// Load back via useBossStore.loadBossFromAgent
bossStore.reset();
bossStore.loadBossFromAgent(enAgentId);
const loadedEn = useBossStore.getState();
check('load: axes restored (ENTJ)', `${loadedEn.axes.ei}${loadedEn.axes.sn}${loadedEn.axes.tf}${loadedEn.axes.jp}` === 'ENTJ');
check('load: birthDay restored', loadedEn.birthDay === 15);
check('load: zodiacProfile rebuilt', !!loadedEn.zodiacProfile);
check('load: chinese animal matches', loadedEn.zodiacProfile?.chinese?.animal === 'ox');
check('load: western sign matches', loadedEn.zodiacProfile?.western?.sign === 'cancer');
check('load: loadedAgentId tracked', loadedEn.loadedAgentId === enAgentId);

// Korean boss — separate flow, verify no regression
bossStore.reset();
bossStore.setBirth(1990, 3, 22);
bossStore.setGender('여');
const koType = getLocalizedPersonalityType('ISFP', 'ko')!;
const koAgentId = agentStore.createBossAgent({
  name: `${koType.name} 팀장`,
  typeCode: 'ISFP',
  gender: '여',
  personalityProfile: {
    communicationStyle: koType.communicationStyle,
    decisionPattern: koType.decisionPattern,
    conflictStyle: koType.conflictStyle,
    feedbackStyle: koType.feedbackStyle,
    triggers: koType.triggers,
    speechPatterns: koType.speechPatterns,
    bossVibe: koType.bossVibe,
  },
  birthYear: 1990,
  birthMonth: 3,
  birthDay: 22,
  locale: 'ko',
});
const koAgent = agentStore.getAgent(koAgentId);
check('KO agent created with Korean name', !!koAgent?.name && /[가-힣]/.test(koAgent.name), koAgent?.name);
check('KO agent role is 팀장', koAgent?.role === '팀장', koAgent?.role);
check('KO agent boss_locale = ko', koAgent?.boss_locale === 'ko');

// Legacy boss (no boss_locale) — simulate by creating and then clearing locale
const legacyId = agentStore.createBossAgent({
  name: 'Legacy 팀장',
  typeCode: 'INTJ',
  gender: '남',
  personalityProfile: {
    communicationStyle: '',
    decisionPattern: '',
    conflictStyle: '',
    feedbackStyle: '',
    triggers: '',
    speechPatterns: [],
    bossVibe: '',
  },
  birthYear: 1988,
  birthMonth: 5,
  birthDay: 10,
});
// createBossAgent auto-sets boss_locale — simulate legacy by clearing it
agentStore.updateAgent(legacyId, { boss_locale: undefined });
const legacyAgent = agentStore.getAgent(legacyId);
check('Legacy agent created', !!legacyAgent);
check('Legacy agent has no boss_locale (simulated pre-migration)', legacyAgent?.boss_locale === undefined);

// ─── Summary ──────────────────────────────────────────────────────────────

section('Summary');
console.log(`${C.ok}${passed} passed${C.reset}${failed > 0 ? ` · ${C.fail}${failed} failed${C.reset}` : ''}`);

if (failed > 0) {
  console.log('\n' + C.fail + 'Failures:' + C.reset);
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
