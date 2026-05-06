const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Need to block external fonts to avoid timeouts per memory instructions
  await page.route('**/*.{woff,woff2,ttf,otf}', route => route.abort());
  await page.route('**/*fonts.googleapis.com*', route => route.abort());
  await page.route('**/*fonts.gstatic.com*', route => route.abort());

  const filePath = path.resolve('VeggieLoops.html');
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
const { performance } = require('perf_hooks');

const tracks = [];
for (let i=0; i<1000; i++) {
    tracks.push({
        id: 'track_' + i,
        grid: Array.from({length: 8}, () => Array(256).fill({on: true, length: 1}))
    });
}

let selectionNotes = [];
for (let i=0; i<1000; i++) {
    for (let j=0; j<10; j++) { // 10,000 notes total
        selectionNotes.push({
            trackId: 'track_' + Math.floor(Math.random() * 1000), // Random track id
            row: j % 8,
            step: j
        });
    }
}

function baseline() {
    let notes = [...selectionNotes];
    const start = performance.now();
    notes.forEach(n => {
        const t = tracks.find(tr => tr.id === n.trackId);
        if (t) t.grid[n.row][n.step] = { on: false, length: 1.0 };
    });
    const end = performance.now();
    return end - start;
}

function optimized() {
    let notes = [...selectionNotes];
    const start = performance.now();
    const trackMap = new Map();
    for (let i=0; i<tracks.length; i++) {
        trackMap.set(tracks[i].id, tracks[i]);
    }
    notes.forEach(n => {
        const t = trackMap.get(n.trackId);
        if (t) t.grid[n.row][n.step] = { on: false, length: 1.0 };
    });
    const end = performance.now();
    return end - start;
}

let baseSum = 0;
let optSum = 0;
for(let i=0; i<10; i++) {
    baseSum += baseline();
    optSum += optimized();
}

console.log('Baseline (avg):', baseSum/10, 'ms');
console.log('Optimized (avg):', optSum/10, 'ms');
