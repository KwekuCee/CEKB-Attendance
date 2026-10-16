import { errorText } from '../utils/errorText';
import React, { useState } from 'react';
import { Button } from './Button';
import { verifyReportCode } from '../lib/cellReports';

interface CellReportCodeModalProps {
  isOpen: boolean;
  churchName: string;
  onClose: () => void;
  onCodeVerified: (verifiedCode: string) => void;
}

export const CellReportCodeModal: React.FC<CellReportCodeModalProps> = ({
  isOpen,
  churchName,
  onClose,
  onCodeVerified,
}) => {
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setError('Please enter your church cell report code.');
      return;
    }

    setIsVerifying(true);
    setError('');

    const { data, error: verifyErr } = await verifyReportCode(churchName, cleanCode);
    setIsVerifying(false);

    if (verifyErr || !data?.ok) {
      setError(errorText(verifyErr, `That access code is not correct for ${churchName}. Please check with your Church Administrator or Pastor.`));
      return;
    }

    onCodeVerified(cleanCode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">key</span>
            </div>
            <div>
              <h3 className="font-headline font-bold text-base text-slate-900">
                Cell Report Access Code
              </h3>
              <p className="text-[11px] text-slate-500">{churchName}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            To submit your weekly report, enter the security code given to your cell by your Church Pastor or Administrator for <strong>{churchName}</strong>.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Church Report Code *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. CEKB-1024"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError('');
              }}
              className="w-full text-center font-mono tracking-widest text-sm uppercase bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <span className="material-symbols-outlined text-sm mt-0.5">error</span>
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isVerifying || !code.trim()}>
              {isVerifying ? (
                <span>Checking…</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">lock_open</span>
                  <span>Unlock Report Sheet</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
