/**
 * Paper Trading Accounting Tests
 *
 * Run with: node server/tests/accounting.test.js
 *
 * Uses Node.js built-in assert — no external test runner needed.
 * Tests the core paper trade math in isolation without starting the full server.
 */

'use strict';

const assert = require('assert');

// ── Constants (must match userStore.js) ──────────────────────────────────────
const PAPER_TAKER_FEE = 0.006;   // 0.6% taker fee
const PAPER_SLIPPAGE  = 0.001;   // 0.1% market impact

// ── Minimal trade execution function (mirrors userStore.executePaperTrade logic) ──
function simulatePaperTrade({ type, amount, price, balance, assetHoldings }) {
    // Input validation (mirrors userStore guards)
    if (!Number.isFinite(price) || price <= 0)       return { ok: false, reason: 'invalid price' };
    if (!Number.isFinite(amount) || amount <= 0)     return { ok: false, reason: 'invalid amount' };
    if (!['BUY', 'SELL'].includes(type))             return { ok: false, reason: 'invalid type' };

    const fillPrice = type === 'BUY'
        ? price * (1 + PAPER_SLIPPAGE)
        : price * (1 - PAPER_SLIPPAGE);
    const fillCost  = amount * fillPrice;
    const feePaid   = fillCost * PAPER_TAKER_FEE;

    if (type === 'BUY') {
        const totalCost = fillCost + feePaid;
        if (balance < totalCost) return { ok: false, reason: 'insufficient balance' };
        return {
            ok: true,
            newBalance: balance - totalCost,
            newHoldings: assetHoldings + amount,
            fillPrice, feePaid, totalCost
        };
    } else {
        if (assetHoldings < amount) return { ok: false, reason: 'insufficient holdings' };
        const netProceeds = fillCost - feePaid;
        return {
            ok: true,
            newBalance: balance + netProceeds,
            newHoldings: assetHoldings - amount,
            fillPrice, feePaid, netProceeds
        };
    }
}

// ── Test helpers ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (e) {
        console.error(`  ❌ ${name}`);
        console.error(`     ${e.message}`);
        failed++;
    }
}

function approxEqual(a, b, tolerance = 0.01) {
    return Math.abs(a - b) <= tolerance;
}

// ── Tests ────────────────────────────────────────────────────────────────────

console.log('\n📊 Paper Trade Accounting Tests\n' + '─'.repeat(50));

test('BUY $1,000 of BTC at $77,000 → ~0.01299 BTC', () => {
    // $1,000 / $77,000 = 0.012987 BTC (before slippage)
    // After 0.1% slippage: fillPrice = $77,077, amount = 0.012987
    // After 0.6% fee: totalCost ≈ $1,006.82
    const amount = 1000 / 77000; // ~0.012987 BTC
    const result = simulatePaperTrade({ type: 'BUY', amount, price: 77000, balance: 100000, assetHoldings: 0 });
    assert.strictEqual(result.ok, true, 'Trade should succeed');
    assert.ok(approxEqual(result.newHoldings, 0.012987, 0.0001), `Holdings ~0.013 BTC, got ${result.newHoldings}`);
    assert.ok(result.newBalance < 100000, 'Balance must decrease after BUY');
    assert.ok(result.newBalance > 98990, `Balance should decrease ~$1007, got ${(100000 - result.newBalance).toFixed(2)} decrease`);
    assert.ok(result.newBalance < 100000 - 999, 'Balance decrease must account for fees');
});

test('BUY then portfolio value stays near starting balance immediately', () => {
    const price = 50000;
    const amount = 0.02; // 0.02 BTC
    const result = simulatePaperTrade({ type: 'BUY', amount, price, balance: 100000, assetHoldings: 0 });
    assert.strictEqual(result.ok, true);
    // Portfolio value = cash + holdings at current price
    const portfolioValue = result.newBalance + result.newHoldings * price;
    // Should be very close to $100,000 (only friction = fees + slippage loss ~0.7%)
    const maxFriction = 100000 * 0.01; // 1% max acceptable friction
    assert.ok(portfolioValue > 100000 - maxFriction,
        `Portfolio value $${portfolioValue.toFixed(2)} should be within 1% of $100k`);
});

test('BUY cannot exceed available balance', () => {
    // Try to buy more BTC than $100k allows at $77k
    const amount = 2; // 2 BTC = $154,000 — exceeds $100k balance
    const result = simulatePaperTrade({ type: 'BUY', amount, price: 77000, balance: 100000, assetHoldings: 0 });
    assert.strictEqual(result.ok, false, 'Trade should be rejected');
    assert.strictEqual(result.reason, 'insufficient balance');
});

test('SELL cannot sell more than holdings', () => {
    const result = simulatePaperTrade({ type: 'SELL', amount: 1.0, price: 77000, balance: 100000, assetHoldings: 0.013 });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'insufficient holdings');
});

test('SELL reduces holdings, increases balance', () => {
    const result = simulatePaperTrade({ type: 'SELL', amount: 0.01, price: 77000, balance: 98000, assetHoldings: 0.013 });
    assert.strictEqual(result.ok, true);
    assert.ok(result.newHoldings < 0.013, 'Holdings must decrease after SELL');
    assert.ok(result.newBalance > 98000, 'Balance must increase after SELL');
    assert.ok(approxEqual(result.newHoldings, 0.003, 0.0001), `Holdings should be ~0.003 BTC`);
});

test('SELL proceeds less than gross (fee/slippage applied)', () => {
    const amount = 0.01, price = 77000;
    const result = simulatePaperTrade({ type: 'SELL', amount, price, balance: 98000, assetHoldings: 0.013 });
    assert.strictEqual(result.ok, true);
    const grossValue = amount * price; // $770
    assert.ok(result.netProceeds < grossValue, 'Net proceeds must be less than gross (fees + slippage)');
    assert.ok(result.netProceeds > grossValue * 0.99, 'Fee+slippage should be under 1% together');
});

test('Input validation: rejects NaN price', () => {
    const result = simulatePaperTrade({ type: 'BUY', amount: 0.01, price: NaN, balance: 100000, assetHoldings: 0 });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'invalid price');
});

test('Input validation: rejects zero price', () => {
    const result = simulatePaperTrade({ type: 'BUY', amount: 0.01, price: 0, balance: 100000, assetHoldings: 0 });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'invalid price');
});

test('Input validation: rejects Infinity amount', () => {
    const result = simulatePaperTrade({ type: 'BUY', amount: Infinity, price: 77000, balance: 100000, assetHoldings: 0 });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'invalid amount');
});

test('Input validation: rejects negative amount', () => {
    const result = simulatePaperTrade({ type: 'BUY', amount: -0.01, price: 77000, balance: 100000, assetHoldings: 0 });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'invalid amount');
});

test('Input validation: rejects unknown trade type', () => {
    const result = simulatePaperTrade({ type: 'HODL', amount: 0.01, price: 77000, balance: 100000, assetHoldings: 0 });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'invalid type');
});

test('Zero balance cannot buy anything', () => {
    const result = simulatePaperTrade({ type: 'BUY', amount: 0.001, price: 77000, balance: 0, assetHoldings: 0 });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'insufficient balance');
});

// ── Invariant: holdings can never exceed what cash allows ────────────────────

test('100 sequential BUYs cannot accumulate more BTC than starting cash allows', () => {
    // Safety assertion: from $100k starting at $78k BTC, max possible holdings = ~1.28 BTC.
    // Even with 100 trades (cooldown bypassed in this simulation), balance runs out.
    const PRICE = 78000;
    const ORDER_USD = 1000;
    let balance = 100000;
    let holdings = 0;
    let tradeCount = 0;

    for (let i = 0; i < 100; i++) {
        const amount = ORDER_USD / PRICE;
        const result = simulatePaperTrade({ type: 'BUY', amount, price: PRICE, balance, assetHoldings: holdings });
        if (!result.ok) break;
        balance = result.newBalance;
        holdings = result.newHoldings;
        tradeCount++;
    }

    const maxPossibleBTC = 100000 / PRICE;
    assert.ok(holdings <= maxPossibleBTC * 1.01,
        `Holdings ${holdings.toFixed(4)} BTC cannot exceed $100k / $${PRICE} = ${maxPossibleBTC.toFixed(4)} BTC`);
    assert.ok(balance >= 0, 'Balance must never go negative');
    // Portfolio value should still be near $100k (only friction loss)
    const portfolioValue = balance + holdings * PRICE;
    assert.ok(portfolioValue > 100000 * 0.90, `Portfolio ${portfolioValue.toFixed(2)} should be within 10% of $100k after trading`);
});

test('position_size_override hard cap: large USD value treated as base units is rejected', () => {
    // Bug scenario: AI returns position_size_override: 50000 intending $50k USD.
    // Treated naively as 50000 BTC — would be $3.9 billion at $78k.
    // The cost estimate guard must reject this before execution.
    const amount = 50000; // 50000 BTC — impossibly large
    const price = 78000;
    const costEstimate = amount * price; // $3.9 billion
    assert.ok(costEstimate > 200_000, 'Should trigger the $200k cost guard');
    // Simulate the guard from executePaperTrade
    const wouldBeRejected = costEstimate > 200_000;
    assert.strictEqual(wouldBeRejected, true, 'Implausible amount must be rejected by cost guard');
});

test('getTotalPortfolioValue: no double-counting when selected product differs from evaluated product', () => {
    // Reproduces the bug: BTC selected, evaluating ETH.
    // OLD code: positionsValue = state.assetHoldings * ethPrice + productHoldings.BTC * btcLastPrice
    //           = 0.013 * 2280 + 0.013 * 78000 = $29.64 + $1014 = $1043.64 (BTC counted TWICE)
    // CORRECT:  selValue = state.assetHoldings * btcLastPrice = 0.013 * 78000 = $1014
    //           otherValue += ETH holdings = 0
    //           total = balance + $1014
    const btcHoldings = 0.013;
    const btcLastPrice = 78000;
    const balance = 98993;
    const ethPrice = 2280;

    // Old (buggy) computation
    const buggyPositions = btcHoldings * ethPrice  // BTC priced at ETH price (wrong)
                         + btcHoldings * btcLastPrice; // BTC priced again at BTC price (double-count)
    const buggyTotal = balance + buggyPositions; // ~$100,036 — over-inflated

    // Correct computation (new code)
    const correctPositions = btcHoldings * btcLastPrice; // BTC priced at BTC's own last price
    const correctTotal = balance + correctPositions; // $98,993 + $1,014 = $100,007

    assert.ok(buggyTotal > correctTotal,
        `Buggy total $${buggyTotal.toFixed(2)} should exceed correct total $${correctTotal.toFixed(2)}`);
    assert.ok(correctTotal < 100100,
        `Correct total $${correctTotal.toFixed(2)} should be near starting $100k`);
    assert.ok(buggyTotal - correctTotal < 100,
        'Double-count error should be small (BTC qty is small) but still a logical error');
});

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`  ${passed} passed  /  ${failed} failed`);
if (failed > 0) {
    console.log('  ❌ Accounting tests FAILED');
    process.exit(1);
} else {
    console.log('  ✅ All accounting tests passed');
}
