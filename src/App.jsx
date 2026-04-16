import React, { useState } from 'react';
import './App.css';
import { Cpu } from 'lucide-react';
import Dashboard from './components/Dashboard';
import BacktestModule from './components/BacktestModule';
import PortfolioPage from './components/PortfolioPage';
import AIConfigPage from './components/AIConfigPage';

const TABS = [
  { id: 'dashboard', label: 'Terminal' },
  { id: 'backtest', label: 'Backtesting' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'ai-config', label: 'AI Config' },
];

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isConnected, setIsConnected] = useState(false);

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="brand">
          <div className="logo-wrapper">
            <Cpu className="logo-icon" size={16} />
          </div>
          <span className="brand-name text-gradient">Nexus AI</span>
        </div>

        <div className="nav-links">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {activeTab === tab.id && <span className="nav-indicator" />}
            </button>
          ))}
        </div>

        <button
          className={`connect-btn ${isConnected ? 'connected' : ''}`}
          onClick={() => setIsConnected(v => !v)}
        >
          {isConnected
            ? <><span className="live-indicator" /> Live · Coinbase</>
            : <><span className="dot-offline" /> Connect Exchange</>
          }
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'dashboard'  && <Dashboard isConnected={isConnected} />}
        {activeTab === 'backtest'   && <BacktestModule />}
        {activeTab === 'portfolio'  && <PortfolioPage />}
        {activeTab === 'ai-config'  && <AIConfigPage isConnected={isConnected} />}
      </main>
    </div>
  );
}

export default App;
