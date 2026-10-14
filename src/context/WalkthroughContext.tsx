import React, { createContext, useContext, useState, useCallback } from 'react';
import { ViewType, AuthSessionUser } from '../types';

export interface WalkthroughContextType {
  isTourOpen: boolean;
  tourMode: 'full' | 'page';
  targetPage?: ViewType;
  startFullTour: () => void;
  startPageTour: (page?: ViewType) => void;
  closeTour: () => void;
}

const WalkthroughContext = createContext<WalkthroughContextType>({
  isTourOpen: false,
  tourMode: 'full',
  startFullTour: () => {},
  startPageTour: () => {},
  closeTour: () => {},
});

export interface WalkthroughProviderProps {
  children: React.ReactNode;
  user?: { role: AuthSessionUser['role']; name?: string; email?: string; church?: string };
  currentView?: ViewType;
  onNavigate?: (view: ViewType) => void;
}

export const WalkthroughProvider: React.FC<WalkthroughProviderProps> = ({
  children,
  currentView,
  onNavigate,
}) => {
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourMode, setTourMode] = useState<'full' | 'page'>('full');
  const [targetPage, setTargetPage] = useState<ViewType | undefined>(undefined);

  const startFullTour = useCallback(() => {
    setTourMode('full');
    setTargetPage(undefined);
    setIsTourOpen(true);
  }, []);

  const startPageTour = useCallback(
    (page?: ViewType) => {
      const pageToTour = page || currentView || 'dashboard';
      setTourMode('page');
      setTargetPage(pageToTour);
      if (page && onNavigate && currentView !== page) {
        onNavigate(page);
      }
      setIsTourOpen(true);
    },
    [currentView, onNavigate]
  );

  const closeTour = useCallback(() => {
    setIsTourOpen(false);
  }, []);

  return (
    <WalkthroughContext.Provider
      value={{
        isTourOpen,
        tourMode,
        targetPage,
        startFullTour,
        startPageTour,
        closeTour,
      }}
    >
      {children}
    </WalkthroughContext.Provider>
  );
};

export function useWalkthrough(): WalkthroughContextType {
  return useContext(WalkthroughContext);
}
