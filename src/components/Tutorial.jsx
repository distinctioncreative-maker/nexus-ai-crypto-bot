import React, { useState } from 'react';
import { Cpu, Activity, Bot, Radio, Database, Wallet, X, ArrowRight, ArrowLeft } from 'lucide-react';

const ICON_MAP = { Cpu, Activity, Bot, Radio, Database, Wallet };

const STEPS = [
  {
    icon: 'Cpu',
    color: '#BF5AF2',
    title: 'Welcome to NEXUS',
    subtitle: 'Your AI-powered trading command center',
    desc: "NEXUS deploys intelligent agents that monitor markets 24/7, execute trades automatically, and continuously learn from new data. This quick tour shows you what everything does.",
    tip: null,
  },
  {
    icon: 'Activity',
    color: '#0A84FF',
    tab: 'Terminal',
    title: 'Live Terminal',
    subtitle: 'Watch your AI trade in real-time',
    desc: "The Terminal shows live prices across BTC, ETH, SOL and DOGE, your AI's current thought process, the live order book, and every trade your bot executes. Hit \"Connect Exchange\" in the top right to activate.",
    tip: '💡 The purple "Neural Engine" panel shows exactly what your AI is thinking right now.',
  },
  {
    icon: 'Bot',
    color: '#30D158',
    tab: 'AI Agents',
    title: 'AI Agents',
    subtitle: 'Multiple bots, trading simultaneously',
    desc: 'Deploy separate AI agents for each cryptocurrency. Each agent runs its own strategy, manages its own risk, and trades independently. You can run all four at once or mix and match.',
    tip: '💡 Each agent can have a different risk profile — run a conservative BTC agent alongside an aggressive SOL agent.',
  },
  {
    icon: 'Radio',
    color: '#FF9F0A',
    tab: 'Intelligence',
    title: 'Market Intelligence',
    subtitle: 'OSINT monitoring — news before it moves the market',
    desc: 'NEXUS scrapes hundreds of sources in real-time: Reuters, Bloomberg, CoinTelegraph, whale wallet alerts, Reddit sentiment, and SEC filings. When something market-moving breaks, your AI reacts first.',
    tip: '💡 High-impact events (score 8+) automatically alert your active agents.',
  },
  {
    icon: 'Database',
    color: '#FF453A',
    tab: 'Data Lab',
    title: 'Data Lab',
    subtitle: "The engine that keeps your AI sharp",
    desc: "This is where NEXUS continuously collects market data, cleans it, and retrains its models. Think of it as your AI's gym — the more quality data it ingests, the better it gets at predicting price movements.",
    tip: '💡 Model accuracy improves automatically over time as more data is collected.',
  },
  {
    icon: 'Wallet',
    color: '#D4AF37',
    tab: 'Portfolio',
    title: 'Portfolio',
    subtitle: "Track what you own and how it's performing",
    desc: "See your full holdings, unrealized P&L per asset, allocation breakdown, and how you're performing vs. just holding Bitcoin. All numbers update live as prices change.",
    tip: null,
  },
];

export default function Tutorial({ onClose }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const IconComponent = ICON_MAP[current.icon];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
      animation: 'fadeIn 0.25s ease',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        background: 'rgba(12, 12, 18, 0.98)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderTop: `3px solid var(--accent-gold)`,
        borderRadius: '20px',
        padding: '2rem',
        position: 'relative',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(212,175,55,0.08)',
        animation: 'fadeInUp 0.3s ease',
      }}>
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            width: '28px', height: '28px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>

        {/* Step counter */}
        <div style={{
          fontSize: '0.62rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)',
          letterSpacing: '0.08em',
          marginBottom: '1.5rem',
        }}>
          {step + 1} / {STEPS.length}
          {current.tab && (
            <span style={{ marginLeft: '0.5rem', color: current.color, opacity: 0.8 }}>
              → {current.tab}
            </span>
          )}
        </div>

        {/* Icon */}
        <div style={{
          width: '64px', height: '64px',
          borderRadius: '18px',
          background: `${current.color}18`,
          border: `1px solid ${current.color}35`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.25rem',
          boxShadow: `0 0 30px ${current.color}20`,
        }}>
          <IconComponent size={28} color={current.color} />
        </div>

        {/* Title */}
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.5rem',
          fontWeight: 800,
          color: 'var(--text-primary)',
          lineHeight: 1.15,
          marginBottom: '0.35rem',
          letterSpacing: '0.01em',
        }}>
          {current.title}
        </h2>

        {/* Subtitle */}
        <p style={{
          fontSize: '0.82rem',
          color: current.color,
          fontWeight: 500,
          marginBottom: '1rem',
          opacity: 0.9,
        }}>
          {current.subtitle}
        </p>

        {/* Description */}
        <p style={{
          fontSize: '0.88rem',
          color: 'rgba(255,255,255,0.65)',
          lineHeight: 1.65,
          marginBottom: current.tip ? '1rem' : '1.75rem',
        }}>
          {current.desc}
        </p>

        {/* Tip */}
        {current.tip && (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '10px',
            padding: '0.65rem 0.85rem',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            marginBottom: '1.75rem',
          }}>
            {current.tip}
          </div>
        )}

        {/* Progress dots */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.4rem',
          marginBottom: '1.5rem',
        }}>
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              style={{
                width: i === step ? '20px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: i === step ? 'var(--accent-gold)' : 'rgba(255,255,255,0.15)',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
            />
          ))}
        </div>

        {/* Buttons */}
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
        }}>
          {!isFirst && (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.6rem 1rem',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.09)',
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-secondary)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}

          {!isFirst && (
            <button
              onClick={onClose}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'transparent',
                color: 'var(--text-tertiary)',
                fontSize: '0.78rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Skip
            </button>
          )}

          <button
            onClick={isLast ? onClose : () => setStep(s => s + 1)}
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.6rem 1.25rem',
              borderRadius: '10px',
              border: '1px solid rgba(212,175,55,0.35)',
              background: 'rgba(212,175,55,0.12)',
              color: 'var(--accent-gold)',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {isLast ? 'Get Started' : 'Next'}
            {!isLast && <ArrowRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
