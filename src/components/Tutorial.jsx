import React, { useState } from 'react';
import { BrainCircuit, LayoutDashboard, Briefcase, Activity, Binary, ShieldAlert, Cpu, X, ArrowRight, ArrowLeft, Zap } from 'lucide-react';

const ICON_MAP = { BrainCircuit, LayoutDashboard, Briefcase, Activity, Binary, ShieldAlert, Cpu, Zap };

const STEPS = [
  {
    icon: 'Cpu',
    color: '#BF5AF2',
    title: 'Welcome to Quant',
    subtitle: 'A Bloomberg-grade AI trading platform by Distinction Creative',
    desc: 'Quant deploys multi-strategy AI agents that monitor 15 markets 24/7, execute paper or live trades automatically, and continuously evolve through a tournament engine. This tour covers everything you need to know.',
    tip: null,
  },
  {
    icon: 'LayoutDashboard',
    color: '#0A84FF',
    tab: 'Terminal',
    title: 'Trading Terminal',
    subtitle: 'Live prices, real-time AI decisions',
    desc: 'The Terminal streams live Coinbase prices for BTC, ETH, SOL and 12 others via WebSocket. The Neural Engine panel shows what the AI is evaluating right now — its reasoning, confidence score, and the signal inputs it used.',
    tip: '💡 The Intelligence Strip below the metrics shows Fear & Greed, DeFi TVL trend, and Polymarket probability — the same signals your AI uses.',
  },
  {
    icon: 'Briefcase',
    color: '#D4AF37',
    tab: 'Portfolio',
    title: 'Portfolio',
    subtitle: 'Real balance, real trades, real P&L',
    desc: 'Every trade the AI executes updates your portfolio live. See your unrealized P&L, average buy price, equity curve built from actual trade history, and your allocation split between cash and holdings.',
    tip: '💡 Paper mode starts you with $100,000 virtual capital. All calculations are identical to live — only the money is virtual.',
  },
  {
    icon: 'BrainCircuit',
    color: '#FF9F0A',
    tab: 'Intelligence',
    title: 'Market Intelligence',
    subtitle: 'Multi-signal context your AI reads in real-time',
    desc: 'The Intelligence page shows the live data feeding your AI: the Crypto Fear & Greed Index (0–100), DeFi TVL 7-day trend, Polymarket BTC bull probability, and a composite score that blends all three. High fear = AI looks for buys. Euphoria = AI looks for sells.',
    tip: '💡 These signals update every 5 minutes. The composite score is what actually feeds the AI prompt — not the raw numbers.',
  },
  {
    icon: 'Activity',
    color: '#30D158',
    tab: 'Agents',
    title: 'Strategy Agents',
    subtitle: 'Five strategies competing in a live tournament',
    desc: 'Quant runs 5 strategy variants simultaneously: Momentum MA Cross, Mean Reversion RSI, Trend Following EMA, Sentiment Driven, and Combined Signal. Every 20 trades, the tournament runs — the top performers are promoted, the worst is retired, and a mutated variant of the winner is spawned.',
    tip: '💡 The winning strategy\'s parameters are injected into the AI\'s prompt automatically — the AI knows which edge is working right now.',
  },
  {
    icon: 'Binary',
    color: '#64D2FF',
    tab: 'Backtest',
    title: 'Walk-Forward Backtest',
    subtitle: 'Test strategies on real OHLCV data — no guessing',
    desc: 'Select a strategy, asset, and date range. The backtest engine fetches real historical candles from CoinGecko, applies 0.6% taker fees and 0.1% slippage, and splits the data 80/20 — training on the first 80%, testing on unseen data. No look-ahead bias.',
    tip: '💡 If a strategy looks great on training but collapses on test data, it\'s overfit. Only trust strategies that hold up in the test window.',
  },
  {
    icon: 'ShieldAlert',
    color: '#FF453A',
    tab: 'Risk Controls',
    title: 'Risk Engine + Kill Switch',
    subtitle: 'Every trade is gated by hard limits',
    desc: 'The gear icon opens Risk Settings: per-trade max (% of portfolio), daily loss limit, max single order size, volatility-based size reduction, and stop-loss/take-profit percentages. The red KILL button in the navbar instantly halts all AI activity and cancels open live orders.',
    tip: '💡 The circuit breaker trips automatically if drawdown exceeds your configured threshold — no manual action needed.',
  },
  {
    icon: 'Zap',
    color: '#FF9F0A',
    tab: 'Execution Modes',
    title: 'Paper · Live · Full Auto · AI Assisted',
    subtitle: 'Four execution modes — you choose the level of control',
    desc: 'Paper mode uses virtual capital. Live mode places real Coinbase orders (requires confirmation to activate). Full Auto means the AI executes immediately. AI Assisted shows a 60-second trade card with full reasoning — you accept or reject every trade.',
    tip: '💡 Start in Paper + AI Assisted. Once you trust the AI\'s reasoning, switch to Paper + Full Auto. Only move to Live after reviewing your risk limits.',
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
