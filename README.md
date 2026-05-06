# Veggie Loops | Advanced Web-Based DAW

Veggie Loops is a high-performance, modular music production environment built entirely in Vanilla JS and Web Audio API. It features a unique "Cable-Patch" modulation system and a sophisticated pattern generation engine.

## 🚀 Key Features

- **Modular Synthesis**: Physical modeling for strings, additive synthesis for percussion, and high-gain waveshaping for electric tones.
- **Melody Hub**: A dedicated **MIDI IN/OUT** system for doubling melodies across different tracks.
- **Pattern Randomizer**: Intelligent sequence generation with "Musical", "Acid", "Euclidean", and "Chaotic" modes.
- **Drawer Modulation**: Custom curve and XY pad modulators that can be "patched" into any track parameter.
- **FX Pedal Chain**: Five high-quality modular FX units (Delay, Reverb, Distortion, Chorus, Compressor).

## 🛠 Performance & Architecture

- **Optimized Cable Rendering**: Uses a global DOM element cache and `ResizeObserver` to maintain 60fps even with hundreds of active modulation cables.
- **Voice Management**: Per-voice oscillator stacks with clean cleanup to prevent memory and audio leaks.

## 🧪 Testing & Development

### Run Playwright Tests
Verify core UI interactions and state persistence:
```bash
npm test
```

### Run Performance Benchmarks
Measure rendering latency and modulation overhead:
```bash
node run_benchmark.js
```

## 📜 Refactor Status
We are currently executing the `VEGGIELOOPS_REFACTOR_PLAN.md`. 
- [x] Stabilization of MIDI Hub UI
- [x] Enhanced Synthesis Engine (Marimba, Guitars)
- [x] Key/Scale Dropdown Persistence
- [ ] Next: Advanced Euclidean algorithm refinements
