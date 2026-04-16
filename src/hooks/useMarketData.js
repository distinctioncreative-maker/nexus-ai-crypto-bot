import { useState, useEffect, useRef } from 'react';

export const ASSETS = {
  BTC:  { basePrice: 67250,  name: 'Bitcoin',  symbol: 'BTC',  volatility: 140,   color: '#F7931A' },
  ETH:  { basePrice: 3420,   name: 'Ethereum', symbol: 'ETH',  volatility: 28,    color: '#627EEA' },
  SOL:  { basePrice: 152.5,  name: 'Solana',   symbol: 'SOL',  volatility: 2.2,   color: '#9945FF' },
  DOGE: { basePrice: 0.1625, name: 'Dogecoin', symbol: 'DOGE', volatility: 0.0028,color: '#C2A633' },
};

const AI_THOUGHTS = [
  (a, p) => `RSI(14) at ${(Math.random()*30+55).toFixed(1)} — approaching overbought on ${a}/USD`,
  (a, p) => `MACD histogram turning positive on ${a} 4H chart`,
  (a, p) => `Volume spike +${(Math.random()*40+20).toFixed(0)}% above 20-period SMA`,
  (a, p) => `Key support identified at $${(p*0.986).toFixed(p < 1 ? 5 : 2)}`,
  (a, p) => `Bollinger Band squeeze forming — breakout imminent`,
  (a, p) => `Order flow imbalance: ${(Math.random()*20+55).toFixed(0)}% bid pressure detected`,
  (a, p) => `EMA(9) crossing above EMA(21) — bullish divergence signal`,
  (a, p) => `Funding rate ${(Math.random()*0.08-0.02).toFixed(3)}% — market neutral positioning`,
  (a, p) => `Placing limit order at $${(p*(1+(Math.random()-0.5)*0.004)).toFixed(p < 1 ? 5 : 2)}`,
  (a, p) => `Liquidation cluster detected below $${(p*0.972).toFixed(p < 1 ? 5 : 2)}`,
  (a, p) => `Open interest up ${(Math.random()*15+5).toFixed(1)}% in last 2 hours`,
  (a, p) => `Stoch RSI: K=${Math.floor(Math.random()*40+20)} D=${Math.floor(Math.random()*40+20)} — oversold bounce likely`,
  (a, p) => `Neural confidence: ${(Math.random()*14+79).toFixed(1)}% LONG signal`,
  (a, p) => `Scanning correlated assets for confirmation signals`,
  (a, p) => `ATR(14) expanding — volatility regime shift detected`,
  (a, p) => `Cross-asset correlation BTC/ETH = ${(Math.random()*0.2+0.78).toFixed(2)}`,
];

const AI_STATUSES = [
  'Analyzing markets...',
  'Scanning order flow...',
  'Detecting alpha signals...',
  'Monitoring positions...',
  'Calibrating model...',
];

function generateSeedData(asset, points = 80) {
  const { basePrice, volatility } = ASSETS[asset];
  const data = [];
  let price = basePrice * (1 + (Math.random() - 0.5) * 0.015);
  for (let i = points; i >= 0; i--) {
    const t = new Date();
    t.setMinutes(t.getMinutes() - i);
    const trend = Math.sin(i / 20) * volatility * 0.4;
    price = Math.max(price + (Math.random() - 0.49) * volatility + trend, basePrice * 0.75);
    data.push({
      time: t.toISOString(),
      price,
      formattedTime: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  }
  return data;
}

function generateOrderBook(price, asset) {
  const step = price * 0.0004;
  const bids = Array.from({ length: 8 }, (_, i) => ({
    price: price - (i + 1) * step * (0.8 + Math.random() * 0.4),
    size: (Math.random() * 3 + 0.05).toFixed(asset === 'DOGE' ? 0 : 3),
    depth: Math.random(),
  }));
  const asks = Array.from({ length: 8 }, (_, i) => ({
    price: price + (i + 1) * step * (0.8 + Math.random() * 0.4),
    size: (Math.random() * 3 + 0.05).toFixed(asset === 'DOGE' ? 0 : 3),
    depth: Math.random(),
  }));
  return { bids, asks };
}

const SEED_TRADES = [
  { id: 1, type: 'buy',  asset: 'BTC',  amount: '0.0153', entryPrice: 65120.50, exitPrice: 66280.00, pnl: 17.74, time: '09:14:22' },
  { id: 2, type: 'sell', asset: 'ETH',  amount: '0.500',  entryPrice: 3380.00,  exitPrice: 3290.00,  pnl: -45.00,time: '10:02:11' },
  { id: 3, type: 'buy',  asset: 'SOL',  amount: '5.00',   entryPrice: 148.20,   exitPrice: 155.40,   pnl: 36.00, time: '11:30:05' },
  { id: 4, type: 'buy',  asset: 'BTC',  amount: '0.0082', entryPrice: 66500.00, exitPrice: 67100.00, pnl: 4.92,  time: '12:15:33' },
  { id: 5, type: 'sell', asset: 'DOGE', amount: '2000',   entryPrice: 0.1690,   exitPrice: 0.1625,   pnl: -13.00,time: '13:44:19' },
];

export function useMarketData(isConnected, activeAsset = 'BTC') {
  const activeAssetRef  = useRef(activeAsset);
  const pricesRef       = useRef({});
  const thoughtIdx      = useRef(0);

  useEffect(() => { activeAssetRef.current = activeAsset; }, [activeAsset]);

  // ── Initial state ──────────────────────────────────────────────────────────
  const [allData, setAllData] = useState(() => {
    const d = {};
    Object.keys(ASSETS).forEach(a => { d[a] = generateSeedData(a); });
    return d;
  });

  const [prices, setPrices] = useState(() => {
    const p = {};
    Object.keys(ASSETS).forEach(a => {
      const seed = allData?.[a] ?? generateSeedData(a);
      p[a] = seed[seed.length - 1].price;
    });
    pricesRef.current = p;
    return p;
  });

  const [openPrices] = useState(() => {
    const p = {};
    Object.keys(ASSETS).forEach(a => {
      const seed = allData?.[a] ?? generateSeedData(a);
      p[a] = seed[0].price;
    });
    return p;
  });

  const [aiStatus,   setAiStatus]   = useState('Standby');
  const [aiThoughts, setAiThoughts] = useState([]);
  const [trades,     setTrades]     = useState(SEED_TRADES);
  const [balance,    setBalance]    = useState(12847.32);
  const [orderBook,  setOrderBook]  = useState(() =>
    generateOrderBook(ASSETS['BTC'].basePrice, 'BTC')
  );

  // ── Order book refresh ─────────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const p = pricesRef.current[activeAsset] ?? ASSETS[activeAsset].basePrice;
      setOrderBook(generateOrderBook(p, activeAsset));
    }, 2500);
    return () => clearInterval(iv);
  }, [activeAsset]);

  // ── Live price + AI ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isConnected) {
      setAiStatus('Disconnected');
      setAiThoughts([]);
      return;
    }

    setAiStatus('Initializing neural engine...');

    // seed a few thoughts immediately
    const asset = activeAssetRef.current;
    const price = pricesRef.current[asset] ?? ASSETS[asset].basePrice;
    const initialThoughts = AI_THOUGHTS
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((fn, i) => ({
        id: i,
        text: fn(asset, price),
        time: new Date(Date.now() - (3 - i) * 7000).toLocaleTimeString(),
        type: 'analysis',
      }));
    setAiThoughts(initialThoughts);

    // ── price tick ──
    const priceIv = setInterval(() => {
      setAllData(prev => {
        const next = { ...prev };
        const nextPrices = { ...pricesRef.current };

        Object.keys(ASSETS).forEach(a => {
          const { volatility, basePrice } = ASSETS[a];
          const last = prev[a][prev[a].length - 1].price;
          const trend = Math.sin(Date.now() / 14000) * volatility * 0.25;
          const change = (Math.random() - 0.5) * volatility * 0.9 + trend;
          const newPrice = Math.max(last + change, basePrice * 0.65);
          nextPrices[a] = newPrice;

          // occasional AI trade
          if (a === activeAssetRef.current && Math.abs(change) > volatility * 0.7 && Math.random() > 0.65) {
            const type = change < 0 ? 'buy' : 'sell';
            executeTrade(type, newPrice, a);
          }

          const pt = {
            time: new Date().toISOString(),
            price: newPrice,
            formattedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          const arr = [...prev[a], pt];
          if (arr.length > 80) arr.shift();
          next[a] = arr;
        });

        pricesRef.current = nextPrices;
        setPrices(nextPrices);
        return next;
      });
    }, 2000);

    // ── AI thought tick ──
    const thoughtIv = setInterval(() => {
      const a = activeAssetRef.current;
      const p = pricesRef.current[a] ?? ASSETS[a].basePrice;
      const fn = AI_THOUGHTS[thoughtIdx.current % AI_THOUGHTS.length];
      thoughtIdx.current++;

      setAiThoughts(prev => [{
        id: Date.now(),
        text: fn(a, p),
        time: new Date().toLocaleTimeString(),
        type: Math.random() > 0.78 ? 'action' : 'analysis',
      }, ...prev].slice(0, 14));

      setAiStatus(AI_STATUSES[Math.floor(Math.random() * AI_STATUSES.length)]);
    }, 3800);

    return () => {
      clearInterval(priceIv);
      clearInterval(thoughtIv);
    };
  }, [isConnected]);

  const executeTrade = (type, price, asset) => {
    setAiStatus(`Executing ${type.toUpperCase()} order...`);
    setTimeout(() => {
      const qty =
        asset === 'BTC'  ? (Math.random() * 0.04 + 0.005).toFixed(4) :
        asset === 'ETH'  ? (Math.random() * 0.8  + 0.1  ).toFixed(3) :
        asset === 'SOL'  ? (Math.random() * 8    + 1    ).toFixed(2) :
                           (Math.random() * 1500 + 200  ).toFixed(0);

      setTrades(prev => [{
        id: Date.now(),
        type, asset,
        amount: qty,
        entryPrice: price,
        exitPrice: null,
        pnl: null,
        time: new Date().toLocaleTimeString(),
      }, ...prev].slice(0, 20));

      setBalance(prev =>
        type === 'sell'
          ? prev + price * parseFloat(qty) * (Math.random() * 0.018 + 0.003)
          : prev - price * parseFloat(qty) * 0.008
      );
    }, 700);
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const data         = allData[activeAsset] ?? [];
  const currentPrice = prices[activeAsset]  ?? ASSETS[activeAsset].basePrice;
  const openPrice    = openPrices[activeAsset] ?? currentPrice;
  const priceChange  = currentPrice - openPrice;
  const priceChangePct = (priceChange / openPrice) * 100;

  const closedTrades   = trades.filter(t => t.pnl !== null);
  const winRate        = closedTrades.length > 0
    ? ((closedTrades.filter(t => t.pnl > 0).length / closedTrades.length) * 100).toFixed(0)
    : '—';
  const dailyPnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);

  return {
    data, allData, prices, currentPrice, priceChange, priceChangePct,
    aiStatus, aiThoughts, trades, balance, orderBook,
    winRate, dailyPnl, totalTrades: trades.length, ASSETS,
  };
}
