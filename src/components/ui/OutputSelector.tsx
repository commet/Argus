'use client';

import { useState } from 'react';
import { Button } from './Button';
import { CopyButton } from './CopyButton';
import { FileText, MessageSquare, Code, CheckSquare, Download, ChevronDown, ChevronUp } from 'lucide-react';
import type { Project, MetaReflection } from '@/stores/types';
import { useProjectStore } from '@/stores/useProjectStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { Field } from './Field';
import { generateProjectBrief } from '@/lib/project-brief';
import { generatePromptChain } from '@/lib/prompt-chain';
import { generateAgentSpec } from '@/lib/agent-spec';
import { generateChecklist } from '@/lib/checklist';
import { generateDecisionRationale } from '@/lib/decision-rationale';
import { track } from '@/lib/analytics';
import { Scale } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';

interface OutputSelectorProps {
  project: Project;
}

interface OutputFormat {
  key: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  generator: (project: Project) => string;
  fileExt: string;
}

/** W1.4 산출물 압축 — default exposure is the 판단 근거서 line only; the rest
 *  are preserved (never deleted) behind the `all_output_formats` setting.
 *  Music-era format names swept to plain or voyage-consistent names (W1.4
 *  잔재 어휘 일소 — the old terms must not appear anywhere in src/). */
function getFormats(locale: 'ko' | 'en'): OutputFormat[] {
  const ko = locale === 'ko';
  return [
    {
      key: 'rationale',
      icon: <Scale size={18} />,
      label: ko ? '판단 근거서 · Decision Rationale' : 'Decision Rationale · 판단 근거서',
      description: ko
        ? '각 단계에서 왜 그렇게 판단했는지, 그 배경까지 담아요.'
        : 'The reasoning and thinking behind each decision.',
      generator: generateDecisionRationale,
      fileExt: 'md',
    },
    {
      key: 'brief',
      icon: <FileText size={18} />,
      label: ko ? '브리프 · Project Brief' : 'Project Brief · 브리프',
      description: ko
        ? '경영진이나 팀에 공유하는 의사결정 기록.'
        : 'Decision record to share with leadership or the team.',
      generator: generateProjectBrief,
      fileExt: 'md',
    },
    {
      key: 'prompt-chain',
      icon: <MessageSquare size={18} />,
      label: ko ? '프롬프트 체인 · Prompt Chain' : 'Prompt Chain · 프롬프트 체인',
      description: ko
        ? 'Claude/ChatGPT에 순서대로 입력할 프롬프트 세트. AI 실행 시 사용.'
        : 'A sequenced prompt set to paste into Claude/ChatGPT. For AI execution.',
      generator: generatePromptChain,
      fileExt: 'md',
    },
    {
      key: 'agent-spec',
      icon: <Code size={18} />,
      label: ko ? '에이전트 설계서 · Agent Spec' : 'Agent Spec · 에이전트 설계서',
      description: ko
        ? 'LangGraph/CrewAI 구현의 출발점이 되는 설계서.'
        : 'Starting spec for LangGraph / CrewAI implementations.',
      generator: generateAgentSpec,
      fileExt: 'yaml',
    },
    {
      key: 'checklist',
      icon: <CheckSquare size={18} />,
      label: ko ? '실행 점검표 · Execution Checklist' : 'Execution Checklist · 실행 점검표',
      description: ko
        ? '각 단계를 하나씩 확인하며 실행하는 체크리스트.'
        : 'Step-by-step checklist to verify as you execute.',
      generator: generateChecklist,
      fileExt: 'md',
    },
  ];
}

/** Format keys exposed by default (기본 노출 1종 — 판단 근거서 계열). */
const DEFAULT_FORMAT_KEYS = ['rationale'];

export function OutputSelector({ project }: OutputSelectorProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const allFormats = getFormats(locale);
  // 기본 노출 1종; 나머지는 설정 flag 뒤 보존 (W1.4). Persisted via settings so
  // a user who opens them once keeps them open.
  const allFormatsOn = useSettingsStore((s) => s.settings.all_output_formats ?? false);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const formats = allFormatsOn ? allFormats : allFormats.filter((f) => DEFAULT_FORMAT_KEYS.includes(f.key));
  const hiddenCount = allFormats.length - formats.length;
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [codaOpen, setCodaOpen] = useState(false);
  const [codaForm, setCodaForm] = useState<MetaReflection>({
    understanding_change: project.meta_reflection?.understanding_change || '',
    surprising_discovery: project.meta_reflection?.surprising_discovery || '',
    next_time_differently: project.meta_reflection?.next_time_differently || '',
    created_at: project.meta_reflection?.created_at || '',
  });
  const [codaSaved, setCodaSaved] = useState(!!project.meta_reflection);
  const { updateProject } = useProjectStore();

  const handleSaveCoda = () => {
    updateProject(project.id, {
      meta_reflection: {
        ...codaForm,
        created_at: new Date().toISOString(),
      },
    });
    setCodaSaved(true);
  };

  const handleSelect = (format: OutputFormat) => {
    if (selectedKey === format.key) {
      setSelectedKey(null);
      setPreview('');
      return;
    } else {
      setSelectedKey(format.key);
      setPreview(format.generator(project));
      track('output_generated', { format: format.key });
    }
  };

  // Look up in ALL formats: a hidden-format selection must keep its preview
  // working even if the user collapses the list mid-preview.
  const selectedFormat = allFormats.find((f) => f.key === selectedKey);

  const handleDownload = () => {
    if (!selectedFormat || !preview) return;
    const blob = new Blob([preview], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}-${selectedFormat.key}.${selectedFormat.fileExt}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-[14px] font-bold text-[var(--text-primary)]">{L('산출물 — 가져가실 것', 'Outputs — yours to take')}</h3>
      <p className="text-[12px] text-[var(--text-secondary)]">{L('한 번의 항해에서, 필요한 형식으로 골라 내보내요.', 'One voyage, exported in whatever format you need.')}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {formats.map((format) => (
          <button
            key={format.key}
            onClick={() => handleSelect(format)}
            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
              selectedKey === format.key
                ? 'border-[var(--accent)] bg-[var(--ai)] shadow-sm'
                : 'border-[var(--border)] hover:border-[var(--accent)]'
            }`}
          >
            <div className={`mt-0.5 shrink-0 ${selectedKey === format.key ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
              {format.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[var(--text-primary)] break-words">{format.label}</p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 break-words">{format.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* The preserved formats — one quiet toggle, persisted in settings. */}
      <button
        onClick={() => updateSettings({ all_output_formats: !allFormatsOn })}
        className="text-[11.5px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
      >
        {allFormatsOn
          ? L('기본 형식만 보기', 'Show default format only')
          : L(`다른 형식 ${hiddenCount}종 더 보기`, `Show ${hiddenCount} more formats`)}
      </button>

      {/* Preview */}
      {selectedKey && preview && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-[var(--text-secondary)]">{L('미리보기', 'Preview')}</span>
            <div className="flex gap-2">
              <CopyButton getText={() => preview} label={L('복사', 'Copy')} />
              <Button variant="secondary" size="sm" onClick={handleDownload}>
                <Download size={12} /> {L('다운로드', 'Download')}
              </Button>
            </div>
          </div>
          <pre className="bg-[#1a1a2e] text-[#e2e4ea] rounded-xl p-4 text-[12px] leading-relaxed overflow-x-auto max-h-[400px] overflow-y-auto font-mono">
            {preview}
          </pre>
        </div>
      )}

      {/* Logbook: 항해 후 성찰 */}
      <div className="border-t border-[var(--border-subtle)] pt-4 mt-4">
        <button
          onClick={() => setCodaOpen(!codaOpen)}
          className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors w-full"
        >
          {codaOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {L('항해일지 · 되돌아보기', 'Logbook · Reflect')}
          {codaSaved && <span className="text-[10px] text-[var(--success)] font-medium ml-1">{L('저장됨', 'Saved')}</span>}
        </button>
        {codaOpen && (
          <div className="mt-4 space-y-4 animate-fade-in">
            <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
              {L(
                '항해가 끝났어요. 지나온 항로를 한 번 짚어보면 다음 항해가 한결 수월해져요.',
                "The voyage is done. Looking back at the route makes the next one easier.",
              )}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[12px] font-semibold text-[var(--text-primary)] block mb-1">
                  {L(
                    '1. 처음 일을 받았을 때랑 지금, 생각이 어떻게 달라졌나요?',
                    '1. How has your thinking changed since you first got the brief?',
                  )}
                </label>
                <Field
                  value={codaForm.understanding_change || ''}
                  onChange={(e) => setCodaForm(prev => ({ ...prev, understanding_change: e.target.value }))}
                  rows={2}
                  animatedPlaceholders={locale === 'ko' ? [
                    '처음에는 단순한 과제라고 생각했지만...',
                    '핵심 이해관계자의 관점이 완전히 달라 보이기 시작했다',
                    '문제의 범위가 예상보다 넓다는 것을 알게 되었다',
                    '기술적 해결이 아닌 조직적 문제라는 걸 깨달았다',
                  ] : [
                    "At first I thought it was a simple task, but...",
                    "A key stakeholder's perspective started to look completely different",
                    'The scope turned out to be wider than expected',
                    'I realized it was an organizational problem, not a technical one',
                  ]}
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[var(--text-primary)] block mb-1">
                  {L(
                    '2. 하면서 가장 뜻밖이었던 발견은 뭐였나요?',
                    '2. What surprised you most along the way?',
                  )}
                </label>
                <Field
                  value={codaForm.surprising_discovery || ''}
                  onChange={(e) => setCodaForm(prev => ({ ...prev, surprising_discovery: e.target.value }))}
                  rows={2}
                  animatedPlaceholders={locale === 'ko' ? [
                    '예상하지 못했던 리스크나 새로운 관점...',
                    '이해관계자가 실제로는 다른 것을 원하고 있었다',
                    '가정이 틀렸다는 걸 데이터가 보여줬다',
                    '가장 작은 단계가 가장 큰 영향을 줄 수 있었다',
                  ] : [
                    'An unexpected risk or a new angle...',
                    'The stakeholder actually wanted something different',
                    'The data showed my assumption was wrong',
                    'The smallest step could make the biggest impact',
                  ]}
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[var(--text-primary)] block mb-1">
                  {L(
                    '3. 다음에 비슷한 일을 또 만나면 뭘 다르게 해볼까요?',
                    '3. What would you do differently next time?',
                  )}
                </label>
                <Field
                  value={codaForm.next_time_differently || ''}
                  onChange={(e) => setCodaForm(prev => ({ ...prev, next_time_differently: e.target.value }))}
                  rows={2}
                  animatedPlaceholders={locale === 'ko' ? [
                    '이해관계자를 더 일찍 참여시키거나...',
                    '가정 검증을 첫 단계에서 했을 것이다',
                    '리스크를 미리 시뮬레이션해 봤을 것이다',
                    '작은 파일럿으로 먼저 검증했을 것이다',
                  ] : [
                    "Bring stakeholders in earlier, or...",
                    'Validate assumptions in the first step',
                    'Simulate the risks up front',
                    'Run a small pilot to verify first',
                  ]}
                />
              </div>
              <Button size="sm" onClick={handleSaveCoda}>
                {codaSaved ? L('업데이트', 'Update') : L('성찰 저장', 'Save reflection')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
