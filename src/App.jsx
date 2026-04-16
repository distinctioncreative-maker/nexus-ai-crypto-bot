import React, { useState } from 'react';
import './App.css';
import { Cpu } from 'lucide-react';
import Dashboard from './components/Dashboard';
import PortfolioPage from './components/PortfolioPage';
import AgentsPage from './components/AgentsPage';
import IntelligencePage from './components/IntelligencePage';
import DataLabPage from './components/DataLabPage';
import Tutorial from './components/Tutorial';

const TABS = [
  { id: 'dashboard',    label: 'Terminal' },
  { id: 'agents',       label: 'AI Agents' },
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'data-lab',     label: 'Data Lab' },
  { id: 'portfolio',    label: 'Portfolio' },
];

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isConnected, setIsConnected] = useState(false);
  const [showTutorial, setShowTutorial] = useState(
    () => !localStorage.getItem('nexus_tutorial_seen')
  );

  const handleCloseTutorial = () => {
    localStorage.setItem('nexus_tutorial_seen', '1');
    setShowTutorial(false);
  };

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

        <div className="nav-right">
          <button
            className="help-btn"
            onClick={() => setShowTutorial(true)}
            title="Show tutorial"
          >
            ?
          </button>
          <button
            className={`connect-btn ${isConnected ? 'connected' : ''}`}
            onClick={() => setIsConnected(v => !v)}
          >
            {isConnected
              ? <><span className="live-indicator" /> Live · Coinbase</>
              : <><span className="dot-offline" /> Connect Exchange</>
            }
          </button>
        </div>
      </nav>

      <main className="main-content">
        {activeTab === 'dashboard'    && <Dashboard isConnected={isConnected} />}
        {activeTab === 'agents'       && <AgentsPage />}
        {activeTab === 'intelligence' && <IntelligencePage />}
        {activeTab === 'data-lab'     && <DataLabPage />}
        {activeTab === 'portfolio'    && <PortfolioPage />}
      </main>

      {showTutorial && <Tutorial onClose={handleCloseTutorial} />}
    </div>
  );
}

export default App;
