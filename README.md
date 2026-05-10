# Veggie Loops

Veggie Loops is a browser-based modular music workstation built with vanilla JavaScript and the Web Audio API. It combines instrument tracks, MCP2000-style sampler pads, melodic arpeggiation, MIDI IN/OUT track routing, modulation drawers, FX pedals, and pattern generation in a static web app that can run locally or through GitHub Pages.

The main app lives in `VeggieLoops.html`. Sampler audio is stored as external WAV files in `samples/mcp2000_sounds/` so the HTML remains easier to search, edit, and deploy.

## Key Features

- **Instrument tracks:** Drum kits, percussion, synth leads, basses, and other Web Audio instruments.
- **MCP2000 sampler:** Pad-based sampler with waveform preview and Bank A/B sample loading from external WAV files.
- **Melodic arpeggiator:** ARP, latch, rate, and direction controls for melodic tracks, including sequencer note-pool support.
- **MIDI IN/OUT routing:** Header-level MIDI ports for doubling or routing note data between tracks.
- **Modulation drawers:** Patchable curve and XY modulation sources for shaping track parameters.
- **FX pedals:** Addable delay, reverb, distortion, chorus, and compressor pedals with audio chaining.
- **Pattern tools:** Musical randomization, scene saving/loading, and piano-roll note editing.

## Current Direction

- Keep the app static, browser-native, and framework-free.
- Keep sampler audio external in `samples/mcp2000_sounds/`.
- Run local QA over HTTP, not `file://`, because browsers restrict local file/sample loading.
- Support local launching through `Open Veggie Loops.bat` and `VeggieLoops.server.js`.
- Support public static deployment through GitHub Pages with `index.html`, `VeggieLoops.html`, `.nojekyll`, and the `samples/` folder.

## Local Development

Recommended local launch:

```bat
Open Veggie Loops.bat
```

Manual local server:

```powershell
node VeggieLoops.server.js
```

Then open:

```text
http://127.0.0.1:4399/VeggieLoops.html
```

## Testing

Run the Playwright regression suite from the repo root:

```powershell
cd tests
node run-tests.js
```

The tests serve the app over local HTTP and cover core UI, sampler loading, MIDI routing, arpeggiator behavior, FX chaining, scene save/load, and piano-roll editing.

## Change Log

- Added the MCP2000-style sampler with pad banks, waveform preview, and external WAV loading.
- Moved sampler audio out of embedded base64 storage into `samples/mcp2000_sounds/`.
- Added the local HTTP server and double-click Windows launcher.
- Added melodic arpeggiator controls and sequencer note-pool support.
- Moved MIDI IN/OUT controls into instrument track headers.
- Added FX pedal creation and output chaining.
- Fixed piano-roll left-edge note extension so note starts can be dragged earlier.
- Biased drum randomizer output toward basic 4/4 beat structure.
- Added GitHub Pages entry files: `index.html` and `.nojekyll`.
