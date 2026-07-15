'use client';

import { useState, useEffect } from 'react';
import { Hash, Lock, Search, Check, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useSlackStore } from '@/stores/useSlackStore';
import { useT } from '@/contexts/LocaleProvider';

interface SlackChannelPickerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

export function SlackChannelPicker({ open, onClose, title, content }: SlackChannelPickerProps) {
  const t = useT();
  const { channels, channelsLoading, sending, loadChannels, sendToSlack } = useSlackStore();
  const [search, setSearch] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      loadChannels();
      setSent(false);
      setError('');
      setSearch('');
    }
  }, [open, loadChannels]);

  const filtered = channels.filter(ch =>
    ch.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSend = async (channelId: string) => {
    setError('');
    const result = await sendToSlack(channelId, title, content);
    if (result.ok) {
      setSent(true);
      setTimeout(() => onClose(), 1500);
    } else {
      setError(t('slack.sendFailed'));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('slack.pickerTitle')}>
      {sent ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-[var(--collab)] flex items-center justify-center mx-auto mb-3">
            <Check size={24} className="text-[var(--success)]" />
          </div>
          <p className="text-[16px] font-bold text-[var(--text-primary)]">{t('slack.sentTitle')}</p>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">{t('slack.sentHint')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('slack.searchPlaceholder')}
              maxLength={100}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {error && (
            <p className="text-[13px] text-[var(--danger)] bg-[var(--danger)]/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* Channel list */}
          <div className="max-h-[300px] overflow-y-auto -mx-1">
            {channelsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-[var(--text-tertiary)]" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-[13px] text-[var(--text-tertiary)] py-8">
                {search ? t('slack.searchNoResult') : t('slack.channelsNotFound')}
              </p>
            ) : (
              filtered.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => handleSend(ch.id)}
                  disabled={sending}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[var(--bg)] transition-colors cursor-pointer text-left disabled:opacity-50"
                >
                  {ch.is_private ? (
                    <Lock size={14} className="text-[var(--text-tertiary)] shrink-0" />
                  ) : (
                    <Hash size={14} className="text-[var(--text-tertiary)] shrink-0" />
                  )}
                  <span className="text-[14px] text-[var(--text-primary)] truncate">{ch.name}</span>
                  {sending && (
                    <Loader2 size={14} className="animate-spin text-[var(--text-tertiary)] ml-auto shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-[var(--border-subtle)]">
            <Button variant="secondary" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
