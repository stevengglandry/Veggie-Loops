const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Need to block external fonts to avoid timeouts per memory instructions
  await page.route('**/*.{woff,woff2,ttf,otf}', route => route.abort());
  await page.route('**/*fonts.googleapis.com*', route => route.abort());
  await page.route('**/*fonts.gstatic.com*', route => route.abort());

  const filePath = path.resolve('VibeLETON.html');
  await page.goto(`file://${filePath}`, { waitUntil: 'commit' });

  // Wait a bit for initialization
  await page.waitForTimeout(1000);

  const results = await page.evaluate(() => {
    // 1. Setup a heavy state
    // We add 500 tracks and 500 drawers, connected to random things.
    for (let i = 0; i < 500; i++) {
       const t = createTrack('synthwave');
       state.tracks.push(t);
    }

    for (let i = 0; i < 500; i++) {
       const d = createDrawer();
       // Connect to a random track
       const targetTrack = state.tracks[Math.floor(Math.random() * state.tracks.length)];
       d.connection = targetTrack.id;
       state.drawers.push(d);
    }

    // Measure updateFixedCables
    const iterations = 100;
    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) {
        updateFixedCables();
    }
    const t1 = performance.now();

    // Measure applyModulation
    const t2 = performance.now();
    for (let i = 0; i < iterations; i++) {
        applyModulation(audioCtx.currentTime, 0.05);
    }
    const t3 = performance.now();

    return {
       updateFixedCablesTimeMs: t1 - t0,
       applyModulationTimeMs: t3 - t2,
       iterations
    };
  });

  console.log(`Baseline benchmark results over ${results.iterations} iterations:`);
  console.log(`- updateFixedCables: ${results.updateFixedCablesTimeMs.toFixed(2)} ms`);
  console.log(`- applyModulation: ${results.applyModulationTimeMs.toFixed(2)} ms`);

  await browser.close();
})();
