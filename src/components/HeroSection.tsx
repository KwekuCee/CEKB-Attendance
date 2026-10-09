import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from './Button';
import communityImage from '../assets/community-welcome.jpg';

type Tab = 'home' | 'attendance' | 'leader_reg' | 'admin_signup' | 'login' | 'cell_report';
interface HeroSectionProps { onNavigate: (tab: Tab) => void; }

const actions: Array<{ tab: Tab; icon: string; title: string; detail: string; number: string }> = [
  { tab: 'attendance', icon: 'qr_code_scanner', title: 'Cell Attendance', detail: 'Check in for your service', number: '01' },
  { tab: 'cell_report', icon: 'assignment', title: 'Submit Cell Report', detail: 'Your weekly cell meeting', number: '02' },
  { tab: 'leader_reg', icon: 'diversity_3', title: 'Leader Sign Up', detail: 'Join your church leadership', number: '03' },
  { tab: 'admin_signup', icon: 'church', title: 'Register a Church', detail: 'Welcome your branch', number: '04' },
];

export const HeroSection: React.FC<HeroSectionProps> = ({ onNavigate }) => {
  const reducedMotion = useReducedMotion();
  return (
    <section className="welcome-page">
      <div className="welcome-scene">
        <img src={communityImage} alt="A welcoming Ghanaian church congregation" width={1600} height={912} className="welcome-image" fetchPriority="high" />
        <div className="welcome-shade" />
        <motion.div className="welcome-content" initial={reducedMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <p className="welcome-eyebrow"><span /> CEKB Group · Christ Embassy Korle Bu</p>
          <h1>Every presence counts.</h1>
          <p className="welcome-copy">Behind every attendance record is a person who matters.<br />Stay connected. Show up in faith. Grow together.</p>
          <div className="welcome-values" aria-label="Our focus">
            <span><span className="material-symbols-outlined" aria-hidden="true">how_to_reg</span>Attendance</span>
            <span><span className="material-symbols-outlined" aria-hidden="true">groups</span>Connection</span>
            <span><span className="material-symbols-outlined" aria-hidden="true">trending_up</span>Growth</span>
          </div>
        </motion.div>
        <div className="welcome-photo-caption"><span className="material-symbols-outlined">church</span><span>Faith. Fellowship. Family.</span></div>
      </div>
      <div className="welcome-actions-band">
        <div className="welcome-actions-heading"><p className="section-kicker">YOUR CHURCH, CONNECTED</p><h2>Good to see you here.</h2><span>Every person matters.</span></div>
        <div className="welcome-actions">
          {actions.map(action => (
            <Button key={action.tab} variant="ghost" className="welcome-action" onClick={() => onNavigate(action.tab)}>
              <div className="welcome-action-top"><span className="material-symbols-outlined">{action.icon}</span><span className="welcome-action-number">{action.number}</span></div>
              <span className="welcome-action-title">{action.title}</span>
              <span className="welcome-action-detail">{action.detail}</span>
              <span className="material-symbols-outlined welcome-action-arrow">arrow_forward</span>
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
};
