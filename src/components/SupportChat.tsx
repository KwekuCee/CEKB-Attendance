import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { getPortalToken } from '../lib/portalDb';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SupportChatProps {
  onClose: () => void;
}

const STARTERS = [
  'How does the QR check-in work?',
  'How do I add a new leader?',
  'How do I record why someone was absent?',
  'How do I move a member to another church?'
];

/** In-app help assistant. Answers questions about how the system works only. */
export const SupportChat: React.FC<SupportChatProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hello! I'm the CEKB support assistant. Ask me anything about how to use this system — check-ins, leaders, classes, birthdays, absentees or reports."
    }
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || isSending) return;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: question }];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setIsSending(true);
    try {
      const token = getPortalToken();
      if (!token) throw new Error('Please sign in to use the assistant.');
      const { data, error: fnError } = await supabase.functions.invoke('support-chat', {
        body: { messages: nextMessages.filter((m) => m.role === 'user' || m.role === 'assistant') },
        headers: { 'x-portal-session': token }
      });
      if (fnError) throw new Error(fnError.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const reply = (data as any)?.reply || 'Sorry, I had nothing to add there.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      setError(err?.message || 'The assistant could not answer just now. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg h-[85vh] sm:h-[600px] rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-lg flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-blue-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/15 text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">contact_support</span>
            </div>
            <div>
              <h3 className="font-headline font-bold text-sm text-white leading-tight">Admin Support</h3>
              <p className="text-xs text-blue-100">Help with using the system</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close support chat"
            className="w-8 h-8 rounded-xl text-white hover:bg-white/15 flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[85%] bg-blue-700 text-white text-xs font-semibold rounded-2xl rounded-br-md px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap'
                    : 'max-w-[90%] text-xs text-slate-800 leading-relaxed whitespace-pre-wrap'
                }
              >
                {m.content}
              </div>
            </div>
          ))}

          {isSending && (
            <div className="text-xs text-slate-400 font-semibold animate-pulse">Thinking...</div>
          )}

          {error && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {messages.length === 1 && (
            <div className="pt-2 space-y-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="block w-full text-left text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 hover:bg-blue-100 cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t border-slate-100 p-3 flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={2}
            placeholder="Ask a question about the system..."
            className="flex-1 resize-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600 font-semibold"
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            aria-label="Send question"
            className="w-10 h-10 shrink-0 rounded-xl bg-blue-700 text-white flex items-center justify-center hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </form>

        <p className="px-4 pb-3 text-xs text-slate-400">
          The assistant explains how to use the system. It cannot see member records, figures or passwords.
        </p>
      </div>
    </div>
  );
};
