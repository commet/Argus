'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import type { Persona, RecastItem, ReframeItem } from '@/stores/types';
import { useRecastStore } from '@/stores/useRecastStore';
import { useReframeStore } from '@/stores/useReframeStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { recastToMarkdown } from '@/lib/export';
import { AnimatedPlaceholder } from '@/components/ui/AnimatedPlaceholder';
import { Send, Loader2, Upload, Check, AlertTriangle, ChevronDown, ChevronUp, Bot, Brain, Flag } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';

interface FeedbackRequestProps {
  personas: Persona[];
  onSubmit: (data: {
    documentTitle: string;
    documentText: string;
    personaIds: string[];
    perspective: string;
    intensity: string;
  }) => void;
  loading?: boolean;
  initialContent?: string;
  initialTitle?: string;
  initialPersonaIds?: string[];
}

function getInfluenceStyles(locale: 'ko' | 'en') {
  const ko = locale === 'ko';
  return {
    high: { bg: 'bg-[var(--danger)]/10', border: 'border-[var(--danger)]/25', text: 'text-[var(--danger)]', label: ko ? '높음' : 'High' },
    medium: { bg: 'bg-[var(--warning)]/10', border: 'border-[var(--warning)]/30', text: 'text-[var(--warning)]', label: ko ? '중간' : 'Med' },
    low: { bg: 'bg-[var(--ai)]', border: 'border-[var(--ai-fg)]/20', text: 'text-[var(--ai-fg)]', label: ko ? '낮음' : 'Low' },
  } as const;
}

export function FeedbackRequest({ personas, onSubmit, loading, initialContent, initialTitle, initialPersonaIds }: FeedbackRequestProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const INFLUENCE_STYLES = getInfluenceStyles(locale);
  const { items: recastItems } = useRecastStore();
  const { items: reframeItems } = useReframeStore();
  const { currentProjectId } = useProjectStore();

  const [documentText, setDocumentText] = useState(initialContent || '');
  const [documentTitle, setDocumentTitle] = useState(initialTitle || '');
  const [selectedIds, setSelectedIds] = useState<string[]>(initialPersonaIds || []);
  useEffect(() => {
    if (initialPersonaIds && initialPersonaIds.length > 0) {
      setSelectedIds(initialPersonaIds);
    } else if (personas.length > 0) {
      setSelectedIds(prev => {
        if (prev.length > 0) return prev;
        const sorted = [...personas].sort((a, b) => {
          const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
          return (order[a.influence || 'medium'] ?? 1) - (order[b.influence || 'medium'] ?? 1);
        });
        return [sorted[0].id];
      });
    }
  }, [initialPersonaIds, personas]);
  const perspective = L('전반적 인상', 'Overall impression');
  const intensity = L('솔직하게', 'Candid');
  const [showFullDoc, setShowFullDoc] = useState(false);
  const [useCustomDoc, setUseCustomDoc] = useState(false);

  // Auto-populate from recast if available
  const relatedRecast = currentProjectId
    ? recastItems.filter(o => o.project_id === currentProjectId && o.status === 'done' && o.analysis)
        .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))[0]
    : null;

  const relatedReframe = currentProjectId
    ? reframeItems.filter(d => d.project_id === currentProjectId && d.status === 'done' && d.analysis)
        .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))[0]
    : null;

  const relatedRecastId = relatedRecast?.id;
  useEffect(() => {
    if (relatedRecast && !initialContent && !useCustomDoc) {
      const md = recastToMarkdown(relatedRecast);
      setDocumentText(md);
      setDocumentTitle(L('선원 배치 결과물', 'Crew Assignment output'));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relatedRecastId, initialContent, useCustomDoc]);

  const togglePersona = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      alert(L('파일이 너무 큽니다 (최대 5MB).', 'File is too large (max 5MB).'));
      return;
    }
    if (!file.type.startsWith('text/') && !file.name.match(/\.(txt|md|csv|json)$/i)) {
      alert(L('텍스트 파일만 업로드할 수 있습니다 (.txt, .md, .csv, .json).', 'Only text files are supported (.txt, .md, .csv, .json).'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      setDocumentText(evt.target?.result as string);
      setDocumentTitle(file.name.replace(/\.(txt|md|csv|json)$/i, ''));
      setUseCustomDoc(true);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">

      {/* ── 1. Target material ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[15px] font-bold text-[var(--text-primary)]">{L('검증 대상', 'What to review')}</h3>
            <p className="text-[12px] text-[var(--text-secondary)]">{L('이해관계자 앞에서 리허설할 자료', 'What you’ll rehearse in front of stakeholders')}</p>
          </div>
          {relatedRecast && !useCustomDoc && (
            <button
              onClick={() => setUseCustomDoc(true)}
              className="text-[11px] text-[var(--accent)] hover:underline cursor-pointer"
            >
              {L('직접 입력으로 전환', 'Switch to manual')}
            </button>
          )}
          {useCustomDoc && relatedRecast && (
            <button
              onClick={() => { setUseCustomDoc(false); setDocumentText(recastToMarkdown(relatedRecast)); }}
              className="text-[11px] text-[var(--accent)] hover:underline cursor-pointer"
            >
              {L('선원 배치 결과 사용', 'Use Crew Assignment output')}
            </button>
          )}
        </div>

        {/* Auto-populated structured preview */}
        {relatedRecast?.analysis && !useCustomDoc ? (
          <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
            {/* Summary */}
            <div className="px-4 py-3 bg-[var(--ai)]">
              <div className="flex items-center gap-2 mb-1">
                <Check size={12} className="text-[var(--accent)]" />
                <span className="text-[12px] font-semibold text-[var(--accent)]">{L('선원 배치 결과가 연결되었습니다', 'Crew Assignment output connected')}</span>
              </div>
              <p className="text-[14px] font-bold text-[var(--text-primary)] mt-1">
                {relatedRecast.analysis.governing_idea}
              </p>
            </div>

            {/* Key info */}
            <div className="px-4 py-3 border-t border-[var(--border-subtle)]">
              <div className="flex flex-wrap gap-3 text-[11px]">
                <span className="text-[var(--text-secondary)]">
                  <Bot size={10} className="inline mr-1" />
                  {relatedRecast.analysis.steps?.filter(s => s.actor === 'ai').length || 0} {L('AI 단계', 'AI steps')}
                </span>
                <span className="text-[var(--text-secondary)]">
                  <Brain size={10} className="inline mr-1" />
                  {relatedRecast.analysis.steps?.filter(s => s.actor === 'human').length || 0} {L('사람 단계', 'human steps')}
                </span>
                <span className="text-[var(--text-secondary)]">
                  <Flag size={10} className="inline mr-1" />
                  {relatedRecast.analysis.steps?.filter(s => s.checkpoint).length || 0} {L('체크포인트', 'checkpoints')}
                </span>
                {relatedRecast.analysis.key_assumptions?.length > 0 && (
                  <span className="text-[var(--warning)]">
                    <AlertTriangle size={10} className="inline mr-1" />
                    {L(`핵심 가정 ${relatedRecast.analysis.key_assumptions.length}건`, `${relatedRecast.analysis.key_assumptions.length} key assumption${relatedRecast.analysis.key_assumptions.length === 1 ? '' : 's'}`)}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowFullDoc(!showFullDoc)}
                className="flex items-center gap-1 mt-2 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--accent)] cursor-pointer"
              >
                {showFullDoc ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                {showFullDoc ? L('접기', 'Collapse') : L('전체 내용 보기', 'Show full content')}
              </button>
              {showFullDoc && (
                <pre className="mt-2 text-[11px] text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto bg-[var(--bg)] rounded-lg p-3">
                  {documentText}
                </pre>
              )}
            </div>
          </div>
        ) : (
          /* Manual input */
          <div className="space-y-2">
            <div className="relative">
              <AnimatedPlaceholder
                texts={locale === 'ko' ? [
                  'AI 도입 전략 보고서를 여기에 붙여넣으세요',
                  '분기 실적 프레젠테이션 핵심 내용을 입력하세요',
                  '신사업 제안서의 내용을 공유하세요',
                  '프로젝트 기획서의 주요 내용을 작성하세요',
                  '경쟁 분석 보고서를 여기에 입력하세요',
                ] : [
                  'Paste your AI adoption strategy report here',
                  'Drop the core of your quarterly review deck',
                  'Share your new business proposal',
                  'Add the main points of your project plan',
                  'Enter your competitive analysis report',
                ]}
                visible={!documentText.trim()}
                className="absolute left-4 top-3 text-[14px] text-[var(--text-tertiary)] leading-relaxed max-w-[calc(100%-2rem)] truncate"
              />
              <textarea
                value={documentText}
                maxLength={20000}
                onChange={(e) => setDocumentText(e.target.value)}
                className="w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-xl px-4 py-3 text-[14px] leading-relaxed placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] resize-none"
                rows={6}
              />
            </div>
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-[var(--border)] text-[12px] text-[var(--text-secondary)] hover:border-[var(--accent)] cursor-pointer">
              <Upload size={12} /> {L('.txt / .md 파일 업로드', 'Upload .txt / .md file')}
              <input type="file" accept=".txt,.md" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        )}
      </div>

      {/* ── 2. Pick stakeholders ── */}
      <div>
        <h3 className="text-[15px] font-bold text-[var(--text-primary)] mb-1">{L('누구 입장에서 볼까요?', 'From whose perspective?')}</h3>
        <p className="text-[12px] text-[var(--text-secondary)] mb-3">{
          selectedIds.length === 0
            ? L('가장 관련 높은 1명을 선택하세요', 'Pick the most relevant one')
            : selectedIds.length === 1
              ? L('1명 선택됨 — 검토 후 추가 가능', '1 selected — you can add more after review')
              : L(`${selectedIds.length}명 선택됨`, `${selectedIds.length} selected`)
        }</p>

        {personas.length === 0 ? (
          <div className="text-center py-6 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg)]">
            <p className="text-[13px] text-[var(--text-secondary)]">{L('먼저 페르소나를 등록해주세요.', 'Register a persona first.')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {personas.map((p) => {
              const selected = selectedIds.includes(p.id);
              const inf = INFLUENCE_STYLES[p.influence || 'medium'];
              return (
                <button
                  key={p.id}
                  onClick={() => togglePersona(p.id)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl border text-left
                    transition-all duration-200 cursor-pointer
                    ${selected
                      ? 'border-[var(--accent)] bg-[var(--ai)] shadow-sm -translate-y-0.5'
                      : 'border-[var(--border-subtle)] hover:border-[var(--border)]'
                    }
                  `}
                >
                  {/* Avatar */}
                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center text-[16px] font-bold shrink-0
                    ${selected ? 'bg-[var(--accent)] text-[var(--bg)]' : 'bg-[var(--bg)] text-[var(--text-secondary)]'}
                  `}>
                    {p.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{p.name}</p>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${inf.bg} ${inf.text}`}>
                        {inf.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] truncate">{p.role}{p.organization ? ` · ${p.organization}` : ''}</p>
                  </div>
                  {selected && (
                    <Check size={16} className="text-[var(--accent)] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── CTA ── */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-[11px] text-[var(--text-tertiary)]">
          {selectedIds.length > 0
            ? L(`${selectedIds.length}명의 이해관계자가 검토합니다`, `${selectedIds.length} stakeholder${selectedIds.length === 1 ? '' : 's'} will review`)
            : L('이해관계자를 선택하세요', 'Pick stakeholders')
          }
        </p>
        <Button
          onClick={() => onSubmit({ documentTitle, documentText, personaIds: selectedIds, perspective, intensity })}
          disabled={!documentText.trim() || selectedIds.length === 0 || loading}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {loading ? L('검토 중...', 'Reviewing...') : L('검토 받기', 'Get review')}
        </Button>
      </div>
    </div>
  );
}
