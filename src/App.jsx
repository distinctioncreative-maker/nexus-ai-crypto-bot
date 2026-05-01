import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Bot, BookOpen, Activity, LayoutDashboard, BrainCircuit, Binary, Briefcase, LogOut, Radio, KeyRound, ShieldAlert, MoreHorizontal } from 'lucide-react';
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
import ChangelogPage from './components/ChangelogPage';
import EngineControl from './components/EngineControl';

function App() {
  const {
    isConfigured, setIsConfigured, isLiveMode, setIsLiveMode,
    engineStatus, setEngineStatus, tutorialsActive, toggleTutorials, tradingMode, setTradingMode,
    hasCoinbaseKeys, setHasCoinbaseKeys,
  } = useStore();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [backendError, setBackendError] = useState('');
  const [showLiveConfirm, setShowLiveConfirm] = useState(false);
  const [showReconfigure, setShowReconfigure] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const [sessionWarning, setSessionWarning] = useState(false);
  const sessionWarnTimerRef = useRef(null);

  // Listen for Supabase auth state changes
  useEffect(() => {
    const scheduleSessionWarning = (session) => {
      clearTimeout(sessionWarnTimerRef.current);
      setSessionWarning(false);
      if (!session?.expires_at) return;
      const expiresMs = session.expires_at * 1000;
      const warnAt = expiresMs - 5 * 60 * 1000; // 5 min before
      const delay = warnAt - Date.now();
      if (delay > 0) {
        sessionWarnTimerRef.current = setTimeout(() => setSessionWarning(true), delay);
      }
    };

    const checkSession = async () => {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          scheduleSessionWarning(session);
        }
      } else {
        setUser({ id: 'local-dev-user', email: 'dev@local' });
      }
      setAuthLoading(false);
    };
    checkSession();

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        setUser(session?.user || null);
        if (!session) {
          setIsConfigured(false);
          closeWebSocket();
          setSessionWarning(false);
          clearTimeout(sessionWarnTimerRef.current);
        }
        if (event === 'TOKEN_REFRESHED' && session) {
          scheduleSessionWarning(session);
          setSessionWarning(false);
          closeWebSocket();
          initWebSocket();
        }
      });
      return () => {
        subscription.unsubscribe();
        clearTimeout(sessionWarnTimerRef.current);
      };
    }
  }, [setIsConfigured]);

  // Set --vh CSS variable for iOS viewport height fix (keyboard avoidance)
  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    };
    setVh();
    window.addEventListener('resize', setVh);
    return () => window.removeEventListener('resize', setVh);
  }, []);

  // When user is authenticated, check if their keys are set up
  useEffect(() => {
    if (!user) return;

    authFetch(apiUrl('/api/status'))
      .then(readApiResponse)
      .then(data => {
        setIsConfigured(data.isConfigured);
        setHasCoinbaseKeys(!!data.hasCoinbaseKeys);
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
        {import.meta.env.DEV && <DebugPanel />}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="brand-name text-gradient">Quant</span>
                {isLiveMode && (
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.08em', padding: '0.1rem 0.45rem', borderRadius: '4px', background: 'rgba(255,69,58,0.2)', color: 'var(--accent-red)', border: '1px solid rgba(255,69,58,0.4)' }}>
                    LIVE
                  </span>
                )}
              </div>
              <span className="version-tag">{user.email}</span>
            </div>
          </div>

          {/* Mobile-only: just the notification bell — clean fintech navbar */}
          <div className="navbar-mobile-bell">
            <NotificationCenter />
          </div>

          {/* Desktop system controls */}
          <div className="system-controls">
            <EngineControl onLiveRequest={() => setShowLiveConfirm(true)} />
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

        {sessionWarning && (
          <div style={{
            position: 'sticky', top: 0, zIndex: 900,
            background: 'rgba(255,159,10,0.12)', borderBottom: '1px solid rgba(255,159,10,0.3)',
            padding: '0.4rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: '0.78rem', color: 'var(--accent-orange)',
          }}>
            <span>⚠ Session expires in ~5 minutes. <strong>Save any open settings</strong> before your session refreshes.</span>
            <button onClick={() => setSessionWarning(false)} style={{ background: 'none', border: 'none', color: 'var(--accent-orange)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>✕</button>
          </div>
        )}

        <div className="app-layout" onClick={() => setMobileMenuOpen(false)}>
          <nav className="app-navigation" onClick={() => setMoreDrawerOpen(false)}>
            <NavLink to="/" className={({isActive}) => `nav-btn ${isActive ? 'active' : ''}`} end>
              <LayoutDashboard size={22}/> <span className="nav-label">Trading</span>
            </NavLink>
            <NavLink to="/portfolio" className={({isActive}) => `nav-btn ${isActive ? 'active' : ''}`}>
              <Briefcase size={22}/> <span className="nav-label">Portfolio</span>
            </NavLink>
            <NavLink to="/agents" className={({isActive}) => `nav-btn ${isActive ? 'active' : ''}`}>
              <Activity size={22}/> <span className="nav-label">Strategies</span>
            </NavLink>
            <NavLink to="/situation-room" className={({isActive}) => `nav-btn ${isActive ? 'active' : ''}`}>
              <Radio size={22}/> <span className="nav-label">Ask AI</span>
            </NavLink>

            {/* Secondary nav — visible on desktop, hidden on mobile (shown in More drawer) */}
            <NavLink to="/intelligence" className={({isActive}) => `nav-btn nav-secondary ${isActive ? 'active' : ''}`}>
              <BrainCircuit size={22}/> <span className="nav-label">Market Intel</span>
            </NavLink>
            <NavLink to="/backtest" className={({isActive}) => `nav-btn nav-secondary ${isActive ? 'active' : ''}`}>
              <Binary size={22}/> <span className="nav-label">Backtest</span>
            </NavLink>
            <NavLink to="/changelog" className={({isActive}) => `nav-btn nav-secondary ${isActive ? 'active' : ''}`}>
              <BookOpen size={22}/> <span className="nav-label">Guide</span>
            </NavLink>

            {/* More button — only visible on mobile */}
            <button
              className="nav-btn nav-more-btn"
              onClick={e => { e.stopPropagation(); setMoreDrawerOpen(v => !v); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: moreDrawerOpen ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
            >
              <MoreHorizontal size={22}/>
              <span className="nav-label">More</span>
            </button>
          </nav>

          {/* More drawer — slides up on mobile with secondary nav items */}
          {moreDrawerOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 499 }}
                onClick={() => setMoreDrawerOpen(false)}
              />
              <div className="nav-more-drawer">
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto 1rem' }} />
                <NavLink to="/intelligence" className={({isActive}) => `nav-btn ${isActive ? 'active' : ''}`} onClick={() => setMoreDrawerOpen(false)}
                  style={{ flexDirection: 'row', gap: '0.75rem', padding: '0.75rem', borderRadius: 12 }}>
                  <BrainCircuit size={20}/> <span>Market Intel</span>
                </NavLink>
                <NavLink to="/backtest" className={({isActive}) => `nav-btn ${isActive ? 'active' : ''}`} onClick={() => setMoreDrawerOpen(false)}
                  style={{ flexDirection: 'row', gap: '0.75rem', padding: '0.75rem', borderRadius: 12 }}>
                  <Binary size={20}/> <span>Backtest</span>
                </NavLink>
                <NavLink to="/changelog" className={({isActive}) => `nav-btn ${isActive ? 'active' : ''}`} onClick={() => setMoreDrawerOpen(false)}
                  style={{ flexDirection: 'row', gap: '0.75rem', padding: '0.75rem', borderRadius: 12 }}>
                  <BookOpen size={20}/> <span>Guide</span>
                </NavLink>
              </div>
            </>
          )}

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
                <Route path="/changelog" element={<ChangelogPage />} />
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
            riskSettings={useStore.getState().riskSettings}
            onConfirm={() => {
            updateEngineStatus('LIVE_RUNNING');
            setShowLiveConfirm(false);
          }}
          onCancel={() => setShowLiveConfirm(false)}
        />
      )}

      {import.meta.env.DEV && <DebugPanel />}

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
