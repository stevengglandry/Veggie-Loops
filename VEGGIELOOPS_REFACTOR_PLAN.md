# VibeLETON — Code Review & Refactor Plan

> **Purpose:** This document is a living reference for AI agents and contributors working on `VibeLETON.html`. Read it before writing any new feature or fixing any bug. It documents the current architecture, known warts, and the preferred patterns to follow going forward.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Current Code Issues (Prioritized)](#2-current-code-issues-prioritized)
3. [CSS / Design System](#3-css--design-system)
4. [State Management](#4-state-management)
5. [Rendering Pipeline](#5-rendering-pipeline)
6. [Audio Engine](#6-audio-engine)
7. [Patching System (Cables)](#7-patching-system-cables)
8. [Scheduler & Sequencer](#8-scheduler--sequencer)
9. [Planned Features](#9-planned-features)
10. [File Split Strategy](#10-file-split-strategy)
11. [Naming & ID Conventions](#11-naming--id-conventions)
12. [Known Bugs & Gotchas](#12-known-bugs--gotchas)

---

## 1. Architecture Overview

VibeLETON is a single-file browser DAW (~5200 lines). Everything lives in one `<script>` block inside `<body>`. The rough layer breakdown is:

```
VibeLETON.html
├── <style>          CSS (~850 lines) — design tokens, layout, components
├── <body>           Static HTML shells (containers only, JS fills content)
└── <script>         Everything else (~4200 lines)
    ├── Cable cache  window.cableElementCache (Map per port type)
    ├── State        state {} singleton + refreshLookupMap()
    ├── Audio        AudioContext, FX units, synthesis engine
    ├── Rendering    renderTracks(), renderDrawers(), renderFxPanels()
    ├── Scheduler    look-ahead scheduler (tick via setTimeout)
    ├── Patching     connectDrawerPatch / disconnectDrawerPatch
    ├── Cable SVG    doUpdateFixedCables(), updateFixedCables()
    └── I/O          Save/load JSON session, audio export
```

**Key constraint:** All functions are in a single closure — nothing is on `window` except `window.cableElementCache` and `window.onresize`. This means browser DevTools console cannot call them directly during debugging. When debugging, expose via `window._vib = { state, renderTracks, ... }` temporarily.

---

## 2. Current Code Issues (Prioritized)

### P0 — Crashes / Silent Failures

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| 1 | `autoSpawnDrawerIfNeeded()` called but **never defined** in the randomizer branch. Throws ReferenceError silently. | `randomizeTrack()` ~line 3130 | Define the function or remove the call. |
| 2 | `affectedTracks` referenced in `keydown` Delete handler (line 1703) but is scoped to outer `mouseup` closure — undefined here. | `keydown` handler | Compute `affectedTracks` locally from `state.selection.notes`. |
| 3 | `autoSpawnTrackIfNeeded` is **defined twice** (lines ~1509 and ~1779) with different filter logic. Second definition silently overwrites the first. | Global scope | Delete the first definition. Keep the second. |
| 4 | `state.fxUnits = [...]` called **twice in a row** (lines 1320 and 1322). First set's chorus LFO oscillators start and are never stopped. Memory + audio leak. | Init | Delete line 1322. |
| 5 | `refreshLookupMap()` rebuilds each map twice — once via `forEach`, once via a `for` loop (lines 1128–1144). | `refreshLookupMap()` | Remove the redundant second loop. |

### P1 — Behavioral Bugs

| # | Issue | Location |
|---|-------|----------|
| 6 | Note resize (Shift+Drag) calls `renderTracks()` on every `mousemove` — full DOM rebuild during drag. Use `updateTrackGrid(track)` instead. | `renderTracks()` step-inner handler |
| 7 | `renderBeatCounter()` uses `cachedBeatCounterContainer` at line 1409 but it's never assigned (declared `null` at 1400). Beat pips never render. | `renderBeatCounter()` |
| 8 | `panGroup.appendChild(panLabel)` called twice (lines 2282 + 2294). PAN label appears twice in DOM. | `renderTracks()` |
| 9 | `renderFxPanels()` creates two identical title spans per panel and appends both. | `renderFxPanels()` |
| 10 | `xyCanvas` hardcoded to `60 * dpr` then resized twice more in two `setTimeout(0)` calls. Only the last matters. | `renderTracks()` |

### P2 — Code Quality

| # | Issue |
|---|-------|
| 11 | `renderTracks()` is ~650 lines and builds header, grid, ADSR, XY pad, randomizer, resizer all in one function. Must be broken up. |
| 12 | Note drag-move logic is duplicated verbatim in both `createStepInner()` and inside `renderTracks()`. |
| 13 | 30+ inline `style.cssText` strings in `renderTracks()` for structural styling that should be CSS classes. |
| 14 | `instrumentTypes` mutates `.rows` in place — all synth types share the same array reference. |
| 15 | `window.onresize = resizeCanvas` overwrites any prior resize handler. Use `addEventListener`. |
| 16 | `setupFxNodes()`, `updateFxParams()`, `renderFxPanels()` all use long `if/else if` chains for type dispatch. Convert to `switch(unit.type)` for readability and to make adding new types a single-location change. Same applies to the randomizer style dispatch in `randomizeTrack()` and the synthesis dispatch in `playSound()`. |
| 17 | `updateCableElementCache()` has 10 nearly-identical `.clear()` lines followed by 10 nearly-identical `.querySelectorAll().forEach()` calls. Can collapse to a data-driven loop over a `PORT_PREFIXES` config array. |

---

## 3. CSS / Design System

### Current Token Set (never hardcode equivalents)

```css
:root {
  --bg:             #050507;
  --surface:        #101014;
  --surface-hover:  #1a1a20;
  --glass:          rgba(255,255,255,0.04);
  --glass-border:   rgba(255,255,255,0.08);

  --accent-cyan:    #00f2ff;   /* Active, connected, playhead */
  --accent-purple:  #bc00ff;   /* Reserved — modulation depth */
  --accent-pink:    #ff007f;   /* Danger, record, synth notes */
  --accent-yellow:  #ffea00;   /* Mod cables, values */

  --text-main:      #e0e0e6;
  --text-dim:       #60606a;

  --font-main: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

### Missing Tokens (add these before using)

```css
:root {
  --space-xs: 2px;   --space-sm: 4px;
  --space-md: 8px;   --space-lg: 16px;   --space-xl: 24px;

  --radius-sm: 3px;  --radius-md: 6px;
  --radius-lg: 8px;  --radius-xl: 12px;

  --z-base:    5;    --z-panel:  10;
  --z-overlay: 20;   --z-cable:  9999;   --z-modal: 10000;
}
```

### CSS Rules to Follow

1. **Never use `style.cssText` in JS for structural styling.** Create a CSS class. Inline styles are acceptable only for dynamic computed values (e.g., a width from user input).

2. **Use CSS classes for state**, not inline styles:
   ```js
   el.classList.toggle('active', track.muted);
   ```

3. **Accent colors map to semantic roles. Stick to this:**
   - `--accent-cyan` → active/connected/playing states
   - `--accent-yellow` → modulation cables and associated values
   - `--accent-pink` → destructive/record/warning actions
   - `--accent-purple` → (reserved) modulation depth/intensity

4. **All new interactive components need hover + active states:**
   ```css
   .my-component { border: 1px solid var(--glass-border); transition: all 0.15s; }
   .my-component:hover { border-color: var(--accent-cyan); }
   .my-component.active { background: var(--accent-cyan); color: #000; }
   ```

5. **Glow via `box-shadow`:**
   ```css
   /* cyan */ box-shadow: 0 0 8px rgba(0, 242, 255, 0.3);
   /* yellow */ box-shadow: 0 0 8px rgba(255, 234, 0, 0.5);
   ```

6. **Font size scale** (don't introduce new sizes):
   - `0.35rem` micro labels → `0.45rem` knob labels → `0.5rem` row labels →
   - `0.55rem` knob values → `0.62rem` buttons → `0.75rem` selects → `1rem` logo

---

## 4. State Management

### Track Shape

```js
{
  id: 'trk_XXXX',        // ALWAYS 'trk_' prefix
  typeId,                // key into instrumentTypes{}
  volume, swing, muted, solo,
  subdiv, octaveOffset, loopMultiplier,
  rowStyles[],           // per-row drum variant index
  rowHeight,
  grid: (bool|NoteData)[][], // [row][step]; NoteData = {on, length}
  adsr: {a, d, s, r},   // null for drums
  adsrDefaults: {a,d,s,r},
  modLinks: {x, y, decay, adsr},  // drawerIds or null
  audioRoute: 'master' | fxUnitId,
  xy: {x, y},            // filter cutoff/resonance 0-1
  glide, glideTime, lastFreq,
  randStyle, randDensity, randSpread, randMode,
  randOnLoop, randNoteLen, randJitter, randGliss,
  minimized, sidechainEnabled,
  activeNotes: Set,
  // Audio nodes (NOT serialized to JSON):
  gainNode, filterNode, panNode, sidechainNode, analyser,
  cleanup()
}
```

### Drawer Shape

```js
{
  id: 'drw_XXXX',        // ALWAYS 'drw_' prefix
  connection: trackId | 'drw_XXXX' | null,
  modSource: 'drw_XXXX' | null,
  mode: 'curve' | 'pad',
  points: [{x,y}][],
  padPos: {x,y} | null,
  waveType, waveRate, baseRate, modAmount, sync, height, minimized
}
```

### Rules for Modifying State

1. **Always call `refreshLookupMap()` after mutating `state.tracks`, `state.drawers`, or `state.fxUnits` arrays.** The cable renderer, scheduler, and modulation engine all use `state.lookup.*` exclusively.

2. **ID prefixes are load-bearing.** The patching system uses `.startsWith()` to branch:
   - `trk_` → track, `drw_` → drawer, `fx_` → FX unit
   - Never rename these prefixes without auditing all callers.

3. **`modLinks` stores drawerIds, not element IDs.** When adding a new modulation target, update both `MOD_LINK_PREFIXES` and `doUpdateFixedCables`.

4. **Don't serialize audio nodes.** `saveSession()` must strip all `AudioNode` references.

---

## 5. Rendering Pipeline

### Full Rebuild vs. Fine-Grained Patch

| Trigger | Function to Call |
|---------|-----------------|
| Track/drawer added, removed, or type changed | `renderTracks()` / `renderDrawers()` |
| Note toggled on/off or length changed | `updateTrackGrid(track)` |
| Cable connection changed | `updateFixedCables()` |
| Active playhead step | Direct classList toggle on `.step.current` |
| Knob/slider value | Direct DOM property update, no re-render |

### `renderTracks()` Target Structure

Break into composable builders (each returns a DOM element):

```
renderTracks()
  └── state.tracks.forEach(t => buildTrackEl(t, i))
        ├── buildTrackHeader(track, index)
        │   ├── buildHeaderRow1(track) // select, vol, pan, S/M
        │   └── buildHeaderRow2(track) // XY, ADSR, glide, randomizer
        ├── buildTrackGrid(track)
        └── buildTrackResizer(track)
```

### `updateFixedCables()` — Keep This Implementation

```js
function updateFixedCables() {
    // Double-rAF: waits for canvas-sizing rAFs from _setupDrawerCanvasInteractions
    // to complete before reading getBoundingClientRect() for cable endpoints.
    requestAnimationFrame(() => requestAnimationFrame(doUpdateFixedCables));
}
```

**Do not add setTimeout fallbacks.** They cause duplicate draws and were part of failed fix attempts. The double-rAF is correct and sufficient.

---

## 6. Audio Engine

### Signal Chain

```
Track source nodes
  → filterNode (BiquadFilter)
  → panNode (StereoPanner)
  → sidechainNode (Gain)
  → gainNode (Gain) → analyser (per-track meter)
                    → audioRoute: masterGain | fxUnit.input

masterGain → masterAnalyser → audioCtx.destination
```

### Mixer Board — Planned Feature

Add a per-track volume mixer that sits **after** FX sends, visible as a compact strip near the master spectrogram in the top-right header area.

**Signal chain change:**
```
track.gainNode
  → audioRoute: masterGain | fxUnit.input

// BECOMES:
track.gainNode
  → fxUnit.input (when routed)  → fxUnit.output
                                       ↘
  → track.mixerStripGain  ← (new per-track post-FX gain node)
          ↓
      masterGain
```

**State changes required:**
- Add `track.mixerGain` (default `1.0`) to `createTrack()`  
- Add `track.mixerGainNode` (AudioNode, not serialized) to the audio node chain in `createTrack()`
- Add to `saveSession()` / `loadSession()`

**UI Spec — Mixer Strip (top-right, alongside spectrogram):**
- Compact vertical fader strips, one per track, ~12px wide each
- Color-coded by track type (cyan = drum, pink = synth)
- Fader height: ~60px tall; rendered in a small `<div id="mixer-strip-container">`
- Sits between the spectrogram and master output meter in the header
- Each strip: track name (2-char abbrev), vertical range slider, current dB value
- Clicking a strip selects that track in the main area (calls `selectTrack(index)`)
- Mute/solo state reflected by fader opacity

**CSS class to add:** `.mixer-strip`, `.mixer-strip.muted { opacity: 0.3; }`, `.mixer-strip.solo { border-color: var(--accent-yellow); }`

**Render function:** `renderMixerStrips()` — called after `renderTracks()`. Uses fine-grained updates only (`updateMixerStrip(track)`) during playback to avoid full rebuilds.

### Adding a New FX Type

**Use `switch(unit.type)` — not `if/else if` chains.** Both `setupFxNodes` and `updateFxParams` should be refactored to this pattern before new types are added:

```js
function setupFxNodes(unit) {
    // ... disconnect old nodes ...
    switch (unit.type) {
        case 'delay':
        case 'tape_echo': {
            // shared delay path
            break;
        }
        case 'chorus':
        case 'vibrato': {
            // ...
            break;
        }
        case 'new_fx': {
            // Add your new type here
            unit.nodes = { ... };
            unit.params = { mix: 0.5, ... };
            break;
        }
        default:
            console.warn('Unknown FX type:', unit.type);
    }
}
```

3. Define `unit.params` with sensible defaults — the panel UI auto-generates from it.
4. If it needs a custom curve/impulse update function, follow `updateShaperCurve` pattern.

### AudioContext Resumption

Browser policy keeps `audioCtx` suspended until user gesture. Always:

```js
if (audioCtx.state === 'suspended') {
    audioCtx.resume().then(() => /* schedule audio */);
} else {
    /* schedule audio */
}
```

`playPatchSound()` already does this correctly. Replicate the pattern everywhere audio is triggered.

---

## 7. Patching System (Cables)

### Port ID Conventions (exact format required)

| Port | ID Format | Class |
|------|-----------|-------|
| Drawer output | `out_drw_XXXX` | `patch-point mod-out` |
| Drawer input | `in_drw_XXXX` | `patch-point mod-in` |
| Track mod main | `in_trk_XXXX` | `patch-point mod-in` |
| Track filter X (cutoff) | `mod_x_trk_XXXX` | `patch-point mod-in` |
| Track filter Y (resonance) | `mod_y_trk_XXXX` | `patch-point mod-in` |
| Track ADSR decay | `mod_decay_trk_XXXX` | `patch-point mod-in` |
| Track ADSR A/R | `mod_adsr_trk_XXXX` | `patch-point mod-in` |
| Track audio out | `audio_out_trk_XXXX` | `patch-point audio-out` |
| FX audio in | `audio_in_fx_XXXX` | `patch-point audio-in` |

### Adding a New Modulation Target Checklist

- [ ] Add port element in `renderTracks()` with the correct ID
- [ ] Add to `MOD_LINK_PREFIXES` array
- [ ] Add `modLinks.newKey = null` in `createTrack()`
- [ ] Add cache Map in `window.cableElementCache` + `updateCableElementCache()`
- [ ] Add lookup in `doUpdateFixedCables()` to resolve `inEl`
- [ ] Apply value in scheduler/synthesis tick

### Cable Colors

| Connection | Color |
|-----------|-------|
| Drawer → Track mod port | `var(--accent-yellow)` |
| Drawer → Drawer | `var(--accent-cyan)` |
| Track audio → FX audio | `#00f2ff` |

---

## 8. Scheduler & Sequencer

- `stepsPerBeat = 24` (24 PPQN, hardcoded)
- `totalSteps = timeSignature * 24` (e.g., 96 for 4/4)
- Each track's step count: `loopMultiplier * round(timeSignature * track.subdiv)`
- Track position: `currentStep % trackSteps`
- Look-ahead: `scheduleAhead = 0.1s`, tick interval `25ms`

### Instrument → Synthesis Map

The synthesis dispatch in `playSound()` should also be refactored to `switch(track.typeId)` (see P2 #16).

#### Existing Instruments

| typeId | Method | Default ADSR |
|--------|--------|-------------|
| `drumSet`, `auxPerc` | Noise burst + filtered tone, per row/style | N/A |
| `synthwave` | Oscillator + ADSR | A:0.1 D:0.4 S:0.6 R:0.2 |
| `arp` | Fast oscillator + ADSR, chiptune filtering | A:0.02 D:0.2 S:0.5 R:0.1 |
| `pluck` | FM ratio oscillator + fast ADSR | A:0.01 D:0.3 S:0.1 R:0.2 |
| `bass` | 2x detuned sawtooth oscillators | A:0.02 D:0.6 S:0.4 R:0.1 |
| `pad` | 3x detuned oscillators + slow vibrato LFO | A:0.4 D:1.0 S:0.8 R:1.5 |
| `piano` | FM-like harmonic partials + hammer envelope | A:0.01 D:1.5 S:0.1 R:0.4 |
| `acousticGuitar` | Karplus-Strong string model | A:0.005 D:1.2 S:0.05 R:0.3 |
| `electricGuitar` | Karplus-Strong + overdrive saturation | A:0.005 D:2.0 S:0.4 R:0.6 |

#### Planned New Instruments

| typeId | Name | Synthesis Method | Iconic Default Settings |
|--------|------|-----------------|------------------------|
| `organ` | Hammond Organ | 9 additive drawbar sine partials (16', 8', 5⅓', 4', …) | A:0.01 D:0 S:1.0 R:0.02 — instant attack, instant release, full sustain |
| `marimba` | Marimba | Sine + filtered noise click transient; 4th harmonic prominent | A:0.002 D:0.6 S:0.0 R:0.4 — percussive, wood-like decay |
| `vibraphone` | Vibraphone | Sine with slow tremolo LFO (4Hz AM); metallic overtones | A:0.004 D:1.5 S:0.2 R:1.0 — long ring, jazz feel |
| `brass` | Brass Section | Sawtooth → bandpass filter sweep on attack (brassy bite) | A:0.08 D:0.3 S:0.7 R:0.15 — fat, punchy attack swell |
| `flute` | Flute | Sine + breath noise (filtered white noise blend, ~5%); vibrato | A:0.15 D:0.1 S:0.9 R:0.25 — airy, legato |
| `supersaw` | Supersaw Lead | 7 detuned sawtooth oscillators; light reverb; hard sync option | A:0.02 D:0.5 S:0.7 R:0.4 — trance/EDM staple |
| `wobblebass` | Wobble Bass | Sawtooth → resonant LP filter modulated by synced LFO | A:0.01 D:0.8 S:0.6 R:0.1 — dubstep wobble; LFO rate tied to BPM |
| `celeste` | Celeste | Triangle wave + short reverb; bell-like upper partials | A:0.003 D:0.8 S:0.05 R:0.6 — delicate, music-box quality |
| `clavinet` | Clavinet | Square wave + bandpass comb filter; pluck transient | A:0.003 D:0.4 S:0.1 R:0.15 — funky, Stevie Wonder-style |
| `theremin` | Theremin | Pure sine; always glide enabled; no attack click | A:0.2 D:0 S:1.0 R:0.3 — eerie legato; force `track.glide = true` on create |

**Implementation notes for new instruments:**
- Each new typeId must be added to `instrumentTypes{}` with correct `name`, `rows: []`, `type: 'synth'`, and `adsr`.
- Add a `case 'typeId':` branch in the synthesis `switch` in `playSound()` following the existing pattern.
- `wobblebass` and `organ` require extra state on the track (LFO node, drawbar ratios) — store on `track.synthState = {}` (not serialized).
- `theremin` should set `track.glide = true` and `track.glideTime = 0.3` in `createTrack()` as defaults when `typeId === 'theremin'`.

---

## 9. Planned Features

### Mixer Board (see §6 Audio Engine for full spec)
- Compact per-track fader strips rendered in the header, right of the spectrogram
- New `track.mixerGainNode` in the audio chain post-FX
- `renderMixerStrips()` function + `updateMixerStrip(track)` for real-time updates
- Mute/solo reflected visually via opacity

### New Instrument Types (see §8 Scheduler for full list)
`organ`, `marimba`, `vibraphone`, `brass`, `flute`, `supersaw`, `wobblebass`, `celeste`, `clavinet`, `theremin`

### Switch/Case Refactors (see P2 #16)
- `setupFxNodes()` → `switch(unit.type)`
- `updateFxParams()` → `switch(unit.type)`
- `playSound()` synthesis dispatch → `switch(track.typeId)`
- `randomizeTrack()` style dispatch → `switch(track.randStyle)`

---

## 10. File Split Strategy

When splitting out of a single file, use this order:

```
VibeLETON/
├── index.html
├── styles/
│   ├── tokens.css        :root variables
│   ├── layout.css        header, main, sidebars
│   ├── components.css    track, panel, knob, patch-point, mixer-strip
│   └── cable.css         #cable-svg, .cable-path, port states
└── js/
    ├── state.js          state{}, createTrack/Drawer/Fx, refreshLookupMap
    ├── audio.js          AudioContext, FX, synthesis, scheduler
    ├── instruments.js    instrumentTypes{}, playSound() switch dispatch
    ├── render-tracks.js  renderTracks() and all build* helpers
    ├── render-drawers.js renderDrawers(), canvas interactions
    ├── render-fx.js      renderFxPanels(), updateFxParams
    ├── render-mixer.js   renderMixerStrips(), updateMixerStrip
    ├── patching.js       connect/disconnect, doUpdateFixedCables
    ├── session.js        save/load/export
    └── ui-events.js      global mouse/key handlers, resizer
```

---

## 11. Naming & ID Conventions

| Prefix | Purpose |
|--------|---------|
| `render*()` | Full DOM section rebuild. Use sparingly. |
| `update*()` | Fine-grained DOM patch. Prefer this. |
| `build*()` | Returns a DOM element (does not append). |
| `create*()` | Returns a data object, not DOM. |
| `draw*()` | Draws to Canvas 2D context. |
| `apply*()` | Applies a value to an AudioNode. |
| `setup*()` | One-time component initialization. |
| `_helper*()` | Internal helper not called from outside. |

**Always query by ID over class when possible.** ID lookups are O(1); class scans are O(n DOM nodes).

---

## 12. Known Bugs & Gotchas

### Scope / Debugging

All functions are in a local closure. To call from DevTools console:
```js
window._vib = { state, renderTracks, renderDrawers, updateFixedCables };
```
Remove before committing.

### AudioContext Autoplay Gate

`audioCtx` starts `'suspended'`. Check before all audio scheduling. `playPatchSound()` is the reference implementation.

### Canvas Sizing Race

Drawer and XY canvases are sized inside `requestAnimationFrame` after DOM insertion. Never read `canvas.offsetWidth` synchronously in `renderDrawers()` — it will return 0. Always size inside rAF.

### `refreshLookupMap()` After Array Mutations

Any push/splice/assignment to `state.tracks`, `state.drawers`, or `state.fxUnits` **must** be followed by `refreshLookupMap()`. Missing this causes silent undefined lookups in cables, modulation, and scheduler.

### Two Definitions of `autoSpawnTrackIfNeeded`

Line ~1509: filters `typeId !== 'drumSet'` (correct)
Line ~1779: filters `typeId !== 'Set'` (typo, overwrites first)
Delete the first. The correct filter is `typeId !== 'drumSet' && typeId !== 'auxPerc'`.

### Duplicate `state.fxUnits` Init

Lines 1320 and 1322 both assign `state.fxUnits`. First batch's LFO oscillators start and are never stopped. Delete line 1322.

---

## Appendix: Quick Checklists

**New track parameter:**
- [ ] Add to `createTrack()` with safe default
- [ ] Add to `saveSession()` serialization
- [ ] Add to `loadSession()` deserialization  
- [ ] Add UI control in `buildHeaderRow*()`
- [ ] Apply in scheduler/audio if needed

**New modulation target:**
- [ ] Port element with correct ID in `renderTracks()`
- [ ] Entry in `MOD_LINK_PREFIXES`
- [ ] `modLinks.key = null` in `createTrack()`
- [ ] Cache Map in `cableElementCache` + `updateCableElementCache()`
- [ ] Lookup in `doUpdateFixedCables()`
- [ ] Apply value in scheduler tick

**New FX type:**
- [ ] `case 'new_fx':` block in `setupFxNodes()` switch
- [ ] `case 'new_fx':` block in `updateFxParams()` switch
- [ ] `unit.params` with sensible defaults
- [ ] Audio-in port element in `renderFxPanels()` if needed

**New instrument type:**
- [ ] Entry in `instrumentTypes{}` with `name`, `type: 'synth'`, `rows: []`, `adsr`
- [ ] `case 'typeId':` block in `playSound()` synthesis switch
- [ ] If it needs persistent audio state (LFO, drawbars): add `track.synthState = {}` in `createTrack()` (do not serialize)
- [ ] If glide should default on: set `track.glide = true` in `createTrack()` for that typeId

**Any patch/fix:**
- [ ] Expose needed fns via `window._vib` for console testing
- [ ] Call `refreshLookupMap()` after any array mutation
- [ ] Call `updateFixedCables()` (not `doUpdateFixedCables`) after DOM rebuild
- [ ] Check `audioCtx.state` before scheduling audio

---

## 13. Bug Testing & Validation

Perform these tests after every major refactor phase to ensure zero regression.

### A. Critical Path: Audio & Synthesis
- [ ] **No Dead Notes:** Play a complex sequence with multiple instruments. Ensure every note triggers and releases (no "stuck" oscillators).
- [ ] **ADSR Accuracy:** Change Attack/Decay on a synth track. Verify the audible shape changes.
- [ ] **Instrument Swapping:** Change a track's instrument type while playing. Ensure it switches without a crash or audio pop.
- [ ] **Polyphony/CPU:** Open a heavy session (~8+ tracks). Verify no audio stuttering or "NaN" logs in console.

### B. Patching & Modulation
- [ ] **Cable Visibility:** Plug a cable into every target type (Mod X, Mod Y, ADSR Decay, ADSR A/R). Verify the cable is visible immediately without "wiggling" the panel.
- [ ] **Modulation Effect:** Connect a LFO-style drawer to Filter Cutoff. Verify the cutoff actually sweeps audibly.
- [ ] **Persistence:** Save the session, refresh the page, and Load. Cables must reappear in their correct positions.
- [ ] **Bi-directional State:** Verify `drawer.connection` and `track.modLinks` match. Disconnecting one must clear the other.

### C. State & I/O
- [ ] **JSON Integrity:** Export a session and inspect the JSON. Ensure it contains **zero** `AudioNode` objects (which cause serialization errors).
- [ ] **History / Undo:** (If implemented) verify track additions/deletions are tracked correctly.
- [ ] **Lookup Consistency:** Add a track, then immediately try to patch it. If the patch fails, `refreshLookupMap` wasn't called.

### D. UI Layout & Performance
- [ ] **Resizer Stability:** Drag the panel divider between instruments and drawers. Cables must follow the ports smoothly in real-time.
- [ ] **Note Dragging:** Drag a note on the grid. Verify no lag or stutter (indicates `renderTracks` is being called too often).
- [ ] **Mixer Responsiveness:** (Once added) verify Mixer faders update the audible volume and the dB labels reflect the state correctly.
- [ ] **Spectrogram:** Ensure the master spectrogram in the header is active and rendering frequency data.

### E. Console Health
- [ ] **Zero Red Text:** Keep DevTools open. There should be **no** `ReferenceError`, `TypeError`, or `unhandledrejection` during normal DAW operation.
- [ ] **AudioCtx State:** If no sound plays, check if the console says "AudioContext was not allowed to start". Verify the first click resumes it.
