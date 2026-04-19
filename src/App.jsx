import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Bot, ShieldAlert, BookOpen, Activity, LayoutDashboard, BrainCircuit, Binary, Briefcase, LogOut, Cpu, Radio, KeyRound } from 'lucide-react';
import { useStore } from './store/useStore';
import { initWebSocket, closeWebSocket, sendTradingModeChange, sendEngineStatusChange } from './services/websocket';
import { supabase, authFetch } from './lib/supabase';
import { apiUrl, readApiResponse } from './lib/api';
import './App.css';

// Components
import AuthPage from './components/AuthPage';
import SetupWizard from './components/SetupWizard';
import Dashboard from './components/Dashboard';
import BacktestModule from './components/BacktestModule';
import AgentsPage from './components/AgentsPage';
import SituationRoom from './components/SituationRoom';
import IntelligencePage from './components/IntelligencePage';
import PortfolioPage from './components/PortfolioPage';
import ErrorBoundary from './components/ErrorBoundary';
import NotificationCenter from './components/NotificationCenter';
import KillSwitch from './components/KillSwitch';
import RiskSettingsModal from './components/RiskSettingsModal';
import PendingTradeCard from './components/PendingTradeCard';
import LiveModeConfirmModal from './components/LiveModeConfirmModal';
import Tutorial from './components/Tutorial';
import DebugPanel from './components/DebugPanel';

function App() {
  const {
    isConfigured, setIsConfigured, isLiveMode, setIsLiveMode,
    engineStatus, setEngineStatus, tutorialsActive, toggleTutorials, tradingMode, setTradingMode
  } = useStore();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [backendError, setBackendError] = useState('');
  const [showLiveConfirm, setShowLiveConfirm] = useState(false);
  const [showReconfigure, setShowReconfigure] = useState(false);

  // Listen for Supabase auth state changes
  useEffect(() => {
    // Check existing session
    const checkSession = async () => {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
        }
      } else {
        // Local dev mode — auto-login
        setUser({ id: 'local-dev-user', email: 'dev@local' });
      }
      setAuthLoading(false);
    };
    checkSession();

    // Subscribe to auth events
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        setUser(session?.user || null);
        if (!session) {
          setIsConfigured(false);
          closeWebSocket();
        }
        // Reconnect WebSocket with fresh token when Supabase silently refreshes the JWT
        if (event === 'TOKEN_REFRESHED' && session) {
          closeWebSocket();
          initWebSocket();
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [setIsConfigured]);

  // When user is authenticated, check if their keys are set up
  useEffect(() => {
    if (!user) return;

    authFetch(apiUrl('/api/status'))
      .then(readApiResponse)
      .then(data => {
        setIsConfigured(data.isConfigured);
        if (data.engineStatus) setEngineStatus(data.engineStatus);
        if (typeof data.isLiveMode === 'boolean') setIsLiveMode(data.isLiveMode);
        if (data.tradingMode) setTradingMode(data.tradingMode);
        if (data.isConfigured) {
          initWebSocket();
        }
      })
      .catch(err => {
        console.error("Backend check failed:", err);
        setIsConfigured(false);
        setBackendError(err.message === 'Failed to fetch'
            ? 'Cannot reach backend server. Check your connection or Railway deployment.'
            : `Backend error: ${err.message}`
        );
      });
  }, [user, setIsConfigured, setEngineStatus, setIsLiveMode, setTradingMode]);

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setIsConfigured(false);
    closeWebSocket();
  };

  const updateEngineStatus = (nextStatus) => {
    // Send via WebSocket — the WS handler in server/index.js persists + broadcasts back
    sendEngineStatusChange(nextStatus);
    // Optimistically update local state so the button flips immediately
    setEngineStatus(nextStatus);
  };

  if (authLoading) return null;

  // Gate 1: Not authenticated → show Auth Page
  if (!user) {
    return <AuthPage onAuth={(u) => setUser(u)} />;
  }

  // Gate 2: Authenticated but keys not configured → show Setup Wizard
  if (!isConfigured) {
    return (
      <div className="app-container">
        {backendError && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: 'rgba(255,69,58,0.15)', border: '1px solid rgba(255,69,58,0.4)', padding: '0.6rem 1.25rem', fontSize: '0.8rem', color: '#ff453a', textAlign: 'center' }}>
            ⚠️ {backendError}
          </div>
        )}
        <SetupWizard onComplete={() => {
          setIsConfigured(true);
          setBackendError('');
          initWebSocket();
        }} />
        <DebugPanel />
      </div>
    );
  }

  // Gate 3: Fully authenticated + configured → show Trading Terminal
  return (
    <BrowserRouter>
      <div className={`app-container ${isLiveMode ? 'live-mode' : 'paper-mode'}`}>
        <nav className="navbar top-nav">
          <div className="brand">
            <Bot className="logo-icon pulse" size={28} />
            <div className="brand-text">
              <span className="brand-name text-gradient">Quant</span>
              <span className="version-tag">{user.email}</span>
            </div>
          </div>

          <div className="system-controls">
            <div className="mode-toggle-container" title="Halt execution engine — no orders will be placed">
              <button
                className={`mode-pill ${engineStatus === 'STOPPED' ? 'stopped' : ''}`}
                onClick={() => updateEngineStatus('STOPPED')}
                style={{ border: 'none', cursor: 'pointer' }}
              >
                <ShieldAlert size={16}/> STOPPED
              </button>
            </div>

            <div className="mode-toggle-container" title="Run paper simulation — virtual trades only">
              <button
                className={`mode-pill ${engineStatus === 'PAPER_RUNNING' ? 'paper' : ''}`}
                onClick={() => updateEngineStatus('PAPER_RUNNING')}
                style={{ border: 'none', cursor: 'pointer' }}
              >
                <Binary size={16}/> PAPER
              </button>
            </div>

            <div className="mode-toggle-container" title="Live trading — AI Assisted, real Coinbase orders">
              <button
                className={`mode-pill ${engineStatus === 'LIVE_RUNNING' ? 'live' : ''}`}
                onClick={() => setShowLiveConfirm(true)}
                style={{ border: 'none', cursor: 'pointer' }}
              >
                <ShieldAlert size={16}/> LIVE
              </button>
            </div>

            {/* Trading mode toggle: Full Auto / AI Assisted */}
            <div
              className="mode-toggle-container"
              onClick={() => {
                const next = tradingMode === 'FULL_AUTO' ? 'AI_ASSISTED' : 'FULL_AUTO';
                sendTradingModeChange(next);
              }}
              title={tradingMode === 'FULL_AUTO' ? 'Full Auto: AI executes without confirmation' : 'AI Assisted: You confirm each trade'}
            >
              <div className={`mode-pill ${tradingMode === 'AI_ASSISTED' ? 'live' : 'paper'}`} style={{ fontSize: '0.7rem' }}>
                <Cpu size={14} />
                {tradingMode === 'AI_ASSISTED' ? 'AI ASSISTED' : 'FULL AUTO'}
              </div>
            </div>

            <KillSwitch />
            <NotificationCenter />
            <RiskSettingsModal />
            <button
              className="tutorial-btn"
              onClick={() => setShowReconfigure(true)}
              title="Update API Keys"
            >
              <KeyRound size={18} />
            </button>

            <button
              className={`tutorial-btn ${tutorialsActive ? 'active' : ''}`}
              onClick={toggleTutorials}
            >
              <BookOpen size={18} />
            </button>

            <div className="secure-badge">
              <ShieldAlert size={14} color="var(--accent-green)"/>
              <span>Encrypted Enclave</span>
            </div>

            <button className="tutorial-btn" onClick={handleSignOut} title="Sign Out">
              <LogOut size={18} />
            </button>
          </div>
        </nav>

        <div className="app-layout">
          <nav className="app-navigation">
            <NavLink to="/" className={({isActive}) => `nav-btn ${isActive ? 'active' : ''}`} end>
              <LayoutDashboard size={22}/> <span className="nav-label">Terminal</span>
            </NavLink>
            <NavLink to="/portfolio" className={({isActive}) => `nav-btn ${isActive ? 'active' : ''}`}>
              <Briefcase size={22}/> <span className="nav-label">Portfolio</span>
            </NavLink>
            <NavLink to="/intelligence" className={({isActive}) => `nav-btn ${isActive ? 'active' : ''}`}>
              <BrainCircuit size={22}/> <span className="nav-label">Intelligence</span>
            </NavLink>
            <NavLink to="/agents" className={({isActive}) => `nav-btn ${isActive ? 'active' : ''}`}>
              <Activity size={22}/> <span className="nav-label">Agents</span>
            </NavLink>
            <NavLink to="/backtest" className={({isActive}) => `nav-btn ${isActive ? 'active' : ''}`}>
              <Binary size={22}/> <span className="nav-label">Backtest</span>
            </NavLink>
            <NavLink to="/situation-room" className={({isActive}) => `nav-btn ${isActive ? 'active' : ''}`}>
              <Radio size={22}/> <span className="nav-label">Situation Room</span>
            </NavLink>
          </nav>

          <main className="main-content-area">
            <PendingTradeCard />
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/portfolio" element={<PortfolioPage />} />
                <Route path="/intelligence" element={<IntelligencePage />} />
                <Route path="/agents" element={<AgentsPage />} />
                <Route path="/backtest" element={<BacktestModule />} />
                <Route path="/situation-room" element={<SituationRoom />} />
              </Routes>
            </ErrorBoundary>
          </main>
        </div>
      </div>

      {tutorialsActive && (
        <Tutorial onClose={toggleTutorials} />
      )}

      {showLiveConfirm && (
        <LiveModeConfirmModal
            onConfirm={() => {
            updateEngineStatus('LIVE_RUNNING');
            setShowLiveConfirm(false);
          }}
          onCancel={() => setShowLiveConfirm(false)}
        />
      )}

      <DebugPanel />

      {showReconfigure && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowReconfigure(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, padding: '1rem' }}>
            <SetupWizard onComplete={() => setShowReconfigure(false)} />
          </div>
        </div>
      )}
    </BrowserRouter>
  );
}

export default App;
