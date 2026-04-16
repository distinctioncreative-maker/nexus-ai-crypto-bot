import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Bot, ShieldAlert, BookOpen, Activity, LayoutDashboard, BrainCircuit, BarChart3, Binary, Briefcase, LogOut } from 'lucide-react';
import { useStore } from './store/useStore';
import { initWebSocket, closeWebSocket } from './services/websocket';
import { supabase, authFetch } from './lib/supabase';
import './App.css';

// Components
import AuthPage from './components/AuthPage';
import SetupWizard from './components/SetupWizard';
import Dashboard from './components/Dashboard';
import BacktestModule from './components/BacktestModule';
import AgentsPage from './components/AgentsPage';
import DataLabPage from './components/DataLabPage';
import IntelligencePage from './components/IntelligencePage';
import PortfolioPage from './components/PortfolioPage';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function App() {
  const { isConfigured, setIsConfigured, isLiveMode, toggleTradingMode, tutorialsActive, toggleTutorials } = useStore();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

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
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user || null);
        if (!session) {
          setIsConfigured(false);
          closeWebSocket();
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [setIsConfigured]);

  // When user is authenticated, check if their keys are set up
  useEffect(() => {
    if (!user) return;

    authFetch(`${API_URL}/api/status`)
      .then(res => res.json())
      .then(data => {
        setIsConfigured(data.isConfigured);
        if (data.isConfigured) {
          initWebSocket();
        }
      })
      .catch(err => console.error("Backend check failed:", err));
  }, [user, setIsConfigured]);

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setIsConfigured(false);
    closeWebSocket();
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
        <SetupWizard onComplete={() => {
          setIsConfigured(true);
          initWebSocket();
        }} />
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
              <span className="brand-name text-gradient">Kalshi Enterprise</span>
              <span className="version-tag">{user.email}</span>
            </div>
          </div>

          <div className="system-controls">
            <div className="mode-toggle-container" onClick={toggleTradingMode}>
              <div className={`mode-pill ${isLiveMode ? 'live' : 'paper'}`}>
                {isLiveMode ? <ShieldAlert size={16}/> : <Binary size={16}/>}
                {isLiveMode ? 'LIVE EXECUTION' : 'PAPER SIMULATION'}
              </div>
            </div>

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
            <NavLink to="/datalab" className={({isActive}) => `nav-btn ${isActive ? 'active' : ''}`}>
              <BarChart3 size={22}/> <span className="nav-label">Data Lab</span>
            </NavLink>
            <NavLink to="/backtest" className={({isActive}) => `nav-btn ${isActive ? 'active' : ''}`}>
              <Binary size={22}/> <span className="nav-label">Backtest</span>
            </NavLink>
          </nav>

          <main className="main-content-area">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/intelligence" element={<IntelligencePage />} />
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/datalab" element={<DataLabPage />} />
              <Route path="/backtest" element={<BacktestModule />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
