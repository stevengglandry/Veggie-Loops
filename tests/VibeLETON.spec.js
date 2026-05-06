const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Veggie Loops App Tests', () => {
    let fileUrl;

    test.beforeAll(() => {
        // Construct the absolute file URL for VeggieLoops.html
        const filePath = path.resolve(__dirname, '../VeggieLoops.html');
        fileUrl = `file://${filePath}`;
    });

    test.beforeEach(async ({ page }) => {
        // Block external font requests as mentioned in memory guidelines
        await page.route('**/*.{ttf,woff,woff2}', route => route.abort());
        await page.route('https://fonts.googleapis.com/**', route => route.abort());
        await page.route('https://fonts.gstatic.com/**', route => route.abort());

        // Navigate to the local file
        await page.goto(fileUrl, { waitUntil: 'commit' });
    });

    test('should render basic UI components', async ({ page }) => {
        // Verify header elements
        await expect(page.locator('.logo')).toHaveText('Vibleton');
        await expect(page.locator('#play-btn')).toBeVisible();
        await expect(page.locator('#record-btn')).toBeVisible();

        // Verify workspace elements
        await expect(page.locator('#tracks-container')).toBeVisible();
        await expect(page.locator('#drawers-container')).toBeVisible();
        await expect(page.locator('#fx-aside')).toBeVisible();
    });

    test('should load default tracks', async ({ page }) => {
        // The app should spawn a few default tracks (usually Drum Set, Aux Perc, Synthwave, Sub Bass)
        const tracks = page.locator('.track');
        await expect(tracks).toHaveCount(4); // Based on code: state.tracks.push(drumSet, auxPerc, synthwave, bass)

        // Verify "ADD INSTRUMENT TRACK" button exists
        await expect(page.locator('.add-track-btn')).toBeVisible();
    });

    test('should add a new instrument track when clicking the add button', async ({ page }) => {
        const initialTrackCount = await page.locator('.track').count();

        // Click the add track button
        await page.click('.add-track-btn');

        // Track count should increase by 1
        const newTrackCount = await page.locator('.track').count();
        expect(newTrackCount).toBe(initialTrackCount + 1);
    });

    test('should toggle playback state', async ({ page }) => {
        const playBtn = page.locator('#play-btn');

        // Initial state should be PLAY
        await expect(playBtn).toHaveText('PLAY');
        await expect(playBtn).not.toHaveClass(/active/);

        // Click to play
        await playBtn.click();
        await expect(playBtn).toHaveText('STOP');
        await expect(playBtn).toHaveClass(/active/);

        // Click to stop
        await playBtn.click();
        await expect(playBtn).toHaveText('PLAY');
        await expect(playBtn).not.toHaveClass(/active/);
    });

    test('should change BPM', async ({ page }) => {
        const bpmInput = page.locator('#bpm-input');

        // Default BPM is 120
        await expect(bpmInput).toHaveValue('120');

        // Change BPM
        await bpmInput.fill('140');
        await expect(bpmInput).toHaveValue('140');
    });

    test('should toggle help modal', async ({ page }) => {
        const helpModal = page.locator('#help-modal');
        const helpBtn = page.locator('.help-btn');

        // Initially hidden
        await expect(helpModal).toBeHidden();

        // Click help button
        await helpBtn.click();
        await expect(helpModal).toBeVisible();

        // Close modal
        await page.click('.modal-content button'); // "GOT IT" button
        await expect(helpModal).toBeHidden();
    });

    test('should draw on modulation drawer canvas without crashing', async ({ page }) => {
        const firstCanvas = page.locator('.drawer-canvas').first();
        await expect(firstCanvas).toBeVisible();

        // Perform a simulated mouse drag on the canvas
        const box = await firstCanvas.boundingBox();
        if (box) {
            await page.mouse.move(box.x + 10, box.y + 10);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width - 10, box.y + box.height - 10, { steps: 5 });
            await page.mouse.up();
        }

        // Just ensure the page hasn't crashed and the canvas is still there
        await expect(firstCanvas).toBeVisible();
    });

    test('should save and load scenes', async ({ page }) => {
        const sceneBtns = page.locator('#scene-container button');
        await expect(sceneBtns).toHaveCount(8);

        const firstSceneBtn = sceneBtns.first();

        // Change a track volume to see if it saves/loads
        const firstTrackVol = page.locator('.track').first().locator('input[type="range"]').first();
        await firstTrackVol.fill('0.5'); // Set volume to 0.5

        // Shift+Click first scene button to save
        await page.keyboard.down('Shift');
        await firstSceneBtn.click();
        await page.keyboard.up('Shift');

        // Change volume again to something else
        await firstTrackVol.fill('0.9');

        // Click to load scene
        await firstSceneBtn.click();

        // Expect volume to be back to 0.5
        // We'll read the value back out
        const volVal = await firstTrackVol.inputValue();
        expect(volVal).toBe('0.5');
    });

    test('should test step sequencer interaction', async ({ page }) => {
        // Find the first track's first step
        const firstStep = page.locator('.track').first().locator('.step').first();

        // Verify it doesn't have the active 'step-inner' child initially
        await expect(firstStep.locator('.step-inner')).toHaveCount(0);

        // Click the step
        await firstStep.click();

        // Verify it now has the active 'step-inner' child
        await expect(firstStep.locator('.step-inner')).toHaveCount(1);

        // Click again to turn off
        await firstStep.locator('.step-inner').click();

        // Verify it's gone
        await expect(firstStep.locator('.step-inner')).toHaveCount(0);
    });
});