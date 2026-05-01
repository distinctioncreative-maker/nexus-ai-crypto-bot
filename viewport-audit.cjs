const { chromium } = require('playwright');

const APP_URL = 'https://crypto-ai-bot-psi.vercel.app';
const VIEWPORTS = [
  { name: '1440x900-desktop',  width: 1440, height: 900,  mobile: false },
  { name: '1280x800-laptop',   width: 1280, height: 800,  mobile: false },
  { name: '768x1024-tablet',   width: 768,  height: 1024, mobile: false },
  { name: '390x844-iphone15',  width: 390,  height: 844,  mobile: true,  dpr: 3 },
  { name: '375x667-iphoneSE',  width: 375,  height: 667,  mobile: true,  dpr: 2 },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr || 1,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      userAgent: vp.mobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : undefined,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0,100)); });
    page.on('pageerror', e => errors.push(e.message.slice(0,100)));

    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const shot = `/tmp/vp-${vp.name}.png`;
    await page.screenshot({ path: shot, fullPage: false });

    // Measure scroll width vs viewport width (overflow check)
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.body.scrollWidth,
      clientWidth: document.body.clientWidth,
      docScrollWidth: document.documentElement.scrollWidth,
    }));

    // Count small buttons (< 44px touch target)
    const smallBtns = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button, a, input[type="submit"]')];
      return btns.filter(b => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
      }).length;
    });

    // Check for horizontal overflow
    const hasOverflow = overflow.scrollWidth > overflow.clientWidth + 2;

    // Check bottom nav visible on mobile
    const bottomNav = vp.mobile ? await page.locator('.bottom-nav, [class*="bottom-nav"], .tab-bar').count() : null;

    results.push({
      vp: vp.name,
      screenshot: shot,
      overflow: hasOverflow ? `⚠️ OVERFLOW: scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}` : '✅ no overflow',
      smallBtns: smallBtns > 0 ? `⚠️ ${smallBtns} buttons < 44px` : '✅ touch targets ok',
      bottomNav: vp.mobile ? (bottomNav > 0 ? '✅ bottom nav found' : '⚠️ bottom nav not found') : 'n/a',
      errors: errors.length > 0 ? `⚠️ ${errors.length} console errors` : '✅ no errors',
    });

    await ctx.close();
  }

  await browser.close();

  console.log('\n📱 Viewport Audit Results\n' + '─'.repeat(60));
  for (const r of results) {
    console.log(`\n[${r.vp}]`);
    console.log(`  ${r.overflow}`);
    console.log(`  ${r.smallBtns}`);
    if (r.bottomNav !== 'n/a') console.log(`  ${r.bottomNav}`);
    console.log(`  ${r.errors}`);
    console.log(`  📸 ${r.screenshot}`);
  }
})();
