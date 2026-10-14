import React from 'react';
import { ViewType } from '../types';
import { useWalkthrough } from '../context/WalkthroughContext';

interface PageGuideButtonProps {
  page?: ViewType;
  label?: string;
  className?: string;
  iconOnly?: boolean;
}

export const PageGuideButton: React.FC<PageGuideButtonProps> = ({
  page,
  label = 'Guide Me',
  className = '',
  iconOnly = false,
}) => {
  const { startPageTour } = useWalkthrough();

  return (
    <button
      type="button"
      onClick={() => startPageTour(page)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 shadow-2xs hover:border-blue-400/60 hover:text-blue-700 hover:shadow-xs transition-all cursor-pointer active:scale-95 ${className}`}
      title={`Take an interactive tour of this page`}
      aria-label={`Take an interactive tour of this screen`}
    >
      <span className="material-symbols-outlined text-[16px] text-blue-600">
        explore
      </span>
      {!iconOnly && <span>{label}</span>}
    </button>
  );
};
