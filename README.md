# VibeLETON DAW 🎵 AKA "Veggie Loops" 
**Premium Web-Based Music Production Environment**

VibeLETON is a high-performance, vibe-coded, single-.html-file Digital Audio Workstation (DAW) built with the Web Audio API. It combines the tactile workflow of classic hardware grooveboxes/modular synths with generative algorithmic composition tools, allowing for rapid prototyping of rhythm, melody, and complex modulation. First principles are ease of use, flexibility, and fun. 

```text
[ GENERATIVE ENGINES ]        [ INSTRUMENT TRACKS ]        [ MASTER EFFECTS ]
      (Logic)                       (Audio)                    (Processing)
 ┌────────────────┐          ┌───────────────────┐        ┌──────────────────┐
 │  - Musical     │          │  - Drum Set       │        │  1. Delay        │
 │  - Euclidean   ├─────────▶│  - 80s Lead       ├───────▶│  2. Reverb      │
 │  - Chaotic     │          │  - Sub Bass       │        │  3. Distortion   │
 │  - Acid        │          │  - Custom Tracks  │        │  4. Chorus       │
 └────────────────┘          └─────────┬─────────┘        │  5. Compression  │
                                       │                  └────────┬─────────┘
 [ MODULATION ]                        │                           │
 ┌─────────────────┐                   │                           │
 │ - LFO (Sine/Saw)│───────────────────┘                           ▼
 │ - Paintable Env │                                           [ AUDIO OUT ]
 └─────────────────┘

## 🚀 Recently Added Features

### 📦 Automated Batch Scene Export (New!)
The most powerful automation tool in VibeLETON yet. Press **BATCH SCENES** to record your entire project.
- **Auto-Sequencing**: Automatically loops through every saved scene in your project.
- **Perfect Timing**: Records each scene exactly twice for a standard musical structure.
- **Single-File Bounce**: Compiles everything into one high-quality, downloadable WAV file.

### 🎸 "Advanced Physical" Modeling: Guitars
Two new instrument types powered by custom DSP chains:
- **Acoustic Guitar**: Simulates string resonance with transient pick-attack noise and body resonance filtering (400Hz).
- **Electric Guitar**: Features a custom `WaveShaper` overdrive circuit and a resonant 3.2kHz low-pass cabinet simulator for authentic grit.

### 🔌 Modular ADSR Patching
The modulation system has been expanded to the track's core envelope:
- **Decay Patching**: Target the `Decay` stage of any track for rhythmic pumping and punchy gated effects.
- **A/R Morphing**: Smoothly transition between sharp stabs and ambient swells by modulating the Attack and Release phases simultaneously from a modulation drawer.

### 🌀 Nested Modulation & CV System
Modulation drawers are no longer just for tracks. 
- **CV Input**: Every modulation drawer now features a `Mod-In` jack, allowing one drawer to modulate the depth or offset of another.
- **XY Pad Mode**: Toggle between curve-based automation and tactile XY radar control for expressive live filtering.

### ⚡ Expressive Randomization 2.0
- **Generative Settings** Logic: Switch between standard Musical timing, Euclidean rhythms (mathematically distributed hits), or Chaotic/Acid modes for generative patterns.
- **Real-time Interaction:** Use DENS (Density), SPRD (Spread), and JITR (Jitter) to add human-like variance or total entropy to your sequences.
- **Rand Mode**: Choose between `Replace` (generate new patterns) or `Add` (layer notes onto existing ones).
- **Loop Reset**: Toggle `Rand on Loop` to generate a fresh variation every time the sequencer wraps.
- **Humanization**: Per-note Jitter and Glissando controls for interesting feel.

## 🎹 Core Engine Features
- ***Drums & Percussion***: Dedicated kits including 808 Deep, Industrial, and Lofi sets with individual control over Snare, Kick, and Hats.
- ***Melodic Instrument FM Synthesis Engines***: * e.,g., 80s Lead: Classic subtractive synthesis with adjustable ADSR and Glissando w/ built in Side Chain to kick drum toggle. Physical Modeling: Options for FM Plucks, Chiptune Arps, and Ethereal Pads.
- **Key & Scale Folding**: Grid dynamically hides out-of-key notes based on the global Scale/Key selector.
- **Sidechain Engine**: Built-in ducking system triggered by the Kick drum, with dedicated Sidechain FX pedals.
- **Modular FX Pedals**: Chainable Tape Echo, Bitcrusher, Overdrive, Chorus, and Reverb.
- **Responsive Canvas**: All visualizers (Oscilloscope, Spectrum, and Filter Graphs) render at high-DPR for crisp visuals.
- ***Export & Batch***: High-quality EXPORT functionality and BATCH SCENES for arranging and sharing loops/full songs as .mp3.

## ⌨️ Quick Controls
- **Space**: Play / Stop
- **Shift + Click (Scene)**: Save Current State
- **Click (Scene)**: Load Scene
- **Z / X**: Octave Shift (Active Track)
- **A ... L**: Play Instrument Rows (MIDI Keyboard Mapping)
- **Esc**: Panic (Kill all sound)

---
*Created by Antigravity*
