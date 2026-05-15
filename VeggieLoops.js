
// --- Cache for Connection Elements ---
        window.cableElementCache = {
            out: new Map(),
            in: new Map(),
            mod_x: new Map(),
            mod_y: new Map(),
            mod_decay: new Map(),
            mod_sustain: new Map(),
            mod_adsr: new Map(),
            audio_out: new Map(),
            audio_in: new Map(),
            midi_out: new Map(),
            midi_in: new Map(),
            mod_wobble: new Map()
        };

        function updateCableElementCache() {
            window.cableElementCache.out.clear();
            window.cableElementCache.in.clear();
            window.cableElementCache.mod_x.clear();
            window.cableElementCache.mod_y.clear();
            window.cableElementCache.mod_decay.clear();
            window.cableElementCache.mod_sustain.clear();
            window.cableElementCache.mod_adsr.clear();
            window.cableElementCache.audio_out.clear();
            window.cableElementCache.audio_in.clear();
            window.cableElementCache.midi_out.clear();
            window.cableElementCache.midi_in.clear();
            window.cableElementCache.mod_wobble.clear();

            document.querySelectorAll('[id^="out_"]').forEach(el => window.cableElementCache.out.set(el.id, el));
            document.querySelectorAll('[id^="in_"]').forEach(el => window.cableElementCache.in.set(el.id, el));
            document.querySelectorAll('[id^="mod_x_"]').forEach(el => window.cableElementCache.mod_x.set(el.id, el));
            document.querySelectorAll('[id^="mod_y_"]').forEach(el => window.cableElementCache.mod_y.set(el.id, el));
            document.querySelectorAll('[id^="mod_decay_"]').forEach(el => window.cableElementCache.mod_decay.set(el.id, el));
            document.querySelectorAll('[id^="mod_sustain_"]').forEach(el => window.cableElementCache.mod_sustain.set(el.id, el));
            document.querySelectorAll('[id^="mod_adsr_"]').forEach(el => window.cableElementCache.mod_adsr.set(el.id, el));
            document.querySelectorAll('[id^="audio_out_"]').forEach(el => window.cableElementCache.audio_out.set(el.id, el));
            document.querySelectorAll('[id^="audio_in_"]').forEach(el => window.cableElementCache.audio_in.set(el.id, el));
            document.querySelectorAll('[id^="midi_out_"]').forEach(el => window.cableElementCache.midi_out.set(el.id, el));
            document.querySelectorAll('[id^="midi_in_"]').forEach(el => window.cableElementCache.midi_in.set(el.id, el));
            document.querySelectorAll('[id^="mod_wobble_"]').forEach(el => window.cableElementCache.mod_wobble.set(el.id, el));
        }
        // --- State & Config ---
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        // --- Audio Routing Setup ---
        function createMasterSoftClipCurve(threshold = 0.82) {
            const curve = new Float32Array(2048);
            for (let i = 0; i < curve.length; i++) {
                const x = (i / (curve.length - 1)) * 2 - 1;
                const abs = Math.abs(x);
                if (abs <= threshold) {
                    curve[i] = x;
                } else {
                    const clipped = threshold + (1 - threshold) * Math.tanh((abs - threshold) / (1 - threshold));
                    curve[i] = Math.sign(x) * Math.min(0.98, clipped);
                }
            }
            return curve;
        }

        const masterAnalyser = audioCtx.createAnalyser();
        masterAnalyser.fftSize = 2048;
        const bufferLength = masterAnalyser.frequencyBinCount;
        const masterDataArray = new Uint8Array(bufferLength);
        const masterMeterState = { peak: 0, rms: 0, clipping: false, clipHold: 0, limiterReduction: 0 };

        const masterGain = audioCtx.createGain(); masterGain.gain.value = 0.8;
        const masterSoftClipper = audioCtx.createWaveShaper();
        masterSoftClipper.curve = createMasterSoftClipCurve();
        masterSoftClipper.oversample = '2x';
        const masterLimiter = audioCtx.createDynamicsCompressor();
        masterLimiter.threshold.value = -1.5;
        masterLimiter.knee.value = 2;
        masterLimiter.ratio.value = 20;
        masterLimiter.attack.value = 0.003;
        masterLimiter.release.value = 0.12;
        masterGain.connect(masterSoftClipper);
        masterSoftClipper.connect(masterLimiter);
        masterLimiter.connect(masterAnalyser);
        masterAnalyser.connect(audioCtx.destination);

        function createToneBridge() {
            const ToneRef = window.Tone;
            const bridge = {
                available: !!ToneRef,
                enabled: false,
                version: ToneRef?.version || null,
                contextShared: false,
                transport: null,
                lastBpm: null,
                connectToMaster(node) {
                    if (!node || typeof node.connect !== 'function') return false;
                    try {
                        node.connect(masterGain);
                        return true;
                    } catch (e) {
                        console.warn('Tone bridge connection failed:', e);
                        return false;
                    }
                },
                setBpm(bpm) {
                    const nextBpm = Number(bpm);
                    if (!this.enabled || !Number.isFinite(nextBpm) || this.lastBpm === nextBpm) return;
                    try {
                        const bpmParam = this.transport?.bpm;
                        if (bpmParam) {
                            if (typeof bpmParam.setValueAtTime === 'function') bpmParam.setValueAtTime(nextBpm, audioCtx.currentTime);
                            else bpmParam.value = nextBpm;
                        }
                        this.lastBpm = nextBpm;
                    } catch (e) {
                        console.warn('Tone bridge BPM sync failed:', e);
                    }
                },
                start() {
                    if (!this.enabled || typeof ToneRef?.start !== 'function') return;
                    try {
                        ToneRef.start();
                    } catch (e) {
                        console.warn('Tone bridge start failed:', e);
                    }
                }
            };

            if (!ToneRef) return bridge;
            try {
                if (typeof ToneRef.setContext === 'function') {
                    try {
                        ToneRef.setContext(audioCtx);
                    } catch (e) {
                        if (typeof ToneRef.Context !== 'function') throw e;
                        ToneRef.setContext(new ToneRef.Context(audioCtx));
                    }
                }
                const toneContext = typeof ToneRef.getContext === 'function' ? ToneRef.getContext() : ToneRef.context;
                bridge.contextShared = toneContext === audioCtx || toneContext?.rawContext === audioCtx;
                bridge.transport = typeof ToneRef.getTransport === 'function' ? ToneRef.getTransport() : ToneRef.Transport;
                bridge.enabled = true;
            } catch (e) {
                console.warn('Tone bridge unavailable:', e);
            }
            return bridge;
        }

        const toneBridge = createToneBridge();
        window.veggieToneBridge = toneBridge;

        // --- Track Data Config ---

        const tonalDefaults = {
            enabled: true,
            globalNames: ['Tonal'],
            scaleAliases: {
                chromatic: 'chromatic',
                major: 'major',
                minor: 'minor',
                pentatonic: 'minor pentatonic'
            },
            randomizerChordSymbols: {
                major: 'maj7',
                minor: 'm7',
                pentatonic: 'm7'
            },
            randomizerChordToneDegrees: [0, 2, 4, 6],
            randomizerChordToneWeight: 0.68
        };
        const suppliedTonalConfig = (typeof tonalIntegrationConfig !== 'undefined' && tonalIntegrationConfig && typeof tonalIntegrationConfig === 'object')
            ? tonalIntegrationConfig
            : {};
        const tonalSettings = {
            ...tonalDefaults,
            ...suppliedTonalConfig,
            scaleAliases: { ...tonalDefaults.scaleAliases, ...(suppliedTonalConfig.scaleAliases || {}) },
            randomizerChordSymbols: { ...tonalDefaults.randomizerChordSymbols, ...(suppliedTonalConfig.randomizerChordSymbols || {}) }
        };
        let cachedTonal = null;

        function getTonal() {
            if (!tonalSettings.enabled || typeof window === 'undefined') return null;
            if (cachedTonal?.Scale) return cachedTonal;
            const globalNames = Array.isArray(tonalSettings.globalNames) ? tonalSettings.globalNames : ['Tonal'];
            for (const globalName of globalNames) {
                const candidate = window[globalName];
                if (candidate?.Scale) {
                    cachedTonal = candidate;
                    return candidate;
                }
            }
            return null;
        }

        function hasTonalSupport() {
            return !!getTonal();
        }

        function normalizeTonalPitchClass(noteName) {
            const tonal = getTonal();
            const noteApi = tonal?.Note;
            let pitchClass = null;
            try {
                if (typeof noteApi?.pitchClass === 'function') pitchClass = noteApi.pitchClass(noteName);
                else if (typeof noteApi?.pc === 'function') pitchClass = noteApi.pc(noteName);
                else if (typeof noteApi?.get === 'function') pitchClass = noteApi.get(noteName)?.pc;
            } catch (e) {
                pitchClass = null;
            }
            if (!pitchClass) {
                const match = String(noteName || '').match(/^([A-G](?:#{1,2}|b{1,2})?)/);
                pitchClass = match ? match[1] : null;
            }
            return pitchClass && getPitchIndex(pitchClass) >= 0 ? pitchClass : null;
        }

        function getScaleIntervals(scaleType) {
            return scalesDef[scaleType] || scalesDef.minor;
        }

        function getTonalScalePitchClasses(rootPitch, scaleType) {
            const tonal = getTonal();
            if (!tonal?.Scale || typeof tonal.Scale.get !== 'function') return null;
            const scaleName = tonalSettings.scaleAliases?.[scaleType] || scaleType;
            const candidates = [...new Set([`${rootPitch} ${scaleName}`, `${rootPitch} ${scaleType}`])];
            for (const candidateName of candidates) {
                try {
                    const scale = tonal.Scale.get(candidateName);
                    const pitchClasses = Array.isArray(scale?.notes)
                        ? scale.notes.map(normalizeTonalPitchClass).filter(Boolean)
                        : [];
                    if (pitchClasses.length > 0) return pitchClasses;
                } catch (e) {
                    // Fall back to local scale definitions when Tonal cannot resolve a name.
                }
            }
            return null;
        }

        function getScaleSteps(rootNoteIdx, scaleType) {
            const rootPitch = noteNames[rootNoteIdx] || noteNames[0];
            const tonalPitchClasses = scaleType === 'chromatic' ? null : getTonalScalePitchClasses(rootPitch, scaleType);
            if (tonalPitchClasses) {
                const seenIntervals = new Set();
                const tonalSteps = [];
                tonalPitchClasses.forEach(pitchClass => {
                    const pitchIdx = getPitchIndex(pitchClass);
                    if (pitchIdx < 0) return;
                    const interval = (pitchIdx - rootNoteIdx + 12) % 12;
                    if (seenIntervals.has(interval)) return;
                    seenIntervals.add(interval);
                    tonalSteps.push({ interval, pitch: noteNames[pitchIdx], spelling: pitchClass });
                });
                if (tonalSteps.length > 0) return tonalSteps;
            }

            return getScaleIntervals(scaleType).map(interval => ({
                interval,
                pitch: noteNames[(rootNoteIdx + interval) % 12]
            }));
        }

        function getTonalChordPitchClasses(rootPitch, chordSymbol) {
            const tonal = getTonal();
            const chordApi = tonal?.Chord;
            if (!chordApi || !chordSymbol) return null;

            const readNotes = chord => Array.isArray(chord?.notes)
                ? chord.notes.map(normalizeTonalPitchClass).filter(Boolean)
                : [];
            try {
                if (typeof chordApi.getChord === 'function') {
                    const notes = readNotes(chordApi.getChord(chordSymbol, rootPitch));
                    if (notes.length > 0) return notes;
                }
            } catch (e) {
                // Older Tonal builds may not support getChord.
            }

            if (typeof chordApi.get !== 'function') return null;
            const candidates = [...new Set([`${rootPitch}${chordSymbol}`, `${rootPitch} ${chordSymbol}`])];
            for (const chordName of candidates) {
                try {
                    const notes = readNotes(chordApi.get(chordName));
                    if (notes.length > 0) return notes;
                } catch (e) {
                    // Keep trying compatible chord name formats.
                }
            }
            return null;
        }

        function getTonalRandomizerPitchClasses(rootPitch, scaleType) {
            const scalePitchClasses = getTonalScalePitchClasses(rootPitch, scaleType);
            if (!scalePitchClasses?.length) return null;

            const chordSymbol = tonalSettings.randomizerChordSymbols?.[scaleType];
            const chordPitchClasses = chordSymbol ? getTonalChordPitchClasses(rootPitch, chordSymbol) : null;
            if (chordPitchClasses?.length) return chordPitchClasses;

            const degrees = Array.isArray(tonalSettings.randomizerChordToneDegrees)
                ? tonalSettings.randomizerChordToneDegrees
                : tonalDefaults.randomizerChordToneDegrees;
            return degrees
                .map(degree => scalePitchClasses[degree])
                .filter(Boolean);
        }

        function getTonalRandomizerRows(track, spread) {
            const template = instrumentTypes[track?.typeId];
            if (!template || template.type === 'drum' || state?.globalScale === 'chromatic') return [];
            const rootPitch = state?.globalKey || 'C';
            const pitchClasses = getTonalRandomizerPitchClasses(rootPitch, state?.globalScale || 'minor');
            if (!pitchClasses?.length) return [];

            const chordPitchIndexes = new Set(pitchClasses.map(getPitchIndex).filter(idx => idx >= 0));
            const rowCount = template.rows.length;
            const center = Math.floor(rowCount / 2);
            const span = Math.max(1, Math.floor(rowCount * spread));
            const minRow = Math.max(0, Math.floor(center - span / 2));
            const maxRow = Math.min(rowCount - 1, Math.floor(center - span / 2 + span - 1));
            const rows = [];
            template.rows.forEach((rowName, rowIdx) => {
                if (rowIdx < minRow || rowIdx > maxRow) return;
                const parts = splitNoteLabel(rowName);
                if (!parts) return;
                const pitchIdx = getPitchIndex(parts.pitch);
                if (chordPitchIndexes.has(pitchIdx)) rows.push(rowIdx);
            });
            return rows;
        }

        function getScaleRows(rootNoteIdx, scaleType) {
            const safeRootIdx = Number.isInteger(rootNoteIdx) && rootNoteIdx >= 0 ? rootNoteIdx : 0;
            if (scaleType === 'chromatic') {
                return [
                    'C6', 'B5', 'A#5', 'A5', 'G#5', 'G5', 'F#5', 'F5', 'E5', 'D#5', 'D5', 'C#5',
                    'C5', 'B4', 'A#4', 'A4', 'G#4', 'G4', 'F#4', 'F4', 'E4', 'D#4', 'D4', 'C#4', 'C4'
                ];
            }
            let scaleSteps = getScaleSteps(safeRootIdx, scaleType);
            let allNotes = [];
            // Two octaves
            for (let octOffset = 0; octOffset < 2; octOffset++) {
                for (let i = 0; i < scaleSteps.length; i++) {
                    let totalInterval = scaleSteps[i].interval + (octOffset * 12);
                    let octave = 4 + Math.floor((safeRootIdx + totalInterval) / 12);
                    allNotes.push(scaleSteps[i].pitch + octave);
                }
            }
            // Final root note at the top
            allNotes.push(noteNames[safeRootIdx] + (4 + Math.floor((safeRootIdx + 24) / 12)));
            return allNotes.reverse();
        }

        function splitNoteLabel(noteName) {
            const match = String(noteName || '').match(/^([A-G](?:#{1,2}|b{1,2})?)(-?\d+)$/);
            return match ? { pitch: match[1], octave: match[2] } : null;
        }

        function getPitchIndex(pitch) {
            const match = String(pitch || '').match(/^([A-G])([#b]*)$/);
            if (!match) return -1;
            const naturalPitch = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
            let pitchIdx = naturalPitch[match[1]];
            for (const accidental of match[2]) {
                pitchIdx += accidental === '#' ? 1 : -1;
            }
            return ((pitchIdx % 12) + 12) % 12;
        }

        function noteNameToAbsoluteSemitone(noteName) {
            const parts = splitNoteLabel(noteName);
            if (!parts) return null;
            const pitchIdx = getPitchIndex(parts.pitch);
            const octave = parseInt(parts.octave, 10);
            if (pitchIdx < 0 || !Number.isFinite(octave)) return null;
            return octave * 12 + pitchIdx;
        }

        function spellScalePitch(pitch) {
            const scale = state?.globalScale || 'minor';
            if (scale === 'chromatic') return pitch;
            const rootPitch = state?.globalKey || 'C';
            const tonalPitchClasses = getTonalScalePitchClasses(rootPitch, scale);
            if (tonalPitchClasses) {
                const rootIdx = getPitchIndex(rootPitch);
                const pitchIdx = getPitchIndex(pitch);
                if (rootIdx >= 0 && pitchIdx >= 0) {
                    const rel = (pitchIdx - rootIdx + 12) % 12;
                    const tonalPitch = tonalPitchClasses.find(candidate => {
                        const candidateIdx = getPitchIndex(candidate);
                        return candidateIdx >= 0 && (candidateIdx - rootIdx + 12) % 12 === rel;
                    });
                    if (tonalPitch) return tonalPitch;
                }
            }
            const intervals = scalesDef[scale] || scalesDef.minor;
            const rootIdx = getPitchIndex(rootPitch);
            const pitchIdx = getPitchIndex(pitch);
            if (rootIdx < 0 || pitchIdx < 0) return pitch;

            const rel = (pitchIdx - rootIdx + 12) % 12;
            const degree = intervals.indexOf(rel);
            if (degree < 0) return pitch;

            const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
            const naturalPitch = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
            const rootLetterIdx = letters.indexOf(rootPitch[0]);
            if (rootLetterIdx < 0) return pitch;

            const letter = letters[(rootLetterIdx + degree) % letters.length];
            const naturalIdx = naturalPitch[letter];
            const diff = (pitchIdx - naturalIdx + 12) % 12;
            if (diff === 0) return letter;
            if (diff === 1) return letter + '#';
            if (diff === 11) return letter + 'b';
            return pitch;
        }

        function formatPianoRollRowLabel(noteName) {
            const parts = splitNoteLabel(noteName);
            if (!parts) return noteName;
            const spelledPitch = spellScalePitch(parts.pitch);
            const rootIdx = getPitchIndex(state?.globalKey || 'C');
            const pitchIdx = getPitchIndex(parts.pitch);
            return pitchIdx === rootIdx ? spelledPitch + parts.octave : spelledPitch;
        }

        const drumTypeNames = Object.keys(drumStyles);

        function normalizeDrumType(rowName) {
            const compact = String(rowName || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
            const aliases = {
                kick01: 'Kick', kick: 'Kick',
                snare02: 'Snare', snare: 'Snare',
                hat03: 'CHat', chat: 'CHat', hatc: 'CHat', closedhat: 'CHat',
                openhat04: 'OHat', ohat: 'OHat', hato: 'OHat', openhat: 'OHat',
                rim11: 'Rim', rim: 'Rim',
                clap05: 'Clap', clap: 'Clap',
                crash13: 'Crash', crash: 'Crash',
                ride12: 'Ride', ridefx16: 'Ride', ride: 'Ride',
                perc06: 'Splash', splash: 'Splash',
                cowbell07: 'Clave', cowbell: 'Clave',
                metalfx08: 'Metal', metal: 'Metal',
                tom09: 'TomL', toml: 'TomL', lowtom: 'TomL',
                midtom10: 'TomH', tomh: 'TomH', midtom: 'TomH',
                shaker15: 'Shaker', shaker: 'Shaker',
                blip14: 'Beep', blip: 'Beep', beep: 'Beep',
                bongoh: 'BongoH', bongol: 'BongoL',
                extra: 'Beep'
            };
            return aliases[compact] || (drumStyles[rowName] ? rowName : 'Kick');
        }

        function getTrackRowDrumName(track, rowIdx) {
            const template = instrumentTypes[track.typeId];
            return normalizeDrumType(track.rowDrums?.[rowIdx] || template.rows[rowIdx]);
        }

        function getTrackRowVariantIndex(track, rowIdx) {
            const drumName = getTrackRowDrumName(track, rowIdx);
            const variants = drumStyles[drumName] || ['Default'];
            const idx = track.rowStyles?.[rowIdx] || 0;
            return Math.max(0, Math.min(variants.length - 1, idx));
        }

        function isSamplerDrumVariant(track, rowIdx) {
            const drumName = getTrackRowDrumName(track, rowIdx);
            const variant = (drumStyles[drumName] || [])[getTrackRowVariantIndex(track, rowIdx)] || '';
            return variant.toLowerCase().startsWith('sampler') || variant.toLowerCase().startsWith('sample');
        }

        function getSamplerPadIndexForRow(track, rowIdx) {
            if (track?.typeId === 'drumSet') return rowIdx;
            const drumName = getTrackRowDrumName(track, rowIdx);
            return samplerPadByDrum[drumName] ?? rowIdx;
        }

        function getSamplerRowLabel(track, rowIdx) {
            const bankPads = getSamplerBankPads(track?.samplerBank || 'A');
            const pad = bankPads[rowIdx];
            if (!pad) return `PAD ${String(rowIdx + 1).padStart(2, '0')}`;
            return String(pad.label || `PAD ${rowIdx + 1}`).toUpperCase();
        }

        function createDrawer() {
            return {
                id: 'drw_' + Math.floor(Math.random() * 10000),
                connection: null,
                modTarget: 'x',
                mode: 'curve',
                points: [],
                height: 160,
                minimized: false,
                modSource: null,
                modSourceTarget: 'depth',
                waveType: 'none',
                waveRate: 1,
                baseRate: 1,
                modAmount: 1,
                sync: true
            };
        }

        const oscCanvas = document.getElementById('osc-canvas');
        const oscCtx = oscCanvas.getContext('2d');
        const specCanvas = document.getElementById('spec-canvas');
        const specCtx = specCanvas.getContext('2d');
        const meterFill = document.getElementById('meter-fill');
        let activeDrawingDrawerId = null;
        let isPatching = false;
        let patchingDrawerId = null;
        let patchingAudioOutId = null;
        let patchingFxOutId = null;

        function resizeCanvas() {
            if (oscCanvas) { oscCanvas.width = oscCanvas.offsetWidth; oscCanvas.height = oscCanvas.offsetHeight; }
            if (specCanvas) { specCanvas.width = specCanvas.offsetWidth; specCanvas.height = specCanvas.offsetHeight; }
            renderDrawers();
        }
        window.onresize = resizeCanvas;

        // --- Tooltip System ---
        const tooltipEl = document.getElementById('tooltip');
        document.addEventListener('mouseover', (e) => {
            const target = e.target.closest('[data-tooltip], .patch-point');
            if (target) {
                const patchTooltip = target.classList.contains('patch-point') ? getPatchPointTooltip(target) : null;
                const text = target.getAttribute('data-tooltip') || patchTooltip?.text || '';
                const title = target.getAttribute('data-tooltip-title') || patchTooltip?.title || '';
                const hotkey = target.getAttribute('data-tooltip-hotkey') || patchTooltip?.hotkey || '';
                if (!text && !title && !hotkey) return;
                tooltipEl.textContent = '';
                if (title) {
                    const titleEl = document.createElement('strong');
                    titleEl.textContent = title;
                    tooltipEl.appendChild(titleEl);
                }
                tooltipEl.appendChild(document.createTextNode(text));
                if (hotkey) {
                    const hotkeyEl = document.createElement('div');
                    hotkeyEl.className = 'tooltip-hotkey';
                    const labelEl = document.createElement('span');
                    labelEl.textContent = 'HOTKEY';
                    const keyEl = document.createElement('kbd');
                    keyEl.textContent = hotkey;
                    hotkeyEl.append(labelEl, keyEl);
                    tooltipEl.appendChild(hotkeyEl);
                }
                tooltipEl.style.display = 'block';
                updateTooltipPos(e);
            }
        });
        document.addEventListener('mousemove', (e) => {
            if (tooltipEl.style.display === 'block') updateTooltipPos(e);
        });
        document.addEventListener('mouseout', (e) => {
            const target = e.target.closest('[data-tooltip], .patch-point');
            if (target) tooltipEl.style.display = 'none';
        });
        function updateTooltipPos(e) {
            const x = e.clientX + 15;
            const y = e.clientY + 15;
            tooltipEl.style.left = Math.min(window.innerWidth - 210, x) + 'px';
            tooltipEl.style.top = Math.min(window.innerHeight - 100, y) + 'px';
        }
        function getPatchPointTooltip(point) {
            const modLabels = {
                x: ['FILTER CUTOFF IN', 'Receives modulation for filter cutoff.'],
                y: ['FILTER Q IN', 'Receives modulation for filter resonance.'],
                wobble: ['WOBBLE IN', 'Receives modulation for wobble/LFO rate.'],
                decay: ['DECAY IN', 'Receives modulation for envelope decay.'],
                sustain: ['SUSTAIN IN', 'Receives modulation for envelope sustain.'],
                adsr: ['A/R IN', 'Receives modulation for envelope attack and release.']
            };
            const modMatch = point.id && point.id.match(/^mod_([^_]+)_/);
            if (modMatch && modLabels[modMatch[1]]) {
                const [title, text] = modLabels[modMatch[1]];
                return { title, text };
            }
            if (point.classList.contains('audio-in')) {
                return { title: 'AUDIO IN', text: 'Receives audio from an instrument or FX pedal output.' };
            }
            if (point.classList.contains('audio-out')) {
                return { title: 'AUDIO OUT', text: 'Drag from here to route audio into an FX input.' };
            }
            if (point.classList.contains('midi-in')) {
                return { title: 'MIDI IN', text: 'Receives notes from another track for MIDI doubling.' };
            }
            if (point.classList.contains('midi-out')) {
                return { title: 'MIDI OUT', text: 'Drag from here to send this track’s notes to another track.' };
            }
            if (point.classList.contains('mod-out')) {
                return { title: 'MOD OUT', text: 'Drag from here to send this modulator to a compatible input.' };
            }
            if (point.classList.contains('mod-in')) {
                return { title: 'MOD IN', text: 'Receives modulation from a drawer or modulation output.' };
            }
            return null;
        }

        const state = {
            isPlaying: false, isRecording: false, clickTrack: false,
            bpm: 120, timeSignature: 4, stepsPerBeat: 24,
            get totalSteps() { return this.timeSignature * this.stepsPerBeat; },
            currentStep: 0,
            activeTrackId: 0,
            tracks: [],
            drawers: [createDrawer()],
            fxUnits: [],
            scenes: Array(8).fill(null),
            undoStack: [],
            redoStack: [],
            maxUndo: 30,
            delayFx: null,
            globalKey: 'C',
            globalScale: 'minor',
            activeNotes: new Map(), // (trackId + freq) -> { nodes }
            isExporting: false,
            performanceMode: (navigator.hardwareConcurrency || 4) > 4 ? 'high' : 'standard',
            selection: {
                active: false,
                startX: 0, startY: 0,
                notes: [], // { trackId, row, step }
                clipboard: [] // { relRow, relStep, nl, on }
            },
            dragSelection: {
                active: false,
                startStep: 0,
                startRow: 0,
                trackId: null
            },
            hoveredGrid: null, // { trackId, row, step }
            lookup: {
                tracks: new Map(),
                fxUnits: new Map(),
                drawers: new Map()
            }
        };
        toneBridge.setBpm(state.bpm);

        function refreshLookupMap() {
            state.lookup.tracks.clear();
            state.lookup.fxUnits.clear();
            state.lookup.drawers.clear();
            state.tracks.forEach(t => state.lookup.tracks.set(t.id, t));
            state.fxUnits.forEach(u => state.lookup.fxUnits.set(u.id, u));
            state.drawers.forEach(d => state.lookup.drawers.set(d.id, d));
        }



        // --- Modular FX Pedal System ---

        function createFxUnit(type = 'delay') {
            const unitId = 'fx_' + Math.floor(Math.random() * 10000);
            const input = audioCtx.createGain();
            const output = audioCtx.createGain();
            const wetGain = audioCtx.createGain();
            const dryGain = audioCtx.createGain();

            input.connect(dryGain);
            dryGain.connect(output);
            wetGain.connect(output);
            const unit = {
                id: unitId,
                type: type,
                minimized: false,
                input: input,
                output: output,
                wet: wetGain,
                dry: dryGain,
                nodes: {}, // Internal nodes for specific FX
                params: {}, // State for sliders
                audioRoute: 'master',
                outputGain: 0.75,
                analyser: audioCtx.createAnalyser(),
                analyserDataArray: null,
                mixerMeterFill: null
            };
            unit.analyser.fftSize = 256;

            setupFxNodes(unit);
            connectFxOutput(unit, 'master');
            return unit;
        }

        function getFxUnitById(id) {
            return state.lookup.fxUnits.get(id) || state.fxUnits.find(unit => unit.id === id) || null;
        }

        function wouldCreateFxCycle(sourceId, targetId) {
            let currentId = targetId;
            const visited = new Set();
            while (currentId && currentId !== 'master') {
                if (currentId === sourceId) return true;
                if (visited.has(currentId)) return true;
                visited.add(currentId);
                const unit = getFxUnitById(currentId);
                if (!unit) return false;
                currentId = unit.audioRoute || 'master';
            }
            return false;
        }

        function connectFxOutput(unit, route = unit?.audioRoute || 'master') {
            if (!unit?.output) return;
            try { unit.output.disconnect(); } catch (e) { }
            try { unit.output.connect(unit.analyser); } catch (e) { }

            let finalRoute = route || 'master';
            if (finalRoute !== 'master') {
                const targetUnit = getFxUnitById(finalRoute);
                if (targetUnit && targetUnit.id !== unit.id && !wouldCreateFxCycle(unit.id, targetUnit.id)) {
                    unit.output.connect(targetUnit.input);
                } else {
                    finalRoute = 'master';
                    unit.output.connect(masterGain);
                }
            } else {
                unit.output.connect(masterGain);
            }
            unit.audioRoute = finalRoute;
        }

        function routeTrackOutput(track, route = track?.audioRoute || 'master') {
            if (!track?.gainNode) return;
            try { track.gainNode.disconnect(); } catch (e) { }
            if (track.analyser) {
                try { track.gainNode.connect(track.analyser); } catch (e) { }
            }

            let finalRoute = route || 'master';
            if (finalRoute !== 'master') {
                const fxUnit = getFxUnitById(finalRoute);
                if (fxUnit) {
                    track.gainNode.connect(fxUnit.input);
                } else {
                    finalRoute = 'master';
                    track.gainNode.connect(track.mixerGainNode);
                }
            } else {
                track.gainNode.connect(track.mixerGainNode);
            }
            track.audioRoute = finalRoute;
        }

        function routeAllAudioConnections() {
            state.fxUnits.forEach(unit => connectFxOutput(unit, unit.audioRoute || 'master'));
            state.tracks.forEach(track => routeTrackOutput(track, track.audioRoute || 'master'));
        }

        function setupFxNodes(unit) {
            // Disconnect old nodes if any
            try { Object.values(unit.nodes).forEach(n => { if (n.disconnect) n.disconnect(); }); } catch (e) { }
            try { unit.input.disconnect(); } catch (e) { }
            unit.input.connect(unit.dry); // Maintain dry path

            const type = unit.type;
            if (!unit.params) unit.params = { mix: 0.5 };

            switch (type) {
                case 'delay':
                case 'tape_echo':
                    if (unit.params.time === undefined) unit.params = { time: 0.25, feedback: 0.4, mix: 0.3, sync: false, syncRate: 0.5 };
                    unit.nodes.delay = audioCtx.createDelay(5.0);
                    unit.nodes.feedback = audioCtx.createGain();
                    unit.nodes.filter = audioCtx.createBiquadFilter();
                    unit.nodes.delay.connect(unit.nodes.feedback);
                    if (type === 'tape_echo') {
                        unit.nodes.filter.type = 'lowpass';
                        unit.nodes.filter.frequency.value = 2000;
                        unit.nodes.feedback.connect(unit.nodes.filter);
                        unit.nodes.filter.connect(unit.nodes.delay);
                    } else {
                        unit.nodes.feedback.connect(unit.nodes.delay);
                    }
                    unit.input.connect(unit.nodes.delay);
                    unit.nodes.delay.connect(unit.wet);
                    break;
                case 'chorus':
                case 'vibrato':
                    if (unit.params.rate === undefined) unit.params = { rate: 1.5, depth: 0.002, mix: type === 'vibrato' ? 1.0 : 0.5 };
                    unit.nodes.delay = audioCtx.createDelay(0.1);
                    unit.nodes.lfo = audioCtx.createOscillator();
                    unit.nodes.lfoGain = audioCtx.createGain();
                    unit.nodes.lfo.connect(unit.nodes.lfoGain);
                    unit.nodes.lfoGain.connect(unit.nodes.delay.delayTime);
                    unit.input.connect(unit.nodes.delay);
                    unit.nodes.delay.connect(unit.wet);
                    unit.nodes.lfo.start();
                    break;
                case 'distortion':
                case 'overdrive':
                    if (unit.params.drive === undefined) unit.params = { drive: 0.5, tone: 0.5, mix: 1.0 };
                    unit.nodes.shaper = audioCtx.createWaveShaper();
                    unit.nodes.filter = audioCtx.createBiquadFilter();
                    unit.nodes.filter.type = 'lowpass';
                    unit.nodes.filter.frequency.value = type === 'overdrive' ? 3000 : 8000;
                    unit.input.connect(unit.nodes.shaper);
                    unit.nodes.shaper.connect(unit.nodes.filter);
                    unit.nodes.filter.connect(unit.wet);
                    updateShaperCurve(unit);
                    break;
                case 'bitcrusher':
                    if (unit.params.bits === undefined) unit.params = { bits: 8, mix: 1.0 };
                    unit.nodes.shaper = audioCtx.createWaveShaper();
                    unit.input.connect(unit.nodes.shaper);
                    unit.nodes.shaper.connect(unit.wet);
                    updateBitcrushCurve(unit);
                    break;
                case 'compressor':
                    if (unit.params.threshold === undefined) unit.params = { threshold: -24, ratio: 4, release: 0.1, mix: 1.0, sync: false, syncRate: 0.25 };
                    unit.nodes.comp = audioCtx.createDynamicsCompressor();
                    unit.input.connect(unit.nodes.comp);
                    unit.nodes.comp.connect(unit.wet);
                    break;
                case 'reverb':
                    if (unit.params.size === undefined) unit.params = { size: 0.5, mix: 0.3, sync: false, syncRate: 1.0 };
                    unit.nodes.convolver = audioCtx.createConvolver();
                    unit.input.connect(unit.nodes.convolver);
                    unit.nodes.convolver.connect(unit.wet);
                    updateReverbImpulse(unit);
                    break;
                case 'sidechain':
                    if (unit.params.depth === undefined) unit.params = { depth: 0.8, release: 0.2, mix: 1.0, sync: false, syncRate: 0.5 };
                    unit.nodes.sc = audioCtx.createGain();
                    unit.input.connect(unit.nodes.sc);
                    unit.nodes.sc.connect(unit.wet);
                    unit.nodes.sc.gain.value = 1.0;
                    unit.sidechainNode = unit.nodes.sc;
                    break;
                case 'eq':
                    if (unit.params.low === undefined) unit.params = { low: 0, mid: 0, high: 0, mix: 1.0 };
                    unit.nodes.lowFilter = audioCtx.createBiquadFilter();
                    unit.nodes.lowFilter.type = 'lowshelf';
                    unit.nodes.lowFilter.frequency.value = 320;

                    unit.nodes.midFilter = audioCtx.createBiquadFilter();
                    unit.nodes.midFilter.type = 'peaking';
                    unit.nodes.midFilter.frequency.value = 1000;
                    unit.nodes.midFilter.Q.value = 0.5;

                    unit.nodes.highFilter = audioCtx.createBiquadFilter();
                    unit.nodes.highFilter.type = 'highshelf';
                    unit.nodes.highFilter.frequency.value = 3200;

                    unit.input.connect(unit.nodes.lowFilter);
                    unit.nodes.lowFilter.connect(unit.nodes.midFilter);
                    unit.nodes.midFilter.connect(unit.nodes.highFilter);
                    unit.nodes.highFilter.connect(unit.wet);
                    break;
            }
            if (!unit.params) unit.params = {};
            if (unit.params.sync === undefined) unit.params.sync = false;
            if (unit.params.syncRate === undefined) unit.params.syncRate = 0.5;

            updateFxParams(unit, null);
        }

        function updateFxParams(unit, container) {
            const type = unit.type;
            const p = unit.params;

            // Set Wet/Dry mix
            unit.wet.gain.setTargetAtTime(p.mix, audioCtx.currentTime, 0.05);
            unit.dry.gain.setTargetAtTime(type === 'vibrato' ? 0 : (1 - p.mix * 0.5), audioCtx.currentTime, 0.05);

            let syncVal = null;
            if (p.sync) {
                const syncS = container ? container.querySelector('.fx-sync-select') : null;
                const rate = syncS ? parseFloat(syncS.value) : (p.syncRate || 0.5);
                syncVal = (60.0 / state.bpm) * rate;
            }

            switch (type) {
                case 'delay':
                case 'tape_echo':
                    let time = syncVal !== null ? syncVal : p.time;
                    unit.nodes.delay.delayTime.setTargetAtTime(time, audioCtx.currentTime, 0.05);
                    unit.nodes.feedback.gain.setTargetAtTime(p.feedback, audioCtx.currentTime, 0.05);
                    break;
                case 'chorus':
                case 'vibrato':
                    let freq = syncVal !== null ? (1.0 / Math.max(0.01, syncVal)) : p.rate;
                    unit.nodes.lfo.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.05);
                    unit.nodes.lfoGain.gain.setTargetAtTime(p.depth, audioCtx.currentTime, 0.05);
                    unit.nodes.delay.delayTime.setTargetAtTime(0.02, audioCtx.currentTime, 0.05);
                    break;
                case 'distortion':
                case 'overdrive':
                    updateShaperCurve(unit);
                    unit.nodes.filter.frequency.setTargetAtTime(500 + p.tone * 10000, audioCtx.currentTime, 0.05);
                    break;
                case 'bitcrusher':
                    updateBitcrushCurve(unit);
                    break;
                case 'compressor':
                    unit.nodes.comp.threshold.setTargetAtTime(p.threshold, audioCtx.currentTime, 0.05);
                    unit.nodes.comp.ratio.setTargetAtTime(p.ratio, audioCtx.currentTime, 0.05);
                    if (syncVal !== null) unit.nodes.comp.release.setTargetAtTime(syncVal, audioCtx.currentTime, 0.05);
                    else unit.nodes.comp.release.setTargetAtTime(p.release || 0.1, audioCtx.currentTime, 0.05);
                    break;
                case 'reverb':
                    if (syncVal !== null) {
                        p.size = Math.min(1.0, syncVal / 2.0); // Rough approximation
                        updateReverbImpulse(unit);
                    }
                    break;
                case 'eq':
                    unit.nodes.lowFilter.gain.setTargetAtTime(p.low, audioCtx.currentTime, 0.05);
                    unit.nodes.midFilter.gain.setTargetAtTime(p.mid, audioCtx.currentTime, 0.05);
                    unit.nodes.highFilter.gain.setTargetAtTime(p.high, audioCtx.currentTime, 0.05);
                    break;
            }
        }

        function updateShaperCurve(unit) {
            const drive = unit.params.drive * 100;
            const n_samples = 44100;
            const curve = new Float32Array(n_samples);
            const deg = Math.PI / 180;
            for (let i = 0; i < n_samples; ++i) {
                const x = (i * 2) / n_samples - 1;
                if (unit.type === 'overdrive') {
                    curve[i] = (3 + drive) * x * 20 * deg / (Math.PI + drive * Math.abs(x));
                } else {
                    curve[i] = (Math.PI + drive) * x / (Math.PI + drive * Math.abs(x));
                }
            }
            unit.nodes.shaper.curve = curve;
        }

        function updateBitcrushCurve(unit) {
            const bits = Math.pow(2, unit.params.bits);
            const n_samples = 4096;
            const curve = new Float32Array(n_samples);
            for (let i = 0; i < n_samples; ++i) {
                const x = (i * 2) / n_samples - 1;
                curve[i] = Math.round(x * bits) / bits;
            }
            unit.nodes.shaper.curve = curve;
        }

        function updateReverbImpulse(unit) {
            const duration = (0.5 + unit.params.size * 3.0) * (state.performanceMode === 'high' ? 1.0 : 0.6);
            const decay = 2.0;
            const sampleRate = audioCtx.sampleRate;
            const length = sampleRate * duration;
            const impulse = audioCtx.createBuffer(2, length, sampleRate);
            for (let i = 0; i < 2; i++) {
                const channelData = impulse.getChannelData(i);
                for (let j = 0; j < length; j++) {
                    channelData[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, decay);
                }
            }
            unit.nodes.convolver.buffer = impulse;
        }



        function updateInstrumentRows() {
            const rootIdx = noteNames.indexOf(state.globalKey);
            const rows = getScaleRows(rootIdx, state.globalScale);
            Object.keys(instrumentTypes).forEach(key => {
                if (instrumentTypes[key].type === 'synth') instrumentTypes[key].rows = rows;
            });
        }
        updateInstrumentRows();

        let cachedBeatCounterContainer = null;
        let cachedBeatPips = [];

        function renderBeatCounter() {
            const container = document.getElementById('beat-counter');
            if (!container) return;
            cachedBeatCounterContainer = container;
            cachedBeatCounterContainer.textContent = '';
            cachedBeatPips = [];
            for (let i = 0; i < state.timeSignature; i++) {
                const pip = document.createElement('div');
                pip.className = 'beat-pip' + (i === Math.floor(state.currentStep / state.stepsPerBeat) % state.timeSignature ? ' active' : '');
                cachedBeatCounterContainer.appendChild(pip);
                cachedBeatPips.push(pip);
            }
        }



        function autoSpawnTrackIfNeeded() {
            const synthTracks = state.tracks.filter(t => t.typeId !== 'drumSet' && t.typeId !== 'auxPerc');
            if (synthTracks.length === 0) return;

            const allUsed = synthTracks.every(t => t.grid.some(row => row.some(s => typeof s === 'object' ? s.on : !!s)));
            if (allUsed && state.tracks.length < 12) {
                state.tracks.push(createTrack('synthwave'));
                refreshLookupMap();
                renderTracks();
                if (typeof autoSpawnDrawerIfNeeded === 'function') autoSpawnDrawerIfNeeded();
            }
        }

        function autoSpawnDrawerIfNeeded() {
            if (state.drawers.length === 0) {
                state.drawers.push(createDrawer());
                refreshLookupMap();
                renderDrawers();
            }
        }
        const ARP_DIRECTION_VALUES = new Set(ARP_DIRECTION_OPTIONS.map(opt => opt.value));
        const TRACK_SCHEMA_VERSION = 2;
        const SAMPLER_MODE_OPTIONS = [
            { id: 'oneShot', label: 'ONE-SHOT' },
            { id: 'gate', label: 'GATE' },
            { id: 'loop', label: 'LOOP' }
        ];
        const SAMPLER_MODE_IDS = new Set(SAMPLER_MODE_OPTIONS.map(mode => mode.id));

        function createDefaultArp() {
            return {
                enabled: false,
                latch: false,
                subdivision: 12,
                direction: 'up',
                heldNotes: [],
                currentIdx: 0,
                lastStep: -1,
                goingUp: true
            };
        }

        function normalizeArp(arp = null) {
            const defaults = createDefaultArp();
            if (!arp) return defaults;

            const subdivision = Number.isFinite(Number(arp.subdivision)) ? Number(arp.subdivision) : defaults.subdivision;
            const savedDirection = arp.direction === 'steady' ? 'random' : arp.direction;
            const direction = ARP_DIRECTION_VALUES.has(savedDirection) ? savedDirection : defaults.direction;
            const heldNotes = Array.isArray(arp.heldNotes)
                ? [...new Set(arp.heldNotes.map(Number).filter(Number.isInteger))]
                : [];

            return {
                ...defaults,
                ...arp,
                enabled: !!arp.enabled,
                latch: !!arp.latch,
                subdivision,
                direction,
                heldNotes,
                currentIdx: Number.isFinite(Number(arp.currentIdx)) ? Number(arp.currentIdx) : 0,
                lastStep: Number.isFinite(Number(arp.lastStep)) ? Number(arp.lastStep) : -1,
                goingUp: arp.goingUp !== false
            };
        }

        function cloneData(value, fallback = null) {
            if (value === undefined || value === null) return fallback;
            return JSON.parse(JSON.stringify(value));
        }

        function numberOrDefault(value, fallback) {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        }

        function boolOrDefault(value, fallback = false) {
            return typeof value === 'boolean' ? value : fallback;
        }

        function normalizeSamplerModeValue(value) {
            return SAMPLER_MODE_IDS.has(value) ? value : 'oneShot';
        }

        function resolveTrackTypeId(typeId) {
            return instrumentTypes[typeId] ? typeId : 'synthwave';
        }

        function createDefaultGrid(rowCount, stepCount = 256) {
            return Array.from({ length: rowCount }, () => Array(stepCount).fill(false));
        }

        function normalizeTrackGrid(grid, rowCount, stepCount = 256) {
            const normalized = createDefaultGrid(rowCount, stepCount);
            if (!Array.isArray(grid)) return normalized;
            for (let r = 0; r < Math.min(rowCount, grid.length); r++) {
                if (!Array.isArray(grid[r])) continue;
                for (let s = 0; s < Math.min(stepCount, grid[r].length); s++) {
                    const cell = grid[r][s];
                    normalized[r][s] = (cell && typeof cell === 'object') ? { ...cell } : !!cell;
                }
            }
            return normalized;
        }

        function getTrackDefaults(typeId) {
            const resolvedTypeId = resolveTrackTypeId(typeId);
            const template = instrumentTypes[resolvedTypeId];
            const rowCount = template.rows.length;
            return {
                typeId: resolvedTypeId,
                volume: 0.8,
                swing: 0,
                muted: false,
                solo: false,
                subdiv: 4,
                octaveOffset: 0,
                baseOctaveOffset: template.baseOctaveOffset || 0,
                loopMultiplier: 1,
                rowDrums: template.type === 'drum' ? template.rows.map(rowName => normalizeDrumType(rowName)) : [],
                rowStyles: template.rows.map(() => 0),
                rowHeight: 18,
                grid: createDefaultGrid(rowCount),
                audioRoute: 'master',
                adsr: template.adsr ? { ...template.adsr } : null,
                adsrDefaults: template.adsr ? { ...template.adsr } : null,
                activeNotes: new Set(),
                randStyle: 'musical',
                randDensity: 0.5,
                randSpread: 0.5,
                randMode: 'replace',
                randOnLoop: false,
                randNoteLen: 1.0,
                randJitter: 0,
                randGliss: 0,
                minimized: false,
                sidechainEnabled: false,
                glide: false,
                glideTime: 0.1,
                glideMode: 'portamento',
                lastFreq: null,
                xy: template.xy ? { ...template.xy } : { x: 0.8, y: 0.2 },
                modLinks: { x: null, y: null, decay: null, sustain: null, adsr: null, wobble: null },
                wobbleRate: (state.bpm / 60) * 2,
                voiceLfoEnabled: template.voiceLfoDefault === true,
                midiDoublingTargetId: null,
                samplerBank: 'A',
                samplerPitch: 1.0,
                samplerMode: 'oneShot',
                samplerReverse: false,
                samplerGain: 1.0,
                samplerPan: 0.0,
                mixerGain: 0.75,
                arp: createDefaultArp()
            };
        }

        function serializeTrack(track, options = {}) {
            const { includeId = true, includeMinimized = true } = options;
            const arp = track.arp ? normalizeArp(track.arp) : null;
            const data = {
                schemaVersion: TRACK_SCHEMA_VERSION,
                typeId: resolveTrackTypeId(track.typeId),
                volume: numberOrDefault(track.volume, 0.8),
                muted: !!track.muted,
                solo: !!track.solo,
                subdiv: numberOrDefault(track.subdiv, 4),
                octaveOffset: numberOrDefault(track.octaveOffset, 0),
                loopMultiplier: numberOrDefault(track.loopMultiplier, 1),
                rowDrums: track.rowDrums ? [...track.rowDrums] : [],
                rowStyles: track.rowStyles ? [...track.rowStyles] : [],
                grid: cloneData(track.grid, []),
                adsr: track.adsr ? { ...track.adsr } : null,
                sidechainEnabled: !!track.sidechainEnabled,
                xy: track.xy ? { ...track.xy } : { x: 0.8, y: 0.2 },
                audioRoute: track.audioRoute || 'master',
                mixerGain: track.mixerGain ?? 0.75,
                modLinks: track.modLinks ? { ...track.modLinks } : { x: null, y: null, decay: null, sustain: null, adsr: null, wobble: null },
                midiDoublingTargetId: track.midiDoublingTargetId || null,
                wobbleRate: numberOrDefault(track.wobbleRate, 0),
                voiceLfoEnabled: !!track.voiceLfoEnabled,
                samplerBank: track.samplerBank || 'A',
                samplerPitch: numberOrDefault(track.samplerPitch, 1.0),
                samplerMode: normalizeSamplerModeValue(track.samplerMode),
                samplerReverse: !!track.samplerReverse,
                samplerGain: numberOrDefault(track.samplerGain, 1.0),
                samplerPan: numberOrDefault(track.samplerPan, 0.0),
                glide: !!track.glide,
                glideTime: numberOrDefault(track.glideTime, 0.1),
                glideMode: track.glideMode || 'portamento',
                arp: arp ? {
                    enabled: !!arp.enabled,
                    latch: !!arp.latch,
                    subdivision: arp.subdivision,
                    direction: arp.direction
                } : null
            };
            if (includeId) data.id = track.id;
            if (includeMinimized) data.minimized = !!track.minimized;
            return data;
        }

        function applyTrackData(track, trackData = {}, options = {}) {
            const { includeId = true, includeMinimized = true } = options;
            const typeId = resolveTrackTypeId(trackData.typeId || track.typeId);
            const defaults = getTrackDefaults(typeId);
            const template = instrumentTypes[typeId];

            if (includeId && trackData.id) track.id = trackData.id;
            track.typeId = typeId;
            track.volume = numberOrDefault(trackData.volume, defaults.volume);
            track.muted = boolOrDefault(trackData.muted, defaults.muted);
            track.solo = boolOrDefault(trackData.solo, defaults.solo);
            track.subdiv = numberOrDefault(trackData.subdiv, defaults.subdiv);
            track.octaveOffset = numberOrDefault(trackData.octaveOffset, defaults.octaveOffset);
            track.baseOctaveOffset = defaults.baseOctaveOffset;
            track.loopMultiplier = numberOrDefault(trackData.loopMultiplier ?? trackData.loopLength, defaults.loopMultiplier);
            track.rowDrums = Array.isArray(trackData.rowDrums)
                ? trackData.rowDrums.map(normalizeDrumType)
                : [...defaults.rowDrums];
            track.rowStyles = Array.isArray(trackData.rowStyles)
                ? [...trackData.rowStyles]
                : [...defaults.rowStyles];
            track.rowHeight = numberOrDefault(trackData.rowHeight, defaults.rowHeight);
            track.grid = normalizeTrackGrid(trackData.grid, template.rows.length);
            track.adsr = trackData.adsr ? { ...defaults.adsr, ...trackData.adsr } : (defaults.adsr ? { ...defaults.adsr } : null);
            track.adsrDefaults = defaults.adsrDefaults ? { ...defaults.adsrDefaults } : null;
            track.sidechainEnabled = boolOrDefault(trackData.sidechainEnabled, defaults.sidechainEnabled);
            track.xy = trackData.xy ? { ...defaults.xy, ...trackData.xy } : { ...defaults.xy };
            track.audioRoute = trackData.audioRoute || defaults.audioRoute;
            track.mixerGain = numberOrDefault(trackData.mixerGain, defaults.mixerGain);
            if (track.mixerGainNode) track.mixerGainNode.gain.value = track.mixerGain;
            track.modLinks = { ...defaults.modLinks, ...(trackData.modLinks || {}) };
            track.midiDoublingTargetId = trackData.midiDoublingTargetId || null;
            track.wobbleRate = numberOrDefault(trackData.wobbleRate, defaults.wobbleRate);
            track.voiceLfoEnabled = boolOrDefault(trackData.voiceLfoEnabled, defaults.voiceLfoEnabled);
            track.samplerBank = trackData.samplerBank || defaults.samplerBank;
            track.samplerPitch = numberOrDefault(trackData.samplerPitch, defaults.samplerPitch);
            track.samplerMode = normalizeSamplerModeValue(trackData.samplerMode);
            track.samplerReverse = boolOrDefault(trackData.samplerReverse, defaults.samplerReverse);
            track.samplerGain = numberOrDefault(trackData.samplerGain, defaults.samplerGain);
            track.samplerPan = numberOrDefault(trackData.samplerPan, defaults.samplerPan);
            track.glide = boolOrDefault(trackData.glide, defaults.glide);
            track.glideTime = numberOrDefault(trackData.glideTime, defaults.glideTime);
            track.glideMode = trackData.glideMode || defaults.glideMode;
            track.randStyle = trackData.randStyle || defaults.randStyle;
            track.randDensity = numberOrDefault(trackData.randDensity, defaults.randDensity);
            track.randSpread = numberOrDefault(trackData.randSpread, defaults.randSpread);
            track.randMode = trackData.randMode || defaults.randMode;
            track.randOnLoop = boolOrDefault(trackData.randOnLoop, defaults.randOnLoop);
            track.randNoteLen = numberOrDefault(trackData.randNoteLen, defaults.randNoteLen);
            track.randJitter = numberOrDefault(trackData.randJitter, defaults.randJitter);
            track.randGliss = numberOrDefault(trackData.randGliss, defaults.randGliss);
            track.arp = normalizeArp(trackData.arp ? { ...defaults.arp, ...trackData.arp } : defaults.arp);
            if (includeMinimized) track.minimized = boolOrDefault(trackData.minimized, defaults.minimized);
            track.gainNode.gain.value = track.muted ? 0 : track.volume;
            applyTrackFilter(track);
            return track;
        }

        function hydrateTrack(trackData = {}) {
            const track = createTrack(trackData.typeId);
            return applyTrackData(track, trackData);
        }

        function resetArpPlayback(track) {
            if (!track?.arp) return;
            track.arp.heldNotes = [];
            track.arp.currentIdx = 0;
            track.arp.lastStep = -1;
            track.arp.goingUp = true;
        }

        function isArpEligibleTrack(track) {
            return instrumentTypes[track?.typeId]?.type === 'synth';
        }

        function getOrderedArpNotes(track) {
            const arp = normalizeArp(track?.arp);
            const maxRows = track?.grid?.length || 0;
            const notes = [...new Set(arp.heldNotes.filter(note => Number.isInteger(note) && note >= 0 && note < maxRows))];
            const ascendingPitch = notes.sort((a, b) => b - a);
            if (arp.direction === 'down' || arp.direction === 'downup') return ascendingPitch.reverse();
            return ascendingPitch;
        }

        function getArpRowToPlay(track, notes) {
            if (!track?.arp || notes.length === 0) return null;
            if (track.arp.direction === 'random') {
                track.arp.currentIdx = Math.floor(Math.random() * notes.length);
            } else if (track.arp.currentIdx >= notes.length || track.arp.currentIdx < 0) {
                track.arp.currentIdx = 0;
            }
            return notes[track.arp.currentIdx];
        }

        function addArpHeldNote(track, rowIdx) {
            if (!track?.arp) return;
            track.arp = normalizeArp(track.arp);
            const heldIdx = track.arp.heldNotes.indexOf(rowIdx);
            if (track.arp.latch && heldIdx >= 0) {
                track.arp.heldNotes.splice(heldIdx, 1);
            } else if (heldIdx < 0) {
                track.arp.heldNotes.push(rowIdx);
            }
            if (track.arp.currentIdx >= track.arp.heldNotes.length) track.arp.currentIdx = 0;
            track.arp.lastStep = -1;
        }

        function isTrackStepWithinNote(startStep, currentStep, noteLength, trackSteps) {
            const lengthSteps = Math.max(1, Math.ceil(Number(noteLength) || 1));
            const distance = (currentStep - startStep + trackSteps) % trackSteps;
            return distance < lengthSteps;
        }

        function getSequencerArpRows(track, trackStep, trackSteps) {
            const rows = [];
            for (let r = 0; r < track.grid.length; r++) {
                for (let s = 0; s < trackSteps; s++) {
                    const stepData = track.grid[r][s];
                    const isOn = typeof stepData === 'object' ? stepData.on : !!stepData;
                    if (!isOn) continue;

                    const noteLength = typeof stepData === 'object' ? stepData.length : 1;
                    if (isTrackStepWithinNote(s, trackStep, noteLength, trackSteps)) {
                        rows.push(r);
                        break;
                    }
                }
            }
            return rows;
        }

        function updateSequencerArpPool(track, rows) {
            if (!track?.arp) return;
            track.arp = normalizeArp(track.arp);

            const nextRows = [...new Set(rows)];
            if (nextRows.length > 0) {
                const previous = track.arp.heldNotes.join(',');
                const next = nextRows.join(',');
                track.arp.heldNotes = nextRows;
                if (previous !== next) {
                    track.arp.currentIdx = 0;
                    track.arp.lastStep = -1;
                    track.arp.goingUp = true;
                }
                return;
            }

            if (!track.arp.latch) resetArpPlayback(track);
        }

        function getArpStepData(track) {
            const arpSubdiv = track?.arp?.subdivision || 12;
            const trackSubdiv = track?.subdiv || 4;
            const length = Math.max(0.1, (arpSubdiv / state.stepsPerBeat) * trackSubdiv * 0.85);
            return { on: true, length, arp: true };
        }

        function advanceArpIndex(track, noteCount) {
            const arp = track?.arp;
            if (!arp || noteCount <= 0) return;
            if (arp.direction === 'random') return;
            if (noteCount === 1) {
                arp.currentIdx = Math.min(Math.max(arp.currentIdx, 0), Math.max(0, noteCount - 1));
                return;
            }

            if (arp.direction === 'updown' || arp.direction === 'downup') {
                if (arp.goingUp) {
                    arp.currentIdx++;
                    if (arp.currentIdx >= noteCount) {
                        arp.currentIdx = Math.max(0, noteCount - 2);
                        arp.goingUp = false;
                    }
                } else {
                    arp.currentIdx--;
                    if (arp.currentIdx < 0) {
                        arp.currentIdx = Math.min(noteCount - 1, 1);
                        arp.goingUp = true;
                    }
                }
                return;
            }

            arp.currentIdx = (arp.currentIdx + 1) % noteCount;
        }

        function createTrack(typeId) {
            const defaults = getTrackDefaults(typeId);
            const trackId = 'trk_' + Math.floor(Math.random() * 10000);
            const track = {
                id: trackId,
                typeId: defaults.typeId,
                volume: defaults.volume, swing: defaults.swing, muted: defaults.muted, solo: defaults.solo,
                subdiv: defaults.subdiv, // 1/16 default
                octaveOffset: defaults.octaveOffset,
                baseOctaveOffset: defaults.baseOctaveOffset,
                loopMultiplier: defaults.loopMultiplier,
                rowDrums: [...defaults.rowDrums],
                rowStyles: [...defaults.rowStyles],
                rowHeight: defaults.rowHeight
            };
            track.grid = cloneData(defaults.grid, []);
            track.gainNode = audioCtx.createGain();
            track.sidechainNode = audioCtx.createGain();
            track.filterNode = audioCtx.createBiquadFilter();
            track.panNode = audioCtx.createStereoPanner();

            track.mixerGain = defaults.mixerGain;
            track.mixerGainNode = audioCtx.createGain();
            track.mixerGainNode.gain.value = track.mixerGain;

            track.filterNode.type = 'lowpass';
            track.filterNode.frequency.value = 20000;
            track.filterNode.connect(track.panNode);
            track.panNode.connect(track.sidechainNode);
            track.sidechainNode.connect(track.gainNode);
            track.gainNode.connect(track.mixerGainNode);
            track.mixerGainNode.connect(masterGain);

            track.cleanup = () => {
                try {
                    track.gainNode.disconnect();
                    track.mixerGainNode.disconnect();
                    track.sidechainNode.disconnect();
                    track.panNode.disconnect();
                    track.filterNode.disconnect();
                } catch (e) { console.warn("Cleanup error:", e); }
            };

            track.analyser = audioCtx.createAnalyser();
            track.analyser.fftSize = 256;
            track.gainNode.connect(track.analyser);

            track.audioRoute = defaults.audioRoute;
            track.adsr = defaults.adsr ? { ...defaults.adsr } : null;
            track.adsrDefaults = defaults.adsrDefaults ? { ...defaults.adsrDefaults } : null;
            track.activeNotes = new Set();
            track.randStyle = defaults.randStyle;
            track.randDensity = defaults.randDensity;
            track.randSpread = defaults.randSpread;
            track.randMode = defaults.randMode; // 'replace' or 'add'
            track.randOnLoop = defaults.randOnLoop;
            track.randNoteLen = defaults.randNoteLen;
            track.randJitter = defaults.randJitter;
            track.randGliss = defaults.randGliss;
            track.minimized = defaults.minimized;
            track.sidechainEnabled = defaults.sidechainEnabled;
            track.glide = defaults.glide;
            track.glideTime = defaults.glideTime;
            track.glideMode = defaults.glideMode; // 'portamento' or 'glissando'
            track.lastFreq = defaults.lastFreq;
            track.xy = { ...defaults.xy }; // Default: high cutoff, low resonance
            track.modLinks = { ...defaults.modLinks }; // IDs of drawers
            track.wobbleRate = defaults.wobbleRate; // Default to 8th notes
            track.voiceLfoEnabled = defaults.voiceLfoEnabled;
            track.midiDoublingTargetId = defaults.midiDoublingTargetId; // ID of target track for MIDI mirroring
            track.samplerBank = defaults.samplerBank;
            track.samplerPitch = defaults.samplerPitch;
            track.samplerMode = defaults.samplerMode;
            track.samplerReverse = defaults.samplerReverse;
            track.samplerGain = defaults.samplerGain;
            track.samplerPan = defaults.samplerPan;
            track.arp = normalizeArp(defaults.arp);
            applyTrackFilter(track);
            return track;
        }

        // --- Sidechain Trigger ---
        // Sidechain trigger is now unified and triggered by playSound for Kick drum



        // --- UI Rendering ---
        const tracksContainer = document.getElementById('tracks-container');
        let isDraggingPip = false; let dragDrawMode = true;

        function selectTrack(idx) {
            if (state.activeTrackId !== idx) {
                state.activeTrackId = idx;
                renderTracks();
                updateOctaveDisp();
            }
        }

        window.addEventListener('mousedown', (e) => {
            if (e.target.closest('#fx-aside') || e.target.closest('.fx-panel')) return;
            const step = e.target.closest('.step');
            const inner = e.target.closest('.step-inner');

            if (step || inner) {
                isDraggingPip = true;
            } else {
                // Start Selection Box if clicking in tracks area but not on a control
                const tracksArea = e.target.closest('.tracks-area');
                if (tracksArea && !e.target.closest('button') && !e.target.closest('select') && !e.target.closest('input')) {
                    state.selection.active = true;
                    state.selection.startX = e.clientX;
                    state.selection.startY = e.clientY;
                    state.selection.notes = []; // Clear selection
                    const box = document.getElementById('selection-box');
                    if (box) {
                        box.style.display = 'block';
                        box.style.left = e.clientX + 'px';
                        box.style.top = e.clientY + 'px';
                        box.style.width = '0px';
                        box.style.height = '0px';
                    }
                }
            }

            const trackEl = e.target.closest('.track');
            if (trackEl) {
                const idx = Array.from(tracksContainer.children).indexOf(trackEl);
                if (idx !== -1 && idx < state.tracks.length) selectTrack(idx);
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (state.selection.active) {
                const box = document.getElementById('selection-box');
                if (box) {
                    const x = Math.min(e.clientX, state.selection.startX);
                    const y = Math.min(e.clientY, state.selection.startY);
                    const w = Math.abs(e.clientX - state.selection.startX);
                    const h = Math.abs(e.clientY - state.selection.startY);
                    box.style.left = x + 'px';
                    box.style.top = y + 'px';
                    box.style.width = w + 'px';
                    box.style.height = h + 'px';

                    // Logic to find notes inside rect will happen on mouseup or here
                }
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (state.selection.active) {
                const box = document.getElementById('selection-box');
                if (box) {
                    const rect = box.getBoundingClientRect();
                    const affectedTracks = new Set();
                    // Find all .step-inner elements inside this rect
                    document.querySelectorAll('.step-inner').forEach(inner => {
                        const iRect = inner.getBoundingClientRect();
                        if (iRect.left >= rect.left && iRect.right <= rect.right &&
                            iRect.top >= rect.top && iRect.bottom <= rect.bottom) {
                            const stepEl = inner.parentElement;
                            const rowEl = stepEl.parentElement;
                            const trackEl = rowEl.parentElement.parentElement;
                            const trackId = trackEl.id.replace('track_', '');
                            const rowIdx = Array.from(rowEl.parentElement.children).indexOf(rowEl);
                            const stepIdx = parseInt(stepEl.dataset.step);
                            state.selection.notes.push({ trackId, row: rowIdx, step: stepIdx });
                            affectedTracks.add(trackId);
                        }
                    });
                    box.style.display = 'none';
                    affectedTracks.forEach(tId => {
                        const t = state.tracks.find(tr => tr.id === tId);
                        if (t) updateTrackGrid(t);
                    });
                }
                state.selection.active = false;
            }
            isDraggingPip = false;
            // autoSpawnTrackIfNeeded(); // Removed for UI Overhaul 2.0
            // if (typeof autoSpawnDrawerIfNeeded === 'function') autoSpawnDrawerIfNeeded(); // Removed for UI Overhaul 2.0
        });

        window.addEventListener('keydown', (e) => {
            const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT';
            if (isInput) return;

            // Delete / Backspace
            if ((e.key === 'Delete' || e.key === 'Backspace') && state.selection.notes.length > 0) {
                const affectedTracks = new Set();
                state.selection.notes.forEach(n => {
                    const t = state.lookup.tracks.get(n.trackId);
                    if (t) {
                        t.grid[n.row][n.step] = { on: false, length: 1.0 };
                        markTrackCellDirty(t, n.row, n.step);
                        affectedTracks.add(n.trackId);
                    }
                });
                state.selection.notes = [];
                affectedTracks.forEach(tId => {
                    const t = state.lookup.tracks.get(tId);
                    if (t) updateTrackGrid(t);
                });
                return;
            }

            // Copy (C)
            if (e.key.toLowerCase() === 'c' && state.selection.notes.length > 0) {
                // Find min row and step to make them relative
                let minR = Infinity, minS = Infinity;
                state.selection.notes.forEach(n => {
                    if (n.row < minR) minR = n.row;
                    if (n.step < minS) minS = n.step;
                });
                const trackMap = new Map(state.tracks.map(t => [t.id, t]));
                state.selection.clipboard = state.selection.notes.map(n => {
                    const t = state.lookup.tracks.get(n.trackId);
                    const data = t ? t.grid[n.row][n.step] : { on: true, length: 1 };
                    return {
                        relRow: n.row - minR,
                        relStep: n.step - minS,
                        nl: typeof data === 'object' ? data.length : 1,
                        on: typeof data === 'object' ? data.on : !!data
                    };
                });
                return;
            }

            // Paste (V)
            if (e.key.toLowerCase() === 'v' && state.selection.clipboard.length > 0 && state.hoveredGrid) {
                const { trackId, row, step } = state.hoveredGrid;
                const track = state.lookup.tracks.get(trackId);
                if (track) {
                    state.selection.clipboard.forEach(clip => {
                        const targetR = row + clip.relRow;
                        const targetS = step + clip.relStep;
                        if (track.grid[targetR] && targetS < 256) {
                            track.grid[targetR][targetS] = { on: clip.on, length: clip.nl };
                            markTrackCellDirty(track, targetR, targetS);
                        }
                    });
                    updateTrackGrid(track);
                }
                return;
            }

            if (state.hoveredGrid && !e.repeat) {
                const { trackId, row } = state.hoveredGrid;
                const track = state.lookup.tracks.get(trackId);
                if (!track) return;

                const currentTrackSubdiv = track.subdiv || 4;
                const trackSteps = (track.loopMultiplier || 1) * Math.round(state.timeSignature * currentTrackSubdiv);
                let changed = false;

                if (e.key === '1') { // *---
                    for (let s = 0; s < trackSteps; s++) track.grid[row][s] = { on: (s % currentTrackSubdiv === 0), length: 1 };
                    changed = true;
                } else if (e.key === '2') { // *-*-
                    for (let s = 0; s < trackSteps; s++) track.grid[row][s] = { on: (s % (currentTrackSubdiv / 2) === 0), length: 1 };
                    changed = true;
                } else if (e.key === '3') { // ****
                    for (let s = 0; s < trackSteps; s++) track.grid[row][s] = { on: true, length: 1 };
                    changed = true;
                } else if (e.key === '4') { // Offbeats
                    for (let s = 0; s < trackSteps; s++) track.grid[row][s] = { on: (s % currentTrackSubdiv === Math.floor(currentTrackSubdiv / 2)), length: 1 };
                    changed = true;
                } else if (e.key === '5') { // Fill by 3
                    for (let s = 0; s < trackSteps; s++) track.grid[row][s] = { on: (s % 3 === 0), length: 1 };
                    changed = true;
                }

                if (changed) {
                    markTrackRowDirty(track, row);
                    updateTrackGrid(track);
                }
            }
        });



        function toggleHelp() {
            const modal = document.getElementById('help-modal');
            modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
        }

        function createStepInner(track, rIdx, s) {
            const inner = document.createElement('div');

            const updateVisuals = () => {
                const sd = track.grid[rIdx][s];
                const isOn = typeof sd === 'object' ? sd.on : !!sd;
                if (!isOn) return;
                const nl = typeof sd === 'object' ? sd.length : 1.0;
                const isSelected = state.selection.notes.some(n => n.trackId === track.id && n.row === rIdx && n.step === s);
                inner.className = 'step-inner' + (isSelected ? ' selected' : '');
                inner.style.width = `calc(${nl * 100}% + ${(nl - 1) * 2}px)`;
            };
            updateVisuals();

            inner.onmousedown = (e) => {
                if (isPatching) return;
                e.stopPropagation();

                const isCurrentSelected = state.selection.notes.some(n => n.trackId === track.id && n.row === rIdx && n.step === s);

                if (e.shiftKey) {
                    isDraggingPip = false;
                    e.preventDefault();
                    const rect = inner.getBoundingClientRect();
                    const currentNl = typeof track.grid[rIdx][s] === 'object' ? track.grid[rIdx][s].length : 1.0;
                    const cellW = rect.width / currentNl;
                    const startX = e.clientX;
                    const originalStep = s;
                    const originalLength = currentNl;
                    const originalEnd = originalStep + originalLength;
                    const maxStep = track.grid[rIdx].length - 1;
                    const clickXRelative = e.clientX - rect.left;
                    const isDraggingStart = clickXRelative <= rect.width / 2;

                    const onMove = (me) => {
                        const rawDeltaSteps = (me.clientX - startX) / cellW;
                        const deltaSteps = Math.round(rawDeltaSteps);
                        const lengthDelta = Math.round(rawDeltaSteps * 4) / 4;
                        const oldData = track.grid[rIdx][s];
                        const noteData = (typeof oldData === 'object' && oldData) ? { ...oldData } : { on: true, length: originalLength };

                        if (isDraggingStart) {
                            const latestStart = Math.max(0, Math.min(maxStep, Math.floor(originalEnd - 0.25)));
                            const newStep = Math.max(0, Math.min(latestStart, originalStep + deltaSteps));
                            const newLen = Math.max(0.25, originalEnd - newStep);
                            if (newStep !== s) {
                                track.grid[rIdx][s] = { on: false, length: 1.0 };
                                markTrackCellDirty(track, rIdx, s);
                            }
                            track.grid[rIdx][newStep] = { ...noteData, on: true, length: newLen };
                            markTrackCellDirty(track, rIdx, newStep);
                            s = newStep;
                        } else {
                            track.grid[rIdx][s] = { ...noteData, on: true, length: Math.max(0.25, originalLength + lengthDelta) };
                            markTrackCellDirty(track, rIdx, s);
                        }
                        scheduleTrackGridUpdate(track);
                    };
                    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
                } else if (isCurrentSelected) {
                    // Start Moving Selection
                    state.dragSelection.active = true;
                    state.dragSelection.startStep = s;
                    state.dragSelection.startRow = rIdx;
                    state.dragSelection.trackId = track.id;

                    // Capture initial states of all selected notes
                    const initialNotes = state.selection.notes.map(n => {
                        const tr = state.tracks.find(t => t.id === n.trackId);
                        return { ...n, data: JSON.parse(JSON.stringify(tr.grid[n.row][n.step])) };
                    });

                    const onMove = (me) => {
                        if (!state.hoveredGrid) return;
                        const ds = state.hoveredGrid.step - state.dragSelection.startStep;
                        const dr = state.hoveredGrid.row - state.dragSelection.startRow;
                        if (ds === 0 && dr === 0) return;

                        // Clear current grid positions of selection
                        initialNotes.forEach(n => {
                            const tr = state.tracks.find(t => t.id === n.trackId);
                            if (tr && tr.grid[n.row] && tr.grid[n.row][n.step]) {
                                tr.grid[n.row][n.step] = { on: false, length: 1.0 };
                                markTrackCellDirty(tr, n.row, n.step);
                            }
                        });

                        // Place at new positions
                        const newSelection = [];
                        initialNotes.forEach(n => {
                            const tr = state.tracks.find(t => t.id === n.trackId);
                            const nr = n.row + dr;
                            const ns = n.step + ds;
                            if (tr && tr.grid[nr] && ns >= 0 && ns < 256) {
                                tr.grid[nr][ns] = n.data;
                                markTrackCellDirty(tr, nr, ns);
                                newSelection.push({ trackId: n.trackId, row: nr, step: ns });
                            }
                        });

                        state.selection.notes = newSelection;
                        state.dragSelection.startStep += ds;
                        state.dragSelection.startRow += dr;

                        // Update all affected tracks
                        const affectedTracks = new Set(initialNotes.map(n => n.trackId).concat(newSelection.map(n => n.trackId)));
                        affectedTracks.forEach(tId => {
                            const tr = state.tracks.find(t => t.id === tId);
                            if (tr) scheduleTrackGridUpdate(tr);
                        });
                    };
                    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
                } else {
                    // Simple Delete if not selected and not shift
                    dragDrawMode = false;
                    track.grid[rIdx][s] = { on: false, length: 1.0 };
                    markTrackCellDirty(track, rIdx, s);
                    updateTrackGrid(track);
                }
            };
            return inner;
        }

        const scheduledTrackGridUpdates = new Set();
        let trackGridUpdateFrame = null;

        function getDirtyCellKey(rowIdx, stepIdx) {
            return `${rowIdx}:${stepIdx}`;
        }

        function markTrackCellDirty(track, rowIdx, stepIdx) {
            if (!track) return;
            if (!track._dirtyGridCells) track._dirtyGridCells = new Map();
            track._dirtyGridCells.set(getDirtyCellKey(rowIdx, stepIdx), { rowIdx, stepIdx });
        }

        function markTrackRowDirty(track, rowIdx) {
            if (!track) return;
            if (!track._dirtyGridRows) track._dirtyGridRows = new Set();
            track._dirtyGridRows.add(rowIdx);
        }

        function markTrackGridDirty(track) {
            if (!track) return;
            track._dirtyGridAll = true;
            if (track._dirtyGridCells) track._dirtyGridCells.clear();
            if (track._dirtyGridRows) track._dirtyGridRows.clear();
        }

        function consumeTrackGridDirtyState(track) {
            if (!track || track._dirtyGridAll) {
                if (track) track._dirtyGridAll = false;
                return null;
            }

            const dirtyRows = track._dirtyGridRows ? Array.from(track._dirtyGridRows) : [];
            const dirtyCells = track._dirtyGridCells ? Array.from(track._dirtyGridCells.values()) : [];
            if (track._dirtyGridRows) track._dirtyGridRows.clear();
            if (track._dirtyGridCells) track._dirtyGridCells.clear();
            if (!dirtyRows.length && !dirtyCells.length) return null;
            return { dirtyRows, dirtyCells };
        }

        function renderGridCellState(track, rIdx, s) {
            const stepEl = track.gridCells?.[rIdx]?.[s];
            const sd = track.grid?.[rIdx]?.[s];
            if (!stepEl || sd === undefined) return;
            const isOn = typeof sd === 'object' ? sd.on : !!sd;
            const nl = typeof sd === 'object' ? sd.length : 1.0;
            const isSelected = state.selection.notes.some(n => n.trackId === track.id && n.row === rIdx && n.step === s);

            const inner = stepEl.firstElementChild;
            if (isOn) {
                if (!inner) {
                    stepEl.appendChild(createStepInner(track, rIdx, s));
                } else {
                    inner.className = 'step-inner' + (isSelected ? ' selected' : '');
                    inner.style.width = `calc(${nl * 100}% + ${(nl - 1) * 2}px)`;
                }
            } else if (inner) {
                stepEl.removeChild(inner);
            }
        }

        function updateTrackGrid(track) {
            if (track.minimized || !track.gridCells) return;
            const dirtyState = consumeTrackGridDirtyState(track);
            if (dirtyState) {
                dirtyState.dirtyRows.forEach(rIdx => {
                    const rowCells = track.gridCells[rIdx];
                    if (!rowCells) return;
                    rowCells.forEach((_, s) => renderGridCellState(track, rIdx, s));
                });
                dirtyState.dirtyCells.forEach(({ rowIdx, stepIdx }) => renderGridCellState(track, rowIdx, stepIdx));
                return;
            }
            track.gridCells.forEach((rowCells, rIdx) => {
                rowCells.forEach((_, s) => renderGridCellState(track, rIdx, s));
            });
        }

        function scheduleTrackGridUpdate(track) {
            if (!track) return;
            scheduledTrackGridUpdates.add(track);
            if (trackGridUpdateFrame !== null) return;
            trackGridUpdateFrame = requestAnimationFrame(() => {
                const pending = Array.from(scheduledTrackGridUpdates);
                scheduledTrackGridUpdates.clear();
                trackGridUpdateFrame = null;
                pending.forEach(updateTrackGrid);
            });
        }

        function updateSoloMuteUI() {
            state.tracks.forEach(t => {
                if (t.soloBtn) t.soloBtn.classList.toggle('active', t.solo);
                if (t.muteBtn) t.muteBtn.classList.toggle('active', t.muted);

                // Also update mixer strips
                const strip = mixerStripCache.get(t.id);
                if (strip) {
                    strip.classList.toggle('muted', t.muted);
                    strip.classList.toggle('solo', t.solo);
                }
            });
            // Update global solo state logic if needed (handled in synthesis)
        }


        const MCP2000_SAMPLE_BASE_URL = 'samples/mcp2000_sounds/';
        const mcp2000_cache = {};
        const mcp2000_pending = new Map();
        const mcp2000_bankPreloads = new Map();
        const reversedSamplerBuffers = new WeakMap();
        const samplerWaveformPeakCache = new WeakMap();
        const scheduledSamplerWaveformTracks = new Set();
        let samplerWaveformFrame = null;

        function setTooltip(el, title = '', text = '', hotkey = '') {
            if (!el) return el;
            if (title) el.setAttribute('data-tooltip-title', title);
            if (text) el.setAttribute('data-tooltip', text);
            if (hotkey) el.setAttribute('data-tooltip-hotkey', hotkey);
            return el;
        }

        function createButtonControl({
            className = '',
            text = '',
            ariaLabel = '',
            pressed = null,
            dataset = {},
            tooltipTitle = '',
            tooltip = '',
            tooltipHotkey = '',
            onClick = null
        } = {}) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = className;
            button.textContent = text;
            if (ariaLabel) button.setAttribute('aria-label', ariaLabel);
            if (pressed !== null) button.setAttribute('aria-pressed', String(!!pressed));
            Object.entries(dataset).forEach(([key, value]) => {
                if (value !== undefined && value !== null) button.dataset[key] = value;
            });
            setTooltip(button, tooltipTitle, tooltip, tooltipHotkey);
            if (onClick) button.onclick = onClick;
            return button;
        }

        function createRangeControl({
            className = '',
            labelClassName = '',
            valueClassName = '',
            label = '',
            value = 0,
            min = 0,
            max = 1,
            step = 0.01,
            ariaLabel = '',
            dataControl = '',
            tooltipTitle = '',
            tooltip = '',
            tooltipHotkey = '',
            formatValue = current => String(current),
            onInput = null
        } = {}) {
            const wrap = document.createElement('div');
            wrap.className = className;
            setTooltip(wrap, tooltipTitle, tooltip, tooltipHotkey);

            const labelEl = document.createElement('span');
            labelEl.className = labelClassName;
            labelEl.textContent = label;

            const input = document.createElement('input');
            input.type = 'range';
            input.min = min;
            input.max = max;
            input.step = step;
            input.value = value;
            if (ariaLabel) input.setAttribute('aria-label', ariaLabel);
            if (dataControl) input.dataset.control = dataControl;

            const valueEl = document.createElement('span');
            valueEl.className = valueClassName;
            valueEl.textContent = formatValue(value);

            input.oninput = (e) => {
                const nextValue = parseFloat(e.target.value);
                if (onInput) onInput(nextValue, e);
                valueEl.textContent = formatValue(nextValue);
            };

            wrap.append(labelEl, input, valueEl);
            return { wrap, input, valueEl };
        }

        function createCompactSelectControl({
            className = '',
            ariaLabel = '',
            options = [],
            value = '',
            tooltipTitle = '',
            tooltip = '',
            tooltipHotkey = '',
            onChange = null
        } = {}) {
            const select = document.createElement('select');
            select.className = className;
            if (ariaLabel) select.setAttribute('aria-label', ariaLabel);
            setTooltip(select, tooltipTitle, tooltip, tooltipHotkey);
            options.forEach(optionData => {
                const opt = document.createElement('option');
                opt.value = optionData.value;
                opt.textContent = optionData.label;
                if (optionData.value === value) opt.selected = true;
                select.appendChild(opt);
            });
            if (onChange) select.onchange = onChange;
            select.onclick = (e) => e.stopPropagation();
            return select;
        }

        function createPatchPointControl(className, id, active = false) {
            const point = document.createElement('div');
            point.className = className + (active ? ' active' : '');
            point.id = id;
            point.onmousedown = (e) => e.stopPropagation();
            return point;
        }

        function getSamplerWaveformPeaks(buffer, width) {
            if (!buffer) return [];
            const peakWidth = Math.max(1, Math.floor(width || 1));
            let widthCache = samplerWaveformPeakCache.get(buffer);
            if (!widthCache) {
                widthCache = new Map();
                samplerWaveformPeakCache.set(buffer, widthCache);
            }
            if (widthCache.has(peakWidth)) return widthCache.get(peakWidth);

            const data = buffer.getChannelData(0);
            const step = Math.ceil(data.length / peakWidth);
            const peaks = [];
            for (let i = 0; i < peakWidth; i++) {
                let min = 1.0;
                let max = -1.0;
                for (let j = 0; j < step; j++) {
                    const idx = i * step + j;
                    if (idx >= data.length) break;
                    const datum = data[idx];
                    if (datum < min) min = datum;
                    if (datum > max) max = datum;
                }
                peaks.push({ min, max });
            }
            widthCache.set(peakWidth, peaks);
            return peaks;
        }

        function scheduleSamplerWaveformDraw(track) {
            if (!track || !track.samplerCanvas || track.minimized) return;
            scheduledSamplerWaveformTracks.add(track);
            if (samplerWaveformFrame !== null) return;
            samplerWaveformFrame = requestAnimationFrame(() => {
                const pending = Array.from(scheduledSamplerWaveformTracks);
                scheduledSamplerWaveformTracks.clear();
                samplerWaveformFrame = null;
                pending.forEach(item => {
                    if (item.samplerCanvas && !item.minimized) drawSamplerWaveform(item.samplerCanvas, item);
                });
            });
        }

        function getPadFileName(padData) {
            return padData?.file || padData?.label || '';
        }

        function getMCP2000SampleUrl(fileName) {
            return `${MCP2000_SAMPLE_BASE_URL}${encodeURIComponent(fileName)}`;
        }

        function getSamplerBankPads(bank) {
            if (bank === 'B' && typeof mcp2000_config_b !== 'undefined') return mcp2000_config_b.pads || [];
            if (typeof mcp2000_config !== 'undefined') return mcp2000_config.pads || [];
            return [];
        }

        function getSamplerMode(track) {
            return SAMPLER_MODE_IDS.has(track?.samplerMode) ? track.samplerMode : 'oneShot';
        }

        function samplerUsesHeldGate(track) {
            const mode = getSamplerMode(track);
            return mode === 'gate' || mode === 'loop';
        }

        function isHeldVoice(track, rowIdx, template = null) {
            const resolvedTemplate = template || instrumentTypes[track?.typeId];
            if (!resolvedTemplate) return true;
            if (resolvedTemplate.type === 'synth') return true;
            if (resolvedTemplate.type === 'drum' && isSamplerDrumVariant(track, rowIdx)) return samplerUsesHeldGate(track);
            return false;
        }

        function getSamplerPlaybackBuffer(buffer, reverse = false) {
            if (!buffer || !reverse) return buffer;
            if (reversedSamplerBuffers.has(buffer)) return reversedSamplerBuffers.get(buffer);

            const reversed = audioCtx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
            for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
                const source = buffer.getChannelData(ch);
                const target = reversed.getChannelData(ch);
                for (let i = 0, j = source.length - 1; i < source.length; i++, j--) {
                    target[i] = source[j];
                }
            }
            reversedSamplerBuffers.set(buffer, reversed);
            return reversed;
        }

        function getSamplerPreviewKey(track) {
            const currentBank = track?.samplerBank || 'A';
            const pad = getSamplerBankPads(currentBank)[0];
            return getPadFileName(pad) || 'Kick-01_bd-short-and-clean.wav';
        }

        async function loadMCP2000Sample(fileName) {
            if (!fileName) return null;
            if (mcp2000_cache[fileName]) return mcp2000_cache[fileName];
            if (mcp2000_pending.has(fileName)) return mcp2000_pending.get(fileName);

            const loadPromise = (async () => {
                try {
                    const response = await fetch(getMCP2000SampleUrl(fileName));
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const arrayBuffer = await response.arrayBuffer();
                    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
                    const buffer = trimSamplePadding(decoded);
                    mcp2000_cache[fileName] = buffer;
                    return buffer;
                } catch (e) {
                    console.error('Error loading sample:', fileName, e);
                    return null;
                } finally {
                    mcp2000_pending.delete(fileName);
                }
            })();

            mcp2000_pending.set(fileName, loadPromise);
            return loadPromise;
        }

        function preloadSamplerBank(bank) {
            const bankKey = bank || 'A';
            if (mcp2000_bankPreloads.has(bankKey)) return mcp2000_bankPreloads.get(bankKey);

            const preload = Promise.all(
                getSamplerBankPads(bankKey).map(pad => loadMCP2000Sample(getPadFileName(pad)))
            );
            mcp2000_bankPreloads.set(bankKey, preload);
            return preload;
        }

        async function ensureSamplerPreviewBuffer(track) {
            if (!track || track.typeId !== 'drumSet' || track.lastBuffer) return;
            const previewKey = getSamplerPreviewKey(track);
            const buffer = mcp2000_cache[previewKey] || await loadMCP2000Sample(previewKey);
            if (buffer && !track.lastBuffer && getSamplerPreviewKey(track) === previewKey) {
                track.lastBuffer = buffer;
                track._peakCache = null;
            }
        }

        function trimSamplePadding(buffer) {
            const channelCount = buffer.numberOfChannels;
            const sampleRate = buffer.sampleRate;
            const prerollSamples = Math.floor(sampleRate * 0.0015);
            const minTrimSamples = Math.floor(sampleRate * 0.008);
            const maxTrimSamples = Math.floor(sampleRate * 0.12);
            let peak = 0;

            for (let ch = 0; ch < channelCount; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const amp = Math.abs(data[i]);
                    if (amp > peak) peak = amp;
                }
            }

            if (peak <= 0.003) return buffer;

            const threshold = Math.max(0.003, peak * 0.04);
            let start = 0;
            let found = false;

            for (; start < buffer.length; start++) {
                for (let ch = 0; ch < channelCount; ch++) {
                    if (Math.abs(buffer.getChannelData(ch)[start]) >= threshold) {
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }

            if (!found || start < minTrimSamples || start > maxTrimSamples) return buffer;

            const trimStart = Math.max(0, start - prerollSamples);
            const trimmedLength = buffer.length - trimStart;
            if (trimmedLength <= 0) return buffer;

            const trimmed = audioCtx.createBuffer(channelCount, trimmedLength, sampleRate);
            for (let ch = 0; ch < channelCount; ch++) {
                trimmed.getChannelData(ch).set(buffer.getChannelData(ch).subarray(trimStart));
            }
            return trimmed;
        }

        async function generateBassGuitarSamples() {
            // Broad range for Bass (C1 to C7) to cover all possible grid/keyboard mappings
            const notes = [];
            const noteNamesArr = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            for (let oct = 1; oct <= 7; oct++) {
                for (const name of noteNamesArr) {
                    notes.push(name + oct);
                }
            }
            const sampleRate = audioCtx.sampleRate;
            const duration = 2.0;
            const length = Math.floor(sampleRate * duration);

            for (const noteName of notes) {
                const freq = noteToFreq(noteName);
                const buffer = audioCtx.createBuffer(2, length, sampleRate);
                const l = buffer.getChannelData(0);
                const r = buffer.getChannelData(1);

                for (let sample = 0; sample < length; sample++) {
                    const t = sample / sampleRate;
                    const bodyDecay = Math.exp(-t * 2.25);
                    const brightDecay = Math.exp(-t * 8.5);
                    const pluckEnv = Math.exp(-t * 95);
                    const pluck = (Math.random() * 2 - 1) * 0.11 * pluckEnv;
                    const body = (
                        Math.sin(2 * Math.PI * freq * t) * 0.52 +
                        Math.sin(2 * Math.PI * freq * 2.01 * t) * 0.12 * brightDecay +
                        Math.sin(2 * Math.PI * freq * 3.02 * t) * 0.045 * brightDecay
                    ) * bodyDecay;
                    const stereoTwang = Math.sin(2 * Math.PI * freq * 1.997 * t) * 0.018 * bodyDecay;
                    const val = body + pluck;

                    l[sample] = val + stereoTwang;
                    r[sample] = val - stereoTwang;
                }
                mcp2000_cache[`Guitar ${noteName}`] = buffer;
            }
        }

        async function refreshSamplerPreviews() {
            for (const track of state.tracks) {
                await ensureSamplerPreviewBuffer(track);
                if (track.typeId === 'drumSet' && track.samplerCanvas && !track.minimized) {
                    scheduleSamplerWaveformDraw(track);
                }
            }
        }

        async function preloadMCP2000() {
            await Promise.resolve();
            preloadSamplerBank('A');
            await Promise.all([
                loadMCP2000Sample(getSamplerPreviewKey({ samplerBank: 'A' })),
                generateBassGuitarSamples()
            ]);
            await refreshSamplerPreviews();
        }

        preloadMCP2000();

        function getVoiceReleaseSeconds(voice, fallbackTrack = null) {
            if (voice?.samplerMode) return 0.02;
            const track = fallbackTrack || voice?.track;
            const adsr = track?.adsr;
            const beatDur = 60.0 / state.bpm;
            return adsr ? getADSREnvelopeSeconds(adsr, beatDur).r : 0.02;
        }

        function releaseVoice(voiceId, voice, time = audioCtx.currentTime, { force = false, releaseSeconds = null } = {}) {
            if (!voice || (!force && voice.oneShot)) return false;
            const now = audioCtx.currentTime;
            const targetTime = Math.max(now, time || now);
            const rSecs = releaseSeconds ?? getVoiceReleaseSeconds(voice);

            try {
                if (voice.gain?.gain) {
                    if (typeof voice.gain.gain.cancelAndHoldAtTime === 'function') {
                        voice.gain.gain.cancelAndHoldAtTime(targetTime);
                    } else {
                        voice.gain.gain.cancelScheduledValues(targetTime);
                        try { voice.gain.gain.setValueAtTime(voice.gain.gain.value, targetTime); } catch (e) { }
                    }
                    voice.gain.gain.setTargetAtTime(0, targetTime, Math.max(0.001, rSecs / 3));
                }

                const stopTime = Math.max(targetTime + rSecs * 2, (voice.startTime || targetTime) + 0.01);
                voice.nodes.forEach(n => { if (n.stop) n.stop(stopTime); });
                if (voice.lfo) voice.lfo.stop(stopTime);
            } catch (e) {
                console.warn("noteOff error:", e);
                voice.nodes.forEach(n => { if (n.stop) n.stop(targetTime + 0.1); });
            }

            if (voiceId) state.activeNotes.delete(voiceId);
            return true;
        }

        function releaseTrackVoices(track, rowIdx, time, options = {}) {
            for (let [voiceId, voice] of state.activeNotes.entries()) {
                if (voice.track.id === track.id && voice.rowIdx === rowIdx) {
                    releaseVoice(voiceId, voice, time, options);
                }
            }
        }

        function playSamplerBuffer(buffer, localGain, time, voice, track) {
            if (!buffer) return;
            const startTime = Math.max(time, audioCtx.currentTime);
            const mode = getSamplerMode(track);
            const pitch = Math.max(0.01, track.samplerPitch || 1.0);
            const playbackBuffer = getSamplerPlaybackBuffer(buffer, !!track.samplerReverse);
            const source = audioCtx.createBufferSource();
            source.buffer = playbackBuffer;
            source.loop = mode === 'loop';
            if (source.loop) {
                source.loopStart = 0;
                source.loopEnd = source.buffer.duration;
            }

            source.playbackRate.setValueAtTime(pitch, startTime);

            const samplerFade = audioCtx.createGain();
            const playbackDuration = source.buffer.duration / pitch;
            const fadeInSeconds = Math.min(0.004, Math.max(0.001, playbackDuration * 0.4));
            samplerFade.gain.setValueAtTime(0, startTime);
            samplerFade.gain.linearRampToValueAtTime(1, startTime + fadeInSeconds);
            if (!source.loop) {
                const endTime = startTime + playbackDuration;
                const fadeOutSeconds = Math.min(0.006, Math.max(0.001, playbackDuration * 0.4));
                const fadeStart = Math.max(startTime + fadeInSeconds, endTime - fadeOutSeconds);
                if (fadeStart < endTime) {
                    samplerFade.gain.setValueAtTime(1, fadeStart);
                    samplerFade.gain.linearRampToValueAtTime(0, endTime);
                }
            }

            source.connect(samplerFade);
            samplerFade.connect(localGain);

            source.start(startTime);
            track.lastBuffer = source.buffer;
            track.lastSampleStartTime = startTime;
            track.lastSampleDuration = source.buffer.duration / pitch;
            track._peakCache = null;
            voice.oneShot = mode === 'oneShot';
            voice.samplerMode = mode;
            voice.samplerReverse = !!track.samplerReverse;
            source.onended = () => {
                if (voice.id) state.activeNotes.delete(voice.id);
            };

            voice.nodes.push(source);
            scheduleSamplerWaveformDraw(track);
        }

        function resolveSamplerPadBuffer(padData) {
            const fileName = getPadFileName(padData);
            if (!fileName) return Promise.resolve(null);
            if (mcp2000_cache[fileName]) return Promise.resolve(mcp2000_cache[fileName]);
            return loadMCP2000Sample(fileName);
        }

        function shouldStartSamplerVoice(voice) {
            return !voice?.id || voice.oneShot || state.activeNotes.has(voice.id);
        }

        function triggerSamplerPad(padData, localGain, time, voice, track) {
            const fileName = getPadFileName(padData);
            const buffer = mcp2000_cache[fileName];
            if (buffer) {
                if (shouldStartSamplerVoice(voice)) playSamplerBuffer(buffer, localGain, time, voice, track);
                return;
            }

            resolveSamplerPadBuffer(padData).then(loadedBuffer => {
                if (loadedBuffer && shouldStartSamplerVoice(voice)) playSamplerBuffer(loadedBuffer, localGain, time, voice, track);
            });
        }

        function flashSamplerPadControls(track, padIdx, duration = 100) {
            const padEl = document.getElementById(`pad_${track.id}_${padIdx}`);
            if (padEl) {
                padEl.classList.add('active');
                setTimeout(() => {
                    if (padEl.dataset.heldActive !== 'true') padEl.classList.remove('active');
                }, duration);
            }

            const keyEl = document.getElementById(`key_${track.id}_${padIdx}`);
            if (keyEl) {
                keyEl.classList.add('active');
                setTimeout(() => {
                    if (keyEl.dataset.heldActive !== 'true') keyEl.classList.remove('active');
                }, duration);
            }
        }

        function createSamplerVoice(track, padIdx, time) {
            const localGain = audioCtx.createGain();
            localGain.connect(track.filterNode);
            const voiceId = `${track.id}_pad_${padIdx}_${time.toFixed(6)}_${Math.random().toString(36).substr(2, 5)}`;
            const voice = { id: voiceId, track, rowIdx: padIdx, gain: localGain, nodes: [], oneShot: !samplerUsesHeldGate(track), startTime: time };
            state.activeNotes.set(voiceId, voice);
            return voice;
        }

        function triggerSamplerKeyboardPad(track, padIdx, time = audioCtx.currentTime) {
            if (!track || padIdx < 0) return null;
            const bankPads = getSamplerBankPads(track.samplerBank || 'A');
            const padData = bankPads[padIdx];
            if (!padData) return null;

            const voice = createSamplerVoice(track, padIdx, time);
            flashSamplerPadControls(track, padIdx);
            triggerSamplerPad(padData, voice.gain, time, voice, track);
            if (track.sidechainEnabled && padIdx === 0) triggerSidechain(time);
            return voice;
        }

        function createSamplerDial(track, label, prop, min, max, step) {
            const value = track[prop] || 1.0;
            const { wrap } = createRangeControl({
                className: 'sampler-dial',
                labelClassName: 'sampler-dial-label',
                valueClassName: 'sampler-dial-value',
                label,
                value,
                min,
                max,
                step,
                ariaLabel: label,
                dataControl: prop,
                tooltipTitle: `${label} Control`,
                tooltip: label === 'PITCH'
                    ? 'Adjusts sampler playback speed and pitch. Lower values pitch down; higher values pitch up.'
                    : `Adjusts sampler ${label.toLowerCase()}.`,
                formatValue: current => current.toFixed(2),
                onInput: current => { track[prop] = current; }
            });
            return wrap;
        }

        function createSamplerModeToggles(track) {
            const modeStrip = document.createElement('div');
            modeStrip.className = 'sampler-mode-toggles';
            const modeButtons = [];
            const refreshSamplerModeButtons = () => {
                const currentMode = getSamplerMode(track);
                modeButtons.forEach(btn => {
                    const active = btn.dataset.samplerMode === currentMode || (btn.dataset.samplerReverse === 'true' && !!track.samplerReverse);
                    btn.classList.toggle('active', active);
                    btn.setAttribute('aria-pressed', String(active));
                });
            };

            SAMPLER_MODE_OPTIONS.forEach(mode => {
                const btn = createButtonControl({
                    className: 'sampler-mode-btn interactive-element',
                    text: mode.label,
                    ariaLabel: `${mode.label} sampler mode`,
                    dataset: { samplerMode: mode.id },
                    tooltipTitle: `${mode.label} Mode`,
                    tooltip: mode.id === 'oneShot'
                        ? 'Plays the whole sample from one tap or key press.'
                        : mode.id === 'gate'
                            ? 'Plays only while the pad, key, or sequenced note is held.'
                            : 'Loops the sample while the pad, key, or sequenced note is held.',
                    onClick: (e) => {
                        e.stopPropagation();
                        pushUndo();
                        track.samplerMode = mode.id;
                        refreshSamplerModeButtons();
                    }
                });
                modeButtons.push(btn);
                modeStrip.appendChild(btn);
            });

            const reverseBtn = createButtonControl({
                className: 'sampler-mode-btn sampler-reverse-btn interactive-element',
                text: 'REVERSE',
                ariaLabel: 'Reverse sampler playback',
                dataset: { samplerReverse: 'true' },
                tooltipTitle: 'Reverse Playback',
                tooltip: 'Flip sampler playback direction for triggered pads and keys.',
                onClick: (e) => {
                    e.stopPropagation();
                    pushUndo();
                    track.samplerReverse = !track.samplerReverse;
                    refreshSamplerModeButtons();
                }
            });
            modeButtons.push(reverseBtn);
            modeStrip.appendChild(reverseBtn);
            refreshSamplerModeButtons();
            return modeStrip;
        }

        function createSamplerControlRow(track) {
            const controls = document.createElement('div');
            controls.className = 'sampler-control-row';
            controls.append(
                createSamplerDial(track, 'PITCH', 'samplerPitch', 0.25, 4.0, 0.01),
                createSamplerModeToggles(track)
            );
            return controls;
        }

        function createDrumModuleDivider() {
            const divider = document.createElement('div');
            divider.className = 'drum-module-divider';
            return divider;
        }

        function createSamplerTypeSelect(track) {
            return createCompactSelectControl({
                className: 'sampler-type-select',
                ariaLabel: 'Instrument type',
                value: track.typeId,
                tooltipTitle: 'Instrument Type',
                tooltip: 'Change the core synthesis engine or drum kit for this track.',
                options: Object.keys(instrumentTypes).map(key => ({
                    value: key,
                    label: instrumentTypes[key].name.toUpperCase()
                })),
                onChange: (e) => {
                    pushUndo();
                    const oldTrack = track;
                    const oldGrid = track.grid;
                    if (oldTrack.cleanup) oldTrack.cleanup();
                    const index = state.tracks.indexOf(track);
                    state.tracks[index] = createTrack(e.target.value);
                    const newTrack = state.tracks[index];
                    newTrack.id = oldTrack.id;
                    newTrack.volume = oldTrack.volume;
                    newTrack.subdiv = oldTrack.subdiv;
                    newTrack.octaveOffset = oldTrack.octaveOffset;
                    newTrack.muted = oldTrack.muted;
                    newTrack.solo = oldTrack.solo;
                    newTrack.loopMultiplier = oldTrack.loopMultiplier || 1;
                    newTrack.rowHeight = oldTrack.rowHeight || newTrack.rowHeight;
                    newTrack.xy = { ...oldTrack.xy };
                    newTrack.glide = oldTrack.glide;
                    newTrack.glideTime = oldTrack.glideTime;
                    newTrack.glideMode = oldTrack.glideMode || newTrack.glideMode;
                    newTrack.samplerMode = oldTrack.samplerMode || newTrack.samplerMode;
                    newTrack.samplerReverse = !!oldTrack.samplerReverse;
                    newTrack.arp = normalizeArp({ ...newTrack.arp, ...oldTrack.arp, heldNotes: [], currentIdx: 0, lastStep: -1 });
                    if (newTrack.rowDrums && oldTrack.rowDrums) newTrack.rowDrums = newTrack.rowDrums.map((drumName, idx) => normalizeDrumType(oldTrack.rowDrums[idx] || drumName));
                    if (newTrack.rowStyles && oldTrack.rowStyles) newTrack.rowStyles = newTrack.rowStyles.map((styleIdx, idx) => oldTrack.rowStyles[idx] ?? styleIdx);
                    for (let r = 0; r < Math.min(oldGrid.length, newTrack.grid.length); r++) for (let s = 0; s < Math.min(oldGrid[r].length, newTrack.grid[r].length); s++) newTrack.grid[r][s] = oldGrid[r][s];
                    refreshLookupMap();
                    renderTracks();
                }
            });
        }

        function createSamplerBankToggle(track) {
            return createButtonControl({
                className: 'btn sampler-bank-toggle interactive-element',
                text: (track.samplerBank === 'B') ? 'BANK B' : 'BANK A',
                tooltipTitle: 'Sampler Bank',
                tooltip: 'Switch between MCP2000 sample banks A and B.',
                onClick: (e) => {
                    e.stopPropagation();
                    track.samplerBank = track.samplerBank === 'B' ? 'A' : 'B';
                    track.lastBuffer = null;
                    track.lastSampleStartTime = 0;
                    track.lastSampleDuration = 0;
                    track._peakCache = null;
                    preloadSamplerBank(track.samplerBank);
                    trackElementCache.delete(track.id);
                    renderTracks();
                }
            });
        }

        function getSamplerPadLabel(track, padIdx) {
            const padData = getSamplerBankPads(track.samplerBank || 'A')[padIdx];
            return (padData?.label || `Pad ${padIdx + 1}`).toUpperCase();
        }

        function beginSamplerControlPress(track, padIdx, activeEl, e) {
            e.stopPropagation();
            activeEl.dataset.heldActive = 'true';
            activeEl.classList.add('active');
            triggerSamplerKeyboardPad(track, padIdx, audioCtx.currentTime);
            if (track.grid[padIdx]) recordNote(track, padIdx, true);
            const onUp = () => {
                delete activeEl.dataset.heldActive;
                activeEl.classList.remove('active');
                if (samplerUsesHeldGate(track)) noteOff(track, padIdx, audioCtx.currentTime);
                if (track.grid[padIdx]) recordNote(track, padIdx, false);
                window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mouseup', onUp);
        }

        function createSamplerPad(track, padIdx) {
            const pad = document.createElement('div');
            pad.className = 'mpc-pad interactive-element';
            pad.id = `pad_${track.id}_${padIdx}`;
            pad.setAttribute('role', 'button');
            pad.setAttribute('tabindex', '0');
            const padHotkey = samplerKeyboardLabels[padIdx] || '';
            setTooltip(
                pad,
                `PAD ${String(padIdx + 1).padStart(2, '0')}`,
                `Triggers ${getSamplerPadLabel(track, padIdx)} from sampler Bank ${track.samplerBank || 'A'}.`,
                padHotkey ? padHotkey.toUpperCase() : ''
            );

            const padNum = document.createElement('span');
            padNum.className = 'mpc-pad-num';
            padNum.textContent = (padIdx + 1).toString().padStart(2, '0');

            const padLabel = document.createElement('span');
            padLabel.className = 'sampler-pad-label';
            padLabel.textContent = getSamplerPadLabel(track, padIdx);

            pad.append(padNum, padLabel);
            pad.onmousedown = (e) => beginSamplerControlPress(track, padIdx, pad, e);
            return pad;
        }

        function createSamplerPadGrid(track) {
            const padGrid = document.createElement('div');
            padGrid.className = 'sampler-pad-grid';
            for (let i = 0; i < 16; i++) padGrid.appendChild(createSamplerPad(track, i));
            return padGrid;
        }

        function createSamplerPadPane(track) {
            const leftPane = document.createElement('div');
            leftPane.className = 'sampler-pad-pane';

            const topRow = document.createElement('div');
            topRow.className = 'sampler-bank-row';
            topRow.append(createSamplerBankToggle(track));

            leftPane.append(topRow, createSamplerPadGrid(track));
            return leftPane;
        }

        function createSamplerEditor(track) {
            const editorWrap = document.createElement('div');
            editorWrap.className = 'sampler-editor';
            const editorHeader = document.createElement('div');
            editorHeader.className = 'sampler-editor-header';
            const editorTitle = document.createElement('span');
            editorTitle.textContent = 'SAMPLE EDITOR / WAVEFORM';
            editorTitle.className = 'sampler-editor-title';
            editorHeader.append(editorTitle);
            const canvas = document.createElement('canvas');
            canvas.id = 'sampler_canvas_' + track.id;
            canvas.className = 'sampler-canvas interactive-element';
            track.samplerCanvas = canvas;
            setTooltip(canvas, 'Sample Waveform', 'Shows the most recently loaded or triggered sample waveform for this sampler track.');
            editorWrap.append(editorHeader, canvas);
            return editorWrap;
        }

        function createSamplerKeyboard(track) {
            const keysContainer = document.createElement('div');
            keysContainer.className = 'sampler-keys interactive-element';
            for (let i = 0; i < 16; i++) {
                const key = document.createElement('div');
                key.setAttribute('role', 'button');
                key.setAttribute('tabindex', '0');
                key.id = `key_${track.id}_${i}`;
                const keyLayout = samplerKeyboardLayout[i] || { row: 2, col: i + 1, tone: 'white' };
                const isBlack = keyLayout.tone === 'black';
                key.className = `mpc-key ${isBlack ? 'black' : 'white'} interactive-element`;
                key.style.gridRow = `${keyLayout.row}`;
                key.style.gridColumn = `${keyLayout.col} / span 2`;
                const computerLabel = document.createElement('span');
                computerLabel.className = 'computer-key-label';
                const hotkeyLabel = samplerKeyboardLabels[i] || '';
                computerLabel.textContent = hotkeyLabel;
                key.setAttribute('data-tooltip-title', `PAD ${String(i + 1).padStart(2, '0')}`);
                key.setAttribute('data-tooltip', `Triggers ${getSamplerRowLabel(track, i)} from sampler Bank ${track.samplerBank || 'A'}.`);
                if (hotkeyLabel) key.setAttribute('data-tooltip-hotkey', hotkeyLabel.toUpperCase());
                key.appendChild(computerLabel);
                key.onmousedown = (e) => beginSamplerControlPress(track, i, key, e);
                keysContainer.appendChild(key);
            }
            samplerDisplayOnlyKeys.forEach(displayKey => {
                const key = document.createElement('div');
                key.className = `mpc-key display-only ${displayKey.tone === 'black' ? 'black' : 'white'} interactive-element`;
                key.setAttribute('aria-hidden', 'true');
                key.style.gridRow = `${displayKey.row}`;
                key.style.gridColumn = `${displayKey.col} / span 2`;
                const computerLabel = document.createElement('span');
                computerLabel.className = 'computer-key-label';
                computerLabel.textContent = displayKey.label;
                key.appendChild(computerLabel);
                keysContainer.appendChild(key);
            });
            return keysContainer;
        }

        function createSamplerPreviewPane(track) {
            const rightPane = document.createElement('div');
            rightPane.className = 'sampler-preview-pane';
            rightPane.append(createSamplerEditor(track), createSamplerKeyboard(track), createSamplerControlRow(track));
            return rightPane;
        }

        function createSamplerCore(track) {
            const mcpCore = document.createElement('div');
            mcpCore.className = 'sampler-core';
            mcpCore.append(createSamplerPadPane(track), createDrumModuleDivider(), createSamplerPreviewPane(track));
            return mcpCore;
        }

        function renderSamplerModule(track, header, minBtn, patchIn, typeSelect, octBadge, meterContainer, soloBtn, muteBtn, volPanCont, subdivSelect, loopGroup, adsrGroup, xyGroup, randGroup, midiHub) {
            if (header) track._samplerArgs = [header, minBtn, patchIn, typeSelect, octBadge, meterContainer, soloBtn, muteBtn, volPanCont, subdivSelect, loopGroup, adsrGroup, xyGroup, randGroup, midiHub];
            if (!track._samplerArgs) return;
            [header, minBtn, patchIn, typeSelect, octBadge, meterContainer, soloBtn, muteBtn, volPanCont, subdivSelect, loopGroup, adsrGroup, xyGroup, randGroup, midiHub] = track._samplerArgs;
            syncTrackHeaderControls(header, track);

            // CLEAR HEADER IMMEDIATELY to prevent double-appending controls
            header.innerHTML = '';
            header.style.display = 'flex';
            header.style.flexShrink = '0';
            header.classList.toggle('sampler-expanded-header', !track.minimized);

            if (track.minimized) {
                header.style.flexDirection = 'row';
                header.style.alignItems = 'center';
                header.style.minHeight = '18px';
                header.style.gap = '8px';
                header.style.padding = '7px 8px 10px';
                header.style.border = '1px solid var(--glass-border)';
                header.style.borderRadius = '8px';
                const title = document.createElement('span');
                title.className = 'label';
                title.style.cssText = 'min-width:78px; color:var(--accent-yellow); font-weight:900;';
                title.textContent = instrumentTypes[track.typeId].name.toUpperCase();
                header.append(minBtn, patchIn, title, octBadge, createMinimizedModStrip(track), meterContainer, soloBtn, muteBtn);
                appendHeaderMidiHub(header, track, midiHub, true);
                return;
            }

            ensureSamplerPreviewBuffer(track).then(() => {
                scheduleSamplerWaveformDraw(track);
            });
            preloadSamplerBank(track.samplerBank || 'A');

            header.style.flexDirection = 'column';
            header.style.gap = '';
            header.style.padding = '';
            header.style.background = '';
            header.style.border = '';
            header.style.borderRadius = '';
            header.style.alignItems = '';
            header.style.boxShadow = '';
            header.style.minHeight = '';

            // --- MASTER ROW (Universal Controls) ---
            const masterRow = document.createElement('div');
            masterRow.className = 'sampler-master-row';
            typeSelect = createSamplerTypeSelect(track);

            const soloMuteCont = document.createElement('div');
            soloMuteCont.className = 'sampler-solo-mute';
            soloMuteCont.append(soloBtn, muteBtn);

            const topRightGroup = document.createElement('div');
            topRightGroup.className = 'sampler-top-right';
            topRightGroup.append(meterContainer, loopGroup, subdivSelect);

            masterRow.append(minBtn, patchIn, typeSelect, octBadge, soloMuteCont, volPanCont, topRightGroup);
            header.appendChild(masterRow);

            const contentRow = document.createElement('div');
            contentRow.className = 'sampler-content-row';

            // --- COLUMN 1: FILTER & ENV ---
            const farLeftPane = document.createElement('div');
            farLeftPane.className = 'sampler-filter-pane';
            if (xyGroup) {
                xyGroup.style.flex = 'none';
                xyGroup.style.height = '64px';
                xyGroup.style.marginLeft = '0';
                xyGroup.querySelectorAll('.label').forEach(label => {
                    label.style.color = 'var(--control-label)';
                    label.style.opacity = '1';
                });
                const drumXyCanvas = xyGroup.querySelector('.xy-pad');
                if (drumXyCanvas) {
                    const dpr = window.devicePixelRatio || 1;
                    drumXyCanvas.width = 140 * dpr;
                    drumXyCanvas.height = 64 * dpr;
                }
                farLeftPane.appendChild(xyGroup);
            }
            if (adsrGroup) {
                adsrGroup.style.flex = 'none';
                adsrGroup.style.height = 'auto';
                farLeftPane.appendChild(adsrGroup);
            }
            contentRow.appendChild(farLeftPane);
            contentRow.appendChild(createDrumModuleDivider());

            // --- COLUMN 2: MCP2000 CORE ---
            contentRow.appendChild(createSamplerCore(track));
            contentRow.appendChild(createDrumModuleDivider());

            // --- COLUMN 3: PATTERN & CONTROLS ---
            const farRightPane = document.createElement('div');
            farRightPane.className = 'sampler-far-right-pane';

            prepareHeaderMidiHub(midiHub, track);
            midiHub.classList.add('drum-midi-box');
            midiHub.style.cssText = 'display:flex; align-items:center; justify-content:center; gap:8px; height:62px; min-width:92px; padding:10px 8px; background:linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.018)); border:1px solid rgba(255,255,255,0.2); border-radius:5px; flex:0 0 auto;';
            const midiLabelEl = midiHub.querySelector('.label');
            if (midiLabelEl) midiLabelEl.style.cssText = 'font-size:0.48rem; opacity:1; color:var(--control-label); white-space:nowrap;';

            if (randGroup) {
                randGroup.classList.add('drum-random-controls');
                randGroup.style.cssText = 'display:flex; flex-direction:column; gap:7px; padding:10px; background:linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.018)); border:1px solid rgba(255,255,255,0.2); border-radius:6px; width:320px; min-width:320px; flex:0 0 320px; box-shadow:inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 18px rgba(0,0,0,0.22);';
                const randTop = randGroup.firstElementChild;
                const randGrid = randGroup.lastElementChild;
                if (randTop) randTop.style.cssText = 'display:flex; align-items:center; gap:7px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:6px;';
                if (randGrid) randGrid.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:7px 14px;';
                randGroup.querySelectorAll('button').forEach(btn => {
                    btn.style.minWidth = '24px';
                    btn.style.height = '22px';
                    btn.style.fontSize = '0.55rem';
                    btn.style.fontWeight = '800';
                    btn.style.padding = '0 5px';
                });
                const randStyle = randGroup.querySelector('select');
                if (randStyle) {
                    randStyle.style.width = '88px';
                    randStyle.style.height = '22px';
                    randStyle.style.fontSize = '0.58rem';
                }
                randGroup.querySelectorAll('input[type="range"]').forEach(slider => {
                    slider.style.width = '78px';
                    slider.style.height = '4px';
                });
                randGroup.querySelectorAll('.label').forEach(label => {
                    label.style.fontSize = '0.48rem';
                    label.style.opacity = '1';
                    label.style.width = '34px';
                });
            }

            farRightPane.append(midiHub, createDrumModuleDivider());
            if (randGroup) farRightPane.append(randGroup);
            contentRow.appendChild(farRightPane);
            header.appendChild(contentRow);
        }

        const trackElementCache = new Map();

        function renderTracks() {
            let addBtn = document.querySelector('.add-track-btn');

            state.tracks.forEach((track, index) => {
                let trackEl = trackElementCache.get(track.id);
                const template = instrumentTypes[track.typeId];

                if (!trackEl || trackEl.dataset.typeId !== track.typeId) {
                    const staleTrackEl = trackEl || Array.from(tracksContainer.children).find(child => child.id === `track_${track.id}`);
                    trackEl = createTrackEl(track, index);
                    trackElementCache.set(track.id, trackEl);
                    if (staleTrackEl && staleTrackEl !== trackEl && staleTrackEl.parentElement === tracksContainer) {
                        staleTrackEl.remove();
                    }
                } else {
                    trackEl = updateTrackElDynamic(trackEl, track, index);
                }

                if (tracksContainer.children[index] !== trackEl) {
                    tracksContainer.insertBefore(trackEl, tracksContainer.children[index] || null);
                }
            });

            const currentIds = state.tracks.map(t => `track_${t.id}`);
            Array.from(tracksContainer.children).forEach(child => {
                if (child.classList.contains('track') && !currentIds.includes(child.id)) {
                    child.remove();
                }
            });

            if (!addBtn) {
                addBtn = createAddTrackBtn();
            }
            tracksContainer.appendChild(addBtn);
            renderMixerStrips();
            updateFixedCables();
        }

        function updateTrackElDynamic(trackEl, track, index) {
            const isMinimized = !!track.minimized;
            const wasMinimized = trackEl.classList.contains('minimized');

            trackEl.className = `track ${state.activeTrackId === index ? 'active' : ''} ${isMinimized ? 'minimized' : ''}`;

            // If minimization state changed, we need a full rebuild to restore/remove complex structure
            if (isMinimized !== wasMinimized) {
                const newEl = createTrackEl(track, index);
                trackElementCache.set(track.id, newEl);
                trackEl.replaceWith(newEl);
                return newEl;
            }

            const header = trackEl.querySelector('.track-header');
            if (header) {
                header.onclick = () => { if (state.activeTrackId !== index) { state.activeTrackId = index; renderTracks(); } };

                const octBadge = trackEl.querySelector(`#oct_${track.id}`);
                if (octBadge) {
                    const oct = track.octaveOffset || 0;
                    octBadge.textContent = `OCT ${oct >= 0 ? '+' : ''}${oct}`;
                }

                syncTrackMinButton(header.querySelector('.track-min-btn'), track.minimized);
            }
            syncTrackHeaderControls(trackEl, track);

            if (!track.minimized) {
                if (track.typeId === 'drumSet') {
                    renderSamplerModule(track);
                }
                updateTrackGrid(track);
            }

            return trackEl;
        }

        function formatGlideTimeMs(value) {
            return `${Math.round(numberOrDefault(value, 0) * 1000)}ms`;
        }

        function syncGlideButton(button, track) {
            if (!button || !track) return;
            const valueEl = button.querySelector('.glide-time-display');
            if (valueEl) valueEl.textContent = formatGlideTimeMs(track.glideTime);
            button.classList.toggle('active', !!track.glide);
            button.setAttribute('aria-pressed', String(!!track.glide));
            button.setAttribute('aria-label', `Glide ${formatGlideTimeMs(track.glideTime)}`);
        }

        function syncTrackHeaderControls(root, track) {
            if (!root || !track) return;

            const setControlValue = (name, value) => {
                const input = root.querySelector(`[data-control="${name}"]`);
                if (input && document.activeElement !== input && value !== undefined && value !== null) {
                    input.value = value;
                }
            };

            setControlValue('track-volume', track.volume);
            setControlValue('track-loop', track.loopMultiplier || 1);
            setControlValue('track-subdiv', track.subdiv || 4);
            setControlValue('track-glide-time', track.glideTime || 0.1);
            setControlValue('track-pan', track.panNode ? track.panNode.pan.value : 0);
            setControlValue('arp-rate', track.arp?.subdivision || 12);
            setControlValue('arp-direction', track.arp?.direction || 'up');

            const soloBtn = root.querySelector(`.solo-btn[data-track-id="${track.id}"]`);
            if (soloBtn) soloBtn.classList.toggle('active', !!track.solo);

            const muteBtn = root.querySelector(`.mute-btn[data-track-id="${track.id}"]`);
            if (muteBtn) muteBtn.classList.toggle('active', !!track.muted);

            const arpBtn = root.querySelector('[data-control="arp-toggle"]');
            if (arpBtn) arpBtn.classList.toggle('active', !!track.arp?.enabled);

            const latchBtn = root.querySelector('[data-control="arp-latch"]');
            if (latchBtn) latchBtn.classList.toggle('active', !!track.arp?.latch);

            const glideBtn = root.querySelector('[data-control="glide-toggle"]');
            if (glideBtn) syncGlideButton(glideBtn, track);

            const midiIn = root.querySelector('.midi-in');
            if (midiIn) midiIn.classList.toggle('active', state.tracks.some(source => source.midiDoublingTargetId === track.id));

            const midiOut = root.querySelector('.midi-out');
            if (midiOut) midiOut.classList.toggle('active', !!track.midiDoublingTargetId);
        }

        function syncTrackMinButton(button, isMinimized) {
            if (!button) return;
            button.classList.toggle('is-minimized', !!isMinimized);
            button.setAttribute('aria-label', isMinimized ? 'Restore track' : 'Minimize track');
            button.removeAttribute('title');
            button.setAttribute('data-tooltip-title', isMinimized ? 'Restore Track' : 'Minimize Track');
            button.setAttribute('data-tooltip', isMinimized ? 'Expand this instrument panel.' : 'Collapse this instrument panel while keeping its routing active.');
            button.setAttribute('data-tooltip-hotkey', 'Double-click track header');
        }

        function prepareHeaderMidiHub(midiHub, track, compact = false) {
            if (!midiHub || !track) return;
            const incoming = state.tracks.some(source => source.midiDoublingTargetId === track.id);
            const midiIn = midiHub.querySelector('.midi-in');
            const midiOut = midiHub.querySelector('.midi-out');
            if (midiIn) midiIn.classList.toggle('active', incoming);
            if (midiOut) midiOut.classList.toggle('active', !!track.midiDoublingTargetId);
            midiHub.classList.add('header-midi-hub');
            midiHub.style.cssText = [
                'display:flex',
                'align-items:center',
                compact ? 'gap:5px' : 'gap:7px',
                compact ? 'padding:2px 5px' : 'padding:3px 6px',
                'background:rgba(255,255,255,0.03)',
                'border:1px solid var(--glass-border)',
                'border-radius:5px',
                compact ? 'min-width:58px' : 'min-width:70px',
                'flex:0 0 auto',
                'opacity:1',
                compact ? 'margin-left:auto' : '',
                compact ? 'margin-right:42px' : '',
            ].filter(Boolean).join(';');
        }

        function appendHeaderMidiHub(header, track, midiHub, compact = false) {
            if (!header || !track || !midiHub) return;
            prepareHeaderMidiHub(midiHub, track, compact);
            header.appendChild(midiHub);
        }

        function createMinimizedModStrip(track) {
            const strip = document.createElement('div');
            strip.className = 'minimized-port-strip interactive-element';
            strip.onclick = (e) => e.stopPropagation();
            const ports = [
                { target: 'y' },
                { target: 'x' },
                { target: 'wobble' },
                { target: 'sustain' },
                { target: 'adsr' }
            ];
            ports.forEach(({ target }) => {
                const wrap = document.createElement('div');
                wrap.className = 'minimized-port-wrap';
                wrap.append(createModPort(target, track));
                strip.appendChild(wrap);
            });
            return strip;
        }

        function createAddTrackBtn() {
            const addBtn = document.createElement('button');
            addBtn.className = 'add-track-btn';
            addBtn.setAttribute('data-tooltip-title', 'Add Instrument Track');
            addBtn.setAttribute('data-tooltip', 'Create a new melodic instrument track using the default synth voice.');
            const spanPlus = document.createElement('span');
            spanPlus.textContent = '+';
            addBtn.appendChild(spanPlus);
            addBtn.appendChild(document.createTextNode(' ADD INSTRUMENT TRACK'));
            addBtn.onclick = () => {
                pushUndo();
                state.tracks.push(createTrack('synthwave'));
                refreshLookupMap();
                renderTracks();
                renderMixerStrips();
            };
            return addBtn;
        }

        function createTrackEl(track, index) {
            const template = instrumentTypes[track.typeId];
            const trackEl = document.createElement('div');
            trackEl.className = `track ${state.activeTrackId === index ? 'active' : ''} ${track.minimized ? 'minimized' : ''}`;
            trackEl.dataset.typeId = track.typeId;
            trackEl.dataset.type = template.type;
            trackEl.id = `track_${track.id}`;
            trackEl.style.setProperty('--row-height', `${track.rowHeight || (track.typeId === 'drumSet' ? 10 : 14)}px`);

            const header = document.createElement('div');
            header.className = 'track-header';
            header.style.cursor = 'pointer';
            header.onclick = () => { state.activeTrackId = index; renderTracks(); };
            header.ondblclick = (e) => {
                if (['INPUT', 'SELECT', 'BUTTON', 'CANVAS'].includes(e.target.tagName) || e.target.closest('.interactive-element') || e.target.closest('.mpc-pad') || e.target.closest('.mpc-key')) return;
                track.minimized = !track.minimized;
                renderTracks();
            };

            const minBtn = document.createElement('button');
            minBtn.type = 'button';
            minBtn.className = 'track-min-btn';
            syncTrackMinButton(minBtn, track.minimized);
            minBtn.onclick = (e) => { e.stopPropagation(); track.minimized = !track.minimized; renderTracks(); };
            header.appendChild(minBtn);

            const patchIn = document.createElement('div'); patchIn.className = 'patch-point mod-in'; patchIn.id = `in_${track.id}`;
            patchIn.onclick = (e) => e.stopPropagation();
            patchIn.setAttribute('data-tooltip-title', 'MOD IN');
            patchIn.setAttribute('data-tooltip', 'Main modulation input for this track.');
            if (state.drawers.some(d => d.connection === track.id)) patchIn.classList.add('active');
            header.appendChild(patchIn);

            const octGroup = document.createElement('div');
            octGroup.style.cssText = 'display:flex; align-items:center; gap:2px;';
            octGroup.setAttribute('data-tooltip-title', 'Track Octave');
            octGroup.setAttribute('data-tooltip', 'Transpose this track up or down by octaves for playback and computer keyboard input.');
            octGroup.setAttribute('data-tooltip-hotkey', 'Z: down / X: up');

            const octDn = document.createElement('button'); octDn.textContent = '‹'; octDn.className = 'btn'; octDn.style.padding = '0 4px';
            octDn.onclick = (e) => { e.stopPropagation(); track.octaveOffset = Math.max(-4, (track.octaveOffset || 0) - 1); renderTracks(); };

            const octBadge = document.createElement('span');
            octBadge.id = `oct_${track.id}`;
            octBadge.className = 'label';
            octBadge.onclick = (e) => e.stopPropagation();
            octBadge.style.cssText = 'color:var(--accent-pink); font-weight:800; min-width:40px; text-align:center; cursor:default;';
            octBadge.setAttribute('data-tooltip-title', 'Track Octave');
            octBadge.setAttribute('data-tooltip', 'Transpose this track up or down by octaves for playback and computer keyboard input.');
            octBadge.setAttribute('data-tooltip-hotkey', 'Z: down / X: up');
            const oct = track.octaveOffset || 0;
            octBadge.textContent = `OCT ${oct >= 0 ? '+' : ''}${oct}`;

            const octUp = document.createElement('button'); octUp.textContent = '›'; octUp.className = 'btn'; octUp.style.padding = '0 4px';
            octUp.onclick = (e) => { e.stopPropagation(); track.octaveOffset = Math.min(4, (track.octaveOffset || 0) + 1); renderTracks(); };

            octGroup.append(octDn, octBadge, octUp);
            header.appendChild(octGroup);

            const select = document.createElement('select');
            select.onclick = (e) => e.stopPropagation();
            select.ondblclick = (e) => e.stopPropagation();
            select.setAttribute('data-tooltip-title', 'Instrument Type');
            select.setAttribute('data-tooltip', 'Change the core synthesis engine or drum kit for this track.');
            Object.keys(instrumentTypes).forEach(key => {
                const opt = document.createElement('option'); opt.value = key; opt.textContent = instrumentTypes[key].name;
                if (key === track.typeId) opt.selected = true;
                select.appendChild(opt);
            });

            if (track.minimized) {
                const label = document.createElement('span');
                label.className = 'label'; label.style.width = '80px'; label.textContent = instrumentTypes[track.typeId].name;
                header.appendChild(label);
            } else {
                select.onchange = (e) => {
                    pushUndo();
                    const oldTrack = track;
                    const oldGrid = track.grid;
                    if (oldTrack.cleanup) oldTrack.cleanup();
                    state.tracks[index] = createTrack(e.target.value);
                    const newTrack = state.tracks[index];
                    newTrack.id = oldTrack.id;
                    newTrack.volume = oldTrack.volume; newTrack.subdiv = oldTrack.subdiv;
                    newTrack.octaveOffset = oldTrack.octaveOffset; newTrack.muted = oldTrack.muted;
                    newTrack.solo = oldTrack.solo; newTrack.loopLength = oldTrack.loopLength;
                    newTrack.loopMultiplier = oldTrack.loopMultiplier || 1;
                    newTrack.rowHeight = oldTrack.rowHeight || 14;
                    newTrack.xy = { ...oldTrack.xy };
                    newTrack.glide = oldTrack.glide;
                    newTrack.glideTime = oldTrack.glideTime;
                    newTrack.glideMode = oldTrack.glideMode || newTrack.glideMode;
                    newTrack.arp = normalizeArp({ ...newTrack.arp, ...oldTrack.arp, heldNotes: [], currentIdx: 0, lastStep: -1 });
                    newTrack.modLinks = { ...oldTrack.modLinks };
                    if (newTrack.rowDrums && oldTrack.rowDrums) newTrack.rowDrums = newTrack.rowDrums.map((drumName, idx) => normalizeDrumType(oldTrack.rowDrums[idx] || drumName));
                    if (newTrack.rowStyles && oldTrack.rowStyles) newTrack.rowStyles = newTrack.rowStyles.map((styleIdx, idx) => oldTrack.rowStyles[idx] ?? styleIdx);
                    for (let r = 0; r < Math.min(oldGrid.length, newTrack.grid.length); r++) {
                        for (let s = 0; s < Math.min(oldGrid[r].length, newTrack.grid[r].length); s++) {
                            newTrack.grid[r][s] = oldGrid[r][s];
                        }
                    }
                    refreshLookupMap();
                    renderTracks();
                };
                select.onclick = (e) => e.stopPropagation();
                header.appendChild(select);
            }

            const volGroup = document.createElement('div'); volGroup.className = 'slider-group';
            volGroup.setAttribute('data-tooltip-title', 'Level & Panning');
            volGroup.setAttribute('data-tooltip', 'Adjust the track volume and stereo position.');

            const volLabel = document.createElement('span');
            volLabel.className = 'label';
            volLabel.textContent = 'VOL';
            volLabel.style.minWidth = '24px';

            const volInput = document.createElement('input');
            volInput.type = 'range';
            volInput.min = '0';
            volInput.max = '1';
            volInput.step = '0.05';
            volInput.value = track.volume;
            volInput.dataset.control = 'track-volume';
            volInput.style.width = '60px';

            volGroup.appendChild(volLabel);
            volGroup.appendChild(volInput);
            volInput.oninput = (e) => { track.volume = parseFloat(e.target.value); track.gainNode.gain.value = track.volume; };
            const panGroup = document.createElement('div');
            panGroup.className = 'slider-group';
            panGroup.setAttribute('data-tooltip-title', 'Pan');
            panGroup.setAttribute('data-tooltip', 'Set this track position in the stereo field.');

            const panLabel = document.createElement('span');
            panLabel.className = 'label';
            panLabel.textContent = 'PAN';
            panLabel.style.minWidth = '24px';

            const panInput = document.createElement('input');
            panInput.type = 'range';
            panInput.min = '-1';
            panInput.max = '1';
            panInput.step = '0.1';
            panInput.value = track.panNode.pan.value;
            panInput.dataset.control = 'track-pan';
            panInput.style.width = '60px';
            panInput.oninput = (e) => { track.panNode.pan.setTargetAtTime(parseFloat(e.target.value), audioCtx.currentTime, 0.05); };
            panGroup.append(panLabel, panInput);

            let adsrGroup = null;
            if (track.adsr) {
                adsrGroup = document.createElement('div'); adsrGroup.className = `adsr-group ${track.typeId === 'drumSet' ? 'drum-adsr-group' : ''}`;
                const adsrCanvas = document.createElement('canvas');
                adsrCanvas.className = 'adsr-display';
                adsrCanvas.id = `adsr_${track.id}`;
                track.adsrCanvas = adsrCanvas;
                adsrCanvas.width = 120 * (window.devicePixelRatio || 1);
                adsrCanvas.height = 60 * (window.devicePixelRatio || 1);
                adsrCanvas.setAttribute('data-tooltip-title', 'ADSR Envelope');
                adsrCanvas.setAttribute('data-tooltip', 'Attack: horizontal time only. Decay controls time and shares its height with Sustain. Sustain controls level. Release controls time.');
                adsrCanvas.addEventListener('pointerdown', (e) => startADSRGraphDrag(e, adsrCanvas, track, index));
                const knobsDef = [
                    { key: 'a', label: 'A', min: 0.005, max: 4.0, title: 'Attack', help: 'Drag up or down to set how long the sound takes to rise to full level.' },
                    { key: 'd', label: 'D', min: 0.005, max: 4.0, title: 'Decay', help: 'Drag up or down to set how long the envelope falls from peak to the sustain level.' },
                    { key: 's', label: 'S', min: 0.0, max: 1.0, title: 'Sustain', help: 'Drag up or down to set the held level after decay. The decay endpoint stays linked to this level.' },
                    { key: 'r', label: 'R', min: 0.005, max: 8.0, title: 'Release', help: 'Drag up or down to set how long the sound fades after a note ends.' }
                ];
                const MIN_DEG = -135, MAX_DEG = 135;
                const knobsRow = document.createElement('div'); knobsRow.className = 'adsr-knobs';
                knobsDef.forEach(({ key, label, min, max, title, help }) => {
                    const wrap = document.createElement('div'); wrap.className = 'knob-wrap';
                    wrap.dataset.adsrKey = key;
                    setTooltip(wrap, `${title} (${label})`, help);
                    const modRow = document.createElement('div');
                    modRow.className = 'adsr-mod-row';
                    const modSlot = document.createElement('div');
                    modSlot.className = 'adsr-mod-slot';
                    const lbl = document.createElement('div');
                    lbl.className = 'knob-label-adsr';
                    lbl.textContent = label;
                    if (track.typeId !== 'drumSet') {
                        if (key === 'a') modSlot.appendChild(createModPort('adsr', track));
                        if (key === 'd') modSlot.appendChild(createModPort('decay', track));
                    }
                    modRow.append(modSlot, lbl);
                    const knob = document.createElement('div'); knob.className = 'knob';
                    const pip = document.createElement('div'); pip.className = 'knob-pip'; knob.appendChild(pip);
                    const defaults = track.adsrDefaults || (instrumentTypes[track.typeId] ? instrumentTypes[track.typeId].adsr : null);
                    if (defaults && defaults[key] !== undefined) {
                        const defMarker = document.createElement('div'); defMarker.className = 'knob-default-marker';
                        const t = (defaults[key] - min) / (max - min); const deg = MIN_DEG + t * (MAX_DEG - MIN_DEG);
                        defMarker.style.transform = `translateX(-50%) rotate(${deg}deg)`; knob.appendChild(defMarker);
                    }
                    const valEl = document.createElement('div'); valEl.className = 'knob-val';
                    const setRotation = (v) => {
                        const t = (v - min) / (max - min); const deg = MIN_DEG + t * (MAX_DEG - MIN_DEG);
                        pip.style.transform = `translateX(-50%) rotate(${deg}deg)`;
                        valEl.textContent = key === 's' ? v.toFixed(2) : v.toFixed(2) + 'b';
                    };
                    setRotation(track.adsr[key]);
                    wrap.addEventListener('mousedown', (e) => {
                        pushUndo();
                        e.stopPropagation(); let startY = e.clientY; let startVal = track.adsr[key];
                        const onMove = (ev) => {
                            const dy = startY - ev.clientY; const delta = (dy / 160) * (max - min);
                            setADSRParam(track, key, startVal + delta);
                            setRotation(track.adsr[key]);
                            syncADSRControls(track);
                        };
                        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
                    });
                    wrap.append(modRow, knob, valEl); knobsRow.appendChild(wrap);
                });
                if (track.typeId === 'drumSet') {
                    const adsrGraphRow = document.createElement('div');
                    adsrGraphRow.className = 'drum-adsr-graph-row';
                    const adsrModInputs = document.createElement('div');
                    adsrModInputs.className = 'xy-mod-inputs drum-adsr-mod-inputs';
                    const createAdsrModWrap = (label, target) => {
                        const wrap = document.createElement('div');
                        wrap.className = 'xy-mod-row';
                        wrap.append(document.createTextNode(label), createModPort(target, track));
                        return wrap;
                    };
                    adsrModInputs.append(
                        createAdsrModWrap('S', 'sustain'),
                        createAdsrModWrap('A/R', 'adsr')
                    );
                    adsrGraphRow.append(adsrModInputs, adsrCanvas);
                    adsrGroup.append(adsrGraphRow, knobsRow);
                } else adsrGroup.append(knobsRow, adsrCanvas);
                setTimeout(() => {
                    adsrCanvas.width = adsrCanvas.offsetWidth * (devicePixelRatio || 1); adsrCanvas.height = adsrCanvas.offsetHeight * (devicePixelRatio || 1);
                    drawADSR(adsrCanvas, track.adsr, track, state.activeTrackId === index);
                }, 0);
            }

            const meterContainer = document.createElement('div'); meterContainer.style.cssText = 'width:40px; height:8px; background:#111; border-radius:2px; overflow:hidden; margin-left:12px; border:1px solid var(--glass-border);';
            const trackMeterFill = document.createElement('div'); trackMeterFill.className = 'track-meter-fill'; trackMeterFill.id = `meter_${track.id}`;
            trackMeterFill.style.cssText = 'width:0%; height:100%; background:#0f0;';
            meterContainer.appendChild(trackMeterFill);

            const soloBtn = document.createElement('button'); soloBtn.textContent = 'S'; soloBtn.style.padding = '2px 6px'; soloBtn.style.marginLeft = '12px';
            soloBtn.className = `solo-btn ${track.solo ? 'active' : ''}`;
            soloBtn.setAttribute('data-track-id', track.id);
            track.soloBtn = soloBtn;
            soloBtn.setAttribute('data-tooltip-title', 'Solo');
            soloBtn.setAttribute('data-tooltip', 'Silence all other tracks except this one.');
            if (track.solo) soloBtn.classList.add('active');
            soloBtn.onclick = (e) => { e.stopPropagation(); track.solo = !track.solo; updateSoloMuteUI(); };

            const muteBtn = document.createElement('button'); muteBtn.textContent = 'M'; muteBtn.style.padding = '2px 6px';
            muteBtn.className = `mute-btn ${track.muted ? 'active' : ''}`;
            muteBtn.setAttribute('data-track-id', track.id);
            track.muteBtn = muteBtn;
            muteBtn.setAttribute('data-tooltip-title', 'Mute');
            muteBtn.setAttribute('data-tooltip', 'Silence this track entirely.');
            if (track.muted) muteBtn.classList.add('active');
            muteBtn.onclick = (e) => { e.stopPropagation(); track.muted = !track.muted; updateSoloMuteUI(); };

            let scBtn = null;
            if (template.type === 'synth') {
                scBtn = document.createElement('button');
                scBtn.textContent = 'SC';
                scBtn.className = `sc-btn ${track.sidechainEnabled ? 'active' : ''}`;
                scBtn.setAttribute('data-tooltip-title', 'Sidechain Compression');
                scBtn.setAttribute('data-tooltip', 'Ducks the volume of this track whenever the Kick drum hits.');
                scBtn.style.cssText = 'margin-left: 12px; padding: 2px 4px; font-size: 0.5rem;';
                scBtn.onclick = () => { track.sidechainEnabled = !track.sidechainEnabled; renderTracks(); };
            }

            const loopGroup = document.createElement('div'); loopGroup.className = 'slider-group';
            loopGroup.setAttribute('data-tooltip-title', 'Loop Multiplier');
            loopGroup.setAttribute('data-tooltip', 'Sets how many bars this track pattern spans before repeating.');
            const multipliers = [1, 2, 3, 4, 8, 16];
            const loopSelect = document.createElement('select');
            loopSelect.dataset.control = 'track-loop';
            loopSelect.setAttribute('data-tooltip-title', 'Loop Multiplier');
            loopSelect.setAttribute('data-tooltip', 'Choose the track loop length multiplier, from 1x up to 16x.');
            loopSelect.style.cssText = 'width:45px; font-size:0.55rem; background:var(--surface); color:var(--text-main); border:1px solid var(--glass-border); border-radius:3px;';
            multipliers.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m + 'x';
                if ((track.loopMultiplier || 1) === m) opt.selected = true;
                loopSelect.appendChild(opt);
            });
            loopSelect.onclick = (e) => e.stopPropagation();
            loopSelect.onchange = (e) => {
                const nextMultiplier = parseInt(e.target.value, 10);
                if (track.loopMultiplier === nextMultiplier) return;
                track.loopMultiplier = nextMultiplier;
                track.gridCells = null;
                trackElementCache.delete(track.id);
                renderTracks();
            };

            const loopLabel = document.createElement('span');
            loopLabel.className = 'label';
            loopLabel.textContent = 'LOOP';

            loopGroup.appendChild(loopLabel);
            loopGroup.appendChild(loopSelect);

            const subdivSelect = document.createElement('select');
            subdivSelect.dataset.control = 'track-subdiv';
            subdivSelect.setAttribute('data-tooltip-title', 'Step Subdivision');
            subdivSelect.setAttribute('data-tooltip', 'Choose the rhythmic grid resolution for this track, including straight, triplet, and dotted values.');
            subdivSelect.style.cssText = 'width:45px; font-size:0.55rem; background:var(--surface); color:var(--text-main); border:1px solid var(--glass-border); border-radius:3px;';
            const subdivOptions = [
                { val: '0.25', text: '1/1' }, { val: '0.5', text: '1/2' }, { val: '1', text: '1/4' },
                { val: '1.5', text: '1/4T' }, { val: '0.666', text: '1/4D' }, { val: '2', text: '1/8' },
                { val: '3', text: '1/8T' }, { val: '1.333', text: '1/8D' }, { val: '4', text: '1/16' },
                { val: '6', text: '1/16T' }, { val: '8', text: '1/32' }
            ];
            subdivOptions.forEach(optData => {
                const opt = document.createElement('option');
                opt.value = optData.val;
                opt.textContent = optData.text;
                subdivSelect.appendChild(opt);
            });

            subdivSelect.onclick = (e) => e.stopPropagation();
            subdivSelect.value = track.subdiv || 4;
            subdivSelect.onchange = (e) => {
                const nextSubdiv = parseFloat(e.target.value);
                if ((track.subdiv || 4) === nextSubdiv) return;
                track.subdiv = nextSubdiv;
                track.gridCells = null;
                trackElementCache.delete(track.id);
                renderTracks();
            };

            const randStyleSelect = document.createElement('select'); randStyleSelect.style.cssText = 'width: 55px; font-size: 0.55rem;';
            ['Musical', 'Euclidean', 'Acid', 'Chaotic'].forEach(s => { const opt = document.createElement('option'); opt.value = s.toLowerCase(); opt.textContent = s; if ((track.randStyle || 'musical') === s.toLowerCase()) opt.selected = true; randStyleSelect.appendChild(opt); });
            randStyleSelect.setAttribute('data-tooltip-title', 'Randomizer Style');
            randStyleSelect.setAttribute('data-tooltip', 'Choose the pattern generation behavior: musical, Euclidean, acid, or chaotic.');
            randStyleSelect.onclick = (e) => e.stopPropagation();
            randStyleSelect.onchange = (e) => { track.randStyle = e.target.value; };

            const randModeBtn = document.createElement('button');
            randModeBtn.textContent = (track.randMode || 'replace') === 'replace' ? 'REP' : 'ADD';
            randModeBtn.setAttribute('data-tooltip-title', 'Randomization Mode');
            randModeBtn.setAttribute('data-tooltip', 'Replace the current pattern or add new notes into it.');
            randModeBtn.onclick = (e) => {
                e.stopPropagation();
                track.randMode = (track.randMode || 'replace') === 'replace' ? 'add' : 'replace';
                randModeBtn.textContent = track.randMode === 'replace' ? 'REP' : 'ADD';
            };

            const loopRandBtn = document.createElement('button');
            loopRandBtn.textContent = '🔄';
            loopRandBtn.setAttribute('data-tooltip-title', 'Randomize On Loop');
            loopRandBtn.setAttribute('data-tooltip', 'Create evolving patterns automatically when the loop restarts.');
            if (track.randOnLoop) loopRandBtn.classList.add('active');
            loopRandBtn.onclick = (e) => {
                e.stopPropagation();
                track.randOnLoop = !track.randOnLoop;
                loopRandBtn.classList.toggle('active', !!track.randOnLoop);
            };

            const densSlider = document.createElement('input');
            densSlider.type = 'range'; densSlider.min = '0.05'; densSlider.max = '1'; densSlider.step = '0.05';
            densSlider.value = track.randDensity || 0.5; densSlider.style.cssText = 'height:3px; accent-color:var(--accent-cyan);';
            densSlider.oninput = (e) => { track.randDensity = parseFloat(e.target.value); };

            const spreadSlider = document.createElement('input');
            spreadSlider.type = 'range'; spreadSlider.min = '0'; spreadSlider.max = '1'; spreadSlider.step = '0.05';
            spreadSlider.value = track.randSpread || 0.5; spreadSlider.style.cssText = 'height:3px; accent-color:var(--accent-pink);';
            spreadSlider.oninput = (e) => { track.randSpread = parseFloat(e.target.value); };

            const lenSlider = document.createElement('input');
            lenSlider.type = 'range'; lenSlider.min = '0'; lenSlider.max = '1'; lenSlider.step = '0.05';
            lenSlider.value = track.randNoteLen || 0; lenSlider.style.cssText = 'height:3px; accent-color:var(--accent-yellow);';
            lenSlider.oninput = (e) => { track.randNoteLen = parseFloat(e.target.value); };

            const jitSlider = document.createElement('input');
            jitSlider.type = 'range'; jitSlider.min = '0'; jitSlider.max = '1'; jitSlider.step = '0.05';
            jitSlider.value = track.randJitter || 0; jitSlider.style.cssText = 'height:3px; accent-color:var(--accent-cyan);';
            jitSlider.oninput = (e) => { track.randJitter = parseFloat(e.target.value); };

            const gliSlider = document.createElement('input');
            gliSlider.type = 'range'; gliSlider.min = '0'; gliSlider.max = '1'; gliSlider.step = '0.05';
            gliSlider.value = track.randGliss || 0; gliSlider.style.cssText = 'height:3px; accent-color:var(--accent-pink);';
            gliSlider.oninput = (e) => { track.randGliss = parseFloat(e.target.value); };

            const randBtn = document.createElement('button'); randBtn.textContent = '🎲';
            randBtn.setAttribute('data-tooltip-title', 'Generate Pattern');
            randBtn.setAttribute('data-tooltip', 'Generate a new sequence using the current randomizer settings.' + (template.type !== 'drum' && hasTonalSupport() ? ' Tonal.js is loaded, so melodic picks favor key chord tones.' : ''));
            randBtn.style.cssText = 'background:linear-gradient(#111116,#111116) padding-box, linear-gradient(135deg, var(--accent-purple), var(--accent-cyan), var(--accent-pink)) border-box; color:var(--accent-cyan); font-weight:bold; border:1px solid transparent; border-radius:4px; padding:2px 8px; cursor:pointer; box-shadow:0 0 9px rgba(0,242,255,0.18), 0 0 7px rgba(180,0,255,0.18); text-shadow:0 0 6px rgba(0,242,255,0.7);';
            randBtn.onclick = () => {
                randomizeTrack(track);
                autoSpawnTrackIfNeeded();
                if (typeof autoSpawnDrawerIfNeeded === 'function') autoSpawnDrawerIfNeeded();
            };

            const fillBtn = document.createElement('button');
            fillBtn.textContent = '♾️';
            fillBtn.setAttribute('data-tooltip-title', 'Fill The Roll');
            fillBtn.setAttribute('data-tooltip', 'Repeat the first measure pattern across the full loop.');
            fillBtn.onclick = () => { fillTrackPattern(track); markTrackGridDirty(track); updateTrackGrid(track); };

            const clearBtn = document.createElement('button'); clearBtn.textContent = '✕'; clearBtn.style.color = 'var(--accent-pink)';
            clearBtn.setAttribute('data-tooltip-title', 'Clear Pattern');
            clearBtn.setAttribute('data-tooltip', 'Remove all notes from this track piano roll.');
            clearBtn.onclick = () => { pushUndo(); track.grid.forEach(row => row.fill(false)); markTrackGridDirty(track); updateTrackGrid(track); };

            const randGroup = document.createElement('div');
            randGroup.className = 'random-controls';
            randGroup.setAttribute('data-tooltip-title', 'Pattern Randomizer');
            randGroup.setAttribute('data-tooltip', 'Generate new sequences based on style, density, and spread.');
            randGroup.style.cssText = 'display:flex; flex-direction:column; gap:4px; padding:6px; background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); border-radius:6px; min-width:200px;';
            randGroup.onclick = (e) => e.stopPropagation();

            const midiIn = document.createElement('div');
            midiIn.className = 'patch-point midi-in';
            midiIn.id = `midi_in_${track.id}`;
            midiIn.style.cssText = 'border-color:var(--accent-purple);';
            if (state.tracks.some(t => t.midiDoublingTargetId === track.id)) midiIn.classList.add('active');
            midiIn.setAttribute('data-tooltip-title', 'MIDI IN');
            midiIn.setAttribute('data-tooltip', 'Receives MIDI notes from another track. Melodies will be doubled here.');

            const midiOut = document.createElement('div');
            midiOut.className = `patch-point midi-out ${track.midiDoublingTargetId ? 'active' : ''}`;
            midiOut.id = `midi_out_${track.id}`;
            midiOut.setAttribute('data-tooltip-title', 'MIDI OUT');
            midiOut.setAttribute('data-tooltip', 'Sends MIDI notes to another track for melodic doubling.');
            midiOut.style.cssText = 'border-color:var(--accent-yellow);';
            midiOut.onmousedown = (e) => {
                e.stopPropagation();
                isPatching = true;
                patchingMidiOutId = track.id;
                activeCable.style.stroke = '#00f2ff';
                activeCable.style.display = 'block';
                document.querySelectorAll('.midi-in').forEach(el => el.classList.add('mod-port-target'));
            };

            const randTop = document.createElement('div');
            randTop.style.cssText = 'display:flex; align-items:center; gap:6px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:4px;';
            randTop.append(fillBtn, randStyleSelect, randModeBtn, loopRandBtn, randBtn, clearBtn);

            const midiHub = document.createElement('div');
            midiHub.className = 'midi-hub';
            midiHub.style.cssText = 'display:flex; align-items:center; gap:7px; padding:3px 6px; background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); border-radius:5px; min-width:70px;';

            const midiLabel = document.createElement('span');
            midiLabel.className = 'label';
            midiLabel.style.cssText = 'font-size:0.43rem; opacity:0.6; white-space:nowrap;';
            midiLabel.textContent = 'MIDI IN/OUT';

            const midiPorts = document.createElement('div');
            midiPorts.style.cssText = 'display:flex; gap:8px; align-items:center;';
            midiPorts.append(midiIn, midiOut);

            midiHub.append(midiLabel, midiPorts);

            const randGrid = document.createElement('div');
            randGrid.style.cssText = 'display:grid; grid-template-columns: 1fr 1fr; gap:2px 10px;';

            function renderSlider(labelStr, slider, color, helpText = '') {
                const wrap = document.createElement('div');
                wrap.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:6px;';
                if (helpText) {
                    wrap.setAttribute('data-tooltip-title', labelStr);
                    wrap.setAttribute('data-tooltip', helpText);
                }
                const lbl = document.createElement('span'); lbl.className = 'label'; lbl.textContent = labelStr;
                lbl.style.cssText = 'font-size:0.45rem; color:var(--control-label); opacity:1; width:30px;';
                slider.style.width = '50px';
                wrap.append(lbl, slider);
                return wrap;
            }

            randGrid.append(renderSlider('DENS', densSlider, 'var(--accent-cyan)', 'Controls how many notes the randomizer places in the pattern.'));
            randGrid.append(renderSlider('SPRD', spreadSlider, 'var(--accent-pink)', 'Spreads generated notes across more lanes, pitches, or drum rows.'));
            if (template.type !== 'drum') randGrid.append(renderSlider('LEN', lenSlider, 'var(--accent-yellow)', 'Sets the generated melodic note length. Higher values create longer held notes.'));
            randGrid.append(renderSlider('JITR', jitSlider, 'var(--accent-cyan)', 'Adds timing variation so generated notes feel less rigid.'));
            if (template.type !== 'drum') randGrid.append(renderSlider('GLIS', gliSlider, 'var(--accent-pink)', 'Adds stepped pitch slides between generated melodic notes.'));

            randGroup.append(randTop, randGrid);

            let glideGroup = null;
            if (template.type !== 'drum') {
                glideGroup = document.createElement('div');
                glideGroup.className = 'melodic-glide-group';
                glideGroup.style.cssText = 'display:flex; flex-direction:column; gap:3px; padding:4px 6px; background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); border-radius:5px; min-width:118px;';
                const glideTop = document.createElement('div');
                glideTop.style.cssText = 'display:flex; align-items:center; justify-content:center; border-bottom:1px solid rgba(255,255,255,0.07); padding-bottom:3px;';
                const glideBtn = document.createElement('button');
                glideBtn.className = `glide-btn glide-toggle-btn ${track.glide ? 'active' : ''}`;
                glideBtn.dataset.control = 'glide-toggle';
                glideBtn.setAttribute('data-tooltip-title', 'Portamento / Glide');
                glideBtn.setAttribute('data-tooltip', 'Enable smooth frequency sliding between consecutive notes.');
                glideBtn.style.cssText = 'font-size:0.45rem; padding:1px 6px; height:16px; line-height:12px; flex:1;';
                const glideLabel = document.createElement('span');
                glideLabel.className = 'glide-btn-label';
                glideLabel.textContent = 'GLIDE';
                const glideValue = document.createElement('span');
                glideValue.className = 'glide-time-display';
                glideBtn.append(glideLabel, glideValue);
                syncGlideButton(glideBtn, track);
                glideBtn.onclick = () => {
                    track.glide = !track.glide;
                    syncGlideButton(glideBtn, track);
                };
                glideTop.appendChild(glideBtn);

                const glideSlider = document.createElement('input');
                glideSlider.type = 'range'; glideSlider.min = '0'; glideSlider.max = '0.5'; glideSlider.step = '0.01';
                glideSlider.dataset.control = 'track-glide-time';
                setTooltip(glideSlider, 'Glide Time', 'Adjusts how long pitch takes to slide between consecutive melodic notes.');
                glideSlider.value = track.glideTime; glideSlider.style.cssText = 'height:3px; accent-color:var(--accent-yellow); width:100%; margin:1px auto 0;';
                glideSlider.oninput = (e) => {
                    track.glideTime = parseFloat(e.target.value);
                    track.glide = track.glideTime > 0;
                    syncGlideButton(glideBtn, track);
                };
                glideGroup.append(glideTop, glideSlider);

                const arpGroup = document.createElement('div');
                arpGroup.className = 'arp-group';
                arpGroup.style.cssText = 'display:flex; flex-direction:column; gap:4px; padding:5px 6px; background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); border-radius:5px; min-width:128px;';
                arpGroup.setAttribute('data-tooltip-title', 'Arpeggiator');
                arpGroup.setAttribute('data-tooltip', 'ARP builds a note pool from held keyboard notes or active melodic sequencer notes, then plays one pooled pitch per RATE step. LATCH keeps the last pool armed after keys or sequencer notes release; with LATCH off, the pool clears when nothing is held. DIR sets the pool order, including RANDOM picks.');
                arpGroup.onmousedown = (e) => e.stopPropagation();
                arpGroup.onclick = (e) => e.stopPropagation();
                track.arp = normalizeArp(track.arp);

                const arpTop = document.createElement('div');
                arpTop.style.cssText = 'display:flex; align-items:center; gap:4px; width:100%;';
                const arpBtn = document.createElement('button');
                arpBtn.textContent = 'ARP';
                arpBtn.className = `glide-btn ${track.arp?.enabled ? 'active' : ''}`;
                arpBtn.dataset.control = 'arp-toggle';
                setTooltip(arpBtn, 'Arpeggiator On/Off', 'Enable ARP playback. Held keyboard notes or active sequencer notes become the arpeggiator note pool.');
                arpBtn.style.cssText = 'font-size:0.5rem; padding:1px 4px; height:18px; line-height:14px; flex:1;';
                arpBtn.onclick = (e) => {
                    e.stopPropagation();
                    track.arp = normalizeArp(track.arp);
                    track.arp.enabled = !track.arp.enabled;
                    if (!track.arp.enabled) resetArpPlayback(track);
                    renderTracks();
                };
                const latchBtn = document.createElement('button');
                latchBtn.textContent = 'LATCH';
                latchBtn.className = `glide-btn ${track.arp?.latch ? 'active' : ''}`;
                latchBtn.dataset.control = 'arp-latch';
                setTooltip(latchBtn, 'ARP Latch', 'Keep the last arpeggiator note pool armed after keys or sequencer notes release. Turn off to clear the pool when nothing is held.');
                latchBtn.style.cssText = 'font-size:0.5rem; padding:1px 4px; height:18px; line-height:14px; flex:1;';
                latchBtn.onclick = (e) => {
                    e.stopPropagation();
                    track.arp = normalizeArp(track.arp);
                    track.arp.latch = !track.arp.latch;
                    if (!track.arp.latch) resetArpPlayback(track);
                    renderTracks();
                };
                arpTop.append(arpBtn, latchBtn);

                const arpSettings = document.createElement('div');
                arpSettings.style.cssText = 'display:grid; grid-template-columns:46px 1fr; gap:4px; width:100%;';
                const rateSelect = document.createElement('select');
                rateSelect.dataset.control = 'arp-rate';
                rateSelect.setAttribute('aria-label', 'ARP Rate');
                setTooltip(rateSelect, 'ARP Rate', 'Choose how often the arpeggiator advances through its note pool. Smaller note values play faster.');
                rateSelect.style.cssText = 'font-size:0.5rem; background:#101015; border:1px solid var(--glass-border); border-radius:3px; color:var(--accent-yellow); height:18px; padding:0 2px; width:100%;';
                ARP_RATE_OPTIONS.forEach(({ label, value }) => {
                    const opt = document.createElement('option'); opt.value = value; opt.textContent = label;
                    if (track.arp?.subdivision === value) opt.selected = true;
                    rateSelect.appendChild(opt);
                });
                rateSelect.onchange = (e) => {
                    track.arp = normalizeArp(track.arp);
                    track.arp.subdivision = parseInt(e.target.value, 10);
                    track.arp.lastStep = -1;
                };
                const dirSelect = document.createElement('select');
                dirSelect.dataset.control = 'arp-direction';
                dirSelect.setAttribute('aria-label', 'ARP Direction');
                setTooltip(dirSelect, 'ARP Direction', 'Choose the order used to walk the note pool: up, down, alternating, or random.');
                dirSelect.style.cssText = 'font-size:0.5rem; background:#101015; border:1px solid var(--glass-border); border-radius:3px; color:var(--accent-yellow); height:18px; padding:0 2px; width:100%;';
                ARP_DIRECTION_OPTIONS.forEach(({ label, value }) => {
                    const opt = document.createElement('option'); opt.value = value; opt.textContent = label;
                    if (track.arp?.direction === value) opt.selected = true;
                    dirSelect.appendChild(opt);
                });
                dirSelect.onchange = (e) => {
                    track.arp = normalizeArp(track.arp);
                    track.arp.direction = e.target.value;
                    track.arp.currentIdx = 0;
                    track.arp.goingUp = true;
                    track.arp.lastStep = -1;
                };
                arpSettings.append(rateSelect, dirSelect);
                arpGroup.append(arpTop, arpSettings);
                track.arpGroup = arpGroup;
            }

            const audioOut = document.createElement('div'); audioOut.className = `patch-point audio-out ${track.audioRoute !== 'master' ? 'active' : ''}`; audioOut.id = `audio_out_${track.id}`;
            audioOut.style.cssText = `position:absolute; right:12px; top:${track.minimized ? '8px' : '12px'}; z-index:100; border-color:var(--accent-yellow);`;
            audioOut.onmousedown = () => {
                isPatching = true; patchingAudioOutId = track.id;
                activeCable.style.stroke = '#00f2ff'; activeCable.style.display = 'block';
                document.querySelectorAll('.audio-in').forEach(el => el.classList.add('mod-port-target'));
            };

            const xyGroup = document.createElement('div'); xyGroup.className = 'xy-group';
            const xyCont = document.createElement('div'); xyCont.className = 'xy-container';
            const vu = document.createElement('div'); vu.className = 'vu-meter';
            const fill = document.createElement('div'); fill.className = 'vu-meter-fill'; fill.id = `meter_${track.id}`;
            track.vuMeterFill = fill;
            // Removed redundant header.appendChild(vu) - handled by masterRow or headerRow later

            const controls = document.createElement('div');
            controls.className = 'track-controls';
            controls.onclick = (e) => e.stopPropagation();

            const xyCanvas = document.createElement('canvas');
            xyCanvas.className = 'xy-pad'; xyCanvas.id = `xy_${track.id}`;
            track.xyCanvas = xyCanvas;
            xyCanvas.setAttribute('data-tooltip-title', 'Filter Cutoff/Resonance');
            xyCanvas.setAttribute('data-tooltip', 'Drag to adjust filter frequency (X) and resonance (Y).');
            xyCanvas.width = 140 * (window.devicePixelRatio || 1);
            xyCanvas.height = 78 * (window.devicePixelRatio || 1);
            xyCont.appendChild(xyCanvas);

            const filterGroup = document.createElement('div'); filterGroup.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:2px; margin-left:6px;';
            const filterLabel = document.createElement('span'); filterLabel.className = 'label'; filterLabel.style.cssText = 'font-size:0.45rem; opacity:0.6;'; filterLabel.textContent = 'TYPE';
            const filterSelect = document.createElement('select'); filterSelect.style.cssText = 'font-size:0.55rem; width:42px; background:var(--surface); color:var(--accent-cyan); border:1px solid var(--glass-border); border-radius:3px; padding:0 2px;';
            setTooltip(filterSelect, 'Filter Type', 'Choose the track filter shape: low-pass, high-pass, or band-pass.');
            const fTypes = [{ val: 'lowpass', text: 'LP' }, { val: 'highpass', text: 'HP' }, { val: 'bandpass', text: 'BP' }];
            fTypes.forEach(ft => { const fOpt = document.createElement('option'); fOpt.value = ft.val; fOpt.textContent = ft.text; if (track.filterNode.type === ft.val) fOpt.selected = true; filterSelect.appendChild(fOpt); });
            filterSelect.onchange = (e) => { track.filterNode.type = e.target.value; };
            filterGroup.append(filterLabel, filterSelect);

            const modInputs = document.createElement('div'); modInputs.className = 'xy-mod-inputs';
            const createXyModWrap = (label, target) => {
                const wrap = document.createElement('div');
                wrap.className = 'xy-mod-row';
                wrap.append(document.createTextNode(label), createModPort(target, track));
                return wrap;
            };
            const qWrap = createXyModWrap('Q', 'y');
            const fWrap = createXyModWrap('F', 'x');
            const wWrap = createXyModWrap('W', 'wobble');
            modInputs.append(qWrap, fWrap, wWrap);
            xyGroup.append(modInputs, xyCont, filterGroup);

            setupXYEvents(xyCont, xyCanvas, track);

            if (!track.minimized) {
                const volPanCont = document.createElement('div');
                volPanCont.style.display = 'flex'; volPanCont.style.gap = '8px';
                volPanCont.append(volGroup, panGroup);

                const soloMuteCont = document.createElement('div');
                soloMuteCont.style.display = 'flex'; soloMuteCont.style.gap = '4px';
                soloMuteCont.append(soloBtn, muteBtn);

                if (track.typeId === 'drumSet') {
                    renderSamplerModule(track, header, minBtn, patchIn, select, octBadge, meterContainer, soloBtn, muteBtn, volPanCont, subdivSelect, loopGroup, adsrGroup, xyGroup, randGroup, midiHub);
                } else {
                    const row1 = document.createElement('div'); row1.className = 'header-row';
                    const row2 = document.createElement('div'); row2.className = 'header-row';
                    const isMelodicPanel = template.type === 'synth';
                    if (isMelodicPanel) {
                        row1.classList.add('melodic-control-row');
                        row2.classList.add('melodic-module-row');
                    }
                    const createMelodicDivider = () => {
                        const divider = document.createElement('div');
                        divider.className = 'melodic-module-divider';
                        return divider;
                    };
                    const topRightGroup = document.createElement('div');
                    topRightGroup.style.cssText = 'margin-left:auto; display:flex; align-items:center; gap:8px; padding-right:32px;';
                    prepareHeaderMidiHub(midiHub, track);
                    topRightGroup.append(midiHub, meterContainer, loopGroup, subdivSelect);
                    row1.append(minBtn, patchIn, select, octGroup, soloMuteCont, volPanCont, scBtn || document.createElement('div'), topRightGroup);
                    if (isMelodicPanel && adsrGroup) {
                        const adsrCanvas = adsrGroup.querySelector('.adsr-display');
                        if (adsrCanvas) {
                            const dpr = window.devicePixelRatio || 1;
                            adsrCanvas.width = 150 * dpr;
                            adsrCanvas.height = 76 * dpr;
                        }
                    }
                    if (isMelodicPanel) {
                        const perfGroup = document.createElement('div');
                        perfGroup.className = 'melodic-perf-group';
                        perfGroup.append(glideGroup || document.createElement('div'), track.arpGroup || document.createElement('div'));
                        randGroup.style.minWidth = '230px';
                        randGroup.style.padding = '7px 8px';
                        randGroup.style.marginLeft = 'auto';
                        row2.append(
                            xyGroup,
                            createMelodicDivider(),
                            adsrGroup || document.createElement('div'),
                            createMelodicDivider(),
                            perfGroup,
                            createMelodicDivider(),
                            randGroup
                        );
                    } else {
                        row2.append(xyGroup, adsrGroup || document.createElement('div'), glideGroup || document.createElement('div'), track.arpGroup || document.createElement('div'), randGroup);
                    }
                    header.append(row1, row2);
                }
            } else {
                header.textContent = '';
                header.style.flexDirection = 'row';
                header.style.alignItems = 'center';
                header.style.minHeight = '18px';
                header.style.gap = '8px';
                header.style.padding = '7px 8px 10px';
                header.style.border = '1px solid var(--glass-border)';
                header.style.borderRadius = '8px';
                header.append(minBtn, patchIn, document.createTextNode(instrumentTypes[track.typeId].name), octBadge, createMinimizedModStrip(track), meterContainer, soloBtn, muteBtn);
                appendHeaderMidiHub(header, track, midiHub, true);
            }

            trackEl.appendChild(header); trackEl.appendChild(audioOut);

            if (!track.minimized) {
                const gridCont = document.createElement('div'); gridCont.className = 'grid-container';
                track.gridCells = [];
                template.rows.forEach((rowName, rIdx) => {
                    const rowEl = document.createElement('div'); rowEl.className = 'grid-row';
                    track.gridCells[rIdx] = [];
                    const label = document.createElement('div'); label.className = 'row-label';
                    if (template.type === 'synth') {
                        label.dataset.noteKind = rowName.includes('#') ? 'sharp' : 'natural';
                        const noteMarker = document.createElement('span');
                        noteMarker.className = 'row-label-note-marker';
                        noteMarker.setAttribute('aria-hidden', 'true');
                        const noteText = document.createElement('span');
                        noteText.className = 'row-label-text';
                        noteText.textContent = formatPianoRollRowLabel(rowName);
                        label.append(noteMarker, noteText);
                    } else {
                        label.textContent = rowName;
                    }
                    label.onmousedown = (e) => { e.preventDefault(); noteOn(track, rIdx, audioCtx.currentTime); const up = () => { noteOff(track, rIdx, audioCtx.currentTime); window.removeEventListener('mouseup', up); }; window.addEventListener('mouseup', up); };
                    if (template.type !== 'drum') rowEl.appendChild(label);
                    if (template.type === 'drum') {
                        const rowControls = document.createElement('div');
                        rowControls.className = 'drum-row-controls';
                        rowControls.style.cssText = 'display:flex; gap:2px; width:116px; flex:0 0 116px; overflow:hidden;';
                        if (track.typeId === 'drumSet') rowControls.style.cssText = 'display:flex; gap:2px; width:180px; flex:0 0 180px; overflow:hidden;';

                        if (track.typeId === 'drumSet') {
                            const samplerLabel = document.createElement('div');
                            samplerLabel.className = 'sampler-row-label';
                            samplerLabel.textContent = getSamplerRowLabel(track, rIdx);
                            samplerLabel.style.width = '58px';
                            samplerLabel.style.justifyContent = 'flex-start';
                            samplerLabel.style.textAlign = 'left';
                            samplerLabel.setAttribute('data-tooltip-title', `PAD ${String(rIdx + 1).padStart(2, '0')}`);
                            samplerLabel.setAttribute('data-tooltip', `Triggers ${getSamplerRowLabel(track, rIdx)} from sampler Bank ${track.samplerBank || 'A'}.`);
                            const padHotkey = samplerKeyboardLabels[rIdx] || '';
                            if (padHotkey) samplerLabel.setAttribute('data-tooltip-hotkey', padHotkey.toUpperCase());
                            samplerLabel.onmousedown = label.onmousedown;
                            rowControls.appendChild(samplerLabel);
                        }

                        const drumSelect = document.createElement('select');
                        drumSelect.setAttribute('aria-label', `Drum type for row ${rIdx + 1}`);
                        drumSelect.style.cssText = 'font-size:0.48rem; width:58px; background:#111116; border:1px solid rgba(255,255,255,0.08); color:var(--text-dim); border-radius:2px;';
                        const currentDrum = getTrackRowDrumName(track, rIdx);
                        drumTypeNames.forEach(name => {
                            const opt = document.createElement('option');
                            opt.value = name;
                            opt.textContent = name;
                            if (name === currentDrum) opt.selected = true;
                            drumSelect.appendChild(opt);
                        });

                        const variantSelect = document.createElement('select');
                        variantSelect.setAttribute('aria-label', `Drum variant for row ${rIdx + 1}`);
                        variantSelect.style.cssText = 'font-size:0.48rem; width:56px; background:#111116; border:1px solid rgba(255,255,255,0.08); color:var(--control-label); border-radius:2px;';
                        const populateVariants = () => {
                            const drumName = drumSelect.value;
                            const variants = drumStyles[drumName] || ['Default'];
                            const selectedIdx = Math.max(0, Math.min(variants.length - 1, track.rowStyles[rIdx] || 0));
                            variantSelect.textContent = '';
                            variants.forEach((variant, si) => {
                                const opt = document.createElement('option');
                                opt.value = si;
                                opt.textContent = variant;
                                if (si === selectedIdx) opt.selected = true;
                                variantSelect.appendChild(opt);
                            });
                        };
                        populateVariants();

                        drumSelect.onchange = (e) => {
                            track.rowDrums[rIdx] = e.target.value;
                            track.rowStyles[rIdx] = 0;
                            populateVariants();
                        };
                        variantSelect.onchange = (e) => { track.rowStyles[rIdx] = parseInt(e.target.value, 10); };
                        rowControls.append(drumSelect, variantSelect);
                        rowEl.appendChild(rowControls);
                    }
                    const currentTrackSubdiv = track.subdiv || 4;
                    const trackSteps = (track.loopMultiplier || 1) * Math.round(state.timeSignature * currentTrackSubdiv);
                    for (let s = 0; s < trackSteps; s++) {
                        const isLight = Math.floor(s / currentTrackSubdiv) % 2 !== 0;
                        const step = document.createElement('div'); step.className = `step ${isLight ? 'light-beat' : ''}`;
                        step.dataset.step = s;
                        track.gridCells[rIdx][s] = step;
                        renderStepCell(step, track, rIdx, s);
                        step.onmousedown = (e) => { if (isPatching || e.shiftKey) return; pushUndo(); dragDrawMode = !(typeof track.grid[rIdx][s] === 'object' ? track.grid[rIdx][s].on : !!track.grid[rIdx][s]); track.grid[rIdx][s] = { on: dragDrawMode, length: 1.0 }; markTrackCellDirty(track, rIdx, s); updateTrackGrid(track); };
                        step.onmouseenter = () => { state.hoveredGrid = { trackId: track.id, row: rIdx, step: s }; if (!isPatching && isDraggingPip && !window.event?.shiftKey) { track.grid[rIdx][s] = { on: dragDrawMode, length: 1.0 }; markTrackCellDirty(track, rIdx, s); scheduleTrackGridUpdate(track); } };
                        rowEl.appendChild(step);
                    }
                    gridCont.appendChild(rowEl);
                });
                trackEl.appendChild(gridCont);
            }

            const resizer = document.createElement('div');
            resizer.className = 'track-resizer';
            resizer.onmousedown = (e) => {
                e.preventDefault(); const startY = e.clientY; const startH = track.rowHeight || 12;
                const onMove = (me) => { const dy = me.clientY - startY; track.rowHeight = Math.max(12, Math.min(100, startH + (dy / Math.max(1, template.rows.length)))); trackEl.style.setProperty('--row-height', `${track.rowHeight}px`); };
                const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
            };
            trackEl.appendChild(resizer);

            setTimeout(() => {
                [xyCanvas, track.adsrCanvas].forEach(c => {
                    if (c && c.offsetWidth > 0) {
                        c.width = c.offsetWidth * (window.devicePixelRatio || 1);
                        c.height = c.offsetHeight * (window.devicePixelRatio || 1);
                    }
                });
                if (track.xyCanvas) drawXY(track.xyCanvas, track);
            }, 0);

            return trackEl;
        }

        function createModPort(target, track) {
            return createPatchPointControl('patch-point mod-in', `mod_${target}_${track.id}`, !!track.modLinks[target]);
        }

        function renderStepCell(step, track, rIdx, s) {
            const sd = track.grid[rIdx][s];
            const isOn = typeof sd === 'object' ? sd.on : !!sd;
            const nl = typeof sd === 'object' ? sd.length : 1.0;
            const isSelected = state.selection.notes.some(n => n.trackId === track.id && n.row === rIdx && n.step === s);
            step.textContent = '';
            if (isOn) {
                const inner = document.createElement('div');
                inner.className = 'step-inner' + (isSelected ? ' selected' : '');
                inner.style.width = `calc(${nl * 100}% + ${(nl - 1) * 2}px)`;
                inner.onmousedown = (e) => {
                    if (isPatching) return;
                    e.stopPropagation();
                    if (e.shiftKey) {
                        isDraggingPip = false; e.preventDefault();
                        const rect = inner.getBoundingClientRect(); const cellW = rect.width / nl;
                        const startX = e.clientX;
                        const originalStep = s;
                        const originalLength = nl;
                        const originalEnd = originalStep + originalLength;
                        const maxStep = track.grid[rIdx].length - 1;
                        const clickXRelative = e.clientX - rect.left;
                        const isDraggingStart = clickXRelative <= rect.width / 2;

                        const onMove = (me) => {
                            const dx = me.clientX - startX;
                            const rawDeltaSteps = dx / cellW;
                            const deltaSteps = Math.round(rawDeltaSteps);
                            const lengthDelta = Math.round(rawDeltaSteps * 4) / 4;
                            const oldData = track.grid[rIdx][s];
                            const noteData = (typeof oldData === 'object' && oldData) ? { ...oldData } : { on: true, length: originalLength };

                            if (isDraggingStart) {
                                const latestStart = Math.max(0, Math.min(maxStep, Math.floor(originalEnd - 0.25)));
                                const newStep = Math.max(0, Math.min(latestStart, originalStep + deltaSteps));
                                const newLen = Math.max(0.25, originalEnd - newStep);
                                if (newStep !== s) {
                                    track.grid[rIdx][s] = { on: false, length: 1.0 };
                                    markTrackCellDirty(track, rIdx, s);
                                }
                                track.grid[rIdx][newStep] = { ...noteData, on: true, length: newLen };
                                markTrackCellDirty(track, rIdx, newStep);
                                s = newStep;
                            } else {
                                track.grid[rIdx][s] = { ...noteData, on: true, length: Math.max(0.25, originalLength + lengthDelta) };
                                markTrackCellDirty(track, rIdx, s);
                            }
                            scheduleTrackGridUpdate(track);
                        };
                        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
                    } else if (isSelected) {
                        state.dragSelection.active = true; state.dragSelection.startStep = s; state.dragSelection.startRow = rIdx; state.dragSelection.trackId = track.id;
                        const initialNotes = state.selection.notes.map(n => { const tr = state.lookup.tracks.get(n.trackId); return { ...n, data: JSON.parse(JSON.stringify(tr.grid[n.row][n.step])) }; });
                        const onMove = (me) => {
                            if (!state.hoveredGrid) return;
                            const ds = state.hoveredGrid.step - state.dragSelection.startStep; const dr = state.hoveredGrid.row - state.dragSelection.startRow;
                            if (ds === 0 && dr === 0) return;
                            initialNotes.forEach(n => { const tr = state.lookup.tracks.get(n.trackId); tr.grid[n.row][n.step] = { on: false, length: 1.0 }; markTrackCellDirty(tr, n.row, n.step); });
                            const newSelection = [];
                            initialNotes.forEach(n => {
                                const tr = state.lookup.tracks.get(n.trackId); const nr = n.row + dr; const ns = n.step + ds;
                                if (tr.grid[nr] && ns >= 0 && ns < 256) { tr.grid[nr][ns] = n.data; markTrackCellDirty(tr, nr, ns); newSelection.push({ trackId: n.trackId, row: nr, step: ns }); }
                            });
                            state.selection.notes = newSelection; state.dragSelection.startStep += ds; state.dragSelection.startRow += dr;
                            const affectedTracks = new Set(initialNotes.map(n => n.trackId).concat(newSelection.map(n => n.trackId)));
                            affectedTracks.forEach(trackId => scheduleTrackGridUpdate(state.lookup.tracks.get(trackId)));
                        };
                        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
                    } else {
                        dragDrawMode = false; track.grid[rIdx][s] = { on: false, length: 1.0 }; markTrackCellDirty(track, rIdx, s); updateTrackGrid(track);
                    }
                };
                step.appendChild(inner);
            }
        }
        function drawSamplerWaveform(sc, track) {
            const dpr = window.devicePixelRatio || 1;
            const w = sc.offsetWidth * dpr;
            const h = sc.offsetHeight * dpr;
            if (w === 0 || h === 0) return;
            if (sc.width !== w || sc.height !== h) {
                sc.width = w; sc.height = h;
            }
            const sCtx = sc.getContext('2d');
            const rootStyles = getComputedStyle(document.documentElement);
            const waveformYellow = '#ffea00';
            const waveformYellowDim = 'rgba(255, 234, 0, 0.2)';
            const accentPink = rootStyles.getPropertyValue('--accent-pink').trim() || '#ff2fd6';

            const bg = sCtx.createLinearGradient(0, 0, 0, sc.height);
            bg.addColorStop(0, '#07070b');
            bg.addColorStop(0.52, '#05070a');
            bg.addColorStop(1, '#040406');
            sCtx.fillStyle = bg;
            sCtx.fillRect(0, 0, sc.width, sc.height);

            sCtx.lineWidth = 1;
            for (let i = 0; i <= 16; i++) {
                const x = i * sc.width / 16;
                sCtx.strokeStyle = i % 4 === 0 ? 'rgba(255, 234, 0, 0.1)' : 'rgba(255, 255, 255, 0.045)';
                sCtx.beginPath(); sCtx.moveTo(x, 0); sCtx.lineTo(x, sc.height); sCtx.stroke();
            }
            for (let i = 0; i <= 8; i++) {
                const y = i * sc.height / 8;
                sCtx.strokeStyle = i === 4 ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.045)';
                sCtx.beginPath(); sCtx.moveTo(0, y); sCtx.lineTo(sc.width, y); sCtx.stroke();
            }

            if (!track.lastBuffer) {
                sCtx.fillStyle = 'rgba(255, 255, 255, 0.35)';
                sCtx.font = `${10 * dpr}px monospace`;
                sCtx.fillText('LOADING SAMPLE...', 10 * dpr, 18 * dpr);
                return;
            }

            if (track.lastBuffer) {
                const amp = sc.height / 2;
                const peaks = getSamplerWaveformPeaks(track.lastBuffer, sc.width);

                sCtx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
                sCtx.beginPath();
                sCtx.moveTo(0, amp);
                sCtx.lineTo(sc.width, amp);
                sCtx.stroke();

                sCtx.fillStyle = waveformYellowDim;
                for (let i = 0; i < peaks.length; i++) {
                    const { min, max } = peaks[i];
                    if (min <= max) sCtx.fillRect(i, (1 + min) * amp, 1, (max - min) * amp);
                }

                sCtx.shadowBlur = 3 * dpr;
                sCtx.shadowColor = 'rgba(255, 234, 0, 0.45)';
                sCtx.strokeStyle = waveformYellow;
                sCtx.lineWidth = 1.2 * dpr;
                sCtx.beginPath();
                for (let i = 0; i < peaks.length; i++) {
                    const { min, max } = peaks[i];
                    if (min <= max) { sCtx.moveTo(i, (1 + min) * amp); sCtx.lineTo(i, (1 + max) * amp); }
                }
                sCtx.stroke();
                sCtx.shadowBlur = 0;

                if (track.lastSampleStartTime) {
                    const elapsed = audioCtx.currentTime - track.lastSampleStartTime;
                    const progress = elapsed / track.lastSampleDuration;
                    if (progress >= 0 && progress < 1.0) {
                        sCtx.shadowBlur = 4 * dpr; sCtx.shadowColor = accentPink; sCtx.strokeStyle = accentPink;
                        sCtx.lineWidth = 2 * dpr; sCtx.beginPath(); sCtx.moveTo(progress * sc.width, 0); sCtx.lineTo(progress * sc.width, sc.height); sCtx.stroke();
                        sCtx.shadowBlur = 0;
                    }
                }

                if (track.analyserDataArray) {
                    sCtx.lineWidth = 1.5 * dpr;
                    sCtx.strokeStyle = 'rgba(255, 234, 0, 0.42)';
                    sCtx.beginPath();
                    const slice = sc.width / track.analyserDataArray.length;
                    let curX = 0;
                    for (let i = 0; i < track.analyserDataArray.length; i++) {
                        const v = track.analyserDataArray[i] / 128.0;
                        const y = v * sc.height / 2;
                        if (i === 0) sCtx.moveTo(curX, y); else sCtx.lineTo(curX, y);
                        curX += slice;
                    }
                    sCtx.stroke();
                }
            }
        }

        function setupXYEvents(xyCont, xyCanvas, track) {
            const updateXY = (e) => {
                const rect = xyCont.getBoundingClientRect(); if (rect.width === 0 || rect.height === 0) return;
                track.xy.x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                track.xy.y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
                applyTrackFilter(track); drawXY(xyCanvas, track, true);
            };
            xyCont.onmousedown = (e) => {
                if (isPatching) return; e.preventDefault(); xyCont.classList.add('active'); updateXY(e);
                const onMove = (me) => updateXY(me);
                const onUp = (ue) => { xyCont.classList.remove('active'); updateXY(ue); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); applyTrackFilter(track); drawXY(xyCanvas, track, false); };
                window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
            };
        }


        function renderFxPanels() {
            const container = document.getElementById('fx-aside');
            if (!container) return;
            container.innerHTML = '';

            const masterHeader = document.createElement('div');
            masterHeader.className = 'panel-header';
            masterHeader.textContent = 'MASTER OUT';
            masterHeader.setAttribute('data-tooltip-title', 'Master Output');
            masterHeader.setAttribute('data-tooltip', 'Final stage of the signal chain. Monitored by the spectrogram to the left.');
            container.appendChild(masterHeader);

            state.fxUnits.forEach((unit, idx) => {
                const panel = document.createElement('div');
                panel.className = 'panel fx-panel';
                panel.style.marginBottom = '12px';

                const typeOptions = [
                    { val: 'delay', label: 'DELAY' },
                    { val: 'tape_echo', label: 'TAPE ECHO' },
                    { val: 'chorus', label: 'CHORUS' },
                    { val: 'vibrato', label: 'VIBRATO' },
                    { val: 'distortion', label: 'DISTORTION' },
                    { val: 'overdrive', label: 'OVERDRIVE' },
                    { val: 'bitcrusher', label: 'BITCRUSH' },
                    { val: 'compressor', label: 'COMPRESSOR' },
                    { val: 'reverb', label: 'REVERB' },
                    { val: 'eq', label: 'EQ' },
                    { val: 'sidechain', label: 'SIDECHAIN' }
                ];

                const typeSelect = document.createElement('select');
                typeSelect.className = 'fx-type-select';
                typeSelect.style.cssText = 'background:var(--surface); color:var(--accent-cyan); font-weight:800; border:1px solid var(--glass-border); padding:3px 6px; border-radius:4px; font-size:0.65rem;';
                setTooltip(typeSelect, 'FX Pedal Type', 'Choose which effect algorithm this pedal uses.');

                typeOptions.forEach(opt => {
                    const optionEl = document.createElement('option');
                    optionEl.value = opt.val;
                    optionEl.textContent = opt.label;
                    if (unit.type === opt.val) optionEl.selected = true;
                    typeSelect.appendChild(optionEl);
                });

                const panelHeader = document.createElement('div');
                panelHeader.className = 'panel-header fx-panel-header';
                panelHeader.style.cssText = 'border-bottom: 1px solid var(--glass-border); cursor:pointer;';

                panel.ondblclick = (e) => {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.classList.contains('patch-point')) return;
                    unit.minimized = !unit.minimized;
                    renderFxPanels();
                };

                const fxMinBtn = document.createElement('button');
                fxMinBtn.type = 'button';
                fxMinBtn.className = 'track-min-btn';
                fxMinBtn.classList.toggle('is-minimized', !!unit.minimized);
                fxMinBtn.setAttribute('aria-label', unit.minimized ? 'Restore FX pedal' : 'Minimize FX pedal');
                fxMinBtn.setAttribute('data-tooltip-title', unit.minimized ? 'Restore FX Pedal' : 'Minimize FX Pedal');
                fxMinBtn.setAttribute('data-tooltip', unit.minimized ? 'Expand this FX pedal to show its controls.' : 'Collapse this FX pedal while keeping its audio routing active.');
                fxMinBtn.onclick = (e) => {
                    e.stopPropagation();
                    unit.minimized = !unit.minimized;
                    renderFxPanels();
                };

                const patchIn = document.createElement('div');
                patchIn.className = 'patch-point audio-in';
                patchIn.id = `audio_in_${unit.id}`;
                patchIn.style.borderColor = 'var(--accent-purple)';
                patchIn.setAttribute('data-tooltip-title', 'FX Input');
                patchIn.setAttribute('data-tooltip', 'Drop an instrument or another FX pedal output here.');

                const patchOut = document.createElement('div');
                patchOut.className = `patch-point audio-out ${unit.audioRoute !== 'master' ? 'active' : ''}`;
                patchOut.id = `audio_out_${unit.id}`;
            patchOut.style.borderColor = 'var(--accent-yellow)';
                patchOut.setAttribute('data-tooltip-title', 'FX Output');
                patchOut.setAttribute('data-tooltip', 'Drag to another FX input to chain pedals. Drop elsewhere to send this pedal back to MASTER OUT.');
                patchOut.onmousedown = (e) => {
                    e.stopPropagation();
                    isPatching = true;
                    patchingFxOutId = unit.id;
                    activeCable.style.stroke = '#00f2ff';
                    activeCable.style.display = 'block';
                    document.querySelectorAll('.audio-in').forEach(el => {
                        const targetId = el.id.replace('audio_in_', '');
                        if (targetId !== unit.id && !wouldCreateFxCycle(unit.id, targetId)) {
                            el.classList.add('mod-port-target');
                        }
                    });
                };

                const spanIdx = document.createElement('span');
                spanIdx.className = 'fx-panel-index';
                spanIdx.textContent = `#${idx + 1}`;

                const resetBtn = document.createElement('button');
                resetBtn.textContent = '↺'; resetBtn.className = 'btn fx-reset-btn';
                resetBtn.setAttribute('data-tooltip-title', 'Reset Defaults');
                resetBtn.setAttribute('data-tooltip', 'Restore this FX pedal parameters to their defaults.');
                resetBtn.onclick = (e) => { e.stopPropagation(); unit.params = JSON.parse(JSON.stringify(fxDefaults[unit.type] || {})); renderFxPanels(); updateFxParams(unit, panel); };

                typeSelect.onclick = (e) => e.stopPropagation();
                typeSelect.ondblclick = (e) => e.stopPropagation();
                panelHeader.appendChild(fxMinBtn);
                panelHeader.appendChild(patchIn);
                panelHeader.appendChild(typeSelect);
                panelHeader.appendChild(resetBtn);
                panelHeader.appendChild(spanIdx);
                panelHeader.appendChild(patchOut);

                const controlsCont = document.createElement('div');
                controlsCont.className = 'panel-content fx-controls';
                controlsCont.style.cssText = 'height: auto; padding: 10px; display:flex; flex-direction:column; gap:8px;';

                panel.appendChild(panelHeader);
                if (!unit.minimized) panel.appendChild(controlsCont);

                typeSelect.onchange = (e) => {
                    unit.type = e.target.value;
                    setupFxNodes(unit);
                    renderFxPanels();
                    renderMixerStrips();
                };

                // Render dynamic controls
                const renderSlider = (label, key, min, max, step, helpText = '', suffix = '') => {
                    const row = document.createElement('div');
                    row.className = 'slider-group';
                    if (helpText) {
                        row.setAttribute('data-tooltip-title', label);
                        row.setAttribute('data-tooltip', helpText);
                    }

                    const spanLabel = document.createElement('span');
                    spanLabel.className = 'label';
                    spanLabel.style.width = '50px';
                    spanLabel.style.fontSize = '0.6rem';
                    spanLabel.textContent = label;

                    const input = document.createElement('input');
                    input.type = 'range';
                    input.min = min;
                    input.max = max;
                    input.step = step;
                    input.value = unit.params[key];
                    input.style.flex = '1';

                    const disp = document.createElement('span');
                    disp.className = 'val-disp label';
                    disp.style.width = '40px';
                    disp.style.textAlign = 'right';
                    disp.style.fontSize = '0.6rem';
                    disp.style.color = 'var(--accent-cyan)';
                    disp.textContent = unit.params[key] + suffix;

                    row.appendChild(spanLabel);
                    row.appendChild(input);
                    row.appendChild(disp);

                    input.oninput = (e) => {
                        unit.params[key] = parseFloat(e.target.value);
                        disp.textContent = unit.params[key] + suffix;
                        if (key === 'size') updateReverbImpulse(unit);
                        updateFxParams(unit, panel);
                    };
                    input.onmousedown = (e) => { e.stopPropagation(); pushUndo(); };
                    controlsCont.appendChild(row);
                };

                const type = unit.type;
                switch (type) {
                    case 'delay':
                    case 'tape_echo':
                        if (!unit.params.sync) renderSlider('TIME', 'time', 0.01, 2.0, 0.01, 'Delay time in seconds (or sync divisions).', 's');
                        renderSlider('FDBK', 'feedback', 0, 0.95, 0.01, 'Feedback amount (echo repeats).');
                        break;
                    case 'chorus':
                    case 'vibrato':
                        if (!unit.params.sync) renderSlider('RATE', 'rate', 0.1, 10, 0.1, 'LFO modulation speed.', 'Hz');
                        renderSlider('DEPTH', 'depth', 0.0001, 0.01, 0.0001, 'Modulation intensity.');
                        break;
                    case 'distortion':
                    case 'overdrive':
                        renderSlider('DRIVE', 'drive', 0, 1, 0.01, 'Saturation intensity.');
                        renderSlider('TONE', 'tone', 0, 1, 0.01, 'Filter brightness.');
                        break;
                    case 'bitcrusher':
                        renderSlider('BITS', 'bits', 1, 16, 1, 'Audio bit depth.');
                        break;
                    case 'compressor':
                        renderSlider('THRESH', 'threshold', -60, 0, 1, 'Input level where compression begins.', 'dB');
                        renderSlider('RATIO', 'ratio', 1, 20, 1, 'Intensity of the compression.');
                        if (!unit.params.sync) renderSlider('REL', 'release', 0.01, 1.0, 0.01, 'Speed at which gain reduction stops.', 's');
                        break;
                    case 'reverb':
                        if (!unit.params.sync) renderSlider('SIZE', 'size', 0.1, 1, 0.05, 'Size of the virtual acoustic space.');
                        break;
                    case 'sidechain':
                        renderSlider('DEPTH', 'depth', 0, 1, 0.01, 'Intensity of the pump effect.');
                        if (!unit.params.sync) renderSlider('REL', 'release', 0.05, 1.0, 0.05, 'Recovery speed after the pump.', 's');
                        break;
                    case 'eq':
                        renderSlider('LOW', 'low', -24, 24, 1, 'Low frequencies gain.', 'dB');
                        renderSlider('MID', 'mid', -24, 24, 1, 'Mid frequencies gain.', 'dB');
                        renderSlider('HIGH', 'high', -24, 24, 1, 'High frequencies gain.', 'dB');
                        break;
                }

                renderSlider('MIX', 'mix', 0, 1, 0.05, 'Dry/Wet balance.');

                // Add Sync Toggle (if not already handled by specific types above)
                const syncParams = { delay: 1, tape_echo: 1, chorus: 1, vibrato: 1, sidechain: 1, compressor: 1, reverb: 1 };
                if (syncParams[type]) {
                    const syncRow = document.createElement('div');
                    syncRow.style.marginTop = '4px';
                    setTooltip(syncRow, 'Tempo Sync', 'Lock time-based effect parameters to the global BPM.');

                    const labelSync = document.createElement('label');
                    labelSync.style.cssText = 'font-family:var(--font-mono); font-size:0.6rem; color:var(--control-label); display:flex; align-items:center; gap:8px; cursor:pointer;';

                    const syncChk = document.createElement('input');
                    syncChk.type = 'checkbox';
                    syncChk.className = 'fx-sync-chk';
                    syncChk.checked = !!unit.params.sync;

                    labelSync.appendChild(syncChk);
                    labelSync.appendChild(document.createTextNode(' SYNC TO BPM'));
                    syncRow.appendChild(labelSync);

                    syncChk.onchange = (e) => {
                        pushUndo();
                        unit.params.sync = e.target.checked;
                        renderFxPanels();
                        updateFxParams(unit, panel);
                    };
                    controlsCont.insertBefore(syncRow, controlsCont.firstChild);

                    if (unit.params.sync) {
                        const row = document.createElement('div');
                        row.className = 'slider-group';

                        const spanDiv = document.createElement('span');
                        spanDiv.className = 'label';
                        spanDiv.style.width = '50px';
                        spanDiv.style.fontSize = '0.6rem';
                        spanDiv.textContent = 'DIV';

                    const syncS = document.createElement('select');
                    syncS.className = 'fx-sync-select';
                    syncS.style.cssText = 'flex:1; font-size:0.65rem; background:var(--surface); color:var(--text-main); border:1px solid var(--glass-border);';
                    setTooltip(syncS, 'Sync Division', 'Choose the beat division used when this FX pedal is synced to BPM.');

                        const rateOptions = [
                            { val: 4, label: '1/1 (Whole)' },
                            { val: 2, label: '1/2 (Half)' },
                            { val: 3, label: '1/2D (Dotted)' },
                            { val: 1.333, label: '1/2T (Triplet)' },
                            { val: 1, label: '1/4' },
                            { val: 1.5, label: '1/4D' },
                            { val: 0.666, label: '1/4T' },
                            { val: 0.5, label: '1/8' },
                            { val: 0.75, label: '1/8D' },
                            { val: 0.333, label: '1/8T' },
                            { val: 0.25, label: '1/16' }
                        ];

                        rateOptions.forEach(opt => {
                            const optionEl = document.createElement('option');
                            optionEl.value = opt.val;
                            optionEl.textContent = opt.label;
                            if (unit.params.syncRate === opt.val) optionEl.selected = true;
                            syncS.appendChild(optionEl);
                        });

                        row.appendChild(spanDiv);
                        row.appendChild(syncS);

                        syncS.onchange = (e) => {
                            unit.params.syncRate = parseFloat(e.target.value);
                            updateFxParams(unit, panel);
                        };
                        controlsCont.insertBefore(row, syncRow.nextSibling);
                    }
                }

                container.appendChild(panel);
            });

            const addFxBtn = document.createElement('button');
            addFxBtn.className = 'add-fx-btn';
            addFxBtn.innerHTML = '<span>+</span> ADD FX PEDAL';
            addFxBtn.setAttribute('data-tooltip-title', 'Add FX Pedal');
            addFxBtn.setAttribute('data-tooltip', 'Create a new delay pedal. Use its input and output jacks to build an effects chain.');
            addFxBtn.onclick = () => {
                pushUndo();
                state.fxUnits.push(createFxUnit('delay'));
                refreshLookupMap();
                renderFxPanels();
                renderMixerStrips();
                container.scrollTop = container.scrollHeight;
            };
            container.appendChild(addFxBtn);
            updateCableElementCache();
            updateFixedCables();
        }
        // renderFxPanels(); // Called in window.onload

        renderBeatCounter();

        // --- Scene Management ---
        function saveScene(idx) {
            state.scenes[idx] = {
                tracks: state.tracks.map(t => serializeTrack(t, { includeId: false, includeMinimized: false })),
                fx: state.fxUnits.map(u => ({
                    type: u.type,
                    params: JSON.parse(JSON.stringify(u.params)),
                    audioRoute: u.audioRoute || 'master',
                    outputGain: u.outputGain ?? 0.75
                })),
                bpm: state.bpm,
                key: state.globalKey,
                scale: state.globalScale
            };
            renderScenes();
        }

        function loadScene(idx) {
            if (!state.scenes[idx]) return;
            const scene = state.scenes[idx];

            // 1. Restore Tracks
            scene.tracks.forEach((trackData, i) => {
                if (i < state.tracks.length) {
                    applyTrackData(state.tracks[i], trackData, { includeId: false, includeMinimized: false });
                }
            });

            // 2. Restore FX
            if (scene.fx) {
                scene.fx.forEach((fxData, i) => {
                    if (i < state.fxUnits.length) {
                        const u = state.fxUnits[i];
                        if (u.type !== fxData.type) {
                            u.type = fxData.type;
                            setupFxNodes(u);
                        }
                        u.params = JSON.parse(JSON.stringify(fxData.params));
                        u.audioRoute = fxData.audioRoute || 'master';
                        u.outputGain = fxData.outputGain ?? u.outputGain ?? 0.75;
                        updateFxParams(u, null);
                    }
                });
            }

            // 3. Restore Global BPM/Key/Scale
            if (scene.bpm) {
                state.bpm = scene.bpm;
                toneBridge.setBpm(state.bpm);
                document.getElementById('bpm-input').value = state.bpm;
            }
            if (scene.key) {
                state.globalKey = scene.key;
                document.getElementById('key-input').value = state.globalKey;
            }
            if (scene.scale) {
                state.globalScale = scene.scale;
                document.getElementById('scale-input').value = state.globalScale;
            }

            changeScale();
            routeAllAudioConnections();
            renderTracks();
            renderFxPanels();
            renderScenes();
        }

        function renderScenes() {
            const cont = document.getElementById('scene-container');
            if (!cont) return;
            cont.textContent = '';
            for (let i = 0; i < 8; i++) {
                const btn = document.createElement('button');
                btn.textContent = i + 1;
                btn.style.width = '20px'; btn.style.padding = '0';
                if (state.scenes[i]) {
                    btn.style.borderColor = 'var(--accent-cyan)';
                    btn.style.color = 'var(--accent-cyan)';
                }
                btn.onclick = (e) => {
                    if (e.shiftKey) saveScene(i);
                    else loadScene(i);
                };
                btn.setAttribute('data-tooltip-title', `Scene ${i + 1}`);
                btn.setAttribute('data-tooltip', 'Click to load this scene. Shift-click to save the current state here.');
                btn.setAttribute('data-tooltip-hotkey', 'Click: load / Shift+Click: save');
                cont.appendChild(btn);
            }
        }
        setTimeout(renderScenes, 100);

        // --- Euclidean Rhythm Helper ---
        function getEuclidean(k, n) {
            let groups = [];
            for (let i = 0; i < n; i++) groups.push([i < k ? 1 : 0]);
            while (n > 1) {
                let m = Math.min(k, n - k);
                if (m === 0) break;
                for (let i = 0; i < m; i++) groups[i] = groups[i].concat(groups.pop());
                n -= m;
            }
            return groups.flat();
        }

        function fillTrackPattern(track) {
            const currentTrackSubdiv = track.subdiv || 4;
            const baseSteps = Math.round(state.timeSignature * currentTrackSubdiv);
            const totalStepsInLoop = Math.min(256, baseSteps * (track.loopMultiplier || 1));
            track.grid.forEach((row) => {
                const pattern = row.slice(0, baseSteps);
                for (let i = baseSteps; i < totalStepsInLoop; i++) {
                    const src = pattern[i % baseSteps];
                    row[i] = (typeof src === 'object' && src !== null) ? { ...src } : src;
                }
            });
        }

        function randomizeTrack(track) {
            pushUndo();
            const template = instrumentTypes[track.typeId];
            const currentTrackSubdiv = track.subdiv || 4;
            const stepsPerMeasure = Math.round(state.timeSignature * currentTrackSubdiv);
            const steps = (track.loopMultiplier || 1) * stepsPerMeasure;
            const style = track.randStyle || 'musical';
            const dens = track.randDensity || 0.5;
            const spread = track.randSpread !== undefined ? track.randSpread : 0.5;
            const randMode = track.randMode || 'replace';
            const rl = track.randNoteLen || 0;
            const rj = track.randJitter || 0;
            const rg = track.randGliss || 0;

            // Clear current grid if in replace mode
            if (randMode === 'replace') {
                for (let r = 0; r < track.grid.length; r++) {
                    for (let s = 0; s < 256; s++) track.grid[r][s] = false;
                }
            }

            const getRandRow = () => {
                const center = Math.floor(track.grid.length / 2);
                const span = Math.max(1, Math.floor(track.grid.length * spread));
                const r = Math.floor(center - span / 2 + Math.random() * span);
                return Math.max(0, Math.min(track.grid.length - 1, r));
            };
            const tonalRandomizerRows = template.type === 'synth' ? getTonalRandomizerRows(track, spread) : [];
            const getMusicalRandRow = () => {
                if (tonalRandomizerRows.length > 0 && Math.random() < tonalSettings.randomizerChordToneWeight) {
                    return tonalRandomizerRows[Math.floor(Math.random() * tonalRandomizerRows.length)];
                }
                return getRandRow();
            };

            const getRandNoteData = (isOn) => {
                if (!isOn) return false;
                const isDrum = template.type === 'drum';
                const length = isDrum ? 1.0 : (1.0 + (Math.random() * 2 - 1) * rl * 0.75);
                const jitter = (Math.random() * 2 - 1) * rj * 0.1; // up to 10% step duration
                const gliss = isDrum ? 0 : (Math.random() < rg * 0.5 ? (Math.random() * 2 - 1) * rg * 12 : 0); // up to 1 octave gliss
                return { on: true, length: Math.max(0.25, length), jitter, gliss };
            };
            const clampProbability = (value) => Math.max(0, Math.min(0.98, value));
            const isRowKind = (rowName, kind) => {
                const normalized = rowName.toLowerCase();
                if (kind === 'kick') return normalized.includes('kick');
                if (kind === 'snare') return normalized.includes('snare');
                if (kind === 'closedHat') return normalized.includes('chat') || (normalized.includes('hat') && !normalized.includes('open') && !normalized.includes('ohat'));
                if (kind === 'openHat') return normalized.includes('ohat') || (normalized.includes('open') && normalized.includes('hat'));
                if (kind === 'clap') return normalized.includes('clap');
                return false;
            };

            switch (style) {
                case 'chaotic':
                    if (template.type === 'drum') {
                        template.rows.forEach((rowName, rIdx) => {
                            for (let s = 0; s < steps; s++) if (Math.random() < dens * 0.4) track.grid[rIdx][s] = getRandNoteData(true);
                        });
                    } else {
                        for (let s = 0; s < steps; s++) if (Math.random() < dens * 0.3) track.grid[getRandRow()][s] = getRandNoteData(true);
                    }
                    break;
                case 'euclidean':
                    const k = Math.max(1, Math.floor(steps * dens * 0.8));
                    const pattern = getEuclidean(k, steps);
                    const rIdx = getRandRow();
                    pattern.forEach((val, s) => { if (val) track.grid[rIdx][s] = getRandNoteData(true); });
                    break;
                case 'acid':
                    if (template.type === 'synth') {
                        let lastR = Math.floor(track.grid.length / 2);
                        const rootNoteR = track.grid.length - 1;
                        for (let s = 0; s < steps; s++) {
                            if (Math.random() < dens * 0.7) {
                                let r = lastR;
                                if (Math.random() > 0.7) r = Math.max(0, Math.min(track.grid.length - 1, lastR + Math.floor(Math.random() * 7) - 3));
                                else if (Math.random() > 0.8) r = rootNoteR;
                                const isSlide = Math.random() > 0.6;
                                const data = getRandNoteData(true);
                                data.length = isSlide ? 2.0 : data.length;
                                track.grid[r][s] = data;
                                lastR = r;
                                if (isSlide) s++;
                            }
                        }
                    }
                    break;
                case 'musical':
                default:
                    if (template.type === 'drum') {
                        const beatStep = Math.max(1, currentTrackSubdiv);
                        const eighthStep = Math.max(1, Math.round(currentTrackSubdiv / 2));
                        const strongBeatProb = clampProbability(0.35 + dens * 1.25);
                        const supportBeatProb = clampProbability(0.12 + dens * 0.6);
                        const upbeatHatProb = clampProbability(0.30 + dens * 0.95);
                        const downbeatHatProb = clampProbability(0.08 + dens * 0.35);
                        const ghostProb = clampProbability(dens * 0.12);

                        template.rows.forEach((rowName, rIdx) => {
                            const drumName = getTrackRowDrumName(track, rIdx);
                            if (isRowKind(drumName, 'kick')) {
                                for (let s = 0; s < steps; s++) {
                                    const beat = Math.floor((s % stepsPerMeasure) / beatStep);
                                    const onBeat = s % beatStep === 0;
                                    const onUpbeat = s % beatStep === eighthStep;
                                    if (onBeat && (beat === 0 || beat === 2) && Math.random() < strongBeatProb) track.grid[rIdx][s] = getRandNoteData(true);
                                    else if (onBeat && Math.random() < supportBeatProb) track.grid[rIdx][s] = getRandNoteData(true);
                                    else if (onUpbeat && Math.random() < ghostProb) track.grid[rIdx][s] = getRandNoteData(true);
                                }
                            } else if (isRowKind(drumName, 'snare')) {
                                for (let s = 0; s < steps; s++) {
                                    const beat = Math.floor((s % stepsPerMeasure) / beatStep);
                                    const onBeat = s % beatStep === 0;
                                    const nearBackbeat = s % beatStep === Math.max(1, beatStep - 1);
                                    if (onBeat && (beat === 1 || beat === 3) && Math.random() < strongBeatProb) track.grid[rIdx][s] = getRandNoteData(true);
                                    else if (nearBackbeat && Math.random() < ghostProb) track.grid[rIdx][s] = getRandNoteData(true);
                                }
                            } else if (isRowKind(drumName, 'closedHat')) {
                                for (let s = 0; s < steps; s++) {
                                    const onUpbeat = s % beatStep === eighthStep;
                                    const onBeat = s % beatStep === 0;
                                    if (onUpbeat && Math.random() < upbeatHatProb) track.grid[rIdx][s] = getRandNoteData(true);
                                    else if (onBeat && Math.random() < downbeatHatProb) track.grid[rIdx][s] = getRandNoteData(true);
                                }
                            } else if (isRowKind(drumName, 'openHat')) {
                                for (let s = 0; s < steps; s++) {
                                    const beat = Math.floor((s % stepsPerMeasure) / beatStep);
                                    const onUpbeat = s % beatStep === eighthStep;
                                    if (onUpbeat && (beat === 1 || beat === 3) && Math.random() < dens * 0.18) track.grid[rIdx][s] = getRandNoteData(true);
                                }
                            } else if (isRowKind(drumName, 'clap')) {
                                for (let s = 0; s < steps; s++) {
                                    const beat = Math.floor((s % stepsPerMeasure) / beatStep);
                                    if (s % beatStep === 0 && (beat === 1 || beat === 3) && Math.random() < dens * 0.18) track.grid[rIdx][s] = getRandNoteData(true);
                                }
                            } else {
                                for (let s = 0; s < steps; s++) if (Math.random() < dens * 0.035) track.grid[rIdx][s] = getRandNoteData(true);
                            }
                        });
                    } else {
                        const motifLen = Math.random() > 0.5 ? 4 : 8;
                        const motifRhythm = Array(motifLen).fill().map(() => Math.random() < dens * 0.6);
                        const motifNotes = Array(motifLen).fill().map(() => getMusicalRandRow());
                        for (let s = 0; s < steps; s++) if (motifRhythm[s % motifLen]) track.grid[motifNotes[s % motifLen]][s] = getRandNoteData(true);
                    }
                    break;
            }
            markTrackGridDirty(track);
            updateTrackGrid(track);
        }

        // --- Mixer Board ---
        const mixerStripCache = new Map();
        const fxMixerStripCache = new Map();

        function renderMixerStrips() {
            const container = document.getElementById('mixer-strip-container');
            if (!container) return;

            const orderedStrips = [];

            state.tracks.forEach((track, idx) => {
                let strip = mixerStripCache.get(track.id);
                if (!strip || strip.dataset.typeId !== track.typeId) {
                    strip = createMixerStrip(track, idx);
                    mixerStripCache.set(track.id, strip);
                } else {
                    updateMixerStrip(strip, track, idx);
                }
                orderedStrips.push(strip);
            });

            state.fxUnits.forEach((unit, idx) => {
                let strip = fxMixerStripCache.get(unit.id);
                if (!strip || strip.dataset.fxType !== unit.type) {
                    strip = createFxMixerStrip(unit, idx);
                    fxMixerStripCache.set(unit.id, strip);
                } else {
                    updateFxMixerStrip(strip, unit, idx);
                }
                orderedStrips.push(strip);
            });

            orderedStrips.forEach((strip, idx) => {
                if (container.children[idx] !== strip) {
                    container.insertBefore(strip, container.children[idx] || null);
                }
            });

            Array.from(container.children).forEach(child => {
                if (child.classList.contains('mixer-strip') && !orderedStrips.includes(child)) child.remove();
            });

            const trackIds = new Set(state.tracks.map(t => t.id));
            for (const id of mixerStripCache.keys()) {
                if (!trackIds.has(id)) mixerStripCache.delete(id);
            }

            const fxIds = new Set(state.fxUnits.map(u => u.id));
            for (const id of fxMixerStripCache.keys()) {
                if (!fxIds.has(id)) fxMixerStripCache.delete(id);
            }
        }

        function updateMixerMeterFill(fill, percent) {
            if (!fill) return;
            const level = Math.max(0, Math.min(100, percent || 0));
            fill.style.height = level + '%';
            fill.style.opacity = level > 1 ? '0.65' : '0.25';
        }

        function createMixerStrip(track, idx) {
            const strip = document.createElement('div');
            strip.id = `strip_${track.id}`;
            strip.dataset.typeId = track.typeId;
            const isPerc = track.typeId === 'drumSet' || track.typeId === 'auxPerc';
            strip.style.setProperty('--strip-color', isPerc ? 'var(--accent-yellow)' : 'var(--accent-pink)');

            const label = document.createElement('div');
            label.className = 'mixer-label';
            label.textContent = instrumentTypes[track.typeId].name.substring(0, 3).toUpperCase();

            const sliderWrap = document.createElement('div');
            sliderWrap.className = 'mixer-slider-wrap';
            const meterFill = document.createElement('div');
            meterFill.className = 'mixer-meter-fill';
            track.mixerMeterFill = meterFill;

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.orient = 'vertical';
            slider.min = '0';
            slider.max = '1.5';
            slider.step = '0.01';
            slider.value = track.mixerGain ?? 0.75;

            const valDisp = document.createElement('div');
            valDisp.className = 'mixer-val';
            valDisp.textContent = (20 * Math.log10(Math.max(0.001, track.mixerGain ?? 0.75))).toFixed(1) + 'dB';

            slider.oninput = (e) => {
                track.mixerGain = parseFloat(e.target.value);
                if (track.mixerGainNode) track.mixerGainNode.gain.setTargetAtTime(track.mixerGain, audioCtx.currentTime, 0.05);
                valDisp.textContent = (20 * Math.log10(Math.max(0.001, track.mixerGain))).toFixed(1) + 'dB';
            };
            slider.setAttribute('data-tooltip-title', `${instrumentTypes[track.typeId].name} Volume`);
            slider.setAttribute('data-tooltip', 'Final output gain for this track after all effects.');

            sliderWrap.append(meterFill, slider);
            strip.append(label, sliderWrap, valDisp);
            updateMixerStrip(strip, track, idx);
            return strip;
        }

        function updateMixerStrip(strip, track, idx) {
            strip.className = `mixer-strip ${track.muted ? 'muted' : ''} ${track.solo ? 'solo' : ''} ${state.activeTrackId === idx ? 'selected' : ''}`;
            strip.onclick = () => selectTrack(idx);
            track.mixerMeterFill = strip.querySelector('.mixer-meter-fill');

            const slider = strip.querySelector('input[type="range"]');
            if (slider && document.activeElement !== slider) slider.value = track.mixerGain ?? 0.75;

            const valDisp = strip.querySelector('.mixer-val');
            if (valDisp) valDisp.textContent = (20 * Math.log10(Math.max(0.001, track.mixerGain ?? 0.75))).toFixed(1) + 'dB';
        }

        function createFxMixerStrip(unit, idx) {
            const strip = document.createElement('div');
            strip.id = `fx_strip_${unit.id}`;
            strip.dataset.fxType = unit.type;
            strip.className = 'mixer-strip fx-strip';
            strip.style.setProperty('--strip-color', 'var(--accent-cyan)');

            const label = document.createElement('div');
            label.className = 'mixer-label';
            label.textContent = unit.type.substring(0, 3).toUpperCase();

            const sliderWrap = document.createElement('div');
            sliderWrap.className = 'mixer-slider-wrap';
            const meterFill = document.createElement('div');
            meterFill.className = 'mixer-meter-fill';
            unit.mixerMeterFill = meterFill;

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.orient = 'vertical';
            slider.min = '0';
            slider.max = '1.5';
            slider.step = '0.01';
            slider.value = unit.outputGain ?? 0.75;
            slider.setAttribute('data-tooltip-title', `${unit.type.toUpperCase()} Return`);
            slider.setAttribute('data-tooltip', 'Final output gain for this effect return.');

            const valDisp = document.createElement('div');
            valDisp.className = 'mixer-val';

            slider.oninput = (e) => {
                unit.outputGain = parseFloat(e.target.value);
                unit.wet.gain.setTargetAtTime(unit.outputGain * (unit.params.mix || 0.5), audioCtx.currentTime, 0.05);
                valDisp.textContent = (20 * Math.log10(Math.max(0.001, unit.outputGain))).toFixed(1) + 'dB';
            };

            sliderWrap.append(meterFill, slider);
            strip.append(label, sliderWrap, valDisp);
            updateFxMixerStrip(strip, unit, idx);
            return strip;
        }

        function updateFxMixerStrip(strip, unit) {
            strip.className = 'mixer-strip fx-strip';
            strip.dataset.fxType = unit.type;
            unit.mixerMeterFill = strip.querySelector('.mixer-meter-fill');
            const label = strip.querySelector('.mixer-label');
            if (label) label.textContent = unit.type.substring(0, 3).toUpperCase();

            const slider = strip.querySelector('input[type="range"]');
            if (slider && document.activeElement !== slider) slider.value = unit.outputGain ?? 0.75;

            const valDisp = strip.querySelector('.mixer-val');
            if (valDisp) valDisp.textContent = (20 * Math.log10(Math.max(0.001, unit.outputGain ?? 0.75))).toFixed(1) + 'dB';
        }

        // --- Cable Patching System ---
        const activeCable = document.getElementById('active-cable');
        let isDraggingBpm = false, startBpmY = 0, startBpmVal = 120;

        function getCenter(el) {
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return null;
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
        function drawBezier(pathEl, p1, p2) {
            pathEl.setAttribute('d', `M ${p1.x} ${p1.y} C ${p1.x + 100} ${p1.y}, ${p2.x - 100} ${p2.y}, ${p2.x} ${p2.y}`);
        }

        // --- Patch Sound Effect ---
        function playPatchSound(isConnect) {
            const ctx = audioCtx;
            // Resume context if suspended (required by browser autoplay policy)
            const play = () => {
                try {
                    const now = ctx.currentTime;

                    // Electrical buzz burst
                    const bufLen = Math.floor(ctx.sampleRate * 0.05);
                    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
                    const data = buf.getChannelData(0);
                    for (let i = 0; i < bufLen; i++) {
                        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 6);
                    }
                    const noise = ctx.createBufferSource();
                    noise.buffer = buf;

                    const bp = ctx.createBiquadFilter();
                    bp.type = 'bandpass';
                    bp.frequency.value = isConnect ? 3200 : 1800;
                    bp.Q.value = 0.8;

                    const gainNode = ctx.createGain();
                    gainNode.gain.setValueAtTime(isConnect ? 0.35 : 0.25, now);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

                    noise.connect(bp);
                    bp.connect(gainNode);
                    gainNode.connect(masterGain);
                    noise.start(now);
                    noise.stop(now + 0.07);

                    // Mechanical body thump
                    const osc = ctx.createOscillator();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(isConnect ? 220 : 150, now);
                    osc.frequency.exponentialRampToValueAtTime(isConnect ? 80 : 60, now + 0.04);
                    const oscGain = ctx.createGain();
                    oscGain.gain.setValueAtTime(isConnect ? 0.3 : 0.2, now);
                    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                    osc.connect(oscGain);
                    oscGain.connect(masterGain);
                    osc.start(now);
                    osc.stop(now + 0.06);
                } catch (e) { console.warn('playPatchSound error:', e); }
            };

            if (ctx.state === 'suspended') {
                ctx.resume().then(play);
            } else {
                play();
            }
        }

        const resizerLeft = document.getElementById('resizer-left');
        const leftSidebar = document.querySelector('.left-sidebar');
        let isResizingLeft = false;
        if (resizerLeft) {
            resizerLeft.addEventListener('mousedown', () => { isResizingLeft = true; resizerLeft.classList.add('dragging'); document.body.style.cursor = 'col-resize'; });
        }

        const resizerRight = document.getElementById('resizer-right');
        const rightSidebar = document.querySelector('aside');
        let isResizingRight = false;
        let patchingMidiOutId = null;
        if (resizerRight) {
            resizerRight.addEventListener('mousedown', () => { isResizingRight = true; resizerRight.classList.add('dragging'); document.body.style.cursor = 'col-resize'; });
        }

        window.addEventListener('mousemove', (e) => {
            if (isDraggingBpm) {
                const delta = startBpmY - e.clientY;
                let newBpm = Math.max(40, Math.min(240, startBpmVal + Math.floor(delta / 2)));
                bpmInput.value = newBpm;
                state.bpm = newBpm;
                toneBridge.setBpm(state.bpm);
            }
            if (isResizingLeft) {
                const newWidth = e.clientX;
                if (newWidth > 150 && newWidth < window.innerWidth - 400) {
                    leftSidebar.style.width = newWidth + 'px';
                    // Update drawer canvases without rebuilding DOM
                    document.querySelectorAll('.drawer-panel').forEach((panel, idx) => {
                        const canvas = panel.querySelector('.drawer-canvas');
                        if (canvas) {
                            canvas.width = canvas.offsetWidth;
                            canvas.height = canvas.offsetHeight;
                            const drawer = state.drawers[idx];
                            if (drawer) drawDrawer(canvas, drawer);
                        }
                    });
                }
                updateFixedCables();
            } else if (isResizingRight) {
                const newWidth = window.innerWidth - e.clientX;
                if (newWidth > 200 && newWidth < window.innerWidth - 400) rightSidebar.style.width = newWidth + 'px';
                updateFixedCables();
            }

            if (isPatching) {
                if (patchingDrawerId) {
                    const outEl = document.getElementById(`out_${patchingDrawerId}`);
                    if (outEl && activeCable) drawBezier(activeCable, getCenter(outEl), { x: e.clientX, y: e.clientY });
                } else if (patchingAudioOutId) {
                    const outEl = document.getElementById(`audio_out_${patchingAudioOutId}`);
                    if (outEl && activeCable) drawBezier(activeCable, getCenter(outEl), { x: e.clientX, y: e.clientY });
                } else if (patchingFxOutId) {
                    const outEl = document.getElementById(`audio_out_${patchingFxOutId}`);
                    if (outEl && activeCable) drawBezier(activeCable, getCenter(outEl), { x: e.clientX, y: e.clientY });
                } else if (patchingMidiOutId) {
                    const outEl = document.getElementById(`midi_out_${patchingMidiOutId}`);
                    if (outEl && activeCable) drawBezier(activeCable, getCenter(outEl), { x: e.clientX, y: e.clientY });
                }
            }
        });

        // --- Patch Routing Helpers ---
        // Add a new entry here to support any future modulation target; both
        // connectDrawerPatch and disconnectDrawerPatch pick it up automatically.
        const MOD_LINK_PREFIXES = [
            { prefix: 'mod_x_', key: 'x' },
            { prefix: 'mod_y_', key: 'y' },
            { prefix: 'mod_decay_', key: 'decay' },
            { prefix: 'mod_sustain_', key: 'sustain' },
            { prefix: 'mod_adsr_', key: 'adsr' },
            { prefix: 'mod_wobble_', key: 'wobble' }
        ];

        function connectDrawerPatch(drawer, targetId) {
            if (targetId.startsWith('drw_')) {
                const targetDrawer = state.lookup.drawers.get(targetId);
                if (targetDrawer && targetDrawer !== drawer) {
                    drawer.connection = targetId;
                    targetDrawer.modSource = drawer.id;
                }
                return;
            }
            const entry = MOD_LINK_PREFIXES.find(e => targetId.startsWith(e.prefix));
            if (entry) {
                const track = state.lookup.tracks.get(targetId.replace(entry.prefix, ''));
                if (track) {
                    drawer.connection = track.id;
                    drawer.modTarget = entry.key;
                    track.modLinks[entry.key] = drawer.id;
                }
            } else {
                drawer.connection = targetId; // fallback: direct id
            }
        }

        function disconnectDrawerPatch(drawer) {
            if (!drawer.connection) return;
            if (drawer.connection.startsWith('drw_')) {
                const prevTarget = state.lookup.drawers.get(drawer.connection);
                if (prevTarget) prevTarget.modSource = null;
            } else {
                const track = state.lookup.tracks.get(drawer.connection);
                if (track) {
                    MOD_LINK_PREFIXES.forEach(({ key }) => {
                        if (track.modLinks[key] === drawer.id) track.modLinks[key] = null;
                    });
                }
            }
            drawer.connection = null;
            drawer.modTarget = 'x';
        }

        window.addEventListener('mouseup', (e) => {
            isDraggingBpm = false;
            if (isPatching) {
                isPatching = false;
                if (activeCable) {
                    activeCable.style.display = 'none';
                    activeCable.style.stroke = '#00f2ff';
                }

                // Clear highlights
                document.querySelectorAll('.mod-port-target').forEach(el => el.classList.remove('mod-port-target'));
                document.querySelectorAll('.drawer-panel.mod-target-glow').forEach(el => el.classList.remove('mod-target-glow'));

                const target = document.elementFromPoint(e.clientX, e.clientY);

                if (patchingDrawerId) {
                    const drawer = state.lookup.drawers.get(patchingDrawerId);
                    let finalTarget = null;

                    if (target) {
                        if (target.classList.contains('mod-in')) {
                            finalTarget = target.id.replace('in_', '');
                        } else {
                            // Check if dropped on a drawer panel (or its children)
                            const panel = target.closest('.drawer-panel');
                            if (panel && panel.classList.contains('mod-target-glow')) {
                                // Find the drawer ID for this panel
                                const idx = Array.from(panel.parentNode.children).indexOf(panel);
                                const targetDrawer = state.drawers[idx];
                                if (targetDrawer) finalTarget = targetDrawer.id;
                            }
                        }
                    }

                    if (finalTarget && drawer) {
                        connectDrawerPatch(drawer, finalTarget);
                        playPatchSound(true);
                    } else if (drawer) {
                        const wasConnected = !!drawer.connection;
                        disconnectDrawerPatch(drawer);
                        if (wasConnected) playPatchSound(false);
                    }
                    patchingDrawerId = null;
                } else if (patchingAudioOutId) {
                    const track = state.lookup.tracks.get(patchingAudioOutId);
                    if (track) {
                        if (target && target.classList.contains('audio-in')) {
                            const fxUnit = state.lookup.fxUnits.get(target.id.replace('audio_in_', ''));
                            if (fxUnit) {
                                routeTrackOutput(track, fxUnit.id);
                                playPatchSound(true);
                            }
                        } else {
                            const wasRouted = track.audioRoute !== 'master';
                            routeTrackOutput(track, 'master');
                            if (wasRouted) playPatchSound(false);
                        }
                    }
                    patchingAudioOutId = null;
                } else if (patchingFxOutId) {
                    const unit = state.lookup.fxUnits.get(patchingFxOutId);
                    if (unit) {
                        if (target && target.classList.contains('audio-in')) {
                            const targetUnit = state.lookup.fxUnits.get(target.id.replace('audio_in_', ''));
                            if (targetUnit && targetUnit.id !== unit.id && !wouldCreateFxCycle(unit.id, targetUnit.id)) {
                                connectFxOutput(unit, targetUnit.id);
                                playPatchSound(true);
                            }
                        } else {
                            const wasRouted = unit.audioRoute !== 'master';
                            connectFxOutput(unit, 'master');
                            if (wasRouted) playPatchSound(false);
                        }
                    }
                    patchingFxOutId = null;
                } else if (patchingMidiOutId) {
                    const track = state.lookup.tracks.get(patchingMidiOutId);
                    if (track) {
                        if (target && target.classList.contains('midi-in')) {
                            const targetTrackId = target.id.replace('midi_in_', '');
                            if (targetTrackId !== track.id) {
                                track.midiDoublingTargetId = targetTrackId;
                                playPatchSound(true);
                            }
                        } else {
                            const wasConnected = !!track.midiDoublingTargetId;
                            track.midiDoublingTargetId = null;
                            if (wasConnected) playPatchSound(false);
                        }
                    }
                    patchingMidiOutId = null;
                }

                // Final UI Update
                renderTracks();
                renderDrawers();
                renderFxPanels();

                // Update UI and redraw cables
                updateFixedCables();
            }

            if (isResizingLeft || isResizingRight) {
                isResizingLeft = false;
                isResizingRight = false;
                resizerLeft.classList.remove('dragging');
                resizerRight.classList.remove('dragging');
                document.body.style.cursor = '';
            }
        });

        function updateFixedCables() {
            // Double-rAF ensures cables are drawn after the browser has committed
            // layout from any preceding DOM changes (e.g. renderDrawers canvas sizing).
            requestAnimationFrame(() => requestAnimationFrame(doUpdateFixedCables));
        }

        // Auto-update cables when layout changes
        const layoutObserver = new ResizeObserver(() => {
            updateFixedCables();
        });

        function initLayoutObserver() {
            const containers = ['tracks-container', 'drawers-container', 'fx-aside'].map(id => document.getElementById(id)).filter(el => el);
            containers.forEach(c => {
                try { layoutObserver.observe(c); } catch (e) { }
            });
        }

        // Start observation attempt
        if (document.readyState === 'complete') initLayoutObserver();
        else window.addEventListener('load', initLayoutObserver);

        function doUpdateFixedCables() {
            updateCableElementCache(); // Ensure we have the latest elements
            const svg = document.getElementById('cable-svg');
            svg.querySelectorAll('.fixed-cable').forEach(el => el.remove());

            // Clear all connected highlights first
            document.querySelectorAll('.mod-port-connected').forEach(el => el.classList.remove('mod-port-connected'));

            state.drawers.forEach(drawer => {
                if (drawer.connection) {
                    const outEl = window.cableElementCache.out.get(`out_${drawer.id}`);
                    let inEl = window.cableElementCache.in.get(`in_${drawer.connection}`);

                    const track = state.lookup.tracks.get(drawer.connection);
                    if (track) {
                        if (track.modLinks.x === drawer.id) inEl = window.cableElementCache.mod_x.get(`mod_x_${track.id}`);
                        else if (track.modLinks.y === drawer.id) inEl = window.cableElementCache.mod_y.get(`mod_y_${track.id}`);
                        else if (track.modLinks.decay === drawer.id) inEl = window.cableElementCache.mod_decay.get(`mod_decay_${track.id}`);
                        else if (track.modLinks.sustain === drawer.id) inEl = window.cableElementCache.mod_sustain.get(`mod_sustain_${track.id}`);
                        else if (track.modLinks.adsr === drawer.id) inEl = window.cableElementCache.mod_adsr.get(`mod_adsr_${track.id}`);
                        else if (track.modLinks.wobble === drawer.id) inEl = window.cableElementCache.mod_wobble.get(`mod_wobble_${track.id}`);
                        else inEl = window.cableElementCache.in.get(`in_${track.id}`);
                    }

                    if (outEl && inEl) {
                        const p1 = getCenter(outEl);
                        const p2 = getCenter(inEl);

                        if (p1 && p2) {
                            inEl.classList.add('mod-port-connected');
                            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                            path.setAttribute('class', 'cable-path fixed-cable');
                            path.style.stroke = 'var(--accent-cyan)';
                            drawBezier(path, p1, p2);
                            svg.appendChild(path);
                        }
                    }
                }
            });

            state.tracks.forEach(track => {
                if (track.audioRoute && track.audioRoute !== 'master') {
                    const outEl = window.cableElementCache.audio_out.get(`audio_out_${track.id}`);
                    const inEl = window.cableElementCache.audio_in.get(`audio_in_${track.audioRoute}`);
                    if (outEl && inEl) {
                        const p1 = getCenter(outEl);
                        const p2 = getCenter(inEl);

                        if (p1 && p2) {
                            inEl.classList.add('mod-port-connected');
                            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                            path.setAttribute('class', 'cable-path fixed-cable');
                            path.style.stroke = '#00f2ff';
                            drawBezier(path, p1, p2);
                            svg.appendChild(path);
                        }
                    }
                }
            });

            state.fxUnits.forEach(unit => {
                if (unit.audioRoute && unit.audioRoute !== 'master') {
                    const outEl = window.cableElementCache.audio_out.get(`audio_out_${unit.id}`);
                    const inEl = window.cableElementCache.audio_in.get(`audio_in_${unit.audioRoute}`);
                    if (outEl && inEl) {
                        const p1 = getCenter(outEl);
                        const p2 = getCenter(inEl);

                        if (p1 && p2) {
                            inEl.classList.add('mod-port-connected');
                            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                            path.setAttribute('class', 'cable-path fixed-cable');
                            path.style.stroke = '#00f2ff';
                            drawBezier(path, p1, p2);
                            svg.appendChild(path);
                        }
                    }
                }
            });

            state.tracks.forEach(track => {
                if (track.midiDoublingTargetId) {
                    const outEl = window.cableElementCache.midi_out.get(`midi_out_${track.id}`);
                    const inEl = window.cableElementCache.midi_in.get(`midi_in_${track.midiDoublingTargetId}`);
                    if (outEl && inEl) {
                        const p1 = getCenter(outEl);
                        const p2 = getCenter(inEl);
                        if (p1 && p2) {
                            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                            path.setAttribute('class', 'cable-path fixed-cable');
                            path.style.stroke = '#00f2ff';
                            drawBezier(path, p1, p2);
                            svg.appendChild(path);
                        }
                    }
                }
            });
        }
        window.addEventListener('resize', updateFixedCables);

        const ADSR_PARAM_RANGES = {
            a: { min: 0.005, max: 4.0 },
            d: { min: 0.005, max: 4.0 },
            s: { min: 0.0, max: 1.0 },
            r: { min: 0.005, max: 8.0 }
        };
        const ADSR_NODE_MIN_GAP = 0.005;
        const ADSR_TIME_LOG_CURVE = 0.08;
        const ADSR_SOFTEN_SECONDS = 0.008;
        const ADSR_MIN_DEG = -135;
        const ADSR_MAX_DEG = 135;

        function clampValue(value, min, max) {
            return Math.max(min, Math.min(max, value));
        }

        function getADSRGateBeats(track) {
            return track ? (1.0 / (track.subdiv || 4)) : 0.25;
        }

        function getADSRSustainFromY(y, geometry) {
            return clampValue(1 - ((y - geometry.peakY) / Math.max(1, geometry.bottomY - geometry.peakY)), ADSR_PARAM_RANGES.s.min, ADSR_PARAM_RANGES.s.max);
        }

        function getADSRYFromSustain(sustain, geometry) {
            return geometry.bottomY - (sustain * (geometry.bottomY - geometry.peakY));
        }

        function normalizeADSR(track) {
            const adsr = track?.adsr;
            if (!adsr) return null;
            Object.keys(ADSR_PARAM_RANGES).forEach(key => {
                const range = ADSR_PARAM_RANGES[key];
                adsr[key] = clampValue(Number.isFinite(adsr[key]) ? adsr[key] : range.min, range.min, range.max);
            });

            const gateBeats = getADSRGateBeats(track);
            const releaseMin = Math.max(ADSR_PARAM_RANGES.r.min, adsr.a + adsr.d - gateBeats + ADSR_NODE_MIN_GAP);
            if (releaseMin > ADSR_PARAM_RANGES.r.max) {
                adsr.d = Math.max(ADSR_PARAM_RANGES.d.min, gateBeats + ADSR_PARAM_RANGES.r.max - adsr.a - ADSR_NODE_MIN_GAP);
            } else if (adsr.r < releaseMin) {
                adsr.r = releaseMin;
            }
            return adsr;
        }

        function setADSRParam(track, key, value) {
            if (!track?.adsr || !ADSR_PARAM_RANGES[key]) return;
            const range = ADSR_PARAM_RANGES[key];
            track.adsr[key] = clampValue(value, range.min, range.max);
            normalizeADSR(track);
        }

        function getADSREnvelopeSeconds(adsr, beatDur, peak = 1.0) {
            return {
                a: Math.max(ADSR_SOFTEN_SECONDS, (adsr?.a || 0) * beatDur),
                d: Math.max(ADSR_SOFTEN_SECONDS, (adsr?.d || 0) * beatDur),
                s: clampValue(adsr?.s ?? 0, ADSR_PARAM_RANGES.s.min, ADSR_PARAM_RANGES.s.max) * peak,
                r: Math.max(ADSR_SOFTEN_SECONDS, (adsr?.r || 0) * beatDur)
            };
        }

        function getADSRGraphGeometry(canvas, adsr, track = null) {
            const w = canvas.offsetWidth;
            const h = canvas.offsetHeight;
            const gateBeats = getADSRGateBeats(track);
            const envelopeEnd = Math.max(gateBeats + adsr.r, adsr.a + adsr.d + ADSR_NODE_MIN_GAP);
            const maxBeats = Math.max(1.0, Math.min(ADSR_PARAM_RANGES.r.max + gateBeats, envelopeEnd * 1.2));
            const logDenom = Math.log1p(maxBeats / ADSR_TIME_LOG_CURVE);
            const peakY = 4;
            const bottomY = h - 4;
            const sustainY = getADSRYFromSustain(adsr.s, { peakY, bottomY });
            const beatToPx = (b) => {
                const clampedBeat = clampValue(b, 0, maxBeats);
                return (Math.log1p(clampedBeat / ADSR_TIME_LOG_CURVE) / logDenom) * w;
            };
            return {
                w, h, gateBeats, maxBeats, peakY, bottomY, sustainY,
                beatToPx,
                pxToBeat: (x) => ADSR_TIME_LOG_CURVE * Math.expm1((clampValue(x, 0, w) / Math.max(1, w)) * logDenom)
            };
        }

        function getADSRHandlePoints(canvas, track) {
            normalizeADSR(track);
            const adsr = track.adsr;
            const g = getADSRGraphGeometry(canvas, adsr, track);
            const handles = [];
            if (g.gateBeats < adsr.a) {
                handles.push({
                    key: 'a',
                    x: g.beatToPx(g.gateBeats),
                    y: g.bottomY - (g.gateBeats / Math.max(ADSR_PARAM_RANGES.a.min, adsr.a)) * (g.bottomY - g.peakY)
                });
            } else {
                handles.push({ key: 'a', x: g.beatToPx(adsr.a), y: g.peakY });
                if (g.gateBeats < adsr.a + adsr.d) {
                    const decayProgress = (g.gateBeats - adsr.a) / Math.max(ADSR_PARAM_RANGES.d.min, adsr.d);
                    const y = g.peakY + (g.sustainY - g.peakY) * decayProgress;
                    handles.push({ key: 'd', x: g.beatToPx(g.gateBeats), y });
                    handles.push({ key: 's', x: g.beatToPx(g.gateBeats), y });
                } else {
                    handles.push({ key: 'd', x: g.beatToPx(adsr.a + adsr.d), y: g.sustainY });
                    handles.push({ key: 's', x: g.beatToPx(adsr.a + adsr.d), y: g.sustainY });
                }
            }
            handles.push({ key: 'r', x: g.beatToPx(g.gateBeats + adsr.r), y: g.bottomY });
            return handles;
        }

        function pickADSRHandle(canvas, track, clientX, clientY) {
            const rect = canvas.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            const handles = getADSRHandlePoints(canvas, track);
            let nearest = null;
            handles.forEach(handle => {
                const distance = Math.hypot(handle.x - x, handle.y - y);
                if (!nearest || distance < nearest.distance) nearest = { ...handle, distance };
            });
            if (nearest && nearest.distance <= 14) return nearest.key;
            const g = getADSRGraphGeometry(canvas, track.adsr, track);
            const beat = g.pxToBeat(x);
            if (beat <= track.adsr.a + (track.adsr.d * 0.5)) return 'a';
            if (Math.abs(y - g.sustainY) <= 12) return 's';
            if (beat <= track.adsr.a + track.adsr.d + 0.35) return 'd';
            return 'r';
        }

        function setADSRFromGraphPoint(canvas, track, handle, clientX, clientY) {
            const rect = canvas.getBoundingClientRect();
            const x = clampValue(clientX - rect.left, 0, rect.width);
            const y = clampValue(clientY - rect.top, 0, rect.height);
            normalizeADSR(track);
            const g = getADSRGraphGeometry(canvas, track.adsr, track);
            const beat = g.pxToBeat(x);
            if (handle === 'a') {
                setADSRParam(track, 'a', beat);
            } else if (handle === 'd') {
                setADSRParam(track, 'd', beat - track.adsr.a);
                setADSRParam(track, 's', getADSRSustainFromY(y, g));
            } else if (handle === 's') {
                setADSRParam(track, 's', getADSRSustainFromY(y, g));
            } else if (handle === 'r') {
                setADSRParam(track, 'r', beat - g.gateBeats);
            }
            syncADSRControls(track);
        }

        function syncADSRControls(track) {
            const trackEl = document.getElementById(`track_${track.id}`);
            if (trackEl) {
                trackEl.querySelectorAll('.knob-wrap[data-adsr-key]').forEach(wrap => {
                    const key = wrap.dataset.adsrKey;
                    const range = ADSR_PARAM_RANGES[key];
                    if (!range) return;
                    const value = track.adsr[key];
                    const t = (value - range.min) / (range.max - range.min);
                    const deg = ADSR_MIN_DEG + t * (ADSR_MAX_DEG - ADSR_MIN_DEG);
                    const pip = wrap.querySelector('.knob-pip');
                    const valEl = wrap.querySelector('.knob-val');
                    if (pip) pip.style.transform = `translateX(-50%) rotate(${deg}deg)`;
                    if (valEl) valEl.textContent = key === 's' ? value.toFixed(2) : value.toFixed(2) + 'b';
                });
            }
            if (track.adsrCanvas) drawADSR(track.adsrCanvas, track.adsr, track, state.activeTrackId === state.tracks.indexOf(track));
        }

        function startADSRGraphDrag(e, canvas, track, index) {
            e.preventDefault();
            e.stopPropagation();
            pushUndo();
            state.activeTrackId = index;
            if (e.pointerId !== undefined && canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
            const handle = pickADSRHandle(canvas, track, e.clientX, e.clientY);
            setADSRFromGraphPoint(canvas, track, handle, e.clientX, e.clientY);
            const onMove = (ev) => setADSRFromGraphPoint(canvas, track, handle, ev.clientX, ev.clientY);
            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);
                if (e.pointerId !== undefined && canvas.releasePointerCapture) {
                    try { canvas.releasePointerCapture(e.pointerId); } catch (err) { }
                }
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        }

        function drawADSR(canvas, adsr, track = null, isActive = false) {
            const dpr = window.devicePixelRatio || 1;
            const cssW = canvas.offsetWidth;
            const cssH = canvas.offsetHeight;
            const pixelW = cssW * dpr;
            const pixelH = cssH * dpr;
            if (cssW === 0 || cssH === 0) return;
            if (canvas.width !== pixelW || canvas.height !== pixelH) {
                canvas.width = pixelW; canvas.height = pixelH;
            }
            const ctx = canvas.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, cssW, cssH);
            if (track) normalizeADSR(track);
            const g = getADSRGraphGeometry(canvas, adsr, track);

            // Draw Gate Background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.fillRect(0, 0, g.beatToPx(g.gateBeats), g.h);

            // Draw Grid Lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(g.beatToPx(g.gateBeats), 0); ctx.lineTo(g.beatToPx(g.gateBeats), g.h);
            ctx.stroke();
            ctx.setLineDash([]);

            // Points for the path
            const path = [];
            path.push({ x: 0, y: g.bottomY });

            let reachedPeak = false;
            let reachedSustain = false;

            // Attack phase
            if (g.gateBeats < adsr.a) {
                path.push({ x: g.beatToPx(g.gateBeats), y: g.bottomY - (g.gateBeats / adsr.a) * (g.bottomY - g.peakY) });
            } else {
                path.push({ x: g.beatToPx(adsr.a), y: g.peakY });
                reachedPeak = true;

                // Decay phase
                if (g.gateBeats < adsr.a + adsr.d) {
                    const decayProgress = (g.gateBeats - adsr.a) / adsr.d;
                    const y = g.peakY + (g.sustainY - g.peakY) * decayProgress;
                    path.push({ x: g.beatToPx(g.gateBeats), y: y });
                } else {
                    path.push({ x: g.beatToPx(adsr.a + adsr.d), y: g.sustainY });
                    reachedSustain = true;
                    path.push({ x: g.beatToPx(g.gateBeats), y: g.sustainY });
                }
            }

            // Release phase
            path.push({ x: g.beatToPx(g.gateBeats + adsr.r), y: g.bottomY });

            // Draw Fill
            const grad = ctx.createLinearGradient(0, 0, 0, g.h);
            const color = isActive ? 'rgba(0, 242, 255, ' : 'rgba(100, 100, 110, ';
            grad.addColorStop(0, color + '0.4)');
            grad.addColorStop(1, color + '0.0)');

            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            path.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.lineTo(path[path.length - 1].x, g.bottomY);
            ctx.fillStyle = grad;
            ctx.fill();

            // Draw Stroke
            ctx.strokeStyle = isActive ? '#00f2ff' : '#60606a';
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            path.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.stroke();

            // Draw draggable points
            ctx.fillStyle = isActive ? '#fff' : '#8b909c';
            ctx.strokeStyle = isActive ? '#00f2ff' : '#60606a';
            ctx.lineWidth = 1;
            if (track) getADSRHandlePoints(canvas, track).forEach(point => {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });
        }

        function drawXY(canvas, track, showValues = false) {
            const dpr = window.devicePixelRatio || 1;
            const w = canvas.offsetWidth * dpr;
            const h = canvas.offsetHeight * dpr;
            if (w === 0 || h === 0) return;
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w; canvas.height = h;
            }
            const ctx = canvas.getContext('2d');
            const xy = track.xy;
            ctx.clearRect(0, 0, w, h);

            const minF = 20, maxF = 20000;
            const baselineY = h * 0.75;

            // --- Premium Grid (Semi-Log) ---
            ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
            const gridFreqs = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
            gridFreqs.forEach(f => {
                const x = (Math.log10(f / minF) / Math.log10(maxF / minF)) * w;
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
            });
            ctx.beginPath(); ctx.moveTo(0, baselineY); ctx.lineTo(w, baselineY); ctx.stroke();

            // --- Draw Filter Curve ---
            if (track.filterNode) {
                const numPoints = w > 100 ? 128 : 64; // Scale detail to canvas size
                const frequencies = new Float32Array(numPoints);
                for (let i = 0; i < numPoints; i++) {
                    frequencies[i] = minF * Math.pow(maxF / minF, i / (numPoints - 1));
                }
                const magResponse = new Float32Array(numPoints);
                const phaseResponse = new Float32Array(numPoints);
                track.filterNode.getFrequencyResponse(frequencies, magResponse, phaseResponse);

                // Create Gradient for Curve
                const path = new Path2D();
                for (let i = 0; i < numPoints; i++) {
                    const x = (i / (numPoints - 1)) * w;
                    const db = 20 * Math.log10(magResponse[i] + 0.0001);
                    const y = baselineY - (db / 60) * h; // 60dB range
                    if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
                }

                // Fill under curve
                const fillPath = new Path2D(path);
                fillPath.lineTo(w, h); fillPath.lineTo(0, h); fillPath.closePath();
                const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
                fillGrad.addColorStop(0, 'rgba(0, 242, 255, 0.15)');
                fillGrad.addColorStop(1, 'rgba(0, 242, 255, 0)');
                ctx.fillStyle = fillGrad; ctx.fill(fillPath);

                // Stroke curve with glow
                ctx.shadowBlur = 10 * dpr;
                ctx.shadowColor = 'rgba(0, 242, 255, 0.5)';
                ctx.strokeStyle = '#00f2ff';
                ctx.lineWidth = 2 * dpr;
                ctx.stroke(path);
                ctx.shadowBlur = 0;
            }

            // --- Interaction Handle (Orb) ---
            const px = xy.x * w;
            const py = baselineY - (20 * Math.log10(Math.max(0.1, track.filterNode.Q.value) + 0.5) / 60) * h;

            // Orb Glow
            const orbGrad = ctx.createRadialGradient(px, py, 0, px, py, 15 * dpr);
            orbGrad.addColorStop(0, 'rgba(0, 242, 255, 0.4)');
            orbGrad.addColorStop(1, 'rgba(0, 242, 255, 0)');
            ctx.fillStyle = orbGrad;
            ctx.beginPath(); ctx.arc(px, py, 15 * dpr, 0, Math.PI * 2); ctx.fill();

            // Orb Center
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(px, py, 3.5 * dpr, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#00f2ff';
            ctx.lineWidth = 1.5 * dpr;
            ctx.stroke();

            // --- Value Labels ---
            if (showValues) {
                const freq = Math.round(minF * Math.pow(maxF / minF, xy.x));
                const qVal = (track.filterNode.Q.value).toFixed(1);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.font = `bold ${8 * dpr}px var(--font-mono)`;
                ctx.textAlign = 'left';
                ctx.fillText(`${freq}Hz`, 6 * dpr, 12 * dpr);
                ctx.textAlign = 'right';
                ctx.fillText(`Q:${qVal}`, w - 6 * dpr, 12 * dpr);
            }
        }

        function applyTrackFilter(track, time = audioCtx.currentTime) {
            let x = track.xy.x;
            let y = track.xy.y;

            const progress = (state.currentStep % state.totalSteps) / state.totalSteps;

            // Apply Drawer Modulation
            if (track.modLinks.x) {
                const drw = state.lookup.drawers.get(track.modLinks.x);
                if (drw) x = Math.max(0, Math.min(1, x + (getDrawerValueAt(drw, progress) - 0.5) * 0.8));
            }
            if (track.modLinks.y) {
                const drw = state.lookup.drawers.get(track.modLinks.y);
                if (drw) y = Math.max(0, Math.min(1, y + (getDrawerValueAt(drw, progress) - 0.5) * 0.8));
            }

            // Logarithmic mapping for frequency (20Hz to 20kHz)
            const minF = 20, maxF = 20000;
            const freq = minF * Math.pow(maxF / minF, x);
            const res = y * 20; // Q from 0 to 20

            track.filterNode.frequency.setTargetAtTime(freq, time, 0.05);
            track.filterNode.Q.setTargetAtTime(res, time, 0.05);
        }

        // --- Synthesis Engine ---
        function noteToFreq(noteName, baseOctaveOffset = 0, trackOctaveOffset = 0) {
            const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const octave = parseInt(noteName.slice(-1)) + baseOctaveOffset + trackOctaveOffset;
            const noteIndex = notes.indexOf(noteName.slice(0, -1));
            const n = noteIndex - 9 + (octave - 4) * 12;
            return 440 * Math.pow(2, n / 12);
        }

        // --- Helper: Glide / Portamento / Glissando ---
        function applyGlide(param, startFreq, endFreq, startTime, duration, mode) {
            if (mode === 'glissando') {
                const semitones = Math.round(12 * Math.log2(endFreq / startFreq));
                const steps = Math.abs(semitones);
                if (steps === 0) {
                    param.setValueAtTime(endFreq, startTime);
                    return;
                }
                const stepDur = duration / steps;
                for (let i = 0; i <= steps; i++) {
                    const semitoneOffset = Math.round(semitones * (i / steps));
                    const freq = startFreq * Math.pow(2, semitoneOffset / 12);
                    param.setValueAtTime(freq, startTime + i * stepDur);
                }
            } else {
                param.setValueAtTime(startFreq, startTime);
                param.exponentialRampToValueAtTime(endFreq, startTime + duration);
            }
        }

        function createVoiceLfo(voice, frequency, depth, time) {
            const lfo = audioCtx.createOscillator();
            const lfoGain = audioCtx.createGain();
            lfo.frequency.value = frequency;
            lfoGain.gain.value = depth;
            lfo.connect(lfoGain);
            lfo.start(time);
            voice.lfo = lfo;
            voice.lfoGain = lfoGain;
            return lfoGain;
        }

        function createVoiceSaturationCurve(amount = 2.5) {
            const drive = Math.max(0.2, amount);
            const curve = new Float32Array(2048);
            const norm = Math.tanh(drive);
            for (let i = 0; i < curve.length; i++) {
                const x = (i / (curve.length - 1)) * 2 - 1;
                curve[i] = Math.tanh(x * drive) / norm;
            }
            return curve;
        }

        function createVoiceSaturator(amount = 2.5) {
            const shaper = audioCtx.createWaveShaper();
            shaper.curve = createVoiceSaturationCurve(amount);
            shaper.oversample = '2x';
            return shaper;
        }

        function createNoiseBuffer(duration = 0.2) {
            const length = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
            const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
            return buffer;
        }

        function addVoiceOsc(voice, destination, type, startFrequency, targetFrequency, time, options = {}) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const start = Math.max(1, Number.isFinite(startFrequency) ? startFrequency : 1);
            const target = Math.max(1, Number.isFinite(targetFrequency) ? targetFrequency : start);
            const amp = Math.max(0, options.gain ?? 1);
            const attack = Math.max(0, options.attack || 0);

            osc.type = type || 'sine';
            osc.frequency.setValueAtTime(start, time);
            if (Number.isFinite(options.detune)) osc.detune.setValueAtTime(options.detune, time);
            if (options.lfoGain) options.lfoGain.connect(osc.frequency);
            if (Math.abs(target - start) > 0.001 || options.forceGlide) {
                applyGlide(osc.frequency, start, target, time, Math.max(0.001, options.glideDur || 0.001), options.glideMode);
            }

            if (attack > 0) {
                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(amp, time + attack);
            } else {
                gain.gain.setValueAtTime(amp, time);
            }
            if (options.decay) {
                gain.gain.exponentialRampToValueAtTime(0.001, time + Math.max(attack + 0.001, options.decay));
            }

            osc.connect(gain);
            if (Number.isFinite(options.pan) && audioCtx.createStereoPanner) {
                const panner = audioCtx.createStereoPanner();
                panner.pan.setValueAtTime(Math.max(-1, Math.min(1, options.pan)), time);
                gain.connect(panner);
                panner.connect(destination);
            } else {
                gain.connect(destination);
            }

            osc.start(time);
            voice.nodes.push(osc);
            return { osc, gain };
        }

        function addNoiseBurst(voice, destination, time, options = {}) {
            const duration = Math.max(0.01, options.duration || 0.12);
            const source = audioCtx.createBufferSource();
            const gain = audioCtx.createGain();
            const amp = Math.max(0, options.gain ?? 0.1);
            source.buffer = createNoiseBuffer(duration);
            source.loop = !!options.loop;

            let output = source;
            if (options.filterType) {
                const filter = audioCtx.createBiquadFilter();
                filter.type = options.filterType;
                filter.frequency.setValueAtTime(Math.max(20, options.frequency || 2000), time);
                filter.Q.setValueAtTime(Math.max(0.001, options.q || 0.7), time);
                source.connect(filter);
                output = filter;
            }

            output.connect(gain);
            gain.gain.setValueAtTime(options.attack ? 0 : amp, time);
            if (options.attack) gain.gain.linearRampToValueAtTime(amp, time + Math.max(0.001, options.attack));
            if (options.decay) gain.gain.exponentialRampToValueAtTime(0.001, time + Math.max(0.002, options.decay));

            if (Number.isFinite(options.pan) && audioCtx.createStereoPanner) {
                const panner = audioCtx.createStereoPanner();
                panner.pan.setValueAtTime(Math.max(-1, Math.min(1, options.pan)), time);
                gain.connect(panner);
                panner.connect(destination);
            } else {
                gain.connect(destination);
            }

            source.start(time);
            voice.nodes.push(source);
            return { source, gain };
        }

        function noteOn(track, rowIdx, time, stepData = null, isKeyboard = false, doubledFromId = null) {
            if (isKeyboard && isArpEligibleTrack(track) && track.arp && track.arp.enabled) {
                addArpHeldNote(track, rowIdx);
                return null;
            }
            const template = instrumentTypes[track.typeId];
            const rowName = template.type === 'drum' ? getTrackRowDrumName(track, rowIdx) : template.rows[rowIdx];
            if (!rowName && template.type === 'synth') return null;

            const adsr = track.adsr;
            const beatDur = 60.0 / state.bpm;
            const freq = template.type === 'synth' ? noteToFreq(rowName, track.baseOctaveOffset || 0, track.octaveOffset || 0) : null;

            if (template.type === 'synth' && (isNaN(freq) || !freq)) return null;

            const voiceId = `${track.id}_${rowIdx}_${time.toFixed(6)}_${Math.random().toString(36).substr(2, 5)}`;
            const localGain = audioCtx.createGain();
            localGain.connect(track.filterNode);

            const voice = { id: voiceId, track, rowIdx, gain: localGain, nodes: [], lfo: null, lfoGain: null, doubledFromId: doubledFromId, isArp: !!stepData?.arp, startTime: time, oneShot: !isHeldVoice(track, rowIdx, template) };
            state.activeNotes.set(voiceId, voice);

            // Handle MIDI Doubling
            if (!doubledFromId && track.midiDoublingTargetId) {
                const targetTrack = state.tracks.find(t => t.id === track.midiDoublingTargetId);
                if (targetTrack && targetTrack.id !== track.id) {
                    noteOn(targetTrack, rowIdx, time, stepData, isKeyboard, track.id);
                }
            }

            if (template.type === 'drum' && isSamplerDrumVariant(track, rowIdx)) {
                const samplerPadIdx = getSamplerPadIndexForRow(track, rowIdx);
                const delay = Math.max(0, (time - audioCtx.currentTime) * 1000);
                setTimeout(() => flashSamplerPadControls(track, samplerPadIdx), delay);

                const currentBank = track.samplerBank || 'A';
                if (currentBank === 'A' && typeof mcp2000_config !== 'undefined' && mcp2000_config.pads[samplerPadIdx]) {
                    triggerSamplerPad(mcp2000_config.pads[samplerPadIdx], localGain, time, voice, track);
                } else if (currentBank === 'B' && typeof mcp2000_config_b !== 'undefined' && mcp2000_config_b.pads[samplerPadIdx]) {
                    triggerSamplerPad(mcp2000_config_b.pads[samplerPadIdx], localGain, time, voice, track);
                } else {
                    // Fallback to simple noise
                    const noise = audioCtx.createBufferSource();
                    const b = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.1, audioCtx.sampleRate);
                    for (let i = 0; i < b.length; i++) b.getChannelData(0)[i] = Math.random() * 2 - 1;
                    noise.buffer = b; noise.connect(localGain);
                    localGain.gain.setValueAtTime(0.5, time);
                    localGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
                    noise.start(time); voice.nodes.push(noise);
                }
                if (track.sidechainEnabled) triggerSidechain(time);
                if (stepData && samplerUsesHeldGate(track)) {
                    noteOff(track, rowIdx, time + (stepData.length || 1.0) * (beatDur / (track.subdiv || 4)), null, !!stepData.arp);
                }
            } else if (template.type === 'drum') {
                const styleIdx = getTrackRowVariantIndex(track, rowIdx);
                switch (rowName) {
                    case 'Kick': {
                        const styles = [['Classic', 150, 30, 0.5], ['Deep', 120, 20, 0.8], ['Snappy', 200, 40, 0.2], ['Industrial', 180, 25, 0.4]];
                        const s = styles[styleIdx % styles.length];
                        const osc = audioCtx.createOscillator();
                        osc.frequency.setValueAtTime(s[1], time);
                        osc.frequency.exponentialRampToValueAtTime(s[2], time + 0.12);
                        if (s[0] === 'Industrial') {
                            const sh = audioCtx.createWaveShaper();
                            const c = new Float32Array(44100);
                            for (let i = 0; i < 44100; i++) {
                                const x = i * 2 / 44100 - 1;
                                c[i] = (3 + 20) * x * 57 * Math.PI / 180 / (Math.PI + 20 * Math.abs(x));
                            }
                            sh.curve = c;
                            osc.connect(sh); sh.connect(localGain);
                        } else osc.connect(localGain);
                        localGain.gain.setValueAtTime(1.2, time);
                        localGain.gain.exponentialRampToValueAtTime(0.001, time + s[3]);
                        osc.start(time); osc.stop(time + s[3] + 0.1);
                        voice.nodes.push(osc);
                        if (track.sidechainEnabled) triggerSidechain(time);
                        break;
                    }
                    case 'Snare': {
                        const styles = [['Classic', 1200, 0.2], ['Snap', 2500, 0.1], ['Acoustic', 800, 0.25], ['Lofi', 600, 0.15]];
                        const s = styles[styleIdx % styles.length];
                        const noise = audioCtx.createBufferSource();
                        const b = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.3, audioCtx.sampleRate);
                        for (let i = 0; i < b.length; i++) b.getChannelData(0)[i] = Math.random() * 2 - 1;
                        noise.buffer = b;
                        const f = audioCtx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = s[1];
                        noise.connect(f); f.connect(localGain);
                        const osc = audioCtx.createOscillator(); osc.frequency.setValueAtTime(220, time);
                        osc.connect(localGain);
                        localGain.gain.setValueAtTime(0.75, time);
                        localGain.gain.exponentialRampToValueAtTime(0.001, time + s[2]);
                        noise.start(time); osc.start(time);
                        osc.stop(time + s[2]);
                        voice.nodes.push(noise, osc);
                        break;
                    }
                    case 'Clap': {
                        const hpValues = [1800, 2600, 1400, 900];
                        const n = audioCtx.createBufferSource();
                        const b = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.22, audioCtx.sampleRate);
                        for (let i = 0; i < b.length; i++) b.getChannelData(0)[i] = (Math.random() * 2 - 1) * (i % 180 < 75 ? 1 : 0.25);
                        n.buffer = b;
                        const f = audioCtx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hpValues[styleIdx % hpValues.length];
                        n.connect(f); f.connect(localGain);
                        localGain.gain.setValueAtTime(0.55, time);
                        localGain.gain.exponentialRampToValueAtTime(0.001, time + (styleIdx === 3 ? 0.12 : 0.18));
                        n.start(time); n.stop(time + 0.24); voice.nodes.push(n);
                        break;
                    }
                    case 'Rim': {
                        const freqs = [1800, 2600, 1100, 700];
                        const osc = audioCtx.createOscillator(); osc.type = styleIdx === 1 ? 'square' : 'triangle'; osc.frequency.value = freqs[styleIdx % freqs.length];
                        const bpf = audioCtx.createBiquadFilter(); bpf.type = 'bandpass'; bpf.frequency.value = freqs[styleIdx % freqs.length]; bpf.Q.value = 8;
                        osc.connect(bpf); bpf.connect(localGain);
                        localGain.gain.setValueAtTime(0.55, time);
                        localGain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
                        osc.start(time); osc.stop(time + 0.08); voice.nodes.push(osc);
                        break;
                    }
                    case 'HiHat': case 'OpenHat': case 'CHat': case 'OHat': {
                        const isO = rowName === 'OpenHat' || rowName === 'OHat';
                        const styles = [8000, 10000, 6000, 4500];
                        const hpFreq = styles[styleIdx % styles.length];
                        const hDur = isO ? 0.38 : 0.065;
                        const n = audioCtx.createBufferSource();
                        const b = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.25, audioCtx.sampleRate);
                        for (let i = 0; i < b.length; i++) b.getChannelData(0)[i] = Math.random() * 2 - 1;
                        n.buffer = b;
                        const f = audioCtx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hpFreq;
                        n.connect(f); f.connect(localGain);
                        localGain.gain.setValueAtTime(0.3, time);
                        localGain.gain.exponentialRampToValueAtTime(0.001, time + hDur);
                        n.start(time); n.stop(time + hDur + 0.1);
                        voice.nodes.push(n);
                        break;
                    }
                    case 'Crash': case 'Ride': {
                        const isCrash = rowName === 'Crash';
                        const styles = isCrash ? [[4500, 1.8, [450, 680, 920], 0.7, 0.4], [2000, 2.5, [380, 520, 740], 4.0, 0.35], [800, 1.0, [200, 400, 800], 0.5, 0.5]] : [[6500, 0.7, [1200, 2400], 0.7, 0.22], [9000, 0.5, [3200, 6400, 9600], 8.0, 0.15], [4000, 1.2, [800, 1600], 0.5, 0.25]];
                        const s = styles[styleIdx % styles.length];
                        const cDur = s[1];
                        const n = audioCtx.createBufferSource();
                        const b = audioCtx.createBuffer(1, audioCtx.sampleRate * 3, audioCtx.sampleRate);
                        for (let i = 0; i < b.length; i++) b.getChannelData(0)[i] = Math.random() * 2 - 1;
                        n.buffer = b;
                        const f = audioCtx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = s[0]; f.Q.value = s[3];
                        n.connect(f); f.connect(localGain);
                        if (rowName === 'Ride' && styleIdx === 1) {
                            const o1 = audioCtx.createOscillator(); o1.frequency.value = s[2][0];
                            const o2 = audioCtx.createOscillator(); o2.frequency.value = s[2][1];
                            const g2 = audioCtx.createGain(); g2.gain.value = 2000; o2.connect(g2); g2.connect(o1.frequency);
                            o1.connect(localGain); o1.start(time); o1.stop(time + cDur); voice.nodes.push(o1, o2);
                        } else {
                            s[2].forEach(freq => {
                                const o = audioCtx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
                                const og = audioCtx.createGain(); og.gain.value = 0.04; o.connect(og); og.connect(localGain);
                                o.start(time); o.stop(time + cDur); voice.nodes.push(o);
                            });
                        }
                        if (isCrash && styleIdx === 2) {
                            const sh = audioCtx.createWaveShaper(); const c = new Float32Array(44100); for (let i = 0; i < 44100; i++) { const x = i * 2 / 44100 - 1; c[i] = (3 + 10) * x * 20 * Math.PI / 180 / (Math.PI + 10 * Math.abs(x)); } sh.curve = c; f.disconnect(); f.connect(sh); sh.connect(localGain);
                        }
                        localGain.gain.setValueAtTime(s[4], time);
                        localGain.gain.exponentialRampToValueAtTime(0.001, time + cDur);
                        n.start(time); n.stop(time + cDur + 0.1);
                        voice.nodes.push(n);
                        break;
                    }
                    case 'Splash': case 'Metal': {
                        const isMetal = rowName === 'Metal';
                        const s = isMetal ? [1200, 0.28, 14, 0.45] : [5500, 0.55, 4, 0.28];
                        const n = audioCtx.createBufferSource();
                        const b = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.8, audioCtx.sampleRate);
                        for (let i = 0; i < b.length; i++) b.getChannelData(0)[i] = Math.random() * 2 - 1;
                        n.buffer = b;
                        const f = audioCtx.createBiquadFilter(); f.type = isMetal ? 'bandpass' : 'highpass'; f.frequency.value = s[0] + styleIdx * 450; f.Q.value = s[2];
                        n.connect(f); f.connect(localGain);
                        localGain.gain.setValueAtTime(s[3], time);
                        localGain.gain.exponentialRampToValueAtTime(0.001, time + (styleIdx === 3 ? s[1] * 0.45 : s[1]));
                        n.start(time); n.stop(time + s[1] + 0.1); voice.nodes.push(n);
                        break;
                    }
                    case 'Shaker': {
                        const styles = [8000, 5000, 3000];
                        const hp = styles[styleIdx % styles.length];
                        const n = audioCtx.createBufferSource();
                        const b = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.15, audioCtx.sampleRate);
                        for (let i = 0; i < b.length; i++) b.getChannelData(0)[i] = Math.random() * 2 - 1;
                        n.buffer = b;
                        const f = audioCtx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; f.Q.value = styleIdx === 1 ? 10 : 0.7;
                        n.connect(f); f.connect(localGain);
                        localGain.gain.setValueAtTime(0.3, time);
                        localGain.gain.linearRampToValueAtTime(0.001, time + (styleIdx === 2 ? 0.15 : 0.08));
                        n.start(time); n.stop(time + 0.2); voice.nodes.push(n);
                        break;
                    }
                    case 'Cowbell': {
                        const styles = [[540, 800, 3500], [580, 840, 3800], [540, 800, 2500]];
                        const s = styles[styleIdx % styles.length];
                        const osc1 = audioCtx.createOscillator(); osc1.type = 'square'; osc1.frequency.value = s[0];
                        const osc2 = audioCtx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = s[1];
                        const bpf = audioCtx.createBiquadFilter(); bpf.type = 'bandpass'; bpf.frequency.value = s[2]; bpf.Q.value = 1.5;
                        osc1.connect(bpf); osc2.connect(bpf); bpf.connect(localGain);
                        if (styleIdx === 2) {
                            const sh = audioCtx.createWaveShaper(); const c = new Float32Array(44100); for (let i = 0; i < 44100; i++) { const x = i * 2 / 44100 - 1; c[i] = (3 + 10) * x / (Math.PI + 10 * Math.abs(x)); } sh.curve = c; bpf.disconnect(); bpf.connect(sh); sh.connect(localGain);
                        }
                        localGain.gain.setValueAtTime(0.5, time);
                        localGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
                        osc1.start(time); osc2.start(time); osc1.stop(time + 0.3); osc2.stop(time + 0.3);
                        voice.nodes.push(osc1, osc2);
                        break;
                    }
                    case 'Clave': {
                        const styles = [2500, 1200, 3500];
                        const f = styles[styleIdx % styles.length];
                        const osc = audioCtx.createOscillator(); osc.type = styleIdx === 2 ? 'triangle' : 'sine'; osc.frequency.value = f;
                        localGain.gain.setValueAtTime(0.7, time);
                        localGain.gain.exponentialRampToValueAtTime(0.001, time + (styleIdx === 1 ? 0.08 : 0.035));
                        osc.connect(localGain); osc.start(time); osc.stop(time + 0.15);
                        voice.nodes.push(osc);
                        break;
                    }
                    case 'Beep': {
                        const freqs = [880, 1320, 660, 1046];
                        const osc = audioCtx.createOscillator(); osc.type = styleIdx === 3 ? 'square' : 'sine'; osc.frequency.value = freqs[styleIdx % freqs.length];
                        localGain.gain.setValueAtTime(0.35, time);
                        localGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
                        osc.connect(localGain); osc.start(time); osc.stop(time + 0.1);
                        voice.nodes.push(osc);
                        break;
                    }
                    default: {
                        if (rowName.includes('Tom') || rowName.includes('Bongo')) {
                            const isBongo = rowName.includes('Bongo');
                            const styles = isBongo ? [0.15, 0.1, 0.2] : [0.4, 0.5, 0.25];
                            const tDur = styles[styleIdx % styles.length];
                            const osc = audioCtx.createOscillator(); osc.type = styleIdx === 2 ? 'triangle' : 'sine';
                            let f = 100; if (rowName === 'TomH') f = 200; else if (rowName === 'TomL') f = 90; else if (rowName === 'BongoH') f = 450; else if (rowName === 'BongoL') f = 280;
                            osc.frequency.setValueAtTime(f * (styleIdx === 1 ? 1.8 : 1.4), time);
                            osc.frequency.exponentialRampToValueAtTime(f, time + 0.06);
                            const clickG = audioCtx.createGain(); clickG.gain.setValueAtTime(styleIdx === 2 ? 0.2 : 0.1, time); clickG.gain.exponentialRampToValueAtTime(0.001, time + 0.015);
                            const click = audioCtx.createOscillator(); click.type = 'square'; click.frequency.value = 1200; click.connect(clickG); clickG.connect(localGain); click.start(time); click.stop(time + 0.02);
                            localGain.gain.setValueAtTime(0.8, time); localGain.gain.exponentialRampToValueAtTime(0.001, time + tDur);
                            osc.connect(localGain); osc.start(time); osc.stop(time + tDur + 0.1); voice.nodes.push(osc, click);
                        }
                        break;
                    }
                }
                setTimeout(() => state.activeNotes.delete(voiceId), 2000);
            } else if (adsr) {
                const lp = (track.typeId === 'synthwave' || track.typeId === 'pad' || track.typeId === 'brass' || track.typeId === 'wobblebass' || track.typeId === 'clavinet') ? audioCtx.createBiquadFilter() : null;
                if (lp) { lp.type = 'lowpass'; lp.Q.value = track.typeId === 'pad' ? 0.5 : 1.5; lp.connect(localGain); }

                const isGlide = track.glide && track.lastFreq;
                const startFreq = isGlide ? track.lastFreq : freq;
                track.lastFreq = freq;
                let targetFreq = freq;
                if (stepData && stepData.gliss) targetFreq = freq * Math.pow(2, stepData.gliss / 12);

                // Use a small minimum for glideDur to avoid audio issues with zero-time ramps
                const glideDur = isGlide ? Math.max(0.001, track.glideTime) : 0.001;
                const env = getADSREnvelopeSeconds(adsr, beatDur);

                let isWobbleOverride = false;
                switch (track.typeId) {
                    case 'synthwave': {
                        const drive = createVoiceSaturator(2.1);
                        drive.connect(lp);
                        lp.Q.setValueAtTime(1.1, time);
                        lp.frequency.setValueAtTime(Math.max(700, freq * 5.5), time);
                        lp.frequency.linearRampToValueAtTime(Math.max(380, freq * 2.2), time + env.a + env.d * 0.8);
                        [
                            { det: -11, gain: 0.2, pan: -0.16 },
                            { det: -3, gain: 0.24, pan: -0.04 },
                            { det: 4, gain: 0.24, pan: 0.05 },
                            { det: 12, gain: 0.18, pan: 0.18 }
                        ].forEach(part => addVoiceOsc(voice, drive, 'sawtooth', startFreq, targetFreq, time, {
                            gain: part.gain, detune: part.det, pan: part.pan, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        }));
                        addVoiceOsc(voice, drive, 'square', startFreq * 0.5, targetFreq * 0.5, time, {
                            gain: 0.12, detune: -4, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        });
                        addNoiseBurst(voice, drive, time, { duration: 0.035, gain: 0.018, decay: 0.028, filterType: 'highpass', frequency: 4500 });
                        break;
                    }
                    case 'bass': {
                        const bassDrive = createVoiceSaturator(1.7);
                        const bassLp = audioCtx.createBiquadFilter();
                        bassLp.type = 'lowpass';
                        bassLp.Q.setValueAtTime(0.85, time);
                        bassLp.frequency.setValueAtTime(Math.max(100, freq * 4.6), time);
                        bassLp.frequency.linearRampToValueAtTime(Math.max(75, freq * 1.8), time + env.a + env.d);
                        bassDrive.connect(bassLp);
                        bassLp.connect(localGain);
                        addVoiceOsc(voice, localGain, 'sine', startFreq * 0.5, targetFreq * 0.5, time, {
                            gain: 0.48, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        });
                        addVoiceOsc(voice, bassDrive, 'triangle', startFreq, targetFreq, time, {
                            gain: 0.34, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        });
                        addVoiceOsc(voice, bassDrive, 'sawtooth', startFreq, targetFreq, time, {
                            gain: 0.12, detune: -5, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        });
                        addNoiseBurst(voice, bassLp, time, { duration: 0.028, gain: 0.018, decay: 0.018, filterType: 'highpass', frequency: 1800 });
                        break;
                    }
                    case 'pad': {
                        lp.Q.setValueAtTime(0.55, time);
                        lp.frequency.setValueAtTime(Math.min(9000, Math.max(900, freq * 4.8)), time);
                        const pLfoG = track.voiceLfoEnabled ? createVoiceLfo(voice, track.wobbleRate || 4.5, freq * 0.006, time) : null;
                        [
                            { type: 'sawtooth', det: -14, gain: 0.13, pan: -0.35 },
                            { type: 'triangle', det: -5, gain: 0.2, pan: -0.12 },
                            { type: 'sine', det: 0, gain: 0.26, pan: 0 },
                            { type: 'triangle', det: 7, gain: 0.18, pan: 0.14 },
                            { type: 'sawtooth', det: 16, gain: 0.11, pan: 0.36 }
                        ].forEach(part => addVoiceOsc(voice, lp, part.type, startFreq, targetFreq, time, {
                            gain: part.gain, detune: part.det, pan: part.pan, lfoGain: pLfoG, attack: 0.02, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        }));
                        break;
                    }
                    case 'pluck': {
                        const glassFilter = audioCtx.createBiquadFilter();
                        glassFilter.type = 'lowpass';
                        glassFilter.Q.setValueAtTime(1.8, time);
                        glassFilter.frequency.setValueAtTime(Math.min(12000, Math.max(1600, freq * 9)), time);
                        glassFilter.frequency.exponentialRampToValueAtTime(Math.max(700, freq * 3.2), time + Math.max(0.08, env.d));
                        glassFilter.connect(localGain);
                        const carrier = audioCtx.createOscillator();
                        const mod = audioCtx.createOscillator();
                        const modG = audioCtx.createGain();
                        carrier.type = 'sine';
                        carrier.frequency.setValueAtTime(startFreq, time);
                        mod.type = 'sine';
                        mod.frequency.setValueAtTime(startFreq * 2.01, time);
                        modG.gain.setValueAtTime(freq * 4.8, time);
                        modG.gain.exponentialRampToValueAtTime(freq * 0.25, time + 0.07);
                        modG.gain.exponentialRampToValueAtTime(0.001, time + Math.max(0.12, env.d));
                        if (targetFreq !== startFreq || isGlide) {
                            applyGlide(carrier.frequency, startFreq, targetFreq, time, glideDur, track.glideMode);
                            applyGlide(mod.frequency, startFreq * 2.01, targetFreq * 2.01, time, glideDur, track.glideMode);
                        }
                        mod.connect(modG);
                        modG.connect(carrier.frequency);
                        carrier.connect(glassFilter);
                        addVoiceOsc(voice, glassFilter, 'triangle', startFreq * 2, targetFreq * 2, time, {
                            gain: 0.08, decay: 0.09, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        });
                        addNoiseBurst(voice, glassFilter, time, { duration: 0.025, gain: 0.025, decay: 0.018, filterType: 'highpass', frequency: 5000 });
                        mod.start(time);
                        carrier.start(time);
                        voice.nodes.push(mod, carrier);
                        break;
                    }
                    case 'arp': {
                        const arpDrive = createVoiceSaturator(3.0);
                        const arpFilter = audioCtx.createBiquadFilter();
                        arpFilter.type = 'bandpass';
                        arpFilter.Q.setValueAtTime(1.2, time);
                        arpFilter.frequency.setValueAtTime(Math.min(7200, Math.max(650, freq * 4)), time);
                        arpDrive.connect(arpFilter);
                        arpFilter.connect(localGain);
                        addVoiceOsc(voice, arpDrive, 'square', startFreq, targetFreq, time, {
                            gain: 0.36, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        });
                        addVoiceOsc(voice, arpDrive, 'sawtooth', startFreq * 2, targetFreq * 2, time, {
                            gain: 0.12, detune: -7, decay: 0.18, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        });
                        break;
                    }
                    case 'piano': {
                        const pianoBody = audioCtx.createBiquadFilter();
                        pianoBody.type = 'lowpass';
                        pianoBody.Q.setValueAtTime(0.55, time);
                        pianoBody.frequency.setValueAtTime(6200, time);
                        pianoBody.connect(localGain);
                        [
                            { type: 'sine', ratio: 1, gain: 0.52, decay: 0.9 },
                            { type: 'triangle', ratio: 2.01, gain: 0.18, decay: 0.32 },
                            { type: 'sine', ratio: 3.01, gain: 0.09, decay: 0.14 },
                            { type: 'sine', ratio: 5.02, gain: 0.045, decay: 0.08 }
                        ].forEach(part => addVoiceOsc(voice, pianoBody, part.type, startFreq * part.ratio, targetFreq * part.ratio, time, {
                            gain: part.gain, decay: part.decay, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        }));
                        addNoiseBurst(voice, pianoBody, time, { duration: 0.018, gain: 0.018, decay: 0.012, filterType: 'highpass', frequency: 3500 });
                        break;
                    }
                    case 'acousticGuitar': case 'electricGuitar': {
                        const isElec = track.typeId === 'electricGuitar';
                        const toneFilter = audioCtx.createBiquadFilter();
                        toneFilter.type = 'lowpass';
                        toneFilter.Q.setValueAtTime(isElec ? 0.9 : 1.4, time);
                        toneFilter.frequency.setValueAtTime(isElec ? 4300 : 7200, time);
                        toneFilter.frequency.exponentialRampToValueAtTime(isElec ? 1500 : 1200, time + 0.42);
                        if (isElec) {
                            const dist = createVoiceSaturator(3.2);
                            const cab = audioCtx.createBiquadFilter();
                            cab.type = 'lowpass';
                            cab.frequency.setValueAtTime(3400, time);
                            cab.Q.setValueAtTime(0.75, time);
                            toneFilter.connect(dist);
                            dist.connect(cab);
                            cab.connect(localGain);
                            addVoiceOsc(voice, toneFilter, 'sawtooth', startFreq, targetFreq, time, {
                                gain: 0.32, detune: -4, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                            });
                            addVoiceOsc(voice, toneFilter, 'triangle', startFreq * 2.01, targetFreq * 2.01, time, {
                                gain: 0.13, decay: 0.42, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                            });
                            addNoiseBurst(voice, toneFilter, time, { duration: 0.026, gain: 0.03, decay: 0.018, filterType: 'highpass', frequency: 2400 });
                        } else {
                            const body = audioCtx.createBiquadFilter();
                            body.type = 'peaking';
                            body.frequency.setValueAtTime(360, time);
                            body.gain.setValueAtTime(5, time);
                            body.Q.setValueAtTime(1.1, time);
                            toneFilter.connect(body);
                            body.connect(localGain);
                            addVoiceOsc(voice, toneFilter, 'triangle', startFreq, targetFreq, time, {
                                gain: 0.36, decay: 0.7, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                            });
                            addVoiceOsc(voice, toneFilter, 'sawtooth', startFreq * 2.02, targetFreq * 2.02, time, {
                                gain: 0.1, decay: 0.18, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                            });
                            addNoiseBurst(voice, toneFilter, time, { duration: 0.04, gain: 0.04, decay: 0.026, filterType: 'bandpass', frequency: 2600, q: 2.4 });
                        }
                        break;
                    }
                    case 'organ': {
                        const organBus = audioCtx.createGain();
                        organBus.gain.setValueAtTime(0.9, time);
                        organBus.connect(localGain);
                        if (track.voiceLfoEnabled) createVoiceLfo(voice, track.wobbleRate || 5.8, 0.035, time).connect(organBus.gain);
                        [
                            { ratio: 1, gain: 0.42 },
                            { ratio: 2, gain: 0.24 },
                            { ratio: 3, gain: 0.13 },
                            { ratio: 4, gain: 0.09 },
                            { ratio: 6, gain: 0.045 }
                        ].forEach(part => addVoiceOsc(voice, organBus, 'sine', startFreq * part.ratio, targetFreq * part.ratio, time, {
                            gain: part.gain, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        }));
                        addNoiseBurst(voice, organBus, time, { duration: 0.02, gain: 0.014, decay: 0.014, filterType: 'highpass', frequency: 4200 });
                        break;
                    }
                    case 'marimba': {
                        const woodBody = audioCtx.createBiquadFilter();
                        woodBody.type = 'lowpass';
                        woodBody.frequency.setValueAtTime(5200, time);
                        woodBody.Q.setValueAtTime(0.9, time);
                        woodBody.connect(localGain);
                        [
                            { ratio: 1, gain: 0.52, decay: 0.38 },
                            { ratio: 3.97, gain: 0.16, decay: 0.11 },
                            { ratio: 9.2, gain: 0.07, decay: 0.055 }
                        ].forEach(part => addVoiceOsc(voice, woodBody, 'sine', startFreq * part.ratio, targetFreq * part.ratio, time, {
                            gain: part.gain, decay: part.decay, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        }));
                        addNoiseBurst(voice, woodBody, time, { duration: 0.018, gain: 0.035, decay: 0.012, filterType: 'bandpass', frequency: 1700, q: 3.5 });
                        break;
                    }
                    case 'vibraphone': {
                        const vLfoG = track.voiceLfoEnabled ? createVoiceLfo(voice, track.wobbleRate || 6, freq * 0.01, time) : null;
                        [
                            { ratio: 1, gain: 0.44, decay: 1.35, pan: -0.12 },
                            { ratio: 2.01, gain: 0.18, decay: 0.9, pan: 0.14 },
                            { ratio: 3.98, gain: 0.06, decay: 0.45, pan: 0.04 }
                        ].forEach(part => addVoiceOsc(voice, localGain, 'sine', startFreq * part.ratio, targetFreq * part.ratio, time, {
                            gain: part.gain, decay: part.decay, pan: part.pan, lfoGain: vLfoG, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        }));
                        break;
                    }
                    case 'brass': {
                        const brassDrive = createVoiceSaturator(1.5);
                        brassDrive.connect(lp);
                        lp.Q.setValueAtTime(1.2, time);
                        lp.frequency.setValueAtTime(Math.max(220, freq * 0.8), time);
                        lp.frequency.linearRampToValueAtTime(Math.min(9000, Math.max(900, freq * 5.2)), time + Math.max(0.06, env.a + 0.08));
                        [
                            { type: 'sawtooth', det: -8, gain: 0.25, pan: -0.1 },
                            { type: 'sawtooth', det: 3, gain: 0.28, pan: 0.08 },
                            { type: 'square', det: 10, gain: 0.12, pan: 0 }
                        ].forEach(part => addVoiceOsc(voice, brassDrive, part.type, startFreq, targetFreq, time, {
                            gain: part.gain, detune: part.det, pan: part.pan, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        }));
                        break;
                    }
                    case 'flute': {
                        const fluteBody = audioCtx.createBiquadFilter();
                        fluteBody.type = 'lowpass';
                        fluteBody.Q.setValueAtTime(0.65, time);
                        fluteBody.frequency.setValueAtTime(Math.min(9000, Math.max(1600, freq * 7)), time);
                        fluteBody.connect(localGain);
                        const fLfoG = track.voiceLfoEnabled ? createVoiceLfo(voice, track.wobbleRate || 5, freq * 0.005, time) : null;
                        addVoiceOsc(voice, fluteBody, 'sine', startFreq, targetFreq, time, {
                            gain: 0.46, lfoGain: fLfoG, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        });
                        addVoiceOsc(voice, fluteBody, 'triangle', startFreq * 2, targetFreq * 2, time, {
                            gain: 0.08, lfoGain: fLfoG, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        });
                        addNoiseBurst(voice, fluteBody, time, { duration: 0.5, loop: true, gain: 0.026, attack: 0.02, filterType: 'highpass', frequency: 2400, q: 0.7 });
                        break;
                    }
                    case 'supersaw': {
                        const sawDrive = createVoiceSaturator(1.35);
                        const sawLp = audioCtx.createBiquadFilter();
                        sawLp.type = 'lowpass';
                        sawLp.Q.setValueAtTime(0.75, time);
                        sawLp.frequency.setValueAtTime(Math.min(11000, Math.max(1400, freq * 6)), time);
                        sawDrive.connect(sawLp);
                        sawLp.connect(localGain);
                        const dets = state.performanceMode === 'high'
                            ? [-19, -12, -6, 0, 7, 13, 21]
                            : [-15, -7, 0, 8, 16];
                        dets.forEach((det, index) => {
                            const spread = dets.length > 1 ? (index / (dets.length - 1)) * 2 - 1 : 0;
                            addVoiceOsc(voice, sawDrive, 'sawtooth', startFreq, targetFreq, time, {
                                gain: state.performanceMode === 'high' ? 0.105 : 0.15,
                                detune: det,
                                pan: spread * 0.42,
                                glideDur,
                                glideMode: track.glideMode,
                                forceGlide: targetFreq !== startFreq || isGlide
                            });
                        });
                        break;
                    }
                    case 'wobblebass': {
                        const wobbleDrive = createVoiceSaturator(2.8);
                        wobbleDrive.connect(lp);
                        const wLfoG = createVoiceLfo(voice, track.wobbleRate || (state.bpm / 60) * 2, 650, time);
                        lp.frequency.setValueAtTime(Math.max(500, freq * 5), time);
                        wLfoG.connect(lp.frequency);
                        lp.Q.setValueAtTime(9.5, time);
                        addVoiceOsc(voice, localGain, 'sine', startFreq * 0.5, targetFreq * 0.5, time, {
                            gain: 0.34, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        });
                        addVoiceOsc(voice, wobbleDrive, 'sawtooth', startFreq, targetFreq, time, {
                            gain: 0.34, detune: -5, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        });
                        addVoiceOsc(voice, wobbleDrive, 'square', startFreq, targetFreq, time, {
                            gain: 0.14, detune: 6, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        });
                        localGain.gain.setValueAtTime(0, time);
                        localGain.gain.linearRampToValueAtTime(0.86, time + env.a);
                        localGain.gain.linearRampToValueAtTime(env.s * 0.82, time + env.a + env.d);
                        isWobbleOverride = true;
                        break;
                    }
                    case 'celeste': {
                        [
                            { ratio: 1, gain: 0.36, decay: 0.8, pan: -0.08 },
                            { ratio: 2.02, gain: 0.13, decay: 0.36, pan: 0.1 },
                            { ratio: 4.03, gain: 0.15, decay: 0.22, pan: 0.05 },
                            { ratio: 5.01, gain: 0.055, decay: 0.12, pan: -0.02 }
                        ].forEach(part => addVoiceOsc(voice, localGain, 'sine', startFreq * part.ratio, targetFreq * part.ratio, time, {
                            gain: part.gain, decay: part.decay, pan: part.pan, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        }));
                        break;
                    }
                    case 'clavinet': {
                        const clDrive = createVoiceSaturator(3.4);
                        clDrive.connect(lp);
                        lp.Q.setValueAtTime(2.6, time);
                        lp.frequency.setValueAtTime(Math.max(400, freq * 2), time);
                        lp.frequency.linearRampToValueAtTime(Math.min(8500, Math.max(1200, freq * 7)), time + 0.035);
                        lp.frequency.linearRampToValueAtTime(Math.max(320, freq * 1.3), time + 0.22);
                        addVoiceOsc(voice, clDrive, 'square', startFreq, targetFreq, time, {
                            gain: 0.36, decay: 0.25, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        });
                        addVoiceOsc(voice, clDrive, 'sawtooth', startFreq * 2, targetFreq * 2, time, {
                            gain: 0.1, decay: 0.09, detune: -6, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                        });
                        addNoiseBurst(voice, clDrive, time, { duration: 0.016, gain: 0.03, decay: 0.01, filterType: 'highpass', frequency: 3800 });
                        break;
                    }
                    case 'theremin': {
                        const thereminBody = audioCtx.createBiquadFilter();
                        thereminBody.type = 'lowpass';
                        thereminBody.Q.setValueAtTime(0.7, time);
                        thereminBody.frequency.setValueAtTime(Math.min(6000, Math.max(1200, freq * 5.5)), time);
                        thereminBody.connect(localGain);
                        const tLfoG = createVoiceLfo(voice, track.wobbleRate || 5.5, freq * 0.02, time);
                        addVoiceOsc(voice, thereminBody, 'sine', startFreq, targetFreq, time, {
                            gain: 0.48, lfoGain: tLfoG, glideDur, glideMode: track.glideMode, forceGlide: true
                        });
                        addVoiceOsc(voice, thereminBody, 'triangle', startFreq * 2, targetFreq * 2, time, {
                            gain: 0.07, lfoGain: tLfoG, glideDur, glideMode: track.glideMode, forceGlide: true
                        });
                        break;
                    }
                    case 'whiteNoise': {
                        const noiseSource = audioCtx.createBufferSource();
                        noiseSource.buffer = createNoiseBuffer(1.4);
                        noiseSource.loop = true;
                        const noiseHp = audioCtx.createBiquadFilter();
                        noiseHp.type = 'highpass';
                        noiseHp.frequency.setValueAtTime(180, time);
                        noiseHp.Q.setValueAtTime(0.65, time);
                        const noiseBp = audioCtx.createBiquadFilter();
                        noiseBp.type = 'bandpass';
                        noiseBp.Q.setValueAtTime(0.9, time);
                        noiseBp.frequency.setValueAtTime(Math.min(10000, Math.max(220, freq * 4)), time);
                        noiseSource.connect(noiseHp);
                        noiseHp.connect(noiseBp);
                        noiseBp.connect(localGain);
                        noiseSource.start(time);
                        voice.nodes.push(noiseSource);
                        break;
                    }
                    case 'bassGuitar':
                    case 'bassguitar': {
                        const baseOct = track.baseOctaveOffset || 0;
                        const userOct = track.octaveOffset || 0;
                        const originalOct = parseInt(rowName.slice(-1));
                        const targetOct = originalOct + baseOct + userOct;
                        const noteBase = rowName.slice(0, -1);
                        const shiftedNoteName = noteBase + targetOct;
                        const bassBody = audioCtx.createBiquadFilter();
                        bassBody.type = 'lowpass';
                        bassBody.Q.setValueAtTime(0.8, time);
                        bassBody.frequency.setValueAtTime(1650, time);
                        bassBody.connect(localGain);
                        const cacheKey = `Guitar ${shiftedNoteName}`;
                        if (mcp2000_cache[cacheKey]) {
                            const sampleDrive = createVoiceSaturator(1.35);
                            const source = audioCtx.createBufferSource();
                            source.buffer = mcp2000_cache[cacheKey];
                            source.connect(sampleDrive);
                            sampleDrive.connect(bassBody);
                            source.start(time);
                            voice.nodes.push(source);
                        } else {
                            addVoiceOsc(voice, bassBody, 'triangle', startFreq, targetFreq, time, {
                                gain: 0.48, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                            });
                            addVoiceOsc(voice, bassBody, 'sawtooth', startFreq * 2, targetFreq * 2, time, {
                                gain: 0.08, decay: 0.18, glideDur, glideMode: track.glideMode, forceGlide: targetFreq !== startFreq || isGlide
                            });
                        }
                        addNoiseBurst(voice, bassBody, time, { duration: 0.022, gain: 0.024, decay: 0.014, filterType: 'highpass', frequency: 1300 });
                        break;
                    }
                    default:
                        const defO = audioCtx.createOscillator(); defO.type = track.typeId === 'bass' ? 'triangle' : 'sawtooth';
                        defO.frequency.setValueAtTime(startFreq, time);
                        if (targetFreq !== startFreq || isGlide) applyGlide(defO.frequency, startFreq, targetFreq, time, glideDur, track.glideMode);
                        defO.connect(localGain); defO.start(time); voice.nodes.push(defO);
                        break;
                }

                if (!isWobbleOverride) {
                    localGain.gain.setValueAtTime(0, time);
                    localGain.gain.linearRampToValueAtTime(1.0, time + env.a);
                    localGain.gain.linearRampToValueAtTime(env.s, time + env.a + env.d);
                }

                if (stepData) noteOff(track, rowIdx, time + (stepData.length || 1.0) * (beatDur / (track.subdiv || 4)), null, !!stepData.arp);
            }
            return voice;
        }

        function panic() {
            state.activeNotes.forEach((voice, voiceId) => {
                const now = audioCtx.currentTime;
                releaseVoice(voiceId, voice, now, { force: true, releaseSeconds: 0.03 });
            });
            state.activeNotes.clear();
        }

        function noteOff(track, rowIdx, time, doubledFromId = null, releaseOnly = false) {
            if (!releaseOnly && isArpEligibleTrack(track) && track.arp && track.arp.enabled) {
                track.arp = normalizeArp(track.arp);
                if (!track.arp.latch) {
                    track.arp.heldNotes = track.arp.heldNotes.filter(n => n !== rowIdx);
                    if (track.arp.heldNotes.length === 0) {
                        track.arp.currentIdx = 0;
                        track.arp.lastStep = -1;
                        track.arp.goingUp = true;
                    }
                }
            }
            releaseTrackVoices(track, rowIdx, time);

            // Handle MIDI Doubling Off
            if (!doubledFromId && track.midiDoublingTargetId) {
                const targetTrack = state.tracks.find(t => t.id === track.midiDoublingTargetId);
                if (targetTrack && targetTrack.id !== track.id) {
                    noteOff(targetTrack, rowIdx, time, track.id);
                }
            }
            recordNote(track, rowIdx, false);
        }

        function playSound(track, rowIdx, time, stepData) {
            noteOn(track, rowIdx, time, stepData);
        }


        function updateOctaveDisp() {
            const track = state.tracks[state.activeTrackId];
            if (!track) return;
            const badge = document.getElementById(`oct_${track.id}`);
            if (badge) {
                const oct = (track.octaveOffset || 0);
                badge.textContent = `OCT ${oct >= 0 ? '+' : ''}${oct}`;
                badge.style.color = oct !== 0 ? 'var(--accent-cyan)' : 'var(--accent-pink)';
            }
        }

        // --- Scheduler & Mod ---
        let nextNoteTime = 0; let timerID;

        function getDrawerValueAt(drawer, progress) {
            if (drawer.mode === 'pad') return 0.5; // Pad doesn't support time-based CV well
            if (drawer.points.length < 2) return 0.5;

            let p1 = drawer.points[0];
            let p2 = drawer.points[drawer.points.length - 1];
            for (let i = 0; i < drawer.points.length - 1; i++) {
                if (drawer.points[i].x <= progress && drawer.points[i + 1].x >= progress) {
                    p1 = drawer.points[i];
                    p2 = drawer.points[i + 1];
                    break;
                }
            }

            let valY;
            if (p1.x === p2.x) valY = p1.y;
            else {
                const t = (progress - p1.x) / (p2.x - p1.x);
                valY = p1.y + t * (p2.y - p1.y);
            }

            let val = 1 - valY;
            if (drawer.modAmount !== undefined) val *= drawer.modAmount;

            // Apply nested modulation
            if (drawer.modSource) {
                const src = state.lookup.drawers.get(drawer.modSource);
                if (src) {
                    const srcVal = getDrawerValueAt(src, progress);
                    if (drawer.modSourceTarget === 'depth') val *= srcVal;
                    else val = Math.max(0, Math.min(1, val + (srcVal - 0.5)));
                }
            }
            return val;
        }

        function applyModulation(time, stepDuration) {
            state.drawers.forEach(drawer => {
                if (!drawer.connection) return;

                let progress;
                if (drawer.sync !== false) {
                    const cycleSteps = state.totalSteps / (drawer.waveRate || 1);
                    progress = (state.currentStep % cycleSteps) / cycleSteps;
                } else {
                    progress = (time * (drawer.waveRate || 1)) % 1;
                }

                const targetTrack = state.lookup.tracks.get(drawer.connection);
                const targetFx = state.lookup.fxUnits.get(drawer.connection);
                const targetDrawer = state.lookup.drawers.get(drawer.connection);
                if (!targetTrack && !targetFx && !targetDrawer) return;

                const val = getDrawerValueAt(drawer, progress);

                // Skip modulation if in Manual/Pad mode
                if (drawer.mode === 'pad') return;

                // Track Targets
                if (targetTrack) {
                    if (drawer.modTarget === 'x') {
                        targetTrack.xy.x = val;
                        applyTrackFilter(targetTrack, time);
                        const xyCanvas = document.getElementById(`xy_${targetTrack.id}`);
                        if (xyCanvas) drawXY(xyCanvas, targetTrack);
                    } else if (drawer.modTarget === 'y') {
                        targetTrack.xy.y = val;
                        applyTrackFilter(targetTrack, time);
                        const xyCanvas = document.getElementById(`xy_${targetTrack.id}`);
                        if (xyCanvas) drawXY(xyCanvas, targetTrack);
                    } else if (drawer.modTarget === 'volume') {
                        targetTrack.gainNode.gain.setTargetAtTime(val * targetTrack.volume, time, 0.05);
                    } else if (drawer.modTarget === 'pan') {
                        targetTrack.panNode.pan.setTargetAtTime(val * 2 - 1, time, 0.05);
                    } else if (drawer.modTarget === 'decay' && targetTrack.adsr) {
                        const baseDecay = targetTrack.adsrDefaults ? targetTrack.adsrDefaults.d : 0.5;
                        targetTrack.adsr.d = Math.max(0.005, baseDecay + (val - 0.5) * baseDecay * 1.5);
                        const adsrCanvas = document.getElementById(`adsr_${targetTrack.id}`);
                        if (adsrCanvas) drawADSR(adsrCanvas, targetTrack.adsr, targetTrack, state.activeTrackId === state.tracks.indexOf(targetTrack));
                    } else if (drawer.modTarget === 'sustain' && targetTrack.adsr) {
                        targetTrack.adsr.s = Math.max(0, Math.min(1, val));
                        const adsrCanvas = document.getElementById(`adsr_${targetTrack.id}`);
                        if (adsrCanvas) drawADSR(adsrCanvas, targetTrack.adsr, targetTrack, state.activeTrackId === state.tracks.indexOf(targetTrack));
                    } else if (drawer.modTarget === 'adsr' && targetTrack.adsr) {
                        const baseA = targetTrack.adsrDefaults ? targetTrack.adsrDefaults.a : 0.1;
                        const baseR = targetTrack.adsrDefaults ? targetTrack.adsrDefaults.r : 0.4;
                        targetTrack.adsr.a = Math.max(0.005, baseA + (val - 0.5) * baseA * 1.5);
                        targetTrack.adsr.r = Math.max(0.005, baseR + (val - 0.5) * baseR * 1.5);
                        const adsrCanvas = document.getElementById(`adsr_${targetTrack.id}`);
                        if (adsrCanvas) drawADSR(adsrCanvas, targetTrack.adsr, targetTrack, state.activeTrackId === state.tracks.indexOf(targetTrack));
                    } else if (drawer.modTarget === 'wobble') {
                        // Modulate the LFO/Wobble rate
                        const baseRate = (state.bpm / 60) * 2; // Default 8th notes
                        targetTrack.wobbleRate = Math.max(0.1, baseRate * (val * 4)); // Range from 0.1Hz to 4x base rate
                        // Update active voices
                        state.activeNotes.forEach(voice => {
                            if (voice.track.id === targetTrack.id && voice.lfo) {
                                voice.lfo.frequency.setTargetAtTime(targetTrack.wobbleRate, time, 0.05);
                            }
                        });
                    }
                }

                // FX Targets (if connection is an FX unit)
                if (targetFx) {
                    if (drawer.modTarget === 'time' && targetFx.nodes.delay) {
                        targetFx.nodes.delay.delayTime.setTargetAtTime(val * 2.0, time, 0.05);
                    } else if (drawer.modTarget === 'drive' && targetFx.nodes.shaper) {
                        targetFx.params.drive = val;
                        updateShaperCurve(targetFx);
                    } else if (drawer.modTarget === 'mix') {
                        targetFx.params.mix = val;
                        updateFxParams(targetFx, null);
                    }
                }

                // Drawer Targets (Drawer-to-Drawer)
                if (targetDrawer) {
                    if (drawer.modTarget === 'rate') {
                        // Modulate the rate of another drawer
                        const baseRate = targetDrawer.baseRate || 1;
                        targetDrawer.waveRate = Math.max(0.1, baseRate * (0.5 + val * 2));
                    } else if (drawer.modTarget === 'depth') {
                        // Modulate the depth/amount of another drawer (stored as modAmount)
                        targetDrawer.modAmount = val;
                    }
                }
            });
        }

        function triggerSidechain(time) {
            const beatDur = 60.0 / state.bpm;
            state.tracks.forEach(track => {
                if (track.sidechainEnabled && track.sidechainNode) {
                    const node = track.sidechainNode;
                    if (typeof node.gain.cancelAndHoldAtTime === 'function') {
                        node.gain.cancelAndHoldAtTime(time);
                    } else {
                        node.gain.cancelScheduledValues(time);
                        try { node.gain.setValueAtTime(node.gain.value, time); } catch (e) { }
                    }
                    node.gain.setValueAtTime(1.0, time);
                    node.gain.exponentialRampToValueAtTime(0.001, time + 0.01);
                    node.gain.exponentialRampToValueAtTime(1.0, time + beatDur * 0.2);
                }
            });
            // Also trigger any Sidechain FX Pedals
            state.fxUnits.forEach(unit => {
                if (unit.type === 'sidechain' && unit.nodes.sc) {
                    const depth = 1.0 - (unit.params.depth || 0.8);
                    const release = unit.params.release || 0.2;
                    unit.nodes.sc.gain.setValueAtTime(1.0, time);
                    unit.nodes.sc.gain.exponentialRampToValueAtTime(Math.max(0.001, depth), time + 0.01);
                    unit.nodes.sc.gain.exponentialRampToValueAtTime(1.0, time + beatDur * release);
                }
            });
        }

        function scheduleNote(step, time) {
            requestAnimationFrame(() => {
                document.querySelectorAll('.step.current').forEach(s => s.classList.remove('current'));
                state.tracks.forEach((track, tIdx) => {
                    const currentTrackSubdiv = track.subdiv || 4;
                    const ratio = Math.round(state.stepsPerBeat / currentTrackSubdiv);
                    const baseSteps = Math.round(state.timeSignature * currentTrackSubdiv);
                    const trackSteps = baseSteps * (track.loopMultiplier || 1);
                    const totalInternalSteps = trackSteps * ratio;
                    const localStep = step % totalInternalSteps;
                    const trackStep = Math.floor(localStep / ratio);
                    const trackEl = document.getElementById('tracks-container').children[tIdx];
                    if (trackEl) {
                        trackEl.querySelectorAll(`.step[data-step="${trackStep}"]`).forEach(s => s.classList.add('current'));
                    }
                });

                if (state.isPlaying) {
                    const currentBeat = Math.floor((step % state.totalSteps) / state.stepsPerBeat);
                    cachedBeatPips.forEach((pip, idx) => {
                        if (idx === currentBeat) pip.classList.add('active');
                        else pip.classList.remove('active');
                    });
                }
            });

            const stepDuration = (60.0 / state.bpm) / state.stepsPerBeat;
            applyModulation(time, stepDuration);

            const anySolo = state.tracks.some(t => t.solo);
            state.tracks.forEach(track => {
                if (track.muted) return;
                if (anySolo && !track.solo) return;
                const currentTrackSubdiv = track.subdiv || 4;
                const ratio = Math.round(state.stepsPerBeat / currentTrackSubdiv);
                const baseSteps = Math.round(state.timeSignature * currentTrackSubdiv);
                const trackSteps = baseSteps * (track.loopMultiplier || 1);
                const totalInternalSteps = trackSteps * ratio;
                const localStep = step % totalInternalSteps;

                if (localStep % ratio === 0) {
                    const trackStep = localStep / ratio;

                    // Randomize on Loop Restart
                    if (trackStep === 0 && track.randOnLoop && state.isPlaying) {
                        randomizeTrack(track);
                    }

                    const arpUsesSequencer = isArpEligibleTrack(track) && track.arp && track.arp.enabled;
                    if (arpUsesSequencer) {
                        updateSequencerArpPool(track, getSequencerArpRows(track, trackStep, trackSteps));
                    }

                    for (let r = 0; r < track.grid.length; r++) {
                        const stepData = track.grid[r][trackStep];
                        const isOn = typeof stepData === 'object' ? stepData.on : !!stepData;
                        if (isOn) {
                            if (arpUsesSequencer) continue;
                            let playTime = time;
                            if (stepData && stepData.jitter) {
                                const stepDur = (60.0 / state.bpm) / currentTrackSubdiv;
                                playTime += stepData.jitter * stepDur;
                            }
                            noteOn(track, r, playTime, stepData);
                        }
                    }
                }

                // Arpeggiator Engine
                if (isArpEligibleTrack(track) && track.arp && track.arp.enabled && track.arp.heldNotes.length > 0) {
                    track.arp = normalizeArp(track.arp);
                    const arpSubdiv = track.arp.subdivision || 12;
                    const arpStep = Math.floor(step / arpSubdiv);
                    if (step % arpSubdiv === 0 && track.arp.lastStep !== arpStep) {
                        track.arp.lastStep = arpStep;
                        const notes = getOrderedArpNotes(track);
                        if (notes.length === 0) return;
                        const rowToPlay = getArpRowToPlay(track, notes);
                        if (rowToPlay === null) return;
                        noteOn(track, rowToPlay, time, getArpStepData(track), false, null);
                        advanceArpIndex(track, notes.length);
                    }
                }
            });

            if (state.clickTrack && (step % state.totalSteps) % state.stepsPerBeat === 0) {
                const isDownbeat = (step % state.totalSteps) === 0;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(masterGain);

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(isDownbeat ? 1200 : 800, time);
                osc.frequency.exponentialRampToValueAtTime(isDownbeat ? 600 : 400, time + 0.03);
                gain.gain.setValueAtTime(0.3, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

                osc.start(time);
                osc.stop(time + 0.06);
            }
        }

        function scheduler() {
            toneBridge.setBpm(state.bpm);
            const sigVal = document.getElementById('sig-input')?.value;
            if (sigVal) state.timeSignature = parseInt(sigVal);

            while (nextNoteTime < audioCtx.currentTime + 0.1) {
                // Batch Export Scene Transition Logic
                if (state.isExporting && isBatching) {
                    const maxMult = Math.max(1, ...state.tracks.map(t => t.loopMultiplier || 1));
                    const totalStepsInScene = state.totalSteps * maxMult;
                    const loopsRequired = 2; // Loop each scene twice

                    if (state.currentStep >= totalStepsInScene * loopsRequired) {
                        // Find next scene
                        let nextIdx = -1;
                        for (let i = currentBatchIdx + 1; i < 8; i++) {
                            if (state.scenes[i]) { nextIdx = i; break; }
                        }

                        if (nextIdx !== -1) {
                            currentBatchIdx = nextIdx;
                            loadScene(currentBatchIdx);
                            state.currentStep = 0;
                            // Do not reset nextNoteTime, continue seamlessly
                        } else {
                            // No more scenes to batch
                            stopExport();
                            return;
                        }
                    }
                }

                scheduleNote(state.currentStep, nextNoteTime);
                const stepDuration = (60.0 / state.bpm) / state.stepsPerBeat;
                nextNoteTime += stepDuration;
                state.currentStep++;
            }
            timerID = setTimeout(scheduler, 25.0);
        }

        // --- Event Listeners ---
        const playBtn = document.getElementById('play-btn');
        playBtn.onclick = () => {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            toneBridge.start();
            toneBridge.setBpm(state.bpm);
            state.isPlaying = !state.isPlaying;
            if (state.isPlaying) {
                state.currentStep = 0; nextNoteTime = audioCtx.currentTime;
                scheduler(); playBtn.textContent = 'STOP'; playBtn.classList.add('active');
            } else {
                clearTimeout(timerID);
                panic();
                activeKeys.clear();
                playBtn.textContent = 'PLAY'; playBtn.classList.remove('active');
            }
        };

        const recBtn = document.getElementById('rec-btn');
        recBtn.onclick = () => { state.isRecording = !state.isRecording; recBtn.classList.toggle('active'); };

        const clickBtn = document.getElementById('click-btn');
        clickBtn.onclick = () => { state.clickTrack = !state.clickTrack; clickBtn.classList.toggle('active'); };

        // --- Keyboard → Note Input ---
        function getKeyboardMap() {
            const track = state.tracks[state.activeTrackId];
            if (!track) return {};
            const template = instrumentTypes[track.typeId];

            if (template.type === 'drum') {
                return {
                    'a': 0, 'w': 1, 's': 2, 'e': 3, 'd': 4, 'f': 5, 't': 6, 'g': 7,
                    'y': 8, 'h': 9, 'u': 10, 'j': 11, 'k': 12, 'o': 13, 'l': 14, ';': 15
                };
            }

            if (state.globalScale === 'chromatic') {
                return {
                    'a': 24, 'w': 23, 's': 22, 'e': 21, 'd': 20, 'f': 19, 't': 18, 'g': 17, 'y': 16, 'h': 15, 'u': 14, 'j': 13, 'k': 12,
                    'o': 11, 'l': 10, 'p': 9, ';': 8, '[': 7, "'": 6
                };
            }
            const keys = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l', 'p', ';', '[', "'"];
            const map = {};
            const rowNames = template.rows;
            const rootIdx = noteNames.indexOf(state.globalKey);
            if (rootIdx < 0) return map;
            const playableRows = rowNames
                .map((name, rowIdx) => ({ rowIdx, semitone: noteNameToAbsoluteSemitone(name) }))
                .filter(row => Number.isFinite(row.semitone));
            for (let i = 0; i < keys.length; i++) {
                const absolute = rootIdx + i;
                const targetSemitone = (4 * 12) + absolute;
                let nearest = null;
                playableRows.forEach(row => {
                    const distance = Math.abs(row.semitone - targetSemitone);
                    if (
                        !nearest ||
                        distance < nearest.distance ||
                        (distance === nearest.distance && row.semitone < nearest.semitone)
                    ) {
                        nearest = { ...row, distance };
                    }
                });
                if (nearest) map[keys[i]] = nearest.rowIdx;
            }
            return map;
        }

        function recordNote(track, rowIdx, isDown = true) {
            if (state.isRecording && state.isPlaying) {
                const currentTrackSubdiv = track.subdiv || 4;
                const stepDuration = (60.0 / state.bpm) / state.stepsPerBeat;
                const ratio = state.stepsPerBeat / currentTrackSubdiv;
                const stepsAhead = (nextNoteTime - audioCtx.currentTime) / stepDuration;
                let trackStep = Math.round((state.currentStep - stepsAhead) / ratio - 0.3);
                const trackSteps = (track.loopMultiplier || 1) * state.timeSignature * currentTrackSubdiv;
                trackStep = ((trackStep % trackSteps) + trackSteps) % trackSteps;

                if (isDown) {
                    track.grid[rowIdx][trackStep] = { on: true, length: 0.1, _recording: true, _startStep: trackStep };
                    markTrackCellDirty(track, rowIdx, trackStep);
                } else {
                    for (let s = 0; s < trackSteps; s++) {
                        const note = track.grid[rowIdx][s];
                        if (note && note._recording) {
                            let dur = (trackStep - s + trackSteps) % trackSteps;
                            if (dur === 0) dur = 0.5;
                            note.length = Math.max(0.25, dur);
                            delete note._recording;
                            delete note._startStep;
                            markTrackCellDirty(track, rowIdx, s);
                        }
                    }
                }
                if (track.gridCells && !track.minimized) scheduleTrackGridUpdate(track);
                else renderTracks();
            }
        }

        const activeKeys = new Set();
        function setKeyboardRowFeedback(track, rowIdx, isActive) {
            const trackEl = track ? document.getElementById('track_' + track.id) : null;
            const rowEl = trackEl?.querySelectorAll('.grid-row')[rowIdx];
            if (rowEl) rowEl.classList.toggle('keyboard-active', !!isActive);
        }

        window.addEventListener('keydown', (e) => {
            if (isFocusedOnInput() || e.repeat) return;
            if (e.code === 'Space') { e.preventDefault(); playBtn.click(); return; }
            if (e.key === 'Escape') { panic(); return; }

            const key = e.key.toLowerCase();
            const track = state.tracks[state.activeTrackId];
            if (!track) return;

            // Octave controls
            if (key === 'z') { track.octaveOffset = Math.max(-3, (track.octaveOffset || 0) - 1); updateOctaveDisp(); renderTracks(); return; }
            if (key === 'x') { track.octaveOffset = Math.min(3, (track.octaveOffset || 0) + 1); updateOctaveDisp(); renderTracks(); return; }

            const map = getKeyboardMap();
            if (map[key] !== undefined) {
                const rowIdx = map[key];
                if (audioCtx.state === 'suspended') audioCtx.resume();
                if (track.typeId === 'drumSet') {
                    triggerSamplerKeyboardPad(track, rowIdx, audioCtx.currentTime);
                    if (track.grid[rowIdx]) recordNote(track, rowIdx);
                    activeKeys.add(key);
                    setKeyboardRowFeedback(track, rowIdx, true);
                    return;
                }
                noteOn(track, rowIdx, audioCtx.currentTime, null, true);
                activeKeys.add(key);
                setKeyboardRowFeedback(track, rowIdx, true);

                recordNote(track, rowIdx);
            }
        });

        window.addEventListener('keyup', (e) => {
            if (isFocusedOnInput()) return;
            const key = e.key.toLowerCase();
            const map = getKeyboardMap();
            if (map[key] !== undefined) {
                const track = state.tracks[state.activeTrackId];
                if (track?.typeId === 'drumSet') {
                    if (track.grid[map[key]]) recordNote(track, map[key], false);
                    if (samplerUsesHeldGate(track)) noteOff(track, map[key], audioCtx.currentTime);
                    setKeyboardRowFeedback(track, map[key], false);
                    activeKeys.delete(key);
                    return;
                }
                if (track) noteOff(track, map[key], audioCtx.currentTime);
                if (track) setKeyboardRowFeedback(track, map[key], false);
                activeKeys.delete(key);
            }
        });

        function isFocusedOnInput() {
            const el = document.activeElement;
            if (!el) return false;
            if (el instanceof HTMLInputElement) {
                const inputType = (el.type || 'text').toLowerCase();
                return inputType !== 'range' && inputType !== 'button' && inputType !== 'checkbox' && inputType !== 'radio';
            }
            const tag = el.tagName;
            return tag === 'SELECT' || tag === 'TEXTAREA' || el.isContentEditable;
        }

        const exportBtn = document.getElementById('export-btn');
        const batchExportBtn = document.getElementById('batch-export-btn');
        let exportFilename = "Vibleton_Export";
        let mediaRecorder = null;
        let recordedChunks = [];
        let onExportComplete = null;
        let isBatching = false;
        let currentBatchIdx = -1;

        function getMimeType() {
            const types = ['audio/mpeg', 'audio/mp3', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
            for (const t of types) if (MediaRecorder.isTypeSupported(t)) return t;
            return '';
        }

        function triggerExport(filename, callback) {
            if (state.isExporting) return;
            if (audioCtx.state === 'suspended') audioCtx.resume();

            state.isExporting = true;
            exportFilename = filename;
            onExportComplete = callback;

            exportBtn.textContent = 'REC...';
            exportBtn.classList.add('active');

            const dest = audioCtx.createMediaStreamDestination();
            masterAnalyser.connect(dest);

            const mimeType = getMimeType();
            if (!mimeType) {
                try { masterAnalyser.disconnect(dest); } catch (e) { }
                alert("Recording not supported in this browser.");
                state.isExporting = false;
                return;
            }

            recordedChunks = [];
            mediaRecorder = new MediaRecorder(dest.stream, { mimeType, audioBitsPerSecond: 192000 });
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
            mediaRecorder.onstop = () => {
                try { masterAnalyser.disconnect(dest); } catch (e) { }
                const blob = new Blob(recordedChunks, { type: mimeType });
                const isMp3 = mimeType.includes('mpeg') || mimeType.includes('mp3');
                const ext = isMp3 ? 'mp3' : (mimeType.includes('ogg') ? 'ogg' : 'webm');
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `${exportFilename}_${Date.now()}.${ext}`; a.click();
                if (onExportComplete) {
                    const cb = onExportComplete;
                    onExportComplete = null;
                    cb();
                }
            };

            mediaRecorder.start();

            // Auto-stop monitor
            const checkStop = () => {
                if (!state.isExporting) return;
                if (!isBatching) {
                    const maxMult = Math.max(1, ...state.tracks.map(t => t.loopMultiplier || 1));
                    const totalSteps = state.totalSteps * maxMult;
                    if (state.currentStep >= totalSteps && state.isPlaying) {
                        stopExport();
                    } else {
                        setTimeout(checkStop, 100);
                    }
                }
            };
            checkStop();

            // Start playback from beginning
            if (state.isPlaying) { state.isPlaying = false; clearTimeout(timerID); }
            state.currentStep = 0;
            playBtn.click();
        }

        exportBtn.onclick = () => {
            if (state.isExporting) { stopExport(); return; }
            triggerExport("Vibleton_Export", null);
        };

        batchExportBtn.onclick = () => {
            if (isBatching) {
                isBatching = false;
                batchExportBtn.textContent = 'BATCH SCENES';
                batchExportBtn.classList.remove('active');
                if (state.isExporting) stopExport();
                return;
            }

            const firstIdx = state.scenes.findIndex(s => s !== null);
            if (firstIdx === -1) {
                alert("No scenes saved. Shift+Click scene numbers to save the current pattern.");
                return;
            }

            isBatching = true;
            currentBatchIdx = firstIdx;
            batchExportBtn.textContent = 'BATCHING...';
            batchExportBtn.classList.add('active');

            loadScene(currentBatchIdx);
            setTimeout(() => {
                triggerExport("Vibleton_Batch_Export", null);
            }, 100);
        };

        function stopExport() {
            if (!state.isExporting) return;
            state.isExporting = false;

            exportBtn.textContent = 'EXPORT';
            exportBtn.classList.remove('active');
            batchExportBtn.textContent = 'BATCH SCENES';
            batchExportBtn.classList.remove('active');

            if (state.isPlaying) {
                state.isPlaying = false;
                clearTimeout(timerID);
                panic();
                playBtn.textContent = 'PLAY';
                playBtn.classList.remove('active');
            }

            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
            isBatching = false;
        }

        const bpmInput = document.getElementById('bpm-input');
        bpmInput.onmousedown = (e) => {
            pushUndo();
            isDraggingBpm = true;
            startBpmY = e.clientY;
            startBpmVal = state.bpm;
            e.preventDefault();
        };
        bpmInput.onchange = (e) => {
            pushUndo();
            state.bpm = parseInt(e.target.value);
            toneBridge.setBpm(state.bpm);
            renderFxPanels();
        };
        document.getElementById('sig-input').onchange = (e) => {
            pushUndo();
            state.timeSignature = parseInt(e.target.value);
            state.tracks.forEach(t => {
                t.grid = t.grid.map(row => { const nr = Array(64).fill(false); for (let i = 0; i < Math.min(row.length, state.totalSteps); i++) nr[i] = row[i]; return nr; });
            });
            renderTracks();
            renderBeatCounter();
        };

        function changeScale(previousKey = state._lastGlobalKey || state.globalKey, previousScale = state._lastGlobalScale || state.globalScale) {
            const previousRootIdx = noteNames.indexOf(previousKey);
            const oldRows = previousRootIdx >= 0 ? getScaleRows(previousRootIdx, previousScale) : [...instrumentTypes.synthwave.rows];
            updateInstrumentRows();
            const newRows = instrumentTypes.synthwave.rows;
            const preserveRowPositions = previousScale === state.globalScale && oldRows.length === newRows.length;

            state.tracks.forEach(t => {
                if (instrumentTypes[t.typeId].type !== 'drum') {
                    const oldGrid = t.grid;
                    const newRowsLength = newRows.length;
                    const newGrid = Array(newRowsLength).fill().map(() => Array(256).fill(false));

                    // Key changes should transpose the roll by keeping scale-degree row positions.
                    newRows.forEach((newName, newIdx) => {
                        const oldIdx = preserveRowPositions ? newIdx : oldRows.indexOf(newName);
                        if (oldIdx !== -1 && oldGrid[oldIdx]) {
                            newGrid[newIdx] = oldGrid[oldIdx];
                        }
                    });

                    t.grid = newGrid;
                    trackElementCache.delete(t.id);
                }
            });
            state._lastGlobalKey = state.globalKey;
            state._lastGlobalScale = state.globalScale;
            renderTracks();
        }

        // Populate Global Selects
        const keyInput = document.getElementById('key-input');
        const scaleInput = document.getElementById('scale-input');

        noteNames.forEach(n => {
            const opt = document.createElement('option');
            opt.value = n;
            opt.textContent = n;
            if (n === state.globalKey) opt.selected = true;
            keyInput.appendChild(opt);
        });

        Object.keys(scalesDef).forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
            if (s === state.globalScale) opt.selected = true;
            scaleInput.appendChild(opt);
        });

        keyInput.onchange = (e) => { pushUndo(); const previousKey = state.globalKey; const previousScale = state.globalScale; state.globalKey = e.target.value; changeScale(previousKey, previousScale); };
        scaleInput.onchange = (e) => { pushUndo(); const previousKey = state.globalKey; const previousScale = state.globalScale; state.globalScale = e.target.value; changeScale(previousKey, previousScale); };

        // --- Drawer Visuals & UI ---

        function drawDrawerCanvasTitle(ctx, drawer, w, dpr) {
            const index = state.drawers.indexOf(drawer);
            const title = `Drawer ${index >= 0 ? index + 1 : 1}`;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.font = `bold ${9 * dpr}px var(--font-mono)`;
            ctx.fillStyle = 'rgba(180, 190, 205, 0.72)';
            ctx.shadowBlur = 0;
            ctx.fillText(title, w / 2, 5 * dpr, Math.max(24 * dpr, w - 12 * dpr));
            ctx.restore();
        }

        function drawDrawer(canvas, drawer) {
            const ctx = canvas.getContext('2d');
            const w = canvas.width;
            const h = canvas.height;
            const dpr = window.devicePixelRatio || 1;
            ctx.clearRect(0, 0, w, h);

            // --- Premium Grid ---
            ctx.strokeStyle = 'rgba(255,255,255,0.03)';
            ctx.lineWidth = 1;
            // Vertical beat lines
            for (let i = 1; i < 4; i++) {
                const x = (w / 4) * i;
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
            }
            // Horizontal value lines
            for (let i = 1; i < 4; i++) {
                const y = (h / 4) * i;
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
            }

            if (drawer.mode === 'pad') {
                // Tactical XY Pad
                const px = (drawer.padPos?.x || 0.5) * w;
                const py = (drawer.padPos?.y || 0.5) * h;

                // Radar Crosshair
                ctx.strokeStyle = 'rgba(255, 234, 0, 0.1)';
                ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();

                // Blip Glow
                const grad = ctx.createRadialGradient(px, py, 0, px, py, 20 * dpr);
                grad.addColorStop(0, 'rgba(255, 234, 0, 0.3)');
                grad.addColorStop(1, 'rgba(255, 234, 0, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(px, py, 20 * dpr, 0, Math.PI * 2); ctx.fill();

                // Blip Center
                ctx.fillStyle = '#ffea00';
                ctx.beginPath(); ctx.arc(px, py, 4 * dpr, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5 * dpr;
                ctx.stroke();

                // Axes Labels
                ctx.fillStyle = 'rgba(255, 234, 0, 0.4)';
                ctx.font = `bold ${8 * dpr}px var(--font-mono)`;
                ctx.fillText('FREQ', w - 30 * dpr, h - 5 * dpr);
                ctx.save();
                ctx.translate(10 * dpr, 30 * dpr);
                ctx.rotate(-Math.PI / 2);
                ctx.fillText('RES', 0, 0);
                ctx.restore();
                drawDrawerCanvasTitle(ctx, drawer, w, dpr);
                return;
            }

            // --- Curve Mode ---
            if (drawer.points && drawer.points.length > 1) {
                const path = new Path2D();
                drawer.points.forEach((p, i) => {
                    if (i === 0) path.moveTo(p.x * w, p.y * h);
                    else path.lineTo(p.x * w, p.y * h);
                });

                // Fill under curve
                const fillPath = new Path2D(path);
                fillPath.lineTo(w, h); fillPath.lineTo(0, h); fillPath.closePath();
                const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
                fillGrad.addColorStop(0, 'rgba(255, 234, 0, 0.15)');
                fillGrad.addColorStop(1, 'rgba(255, 234, 0, 0)');
                ctx.fillStyle = fillGrad; ctx.fill(fillPath);

                // Stroke curve with glow
                ctx.shadowBlur = 10 * dpr;
                ctx.shadowColor = 'rgba(255, 234, 0, 0.5)';
                ctx.strokeStyle = '#ffea00';
                ctx.lineWidth = 2.5 * dpr;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.stroke(path);
                ctx.shadowBlur = 0;
            }

            // --- Playhead ---
            if (state.isPlaying) {
                let progress;
                if (drawer.sync !== false) {
                    const cycleSteps = state.totalSteps / (drawer.waveRate || 1);
                    progress = (state.currentStep % cycleSteps) / cycleSteps;
                } else {
                    progress = (audioCtx.currentTime * (drawer.waveRate || 1)) % 1;
                }
                const phX = progress * w;

                // Playhead Line
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.lineWidth = 1.5 * dpr;
                ctx.beginPath(); ctx.moveTo(phX, 0); ctx.lineTo(phX, h); ctx.stroke();

                // Value Dot on Playhead
                const val = 1 - getDrawerValueAt(drawer, progress);
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(phX, val * h, 3 * dpr, 0, Math.PI * 2); ctx.fill();
            }

            // Labels
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.font = `${8 * dpr}px var(--font-mono)`;
            ctx.fillText('1.0', 2 * dpr, 10 * dpr);
            ctx.fillText('0.0', 2 * dpr, h - 2 * dpr);
            drawDrawerCanvasTitle(ctx, drawer, w, dpr);
        }

        function generateWaveformPoints(drawer) {
            const numPoints = 256;
            drawer.points = [];
            const type = drawer.waveType;
            const rate = drawer.sync ? (drawer.waveRate || 1) : 1;
            if (type === 'none') return;

            for (let i = 0; i <= numPoints; i++) {
                const x = i / numPoints;
                let y = 0.5;
                if (type === 'sine') y = (Math.sin(x * Math.PI * 2 * rate) + 1) / 2;
                else if (type === 'saw') y = (x * rate) % 1;
                else if (type === 'tri') y = Math.abs((x * rate * 2) % 2 - 1);
                else if (type === 'rect') y = (x * rate) % 1 > 0.5 ? 1 : 0;

                drawer.points.push({ x: x, y: 1 - y });
            }
        }


        function _createDrawerPatchIn(drawer) {
            const patchIn = document.createElement('div');
            patchIn.className = `patch-point mod-in`;
            patchIn.id = `in_${drawer.id}`;
            patchIn.style.borderColor = 'var(--accent-purple)';
            if (state.drawers.some(d => d.connection === drawer.id)) patchIn.classList.add('active');
            return patchIn;
        }

        function _createDrawerModeBtn(drawer) {
            const modeBtn = document.createElement('button');
            modeBtn.textContent = drawer.mode === 'pad' ? 'XY' : 'CV';
            modeBtn.style.padding = '0 6px'; modeBtn.style.fontSize = '0.55rem';
            modeBtn.style.flex = '0 0 auto';
            modeBtn.onclick = () => { drawer.mode = drawer.mode === 'pad' ? 'curve' : 'pad'; renderDrawers(); };
            modeBtn.setAttribute('data-tooltip-title', 'Modulator Mode');
            modeBtn.setAttribute('data-tooltip', 'CV: Draw custom curves or LFOs.\nXY: Use the touch-pad for manual modulation.');
            return modeBtn;
        }

        function _createDrawerTargetSelect(drawer) {
            const select = document.createElement('select');
            select.style.fontSize = '0.6rem';
            select.style.padding = '2px';
            select.style.marginRight = '2px';
            select.style.background = 'var(--surface)';
            select.style.color = 'var(--text-main)';
            select.style.border = '1px solid var(--glass-border)';
            select.style.borderRadius = '3px';
            select.style.minWidth = '0';
            select.style.flex = '1 1 auto';
            select.style.maxWidth = '100%';
            const targets = [
                { val: 'x', label: 'Filter Cutoff' },
                { val: 'y', label: 'Filter Q/Res' },
                { val: 'volume', label: 'Volume Mod' },
                { val: 'pan', label: 'Panning' },
                { val: 'decay', label: 'ADSR: Decay' },
                { val: 'adsr', label: 'ADSR: A/R' },
                { val: 'wobble', label: 'Wobble Rate' },
                { val: 'time', label: 'FX Time/Rate' },
                { val: 'drive', label: 'FX Drive/Depth' },
                { val: 'mix', label: 'FX Mix' },
                { val: 'rate', label: 'Mod: Rate' },
                { val: 'depth', label: 'Mod: Depth' }
            ];
            targets.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.val; opt.textContent = t.label;
                if (drawer.modTarget === t.val) opt.selected = true;
                select.appendChild(opt);
            });
            select.setAttribute('data-tooltip-title', 'Modulation Target');
            select.setAttribute('data-tooltip', 'Select which parameter of the connected track or effect this drawer will control.');
            return select;
        }

        function _createDrawerWaveSelect(drawer) {
            const waveSelect = document.createElement('select');
            waveSelect.style.cssText = 'font-size:0.55rem; background:var(--surface); border:1px solid var(--glass-border); color:var(--text-dim); margin-left:8px; border-radius:3px;';
            waveSelect.setAttribute('data-tooltip-title', 'Wave Shape');
            waveSelect.setAttribute('data-tooltip', 'Choose the modulator waveform. NONE keeps the hand-drawn curve; SINE, SAW, TRI, and RECT generate synced LFO shapes.');
            ['none', 'sine', 'saw', 'tri', 'rect'].forEach(w => {
                const opt = document.createElement('option'); opt.value = w; opt.textContent = w.toUpperCase();
                if (drawer.waveType === w) opt.selected = true;
                waveSelect.appendChild(opt);
            });
            waveSelect.onchange = (e) => {
                drawer.waveType = e.target.value;
                generateWaveformPoints(drawer);
                const canvas = document.getElementById(`canvas_${drawer.id}`);
                if (canvas) drawDrawer(canvas, drawer);
            };
            return waveSelect;
        }

        function _createDrawerSyncBtn(drawer) {
            const syncBtn = document.createElement('button');
            syncBtn.textContent = drawer.sync ? 'SYNC' : 'FREE';
            syncBtn.style.cssText = 'font-size:0.5rem; padding:1px 4px; margin-left:8px; background: ' + (drawer.sync ? 'var(--accent-cyan)' : 'var(--surface)') + '; color: ' + (drawer.sync ? '#000' : 'var(--text-dim)') + '; border: 1px solid var(--glass-border); border-radius: 3px; cursor: pointer;';
            syncBtn.onclick = () => {
                drawer.sync = !drawer.sync;
                if (!drawer.sync) { if (drawer.waveRate > 50) drawer.waveRate = 5; } else { drawer.waveRate = Math.floor(drawer.waveRate) || 1; }
                generateWaveformPoints(drawer);
                renderDrawers();
            };
            syncBtn.setAttribute('data-tooltip-title', 'Tempo Sync');
            syncBtn.setAttribute('data-tooltip', 'SYNC: Lock rate to the song tempo (BPM).\nFREE: Set speed in Hertz (0.1 - 20Hz).');
            return syncBtn;
        }

        function _createDrawerRateWrap(drawer) {
            const rateWrap = document.createElement('div');
            rateWrap.style.cssText = 'display:flex; align-items:center; gap:4px; margin-left:8px;';
            const rateLabel = drawer.sync ? 'RATE' : 'Hz';
            const rateMin = drawer.sync ? 0.25 : 0.1;
            const rateMax = drawer.sync ? 16 : 20;
            const rateStep = drawer.sync ? 0.25 : 0.1;
            rateWrap.innerHTML = `<span style="font-size:0.5rem; color:var(--control-label)">${rateLabel}</span>
                                  <input type="range" min="${rateMin}" max="${rateMax}" step="${rateStep}" value="${drawer.waveRate}" style="width:40px; height:3px;">
                                  <span style="font-size:0.5rem; color:var(--accent-yellow); min-width:15px; text-align:left;">${drawer.waveRate}</span>`;
            rateWrap.querySelector('input').oninput = (e) => {
                drawer.waveRate = parseFloat(e.target.value);
                drawer.baseRate = drawer.waveRate; // Update base rate for modulation
                rateWrap.querySelector('span:last-child').textContent = drawer.waveRate;
                if (drawer.sync && drawer.waveType !== 'none') {
                    generateWaveformPoints(drawer);
                    const canvas = document.getElementById(`canvas_${drawer.id}`);
                    if (canvas) drawDrawer(canvas, drawer);
                }
            };
            rateWrap.setAttribute('data-tooltip-title', 'Modulation Rate');
            rateWrap.setAttribute('data-tooltip', drawer.sync ? 'Tempo-synced speed (1=1 bar, 4=1/4 note).' : 'Free-running frequency in Hertz.');
            return rateWrap;
        }

        function _createDrawerDepthWrap(drawer) {
            const depthWrap = document.createElement('div');
            depthWrap.style.cssText = 'display:flex; align-items:center; gap:3px; margin-left:2px;';
            depthWrap.setAttribute('data-tooltip-title', 'Modulation Depth');
            depthWrap.setAttribute('data-tooltip', 'Scales how strongly this drawer affects its target. 100% is normal depth; values above 100% exaggerate the modulation.');
            depthWrap.innerHTML = `<span style="font-size:0.5rem; color:var(--control-label)">DEPTH</span>
                                   <input type="range" min="0" max="2" step="0.01" value="${drawer.modAmount}" style="width:34px; height:3px; accent-color:var(--accent-pink);">
                                   <span style="font-size:0.5rem; color:var(--accent-pink); min-width:21px; text-align:left;">${Math.round(drawer.modAmount * 100)}%</span>`;
            depthWrap.querySelector('input').oninput = (e) => {
                drawer.modAmount = parseFloat(e.target.value);
                depthWrap.querySelector('span:last-child').textContent = Math.round(drawer.modAmount * 100) + '%';
            };
            return depthWrap;
        }

        function _createDrawerModSourceSelect(drawer) {
            const modTargetSelect = document.createElement('select');
            modTargetSelect.style.cssText = 'font-size:0.55rem; margin-left:4px; background:var(--surface); border:1px solid var(--accent-cyan); color:var(--accent-cyan); border-radius:3px;';
            [{ v: 'depth', l: '×D' }, { v: 'offset', l: '+S' }].forEach(t => {
                const opt = document.createElement('option'); opt.value = t.v; opt.textContent = t.l;
                if (drawer.modSourceTarget === t.v) opt.selected = true;
                modTargetSelect.appendChild(opt);
            });
            modTargetSelect.setAttribute('data-tooltip-title', 'Modulation Operator');
            modTargetSelect.setAttribute('data-tooltip', '×D (Multiply): Scales target intensity.\n+S (Sum): Adds offset to target.');
            modTargetSelect.onchange = (e) => { drawer.modSourceTarget = e.target.value; };
            return modTargetSelect;
        }

        function _createDrawerRandBtn(drawer) {
            const randBtn = document.createElement('button');
            randBtn.textContent = '🎲';
            randBtn.style.cssText = 'padding:0 4px; background:transparent; border:none; color:var(--text-dim); cursor:pointer; margin-left:auto;';
            setTooltip(randBtn, 'Randomize Modulator', 'Generate a new LFO shape and synced rate for this modulation drawer.');
            randBtn.onclick = () => {
                const canvas = document.getElementById(`canvas_${drawer.id}`);
                if (canvas) {
                    drawer.waveType = ['sine', 'saw', 'tri', 'rect'][Math.floor(Math.random() * 4)];
                    drawer.waveRate = 1 + Math.floor(Math.random() * 8);
                    generateWaveformPoints(drawer);
                    drawDrawer(canvas, drawer);
                }
            };
            return randBtn;
        }

        function _createDrawerMinBtn(drawer) {
            const minBtn = document.createElement('button');
            minBtn.type = 'button';
            minBtn.className = 'track-min-btn';
            minBtn.classList.toggle('is-minimized', !!drawer.minimized);
            minBtn.setAttribute('aria-label', drawer.minimized ? 'Restore modulator' : 'Minimize modulator');
            minBtn.setAttribute('data-tooltip-title', drawer.minimized ? 'Restore Modulator' : 'Minimize Modulator');
            minBtn.setAttribute('data-tooltip', drawer.minimized ? 'Expand this modulation drawer to show its canvas and controls.' : 'Collapse this modulation drawer while keeping its patch routing active.');
            minBtn.onclick = (e) => { e.stopPropagation(); drawer.minimized = !drawer.minimized; renderDrawers(); };
            return minBtn;
        }

        function _createDrawerDelBtn(drawer, index) {
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'drawer-delete-btn';
            delBtn.innerHTML = '&times;';
            delBtn.setAttribute('data-tooltip-title', 'Delete Modulator');
            delBtn.setAttribute('data-tooltip', 'Remove this modulation drawer.');
            delBtn.style.cssText = 'width:18px; flex:0 0 18px; padding:0; display:inline-grid; place-items:center; background:transparent; border:none; color:var(--accent-pink); cursor:pointer; font-size: 1rem; opacity: 0.4;';
            delBtn.onmouseover = () => delBtn.style.opacity = '1';
            delBtn.onmouseout = () => delBtn.style.opacity = '0.4';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (state.drawers.length > 1) {
                    state.drawers.splice(index, 1);
                    refreshLookupMap();
                    renderDrawers();
                }
            };
            return delBtn;
        }

        function _createDrawerPatchOut(drawer) {
            const patchOut = document.createElement('div');
            patchOut.className = `patch-point mod-out ${drawer.connection ? 'active' : ''}`;
            patchOut.id = `out_${drawer.id}`;
            patchOut.onmousedown = (e) => {
                isPatching = true; patchingDrawerId = drawer.id;
                document.getElementById('active-cable').style.stroke = '#00f2ff';
                document.getElementById('active-cable').style.display = 'block';
                // Highlight compatible targets
                document.querySelectorAll('.mod-in').forEach(el => el.classList.add('mod-port-target'));
                document.querySelectorAll('.drawer-panel').forEach(panel => {
                    const idx = Array.from(panel.parentNode.children).indexOf(panel);
                    const targetDrawer = state.drawers[idx];
                    if (targetDrawer && targetDrawer.id !== drawer.id) {
                        panel.classList.add('mod-target-glow');
                    }
                });
            };
            return patchOut;
        }

        function _createDrawerContent(drawer) {
            const content = document.createElement('div');
            content.className = 'panel-content';
            const canvas = document.createElement('canvas');
            canvas.className = 'drawer-canvas';
            canvas.id = `canvas_${drawer.id}`;
            content.appendChild(canvas);
            const hint = document.createElement('div');
            hint.style.cssText = 'padding:4px 8px; font-size:0.6rem; color:#444;';
            hint.innerHTML = `<strong style="color:var(--text-dim)">${drawer.sync ? '1 BAR' : 'FREE'}</strong> | PAINT CURVE TO MODIFY`;
            return { content, canvas, hint };
        }

        function _setupDrawerCanvasInteractions(drawer, canvas) {
            canvas.onmousedown = (e) => {
                const rect = canvas.getBoundingClientRect();
                const pt = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
                activeDrawingDrawerId = drawer.id;
                if (drawer.mode === 'pad') {
                    drawer.padPos = pt;
                    updateManualMod(drawer);
                } else {
                    if (drawer.points.length === 0) {
                        for (let i = 0; i <= 1; i += 0.01) drawer.points.push({ x: i, y: 0.5 });
                    }
                    drawer.points.forEach(p => { if (Math.abs(p.x - pt.x) < 0.05) p.y = pt.y; });
                }
                drawDrawer(canvas, drawer);
            };
            canvas.onmousemove = (e) => {
                if (activeDrawingDrawerId !== drawer.id) return;
                const rect = canvas.getBoundingClientRect();
                const pt = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
                if (drawer.mode === 'pad') {
                    drawer.padPos = pt;
                    updateManualMod(drawer);
                } else {
                    drawer.points.forEach(p => { if (Math.abs(p.x - pt.x) < 0.05) p.y = pt.y; });
                }
                drawDrawer(canvas, drawer);
            };
            requestAnimationFrame(() => {
                if (!canvas.isConnected) return; // panel was removed before rAF fired
                canvas.width = canvas.offsetWidth || canvas.parentElement?.offsetWidth || 160;
                canvas.height = canvas.offsetHeight || 100;
                if (drawer.mode === 'curve' && drawer.points.length === 0) {
                    generateWaveformPoints(drawer);
                    if (drawer.points.length === 0) {
                        for (let i = 0; i <= 1; i += 0.05) drawer.points.push({ x: i, y: 1 - i });
                    }
                } else if (drawer.mode === 'pad' && !drawer.padPos) {
                    drawer.padPos = { x: 0.5, y: 0.5 };
                }
                drawDrawer(canvas, drawer);
            });
        }

        function _createDrawerAddBtn(container) {
            const addBtn = document.createElement('button');
            addBtn.innerHTML = '<span>+</span> ADD MODULATOR';
            addBtn.className = 'add-drawer-btn';
            addBtn.style.cssText = 'width: 100%; padding: 12px; margin-top: 8px; background: rgba(0, 242, 255, 0.05); color: var(--accent-cyan); border: 1px dashed rgba(0, 242, 255, 0.3); border-radius: 6px; cursor: pointer; font-size: 0.7rem; font-weight: bold; transition: all 0.2s;';
            setTooltip(addBtn, 'Add Modulator', 'Create another CV or XY modulation drawer.');
            addBtn.onmouseover = () => { addBtn.style.background = 'rgba(0, 242, 255, 0.1)'; addBtn.style.borderColor = 'var(--accent-cyan)'; };
            addBtn.onmouseout = () => { addBtn.style.background = 'rgba(0, 242, 255, 0.05)'; addBtn.style.borderColor = 'rgba(0, 242, 255, 0.3)'; };
            addBtn.onclick = () => {
                state.drawers.push(createDrawer());
                refreshLookupMap();
                renderDrawers();
                // Scroll to bottom
                container.scrollTop = container.scrollHeight;
            };
            return addBtn;
        }

        function renderDrawers() {
            const container = document.getElementById('drawers-container');
            container.textContent = '';
            state.drawers.forEach((drawer, index) => {
                const panel = document.createElement('div');
                panel.className = 'panel drawer-panel';
                panel.style.display = 'flex';
                panel.style.flexDirection = 'column';

                const header = document.createElement('div');
                header.className = 'panel-header';
                header.style.flexDirection = 'column';
                header.style.height = 'auto';
                header.style.padding = '4px';

                // ROW 1: Routing & Basic Config
                const row1 = document.createElement('div');
                row1.className = 'drawer-routing-row';

                const patchIn = _createDrawerPatchIn(drawer);
                const modeBtn = _createDrawerModeBtn(drawer);
                const targetSelect = _createDrawerTargetSelect(drawer);
                const minBtn = _createDrawerMinBtn(drawer);
                const delBtn = _createDrawerDelBtn(drawer, index);
                const patchOut = _createDrawerPatchOut(drawer);

                const r1Center = document.createElement('div');
                r1Center.className = 'drawer-routing-center';
                r1Center.append(modeBtn, targetSelect, minBtn, delBtn);

                row1.append(patchIn, r1Center, patchOut);

                // ROW 2: Generation & Modification
                const row2 = document.createElement('div');
                row2.style.cssText = 'display:flex; align-items:center; width:100%; gap:4px; height:24px;';

                const waveSelect = _createDrawerWaveSelect(drawer);
                const syncBtn = _createDrawerSyncBtn(drawer);
                const rateWrap = _createDrawerRateWrap(drawer);
                const depthWrap = _createDrawerDepthWrap(drawer);
                const randBtn = _createDrawerRandBtn(drawer);

                row2.append(waveSelect, syncBtn, rateWrap, depthWrap);
                if (drawer.modSource) {
                    row2.appendChild(_createDrawerModSourceSelect(drawer));
                }
                row2.appendChild(randBtn);

                header.append(row1, row2);
                header.style.cursor = 'pointer';
                header.ondblclick = (e) => {
                    if (e.target.tagName !== 'SELECT' && e.target.tagName !== 'INPUT') {
                        drawer.minimized = !drawer.minimized; renderDrawers();
                    }
                };

                const { content, canvas, hint } = _createDrawerContent(drawer);
                if (!drawer.minimized) {
                    panel.append(header, content, hint);
                } else {
                    panel.append(header);
                    row2.style.display = 'none'; // Hide Row 2 when minimized
                    panel.style.height = 'auto';
                }
                container.appendChild(panel);
                if (!drawer.minimized) {
                    _setupDrawerCanvasInteractions(drawer, canvas);
                } else {
                    setTimeout(updateFixedCables, 0);
                }
            });

            const addBtn = _createDrawerAddBtn(container);
            container.appendChild(addBtn);
            updateCableElementCache();
        }

        function updateManualMod(drawer) {
            if (!drawer.connection || !drawer.padPos) return;
            const targetTrack = state.lookup.tracks.get(drawer.connection);
            const targetFx = state.lookup.fxUnits.get(drawer.connection);
            const xVal = drawer.padPos.x;
            const yVal = 1 - drawer.padPos.y;
            if (targetTrack) {
                const minF = 20, maxF = 20000;
                const freq = minF * Math.pow(maxF / minF, xVal);
                targetTrack.filterNode.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.05);
                targetTrack.filterNode.Q.setTargetAtTime(yVal * 20, audioCtx.currentTime, 0.05);
            } else if (targetFx) {
                if (targetFx.nodes.delay) {
                    targetFx.nodes.delay.delayTime.setTargetAtTime(xVal * 2.0, audioCtx.currentTime, 0.05);
                    targetFx.nodes.feedback.gain.setTargetAtTime(yVal * 0.95, audioCtx.currentTime, 0.05);
                }
            }
        }

        window.addEventListener('mouseup', () => { activeDrawingDrawerId = null; });

        function drawVisuals() {
            requestAnimationFrame(drawVisuals);
            masterAnalyser.getByteTimeDomainData(masterDataArray);
            oscCtx.fillStyle = 'rgba(5, 5, 7, 0.2)'; oscCtx.fillRect(0, 0, oscCanvas.width, oscCanvas.height);
            oscCtx.lineWidth = 2; oscCtx.strokeStyle = 'var(--accent-cyan)';
            oscCtx.shadowBlur = 8; oscCtx.shadowColor = 'var(--accent-cyan)';
            oscCtx.beginPath();
            const sliceWidth = oscCanvas.width / bufferLength; let x = 0;
            let masterPeak = 0, masterSquareTotal = 0, masterClipSamples = 0;
            for (let i = 0; i < bufferLength; i++) {
                const centered = (masterDataArray[i] - 128) / 128;
                const abs = Math.abs(centered);
                masterPeak = Math.max(masterPeak, abs);
                masterSquareTotal += centered * centered;
                if (abs >= 0.985) masterClipSamples++;
                const v = masterDataArray[i] / 128.0; const y = v * oscCanvas.height / 2;
                if (i === 0) oscCtx.moveTo(x, y); else oscCtx.lineTo(x, y); x += sliceWidth;
            }
            const limiterReduction = Math.abs(masterLimiter.reduction || 0);
            masterMeterState.peak = masterPeak;
            masterMeterState.rms = Math.sqrt(masterSquareTotal / bufferLength);
            masterMeterState.limiterReduction = limiterReduction;
            const clipping = masterClipSamples > 0 || limiterReduction > 6;
            masterMeterState.clipHold = clipping ? 12 : Math.max(0, masterMeterState.clipHold - 1);
            masterMeterState.clipping = masterMeterState.clipHold > 0;
            oscCtx.stroke();
            oscCtx.shadowBlur = 0;

            masterAnalyser.getByteFrequencyData(masterDataArray);
            specCtx.fillStyle = '#050507'; specCtx.fillRect(0, 0, specCanvas.width, specCanvas.height);
            const barWidth = (specCanvas.width / (bufferLength / 4)); let barX = 0;
            for (let i = 0; i < bufferLength / 4; i++) {
                const barHeight = (masterDataArray[i] / 255) * specCanvas.height;
                const hue = 180 + (i / (bufferLength / 4)) * 120;
                specCtx.fillStyle = `hsla(${hue}, 100%, 50%, 0.8)`;
                specCtx.fillRect(barX, specCanvas.height - barHeight, barWidth - 1, barHeight);
                barX += barWidth;
            }
            const meterWidth = Math.min(100, Math.max(masterMeterState.rms * 155, masterMeterState.peak * 82));
            meterFill.style.width = meterWidth + '%';
            if (masterMeterState.clipping) {
                meterFill.style.background = `linear-gradient(90deg, var(--accent-yellow), var(--accent-pink))`;
                meterFill.style.boxShadow = `0 0 10px rgba(255, 42, 109, 0.45)`;
            } else {
                meterFill.style.background = `linear-gradient(90deg, var(--accent-cyan), var(--accent-purple))`;
                meterFill.style.boxShadow = `0 0 10px rgba(0, 242, 255, 0.3)`;
            }

            state.tracks.forEach((track, index) => {
                if (!track.analyserDataArray) track.analyserDataArray = new Uint8Array(track.analyser.frequencyBinCount);
                track.analyser.getByteTimeDomainData(track.analyserDataArray);
                let peak = 0;
                for (let i = 0; i < track.analyserDataArray.length; i++) {
                    let val = Math.abs(track.analyserDataArray[i] - 128);
                    if (val > peak) peak = val;
                }
                let percent = (peak / 128) * 100;
                updateMixerMeterFill(track.mixerMeterFill, percent);
                const fill = track.vuMeterFill;
                if (fill) {
                    fill.style.width = percent + '%';
                    if (percent > 95) fill.style.background = 'var(--accent-pink)';
                    else if (percent > 75) fill.style.background = 'var(--accent-yellow)';
                    else fill.style.background = 'var(--accent-cyan)';
                    fill.style.boxShadow = `0 0 5px ${fill.style.background}`;
                }

                // Update Filter Graph (animates with modulation)
                if (track.xyCanvas) drawXY(track.xyCanvas, track);

                // Update Sampler Waveform
                if (track.typeId === 'drumSet' && !track.minimized && track.samplerCanvas) {
                    drawSamplerWaveform(track.samplerCanvas, track);
                }

                if (track.adsrCanvas && !track.minimized) {
                    drawADSR(track.adsrCanvas, track.adsr, track, state.activeTrackId === index);
                }
            });

            state.fxUnits.forEach(unit => {
                if (!unit.analyser) return;
                if (!unit.analyserDataArray) unit.analyserDataArray = new Uint8Array(unit.analyser.frequencyBinCount);
                unit.analyser.getByteTimeDomainData(unit.analyserDataArray);
                let peak = 0;
                for (let i = 0; i < unit.analyserDataArray.length; i++) {
                    const val = Math.abs(unit.analyserDataArray[i] - 128);
                    if (val > peak) peak = val;
                }
                updateMixerMeterFill(unit.mixerMeterFill, (peak / 128) * 100);
            });

            state.drawers.forEach(drawer => {
                const canvas = document.getElementById(`canvas_${drawer.id}`);
                if (canvas && !drawer.minimized) drawDrawer(canvas, drawer);
            });
        }

        // --- Session Management (File I/O) ---
        function getSessionData() {
            return {
                version: "1.1",
                bpm: state.bpm,
                timeSignature: state.timeSignature,
                globalKey: state.globalKey,
                globalScale: state.globalScale,
                tracks: state.tracks.map(t => serializeTrack(t)),
                activeTrackId: state.activeTrackId,
                fxUnits: state.fxUnits.map(u => ({
                    id: u.id,
                    type: u.type,
                    params: JSON.parse(JSON.stringify(u.params)),
                    minimized: !!u.minimized,
                    audioRoute: u.audioRoute || 'master',
                    outputGain: u.outputGain ?? 0.75
                })),
                scenes: JSON.parse(JSON.stringify(state.scenes)),
                drawers: state.drawers.map(d => ({
                    id: d.id,
                    connection: d.connection,
                    points: JSON.parse(JSON.stringify(d.points)),
                    mode: d.mode,
                    minimized: d.minimized
                }))
            };
        }

        function applySessionData(data) {
            if (!data) return;

            // 1. Restore Global Settings
            if (data.bpm) {
                state.bpm = data.bpm;
                toneBridge.setBpm(state.bpm);
                const bpmIn = document.getElementById('bpm-input');
                if (bpmIn) bpmIn.value = state.bpm;
            }
            if (data.timeSignature) state.timeSignature = data.timeSignature;
            if (data.globalKey) {
                state.globalKey = data.globalKey;
                const keyIn = document.getElementById('key-input');
                if (keyIn) keyIn.value = state.globalKey;
            }
            if (data.globalScale) {
                state.globalScale = data.globalScale;
                const scaleIn = document.getElementById('scale-input');
                if (scaleIn) scaleIn.value = state.globalScale;
            }
            if (data.activeTrackId !== undefined) {
                state.activeTrackId = data.activeTrackId;
            }

            // 2. Restore Tracks
            if (data.tracks) {
                state.tracks.forEach(t => t.cleanup && t.cleanup());
                state.tracks = data.tracks.map(trackData => hydrateTrack(trackData));
            }

            // 3. Restore FX
            if (data.fxUnits) {
                state.fxUnits.forEach(u => { if (u.cleanup) u.cleanup(); });
                state.fxUnits = data.fxUnits.map(uData => {
                    const u = createFxUnit(uData.type);
                    if (uData.id) u.id = uData.id;
                    u.params = JSON.parse(JSON.stringify(uData.params));
                    u.minimized = !!uData.minimized;
                    u.audioRoute = uData.audioRoute || 'master';
                    u.outputGain = uData.outputGain ?? 0.75;
                    setupFxNodes(u);
                    updateFxParams(u, null);
                    return u;
                });
            }

            // 4. Restore Scenes
            if (data.scenes) state.scenes = data.scenes;

            // 5. Restore Drawers
            if (data.drawers) {
                state.drawers = data.drawers.map(dData => ({ ...dData }));
            }

            refreshLookupMap();
            routeAllAudioConnections();
            trackElementCache.clear();
            mixerStripCache.clear();
            fxMixerStripCache.clear();
            renderTracks();
            renderFxPanels();
            renderScenes();
            renderDrawers();
            renderBeatCounter();
        }

        function pushUndo() {
            state.undoStack.push(JSON.stringify(getSessionData()));
            if (state.undoStack.length > state.maxUndo) state.undoStack.shift();
            state.redoStack = [];
        }

        function undo() {
            if (state.undoStack.length === 0) return;
            state.redoStack.push(JSON.stringify(getSessionData()));
            const data = JSON.parse(state.undoStack.pop());
            applySessionData(data);
        }

        function redo() {
            if (state.redoStack.length === 0) return;
            state.undoStack.push(JSON.stringify(getSessionData()));
            const data = JSON.parse(state.redoStack.pop());
            applySessionData(data);
        }

        // --- Session Management (File I/O) ---
        function saveSession() {
            const sessionData = getSessionData();
            const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `VeggieLoops_Session_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }

        function loadSession(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    applySessionData(data);
                    console.log("Session loaded successfully");
                } catch (err) { console.error("Load failed:", err); alert("Failed to load session."); }
            };
            reader.readAsText(file);
        }

        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                undo();
            } else if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
                e.preventDefault();
                redo();
            }
        });

        document.getElementById('save-btn').onclick = saveSession;
        document.getElementById('load-btn').onclick = () => document.getElementById('session-load-input').click();
        document.getElementById('session-load-input').onchange = loadSession;

        // --- BOOTSTRAP ---
        state.fxUnits = [createFxUnit('delay'), createFxUnit('reverb')];
        state.tracks.push(createTrack('drumSet'));

        // Add secondary tracks and minimize them to keep the focus on the main Drum Set
        ['synthwave', 'bass'].forEach(type => {
            const track = createTrack(type);
            track.minimized = true;
            state.tracks.push(track);
        });

        refreshLookupMap();

        window.onload = () => {
            resizeCanvas();
            renderTracks();
            renderDrawers();
            renderBeatCounter();
            renderFxPanels();
            renderScenes();
        };

        drawVisuals();
        initLayoutObserver();
