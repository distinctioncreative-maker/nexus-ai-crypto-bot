import { useState, useEffect } from 'react';
import { apiUrl, readApiResponse, wsUrl } from '../lib/api';

export function useMarketData(isConfigured) {
  const [data, setData] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [aiStatus, setAiStatus] = useState('Connecting to Backend...');
  const [trades, setTrades] = useState([]);
  const [balance, setBalance] = useState(0);

  // Fetch initial portfolio state
  useEffect(() => {
    if (!isConfigured) return;

    fetch(apiUrl('/api/portfolio'))
        .then(readApiResponse)
        .then(state => {
            setBalance(Math.max(0, state.balance));
            setTrades(state.trades);
        }).catch(err => console.error("Error fetching state:", err));
  }, [isConfigured]);

  // Connect to live WebSocket
  useEffect(() => {
    if (!isConfigured) {
      setAiStatus('Waiting for Secure Keys...');
      return;
    }

    setAiStatus('Connecting to Live Data Stream...');
    const ws = new WebSocket(wsUrl());

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
            case 'TICK':
                setData(prev => {
                    const newData = [...prev, {
                        formattedTime: message.payload.time,
                        price: message.payload.price,
                        time: new Date().toISOString()
                    }];
                    if (newData.length > 50) newData.shift();
                    return newData;
                });
                setCurrentPrice(message.payload.price);
                break;
            case 'AI_STATUS':
                setAiStatus(message.payload);
                break;
            case 'TRADE_EXEC':
                setTrades(prev => [message.payload, ...prev]);
                // Re-fetch balance
                fetch(apiUrl('/api/portfolio'))
                    .then(readApiResponse)
                    .then(state => setBalance(state.balance));
                break;
            default:
                break;
        }
    };

    ws.onclose = () => setAiStatus('Backend Connection Lost');
    ws.onerror = () => setAiStatus('WebSocket Error');

    return () => ws.close();
  }, [isConfigured]);

  return { data, currentPrice, aiStatus, trades, balance };
}
