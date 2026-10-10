import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from './Button';
import communityImage from '../assets/images/hero_congregation_1791607505269.jpg';

type Tab = 'home' | 'attendance' | 'leader_reg' | 'admin_signup' | 'login' | 'cell_report';

interface HeroSectionProps {
  onNavigate: (tab: Tab) => void;
}

interface ActionCard {
  tab: Tab;
  icon: string;
  title: string;
  detail: string;
  badge: string;
  number: string;
  buttonLabel: string;
}

const actionCards: ActionCard[] = [
  {
    tab: 'attendance',
    icon: 'how_to_reg',
    title: 'Cell Attendance',
    detail: 'Self check-in for service & instant digital QR pass download for your phone.',
    badge: 'Check In',
    number: '01',
    buttonLabel: 'Launch Attendance',
  },
  {
    tab: 'cell_report',
    icon: 'assignment',
    title: 'Weekly Cell Report',
    detail: 'Submit cell attendance, souls won, discipleship, and offering reports.',
    badge: 'Weekly Report',
    number: '02',
    buttonLabel: 'Submit Report',
  },
  {
    tab: 'leader_reg',
    icon: 'diversity_3',
    title: 'Leader Sign Up',
    detail: 'Register as a BSCT, Cell Leader, or PCF Leader with your branch.',
    badge: 'Leadership',
    number: '03',
    buttonLabel: 'Join Leadership',
  },
  {
    tab: 'admin_signup',
    icon: 'church',
    title: 'Register a Church',
    detail: 'Appoint your church pastor and register a new local church branch.',
    badge: 'New Branch',
    number: '04',
    buttonLabel: 'Add Branch',
  },
];

export const HeroSection: React.FC<HeroSectionProps> = ({ onNavigate }) => {
  const reducedMotion = useReducedMotion();

  return (
    <div className="w-full max-w-[1360px] mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6 sm:space-y-8">
      {/* 1. HERO STAGE — Giant Curved Rectangle Enclosure */}
      <section className="relative rounded-[28px] sm:rounded-[36px] overflow-hidden border border-slate-200/90 shadow-xl bg-slate-950 min-h-[460px] lg:min-h-[520px] flex items-center">
        {/* Background Congregation Photography */}
        <img
          src={communityImage}
          alt="Christ Embassy Korle Bu church congregation gathered in worship"
          width={1600}
          height={912}
          className="absolute inset-0 w-full h-full object-cover object-center opacity-45 sm:opacity-50 scale-105"
          fetchPriority="high"
          referrerPolicy="no-referrer"
        />

        {/* Optical Contrast Scrim */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent sm:hidden" />

        {/* Foreground Content */}
        <div className="relative z-10 w-full p-6 sm:p-10 lg:p-14 max-w-3xl">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="space-y-4 sm:space-y-5"
          >
            {/* Unboxed Metadata Kicker */}
            <div className="flex items-center gap-2.5 text-xs font-semibold text-blue-300">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span>CEKB Group</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span>Christ Embassy Korle Bu</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="text-slate-400">Zone 1</span>
            </div>

            {/* Display Headline */}
            <h1 className="font-headline text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.08] text-balance">
              Every presence <span className="text-blue-400">counts.</span>
            </h1>

            {/* Supporting Copy */}
            <p className="text-sm sm:text-base text-slate-300 font-normal leading-relaxed max-w-2xl text-pretty">
              Behind every attendance record is a person who matters. Stay connected, verify check-in with your digital QR pass, submit weekly cell reports, and grow together in faith.
            </p>

            {/* Hero Quick Actions — Curved Controls */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Button
                variant="inverse"
                onClick={() => onNavigate('attendance')}
                className="rounded-2xl px-5 sm:px-6 py-3 font-bold text-xs sm:text-sm bg-white text-slate-900 hover:bg-slate-100 shadow-md flex items-center gap-2 group transition-all"
              >
                <span className="material-symbols-outlined text-[20px] text-blue-600 group-hover:scale-110 transition-transform">
                  how_to_reg
                </span>
                <span>Check In for Service</span>
              </Button>

              <Button
                variant="ghost"
                onClick={() => onNavigate('cell_report')}
                className="rounded-2xl px-5 sm:px-6 py-3 font-semibold text-xs sm:text-sm text-white hover:bg-white/10 border border-white/20 flex items-center gap-2 transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">assignment</span>
                <span>Submit Cell Report</span>
              </Button>
            </div>

            {/* Quiet Footer Values */}
            <div className="pt-4 flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-slate-400 border-t border-slate-800/80">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="material-symbols-outlined text-[16px] text-blue-400">verified</span>
                Verified Attendance
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="material-symbols-outlined text-[16px] text-blue-400">groups</span>
                Cell Fellowship
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="material-symbols-outlined text-[16px] text-blue-400">trending_up</span>
                Leader Growth
              </span>
            </div>
          </motion.div>
        </div>

        {/* Ambient Corner Badge */}
        <div className="hidden lg:flex absolute right-8 bottom-8 items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-xs text-slate-300">
          <span className="material-symbols-outlined text-blue-400 text-[18px]">church</span>
          <span>Faith · Fellowship · Family</span>
        </div>
      </section>

      {/* 2. PRIMARY ACTION CARDS — 4 Independent Curved Rectangles */}
      <section aria-label="Portal Services & Quick Access">
        <div className="flex items-baseline justify-between mb-4 px-1">
          <div>
            <p className="text-[11px] font-bold tracking-wider text-blue-700 uppercase">
              Connected Church Services
            </p>
            <h2 className="font-headline text-xl sm:text-2xl font-extrabold text-slate-900">
              Choose your action
            </h2>
          </div>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Direct access for members, leaders, and admins
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {actionCards.map((card, idx) => (
            <motion.div
              key={card.tab}
              initial={reducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.06 }}
            >
              <Button
                variant="ghost"
                onClick={() => onNavigate(card.tab)}
                className="w-full h-full p-6 sm:p-7 rounded-[24px] border border-slate-200/90 bg-white hover:bg-slate-50/70 hover:border-blue-500/60 shadow-sm hover:shadow-md transition-all flex flex-col justify-between items-start text-left group gap-5"
              >
                {/* Card Top: Rounded Icon Box + Number */}
                <div className="flex items-center justify-between w-full">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
                    <span className="material-symbols-outlined text-[24px]">
                      {card.icon}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-slate-400">
                    {card.number}
                  </span>
                </div>

                {/* Card Content */}
                <div className="space-y-1.5 w-full">
                  <h3 className="font-headline text-lg sm:text-xl font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-normal">
                    {card.detail}
                  </p>
                </div>

                {/* Card Bottom CTA Strip */}
                <div className="w-full pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-700">
                  <span>{card.buttonLabel}</span>
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </Button>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};
