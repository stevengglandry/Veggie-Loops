const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  let html = fs.readFileSync('VeggieLoops.html', 'utf8');

  const benchmarkScript = `
  <script>
  window.runBenchmark = function() {
      // Generate some mock state to make updateFixedCables do some work
      for (let i = 0; i < 50; i++) {
          state.tracks.push(createTrack('synthwave'));
          const drawer = createDrawer('lfo');
          drawer.connection = state.tracks[i].id;
          state.drawers.push(drawer);
      }

      // Render once to create elements
      renderTracks();
      renderDrawers();

      // wait a moment for DOM to settle
      setTimeout(() => {
          const iterations = 5000;
          const start = performance.now();
          for (let i = 0; i < iterations; i++) {
              updateFixedCables();
          }
          const end = performance.now();

          const result = "Performance Benchmark Result: " + iterations + " iterations took " + (end - start).toFixed(2) + "ms";
          console.log(result);

          const resDiv = document.createElement('div');
          resDiv.id = 'benchmark-result';
          resDiv.innerText = result;
          document.body.appendChild(resDiv);
      }, 100);
  };

  window.onload = function() {
      window.runBenchmark();
  };
  </script>
  `;

  html = html.replace('</body>', benchmarkScript + '</body>');
  fs.writeFileSync('VeggieLoops_benchmark.html', html);

  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage();

  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  await page.goto('file://' + path.resolve('VeggieLoops_benchmark.html'));

  try {
    await page.waitForSelector('#benchmark-result', { timeout: 20000 });
    const resultText = await page.$eval('#benchmark-result', el => el.innerText);
    console.log('BENCHMARK RESULT:', resultText);
  } catch (e) {
    console.log('Error waiting for benchmark result:', e);
  }

  await browser.close();
  fs.unlinkSync('VeggieLoops_benchmark.html');
})();
