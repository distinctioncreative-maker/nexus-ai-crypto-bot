const { chromium } = require('playwright');

// ⚠️  SECURITY: Never hardcode credentials here. Set these environment variables:
//   E2E_APP_URL      — e.g. https://crypto-ai-bot-psi.vercel.app
//   E2E_BACKEND_URL  — e.g. https://kalshi-enterprise-production.up.railway.app
//   E2E_EMAIL        — test account email
//   E2E_PASSWORD     — test account password (never commit this value)
//
// NOTE: If credentials were previously hardcoded in this file and committed,
// rotate the affected account password immediately.
const APP_URL  = process.env.E2E_APP_URL      || (() => { console.error('❌ E2E_APP_URL not set'); process.exit(1); })();
const BACKEND  = process.env.E2E_BACKEND_URL  || (() => { console.error('❌ E2E_BACKEND_URL not set'); process.exit(1); })();
const EMAIL    = process.env.E2E_EMAIL        || (() => { console.error('❌ E2E_EMAIL not set'); process.exit(1); })();
const PASSWORD = process.env.E2E_PASSWORD     || (() => { console.error('❌ E2E_PASSWORD not set'); process.exit(1); })();

const ok   = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => console.log(`  ❌ ${msg}`);
const info = (msg) => console.log(`  ℹ  ${msg}`);
const warn = (msg) => console.log(`  ⚠️  ${msg}`);

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const jsErrors = [];
    const wsMessages = [];
    let tickCount = 0;
    let lastTickTime = 0;
    let tickGaps = [];

    page.on('console', msg => {
        if (msg.type() === 'error') jsErrors.push(msg.text());
    });
    page.on('pageerror', err => jsErrors.push(err.message));

    // Intercept WebSocket messages via CDP
    const client = await page.context().newCDPSession(page);
    await client.send('Network.enable');
    client.on('Network.webSocketFrameReceived', ({ response }) => {
        try {
            const msg = JSON.parse(response.payloadData);
            wsMessages.push({ type: msg.type, time: Date.now() });
            if (msg.type === 'TICK') {
                const now = Date.now();
                if (lastTickTime > 0) tickGaps.push(now - lastTickTime);
                lastTickTime = now;
                tickCount++;
            }
        } catch {}
    });

    let passed = 0, failed = 0;
    function assert(condition, label) {
        if (condition) { ok(label); passed++; } else { fail(label); failed++; }
    }

    console.log(`\n🎭 E2E Full Audit — ${APP_URL}\n`);

    // ── CP1: App Loads ───────────────────────────────────────────────────────
    console.log('[ CP1 ] App loads');
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });
    assert((await page.title()).includes('Quant'), `Title: "${await page.title()}"`);
    assert(await page.locator('#root').count() > 0, 'React root mounted');
    const reactErrors = jsErrors.filter(e => /Minified React|hooks|useState/.test(e));
    assert(reactErrors.length === 0, `No React hook errors (${jsErrors.length} console errors)`);
    if (jsErrors.length > 0) jsErrors.slice(0, 3).forEach(e => info(`console error: ${e.slice(0, 120)}`));
    await page.screenshot({ path: '/tmp/quant-cp1-landing.png' });
    info('Screenshot → /tmp/quant-cp1-landing.png');

    // ── CP2: Auth Gate & Login ───────────────────────────────────────────────
    console.log('\n[ CP2 ] Auth gate + login');
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    await emailInput.waitFor({ timeout: 8000 });
    assert(await emailInput.count() > 0, 'Email input visible');
    assert(await page.locator('input[type="password"]').count() > 0, 'Password input visible');

    // Log in with credentials
    await emailInput.fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    info(`Signing in as ${EMAIL}… (password redacted)`);

    // Wait for either setup wizard or dashboard
    await page.waitForSelector(
        '[class*="setup"], [class*="dashboard"], .app-layout, .app-container',
        { timeout: 20000 }
    ).catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/quant-cp2-after-login.png' });
    info('Screenshot → /tmp/quant-cp2-after-login.png');

    const isOnDashboard = await page.locator('.app-layout, .app-navigation').count() > 0;
    const isOnSetup = await page.locator('[class*="setup-wizard"], [class*="SetupWizard"]').count() > 0;
    info(`Post-login state: dashboard=${isOnDashboard}, setup=${isOnSetup}`);

    // Handle Setup Wizard if shown
    if (isOnSetup || (!isOnDashboard && await page.getByRole('button', { name: /launch paper trading|start paper|continue/i }).count() > 0)) {
        info('Setup wizard detected — clicking Launch Paper Trading');
        const launchBtn = page.getByRole('button', { name: /launch paper trading|start paper|continue/i }).first();
        if (await launchBtn.count() > 0) {
            await launchBtn.click();
            await page.waitForSelector('.app-layout, .app-navigation', { timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(2000);
        }
    }

    const dashboardVisible = await page.locator('.app-layout, .app-navigation').count() > 0;
    assert(dashboardVisible, 'Trading terminal (dashboard) loaded after auth');
    assert(jsErrors.filter(e => /Minified React|hooks|useState/.test(e)).length === 0, 'No React hook errors during auth');

    // ── CP3: Dashboard Structure ─────────────────────────────────────────────
    console.log('\n[ CP3 ] Dashboard structure');
    // Make sure we're on the dashboard
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/quant-cp3-dashboard.png' });
    info('Screenshot → /tmp/quant-cp3-dashboard.png');

    assert(await page.locator('nav.app-navigation, .app-navigation').count() > 0, 'Side navigation present');
    assert(await page.locator('.navbar, nav.top-nav').count() > 0, 'Top navbar present');

    // Engine buttons
    const stoppedBtn = page.getByRole('button', { name: /stopped/i });
    const paperBtn = page.getByRole('button', { name: /paper/i });
    assert(await stoppedBtn.count() > 0, 'STOPPED engine button present');
    assert(await paperBtn.count() > 0, 'PAPER engine button present');

    // Nav links
    assert(await page.getByText(/terminal|dashboard/i).count() > 0, 'Terminal nav link present');
    assert(await page.getByText(/portfolio/i).count() > 0, 'Portfolio nav link present');
    assert(await page.getByText(/agents/i).count() > 0, 'Agents nav link present');
    assert(await page.getByText(/situation room/i).count() > 0, 'Situation Room nav link present');

    // ── CP4: WebSocket Live Data ─────────────────────────────────────────────
    console.log('\n[ CP4 ] WebSocket live data (waiting 20s for ticks…)');
    const wsStart = Date.now();
    await page.waitForTimeout(20000);

    assert(tickCount > 0, `Received ${tickCount} TICK messages in 20s`);
    if (tickCount > 0) {
        const avgGap = tickGaps.length > 0 ? tickGaps.reduce((a, b) => a + b, 0) / tickGaps.length : 0;
        const maxGap = tickGaps.length > 0 ? Math.max(...tickGaps) : 0;
        info(`Tick rate: ${tickCount} ticks in 20s (avg gap: ${avgGap.toFixed(0)}ms, max gap: ${maxGap.toFixed(0)}ms)`);
        assert(tickCount >= 3, `At least 3 ticks in 20s (got ${tickCount})`);
        const bigGaps = tickGaps.filter(g => g > 8000);
        assert(bigGaps.length === 0, `No tick gaps > 8s (found ${bigGaps.length} gaps > 8s)`);
        if (bigGaps.length > 0) info(`Gap details: ${bigGaps.map(g => `${(g/1000).toFixed(1)}s`).join(', ')}`);
    }

    // Check for CANDLE_HISTORY messages
    const candleHistoryMsg = wsMessages.find(m => m.type === 'CANDLE_HISTORY');
    assert(!!candleHistoryMsg, 'CANDLE_HISTORY message received on connect');

    // Check AI_STATUS messages
    const aiStatusMsgs = wsMessages.filter(m => m.type === 'AI_STATUS');
    assert(aiStatusMsgs.length > 0, `AI_STATUS messages received (${aiStatusMsgs.length})`);

    await page.screenshot({ path: '/tmp/quant-cp4-live-data.png' });
    info('Screenshot → /tmp/quant-cp4-live-data.png');

    // ── CP5: Product Switch ──────────────────────────────────────────────────
    console.log('\n[ CP5 ] Product switch');
    const wsBeforeSwitch = wsMessages.length;
    tickCount = 0;
    lastTickTime = 0;
    tickGaps = [];

    // Look for product selector
    const productSelector = page.locator('select, [class*="product-selector"], [class*="ProductSelector"]').first();
    if (await productSelector.count() > 0) {
        const tag = await productSelector.evaluate(el => el.tagName);
        if (tag === 'SELECT') {
            await productSelector.selectOption({ value: 'ETH-USD' }).catch(async () => {
                await productSelector.selectOption({ index: 1 });
            });
        } else {
            await productSelector.click();
            const ethOption = page.getByText('ETH-USD').first();
            if (await ethOption.count() > 0) await ethOption.click();
        }
        await page.waitForTimeout(5000);
        const candleAfterSwitch = wsMessages.slice(wsBeforeSwitch).find(m => m.type === 'CANDLE_HISTORY');
        assert(!!candleAfterSwitch, 'CANDLE_HISTORY received after product switch');
        info(`New ticks after switch: ${tickCount}`);
        await page.screenshot({ path: '/tmp/quant-cp5-product-switch.png' });
        info('Screenshot → /tmp/quant-cp5-product-switch.png');
    } else {
        warn('Product selector not found — skipping product switch test');
        info('Looking for product selector via text…');
        const btcText = page.getByText('BTC-USD').first();
        if (await btcText.count() > 0) {
            await btcText.click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: '/tmp/quant-cp5-product-selector.png' });
        }
    }

    // ── CP6: Engine Start (PAPER mode) ───────────────────────────────────────
    console.log('\n[ CP6 ] Engine start (PAPER mode)');
    // Navigate back to dashboard root
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const paperButton = page.getByRole('button', { name: /paper/i }).first();
    if (await paperButton.count() > 0) {
        const classBefore = await paperButton.getAttribute('class') || '';
        await paperButton.click();
        await page.waitForTimeout(3000);
        const classAfter = await paperButton.getAttribute('class') || '';
        info(`PAPER button class before: "${classBefore}", after: "${classAfter}"`);
        assert(classAfter.includes('paper') || classAfter !== classBefore, 'PAPER button state changed after click');

        // Wait for AI status to update
        await page.waitForTimeout(5000);
        const aiStatusElement = page.locator('[class*="ai-status"], [class*="aiStatus"]').first();
        const aiText = await aiStatusElement.textContent().catch(() => '');
        info(`AI Status text: "${aiText}"`);
        await page.screenshot({ path: '/tmp/quant-cp6-paper-engine.png' });
        info('Screenshot → /tmp/quant-cp6-paper-engine.png');
    } else {
        warn('PAPER button not found');
    }

    // ── CP7: Portfolio Page ──────────────────────────────────────────────────
    console.log('\n[ CP7 ] Portfolio page');
    await page.click('a[href="/portfolio"], [href*="portfolio"]').catch(async () => {
        await page.goto(`${APP_URL}/portfolio`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    });
    await page.waitForTimeout(3000);

    assert(await page.locator('[class*="portfolio"]').count() > 0, 'Portfolio section rendered');
    // Check for balance showing $100k (fresh paper account) or some dollar amount
    const pageText = await page.locator('body').textContent();
    const hasBalance = /\$[\d,]+/.test(pageText);
    assert(hasBalance, 'Dollar balance displayed on portfolio page');

    // Check for equity curve or chart element
    const hasChart = await page.locator('canvas, svg, [class*="chart"], [class*="equity"]').count() > 0;
    assert(hasChart, 'Chart/equity curve element present on portfolio page');

    await page.screenshot({ path: '/tmp/quant-cp7-portfolio.png' });
    info('Screenshot → /tmp/quant-cp7-portfolio.png');

    // ── CP8: Agents Page ─────────────────────────────────────────────────────
    console.log('\n[ CP8 ] Agents page');
    await page.click('a[href="/agents"], [href*="agents"]').catch(async () => {
        await page.goto(`${APP_URL}/agents`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    });
    await page.waitForTimeout(3000);

    const agentNames = ['Atlas', 'Vera', 'Rex', 'Luna', 'Orion'];
    let agentsFound = 0;
    for (const name of agentNames) {
        const found = await page.getByText(name).count() > 0;
        if (found) agentsFound++;
        else warn(`Agent "${name}" not found on page`);
    }
    assert(agentsFound === 5, `All 5 agent cards visible (found ${agentsFound}/5)`);

    const agentCards = await page.locator('[class*="agent-card"], [class*="agentCard"], [class*="strategy-card"]').count();
    info(`Agent card elements found: ${agentCards}`);

    await page.screenshot({ path: '/tmp/quant-cp8-agents.png' });
    info('Screenshot → /tmp/quant-cp8-agents.png');

    // ── CP9: Intelligence Page ───────────────────────────────────────────────
    console.log('\n[ CP9 ] Intelligence page');
    await page.click('a[href="/intelligence"], [href*="intelligence"]').catch(async () => {
        await page.goto(`${APP_URL}/intelligence`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    });
    await page.waitForTimeout(3000);

    const hasIntelligence = await page.locator('[class*="intelligence"], [class*="signal"], [class*="news"]').count() > 0;
    assert(hasIntelligence, 'Intelligence/signals content rendered');
    await page.screenshot({ path: '/tmp/quant-cp9-intelligence.png' });
    info('Screenshot → /tmp/quant-cp9-intelligence.png');

    // ── CP10: Situation Room ─────────────────────────────────────────────────
    console.log('\n[ CP10 ] Situation room');
    await page.click('a[href="/situation-room"], [href*="situation"]').catch(async () => {
        await page.goto(`${APP_URL}/situation-room`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    });
    await page.waitForTimeout(2000);

    const situationInput = page.locator('input[type="text"], textarea').first();
    assert(await situationInput.count() > 0, 'Situation room input field present');

    // Type a question and submit
    if (await situationInput.count() > 0) {
        await situationInput.fill('What is your current view on BTC?');
        await page.keyboard.press('Enter').catch(async () => {
            const submitBtn = page.getByRole('button', { name: /send|submit|ask/i }).first();
            if (await submitBtn.count() > 0) await submitBtn.click();
        });
        info('Waiting up to 30s for agent responses…');
        await page.waitForTimeout(10000);
    }

    await page.screenshot({ path: '/tmp/quant-cp10-situation-room.png' });
    info('Screenshot → /tmp/quant-cp10-situation-room.png');

    // ── Console Error Summary ────────────────────────────────────────────────
    console.log('\n[ Console Errors ]');
    const finalErrors = jsErrors.filter(e => !/favicon|net::ERR/.test(e));
    if (finalErrors.length === 0) {
        ok('No JavaScript errors in console');
    } else {
        warn(`${finalErrors.length} JS console errors:`);
        finalErrors.slice(0, 5).forEach(e => fail(e.slice(0, 150)));
    }

    // ── WS Summary ──────────────────────────────────────────────────────────
    console.log('\n[ WebSocket Summary ]');
    const wsTypeCount = {};
    for (const m of wsMessages) {
        wsTypeCount[m.type] = (wsTypeCount[m.type] || 0) + 1;
    }
    info(`Total WS messages: ${wsMessages.length}`);
    for (const [type, count] of Object.entries(wsTypeCount)) {
        info(`  ${type}: ${count}`);
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    await browser.close();
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`  ${passed} passed  /  ${failed} failed`);
    console.log(failed === 0 ? '  All green 🟢' : '  Failures need attention 🔴');
    process.exit(failed > 0 ? 1 : 0);
})();
