import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Link, Newspaper, MessageCircle, BarChart2, AlertTriangle, RefreshCw, CheckCircle, Clock } from 'lucide-react';

const ICON_MAP = { TrendingUp, Link, Newspaper, MessageCircle, BarChart2, AlertTriangle };

const PIPELINE_STAGES = [
  { id: 'collect',  label: 'COLLECT',  desc: '2.1M records' },
  { id: 'clean',    label: 'CLEAN',    desc: '98.4% valid' },
  { id: 'features', label: 'FEATURES', desc: '142 signals' },
  { id: 'train',    label: 'TRAIN',    desc: 'Epoch 847' },
  { id: 'validate', label: 'VALIDATE', desc: 'Acc 74.2%' },
  { id: 'live',     label: 'LIVE',     desc: 'v2.3.1' },
];

const INIT_SOURCES = [
  { name: 'Binance Price Feed',  type: 'Price OHLCV',          icon: 'TrendingUp',   status: 'active',   recordsToday: 847320, lastUpdate: 'Just now', progress: 100, color: '#F0B90B' },
  { name: 'Glassnode On-Chain',  type: 'Blockchain metrics',   icon: 'Link',         status: 'active',   recordsToday: 24816,  lastUpdate: '8s ago',  progress: 95,  color: '#9945FF' },
  { name: 'News NLP Pipeline',   type: 'Sentiment scores',     icon: 'Newspaper',    status: 'syncing',  recordsToday: 3840,   lastUpdate: '24s ago', progress: 72,  color: '#FF9F0A' },
  { name: 'Social Sentiment',    type: 'Twitter/Reddit NLP',   icon: 'MessageCircle',status: 'active',   recordsToday: 128400, lastUpdate: '3s ago',  progress: 100, color: '#1DA1F2' },
  { name: 'Options Flow',        type: 'Derivatives data',     icon: 'BarChart2',    status: 'active',   recordsToday: 14200,  lastUpdate: '12s ago', progress: 88,  color: '#30D158' },
  { name: 'Liquidation Feed',    type: 'Forced closures',      icon: 'AlertTriangle',status: 'queued',   recordsToday: 8920,   lastUpdate: '2m ago',  progress: 45,  color: '#FF453A' },
];

const MODEL_HISTORY = [
  { version: 'v2.3.1', date: 'Apr 15', accuracy: 74.2, status: 'live' },
  { version: 'v2.3.0', date: 'Apr 10', accuracy: 72.8, status: 'archived' },
  { version: 'v2.2.5', date: 'Apr 2',  accuracy: 71.1, status: 'archived' },
];

function generateLossCurve(points = 40) {
  let loss = 0.85;
  return Array.from({ length: points }, (_, i) => {
    loss = Math.max(0.18, loss - (Math.random() * 0.04 + 0.005) + (Math.random() * 0.01));
    return { epoch: i + 1, loss: parseFloat(loss.toFixed(4)) };
  });
}

function StatusBadge({ status }) {
  const map = {
    active:   { color: 'var(--accent-green)',   bg: 'rgba(48,209,88,0.1)',   label: 'ACTIVE' },
    syncing:  { color: 'var(--accent-orange)',  bg: 'rgba(255,159,10,0.1)',  label: 'SYNCING' },
    queued:   { color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.06)', label: 'QUEUED' },
  };
  const s = map[status] || map.queued;
  return (
    <span style={{
      padding: '0.12rem 0.45rem', borderRadius: '4px',
      background: s.bg, color: s.color,
      fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em',
      fontFamily: 'var(--font-mono)',
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
    }}>
      <span style={{
        width: '4px', height: '4px', borderRadius: '50%',
        background: s.color,
        animation: status === 'active' ? 'pulseDot 2s infinite' : 'none',
      }} />
      {s.label}
    </span>
  );
}

function SourceCard({ source }) {
  const IconComp = ICON_MAP[source.icon];
  return (
    <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: `${source.color}18`, border: `1px solid ${source.color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {IconComp && <IconComp size={15} color={source.color} />}
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {source.name}
            </div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
              {source.type}
            </div>
          </div>
        </div>
        <StatusBadge status={source.status} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '6px', padding: '0.4rem 0.55rem' }}>
          <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.15rem' }}>
            Records Today
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {source.recordsToday.toLocaleString()}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.025)', borderRadius: '6px', padding: '0.4rem 0.55rem' }}>
          <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.15rem' }}>
            Last Update
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600, color: source.status === 'queued' ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
            {source.lastUpdate}
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Sync Progress</span>
          <span style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            {source.progress}%
          </span>
        </div>
        <div style={{ height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px' }}>
          <div style={{
            height: '100%', borderRadius: '2px',
            width: `${source.progress}%`,
            background: source.color,
            transition: 'width 1s ease',
          }} />
        </div>
      </div>
    </div>
  );
}

export default function DataLabPage() {
  const [sources, setSources] = useState(INIT_SOURCES);
  const [activeStage] = useState('train');
  const [lossCurve] = useState(() => generateLossCurve());
  const [accuracy, setAccuracy] = useState(74.2);
  const [epochs, setEpochs] = useState(847);
  const [isRetraining, setIsRetraining] = useState(false);
  const [retrainProgress, setRetrainProgress] = useState(0);

  // Increment records every 2 seconds
  useEffect(() => {
    const iv = setInterval(() => {
      setSources(prev => prev.map(s => {
        if (s.status === 'queued') return s;
        const rates = {
          'Binance Price Feed': 120 + Math.floor(Math.random() * 60),
          'Glassnode On-Chain': 2 + Math.floor(Math.random() * 5),
          'News NLP Pipeline':  1 + Math.floor(Math.random() * 3),
          'Social Sentiment':   30 + Math.floor(Math.random() * 20),
          'Options Flow':       3 + Math.floor(Math.random() * 4),
          'Liquidation Feed':   0,
        };
        return {
          ...s,
          recordsToday: s.recordsToday + (rates[s.name] || 0),
          lastUpdate: s.status === 'active' ? 'Just now' : s.lastUpdate,
        };
      }));
      setEpochs(prev => prev + (Math.random() > 0.7 ? 1 : 0));
      setAccuracy(prev => Math.max(70, Math.min(78, prev + (Math.random() - 0.5) * 0.1)));
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  const handleRetrain = () => {
    if (isRetraining) return;
    setIsRetraining(true);
    setRetrainProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 15 + 5;
      if (p >= 100) {
        p = 100;
        clearInterval(iv);
        setTimeout(() => {
          setIsRetraining(false);
          setRetrainProgress(0);
          setAccuracy(prev => prev + Math.random() * 0.5);
        }, 600);
      }
      setRetrainProgress(Math.min(100, p));
    }, 200);
  };

  const totalRecords = sources.reduce((s, src) => s + src.recordsToday, 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Data Lab</h1>
        <p className="page-subtitle">
          NEXUS continuously ingests market data to keep its AI models current. More data = better predictions.
        </p>
      </div>

      {/* Pipeline */}
      <div className="glass-panel" style={{ padding: '1.1rem 1.25rem', marginBottom: '1.25rem' }}>
        <div className="widget-title" style={{ marginBottom: '1rem' }}>Data Pipeline</div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0,
          overflowX: 'auto', paddingBottom: '0.25rem',
        }}>
          {PIPELINE_STAGES.map((stage, i) => {
            const isActive = stage.id === activeStage;
            const isPast = PIPELINE_STAGES.indexOf(PIPELINE_STAGES.find(s => s.id === activeStage)) > i;
            return (
              <React.Fragment key={stage.id}>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '0.6rem 1rem',
                  borderRadius: '10px',
                  background: isActive
                    ? 'rgba(212,175,55,0.12)'
                    : isPast ? 'rgba(48,209,88,0.07)' : 'rgba(255,255,255,0.03)',
                  border: isActive
                    ? '1px solid rgba(212,175,55,0.35)'
                    : isPast ? '1px solid rgba(48,209,88,0.2)' : '1px solid rgba(255,255,255,0.06)',
                  minWidth: '90px',
                  flexShrink: 0,
                  animation: isActive ? 'pulseGlowGold 2s infinite' : 'none',
                }}>
                  <span style={{
                    fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em',
                    color: isActive ? 'var(--accent-gold)'
                      : isPast ? 'var(--accent-green)' : 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {stage.label}
                  </span>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {stage.desc}
                  </span>
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <div style={{
                    flex: 1, height: '1px',
                    background: isPast ? 'rgba(48,209,88,0.3)' : 'rgba(255,255,255,0.08)',
                    minWidth: '16px', maxWidth: '40px',
                  }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
            Total records ingested today:
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginLeft: '0.4rem', fontWeight: 600 }}>
              {totalRecords.toLocaleString()}
            </span>
          </span>
        </div>
      </div>

      {/* Data Sources */}
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          Data Sources
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem', marginBottom: '1.25rem' }}>
          {sources.map(s => <SourceCard key={s.name} source={s} />)}
        </div>
      </div>

      {/* Model Training */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
        {/* Loss curve + accuracy */}
        <div className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
          <div className="widget-title" style={{ marginBottom: '0.85rem' }}>
            Model Training — Loss Curve
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.85rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.5rem 0.75rem', flex: 1 }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                Accuracy
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.35rem', fontWeight: 600, color: 'var(--accent-green)' }}>
                {accuracy.toFixed(1)}%
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.5rem 0.75rem', flex: 1 }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                Epochs
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.35rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {epochs}
              </div>
            </div>
          </div>
          <div style={{ height: '140px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lossCurve} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="epoch"
                  stroke="transparent"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                  tickLine={false} axisLine={false} minTickGap={8}
                />
                <YAxis
                  stroke="transparent"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                  tickLine={false} axisLine={false} width={40}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(10,10,14,0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px', fontSize: '0.72rem',
                  }}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                  itemStyle={{ color: 'var(--accent-purple)' }}
                />
                <Line
                  type="monotone" dataKey="loss"
                  stroke="var(--accent-purple)" strokeWidth={2}
                  dot={false} isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Loss (error) decreases as the model learns. Lower = better predictions.
          </p>
        </div>

        {/* Model version history */}
        <div className="glass-panel" style={{ padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column' }}>
          <div className="widget-title" style={{ marginBottom: '0.85rem' }}>
            Model Versions
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexGrow: 1 }}>
            {MODEL_HISTORY.map(m => (
              <div key={m.version} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.65rem 0.85rem', borderRadius: '10px',
                background: m.status === 'live' ? 'rgba(48,209,88,0.06)' : 'rgba(255,255,255,0.025)',
                border: m.status === 'live' ? '1px solid rgba(48,209,88,0.2)' : '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {m.version}
                    </span>
                    {m.status === 'live' && (
                      <span style={{
                        padding: '0.08rem 0.4rem', borderRadius: '3px',
                        background: 'rgba(48,209,88,0.15)', color: 'var(--accent-green)',
                        fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.05em',
                      }}>
                        LIVE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    {m.date} · Accuracy {m.accuracy}%
                  </div>
                </div>
                {m.status === 'live'
                  ? <CheckCircle size={15} color="var(--accent-green)" />
                  : <Clock size={15} color="var(--text-tertiary)" />
                }
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1rem' }}>
            {isRetraining ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--accent-purple)', fontWeight: 600 }}>
                    Retraining in progress...
                  </span>
                  <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {retrainProgress.toFixed(0)}%
                  </span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px' }}>
                  <div style={{
                    height: '100%', borderRadius: '2px',
                    width: `${retrainProgress}%`,
                    background: 'var(--accent-purple)',
                    transition: 'width 0.2s ease',
                  }} />
                </div>
              </div>
            ) : (
              <button
                onClick={handleRetrain}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  padding: '0.6rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(191,90,242,0.3)',
                  background: 'rgba(191,90,242,0.08)',
                  color: 'var(--accent-purple)',
                  fontSize: '0.8rem', fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <RefreshCw size={14} /> Retrain Model
              </button>
            )}
            <p style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginTop: '0.4rem', textAlign: 'center' }}>
              Retraining uses the latest collected data to improve predictions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
