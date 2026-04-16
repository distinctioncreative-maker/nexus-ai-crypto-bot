import React, { useState, useEffect } from 'react';
import './App.css';
import { Activity, Wallet, Bot, LineChart } from 'lucide-react';
import Dashboard from './components/Dashboard';
import BacktestModule from './components/BacktestModule';
import SetupWizard from './components/SetupWizard';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isConfigured, setIsConfigured] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check if backend is configured
  useEffect(() => {
    fetch('http://localhost:3001/api/status')
      .then(res => res.json())
      .then(data => {
        setIsConfigured(data.isConfigured);
        setChecking(false);
      })
      .catch((err) => {
        console.error("Backend offline", err);
        setChecking(false);
      });
  }, []);

  if (checking) return null; // or loading spinner

  if (!isConfigured) {
    return (
        <div className="app-container">
            <SetupWizard onComplete={() => setIsConfigured(true)} />
        </div>
    );
  }

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="brand">
          <Bot className="logo-icon" size={28} />
          <span className="brand-name text-gradient">Kalshi AI - Functional Edition</span>
        </div>
        
        <div className="nav-links">
          <div 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Live Paper Trading & AI
          </div>
          <div 
            className={`nav-item ${activeTab === 'backtest' ? 'active' : ''}`}
            onClick={() => setActiveTab('backtest')}
          >
            Backtesting
          </div>
        </div>

        <button 
          className="connect-btn"
          style={{ background: 'rgba(48, 209, 88, 0.2)', color: 'var(--accent-green)', outline: '1px solid var(--accent-green)'}}
        >
          Secure Session Active
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'dashboard' ? (
          <Dashboard isConnected={isConfigured} />
        ) : (
          <BacktestModule />
        )}
      </main>
    </div>
  );
}

export default App;
