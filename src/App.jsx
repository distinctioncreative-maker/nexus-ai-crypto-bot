import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Bot, ShieldAlert, BookOpen, Activity, LayoutDashboard, BrainCircuit, BarChart3, Binary, Briefcase } from 'lucide-react';
import { useStore } from './store/useStore';
import { initWebSocket } from './services/websocket';
import './App.css';

// Components
import SetupWizard from './components/SetupWizard';
import Dashboard from './components/Dashboard';
import BacktestModule from './components/BacktestModule';
import AgentsPage from './components/AgentsPage';
import DataLabPage from './components/DataLabPage';
import IntelligencePage from './components/IntelligencePage';
import PortfolioPage from './components/PortfolioPage';

function App() {
  const { isConfigured, setIsConfigured, isLiveMode, toggleTradingMode, tutorialsActive, toggleTutorials } = useStore();

  // Initial Boot Check
  useEffect(() => {
    fetch('http://localhost:3001/api/status')
      .then(res => res.json())
      .then(data => {
          setIsConfigured(data.isConfigured);
          if (data.isConfigured) {
              initWebSocket();
          }
      })
      .catch(err => console.error("Backend offline", err));
  }, [setIsConfigured]);

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

  return (
    <BrowserRouter>
      <div className={`app-container ${isLiveMode ? 'live-mode' : 'paper-mode'}`}>
        {/* Universal Top Bar */}
        <nav className="navbar top-nav">
          <div className="brand">
            <Bot className="logo-icon pulse" size={28} />
            <div className="brand-text">
                <span className="brand-name text-gradient">Kalshi Enterprise</span>
                <span className="version-tag">Build: Zenith-V1</span>
            </div>
          </div>
          
          <div className="system-controls">
            {/* The Master Toggle */}
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
                <span>Encrypted Enclave Active</span>
            </div>
          </div>
        </nav>

        <div className="app-layout">
            {/* App Navigation (Sidebar on Desktop, Bottom Tab Bar on Mobile) */}
            <nav className="app-navigation">
                 <NavLink to="/" className={({isActive}) => `nav-btn ${isActive ? 'active' : ''}`}>
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

            {/* Main Content Area */}
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
