// Veggie Loops static configuration.
// Keep defaults/manifests here; runtime behavior belongs in VeggieLoops.js.
const mcp2000_config = {
    pads: [
        { label: 'Kick 01', file: 'Kick-01_bd-short-and-clean.wav', note: 36 },
        { label: 'Snare 02', file: 'Snare-02_sd-classic-snare.wav', note: 38 },
        { label: 'Hat 03', file: 'Hat-03_hh-short.wav', note: 42 },
        { label: 'Open Hat 04', file: 'Open-Hat-04_hho-longuish.wav', note: 46 },
        { label: 'Clap 05', file: 'Clap-05_cl-analog-clap.wav', note: 39 },
        { label: 'Perc 06', file: 'Perc-06_pc-cabasa.wav', note: 54 },
        { label: 'Cowbell 07', file: 'Cowbell-07_cb-cowbell.wav', note: 56 },
        { label: 'Metal FX 08', file: 'Metal-FX-08_fx-fm-metal.wav', note: 57 },
        { label: 'Tom 09', file: 'Tom-09_tm-lo-tom.wav', note: 41 },
        { label: 'Mid Tom 10', file: 'Mid-Tom-10_tm-mid-conga-var.wav', note: 45 },
        { label: 'Rim 11', file: 'Rim-11_rs-classic.wav', note: 37 },
        { label: 'Ride 12', file: 'Ride-12_rd-ride-stereo.wav', note: 51 },
        { label: 'Crash 13', file: 'Crash-13_cy-useful-mono.wav', note: 49 },
        { label: 'Blip 14', file: 'Blip-14_fx-blip.wav', note: 60 },
        { label: 'Shaker 15', file: 'Shaker-15_pc-stereo-shaker.wav', note: 70 },
        { label: 'Ride FX 16', file: 'Ride-FX-16_fx-chorus-ride.wav', note: 71 }
    ]
};

const mcp2000_config_b = {
    pads: [
        { label: 'First', file: 'Guitar-01_first.wav', note: 48 },
        { label: 'Second', file: 'Guitar-02_second.wav', note: 49 },
        { label: 'Third', file: 'Guitar-03_third.wav', note: 50 },
        { label: 'Fourth', file: 'Guitar-04_fourth.wav', note: 51 },
        { label: 'Fifth', file: 'Guitar-05_fifth.wav', note: 52 },
        { label: 'Sixth', file: 'Guitar-06_sixth.wav', note: 53 },
        { label: 'Seventh', file: 'Guitar-07_seventh.wav', note: 54 },
        { label: 'Eighth', file: 'Guitar-08_eigth.wav', note: 55 },
        { label: 'Ninth', file: 'Guitar-09_nineth.wav', note: 56 },
        { label: 'Tenth', file: 'Guitar-10_tenth.wav', note: 57 },
        { label: 'Eleventh', file: 'Guitar-11_eleventh.wav', note: 58 },
        { label: 'Twelfth', file: 'Guitar-12_twelth.wav', note: 59 },
        { label: 'Thirteenth', file: 'Guitar-13_thirteenth.wav', note: 60 },
        { label: 'Fourteenth', file: 'Guitar-14_fourteenth.wav', note: 61 },
        { label: 'Fifteenth', file: 'Guitar-15_fifteenth.wav', note: 62 },
        { label: 'Sixteenth', file: 'Guitar-16_sixteenth.wav', note: 63 }
    ]
};

const scalesDef = {
'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
'major': [0, 2, 4, 5, 7, 9, 11],
'minor': [0, 2, 3, 5, 7, 8, 10],
'pentatonic': [0, 3, 5, 7, 10]
};

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const drumStyles = {
'Kick': ['Sampler', '808 Deep', 'Snappy', 'LoFi'],
'Snare': ['Sampler', '808 Snap', 'Acoustic', 'LoFi'],
'CHat': ['Sampler', 'Metallic', 'Analog', 'LoFi'],
'OHat': ['Sampler', 'Metallic', 'Analog', 'LoFi'],
'Rim': ['Sampler', 'Metallic', 'Analog', 'LoFi'],
'Clap': ['Sampler', 'Metallic', 'Analog', 'LoFi'],
'Crash': ['Sampler', 'Resonant', 'Trashy', 'LoFi'],
'Ride': ['Sampler', 'Bell', 'Sizzle', 'LoFi'],
'Splash': ['Sampler', '808', 'Metal', 'LoFi'],
'Clave': ['Classic', 'Woodblock', 'Electronic', 'Cowbell'],
'TomH': ['Sampler', '808 Deep', 'Acoustic', 'LoFi'],
'TomL': ['Sampler', '808 Deep', 'Acoustic', 'LoFi'],
'Shaker': ['Sampler', 'Sand', 'Metal', 'LoFi'],
'BongoH': ['Sample H', '808-H', 'Snappy-H', 'LoFi-H'],
'BongoL': ['Sample L', '808-L', 'Snappy-L', 'LoFi-L'],
'Metal': ['Sampler', 'Bell', 'Trashy', 'LoFi'],
'Beep': ['Sampler', 'Beep', 'Boop', '8bit']
};

const samplerPadByDrum = {
Kick: 0, Snare: 1, CHat: 2, OHat: 3, Clap: 4, Splash: 5,
Clave: 6, Cowbell: 6, Metal: 7, Beep: 13, TomL: 8, TomH: 9,
Rim: 10, Ride: 11, Crash: 12, Shaker: 14, BongoH: 5, BongoL: 5
};

const samplerKeyboardLabels = ['A', 'W', 'S', 'E', 'D', 'F', 'T', 'G', 'Y', 'H', 'U', 'J', 'K', 'O', 'L', ';'];

const samplerKeyboardLayout = [
{ row: 2, col: 2, tone: 'white' }, { row: 1, col: 3, tone: 'black' },
{ row: 2, col: 4, tone: 'white' }, { row: 1, col: 5, tone: 'black' },
{ row: 2, col: 6, tone: 'white' }, { row: 2, col: 8, tone: 'white' },
{ row: 1, col: 9, tone: 'black' }, { row: 2, col: 10, tone: 'white' },
{ row: 1, col: 11, tone: 'black' }, { row: 2, col: 12, tone: 'white' },
{ row: 1, col: 13, tone: 'black' }, { row: 2, col: 14, tone: 'white' },
{ row: 2, col: 16, tone: 'white' }, { row: 1, col: 17, tone: 'black' },
{ row: 2, col: 18, tone: 'white' }, { row: 2, col: 20, tone: 'white' }
];

const samplerDisplayOnlyKeys = [
{ label: 'P', row: 1, col: 19, tone: 'black' }
];

const instrumentTypes = {
'drumSet': { name: 'Drum Set', rows: ['Kick', 'Snare', 'CHat', 'OHat', 'Clap', 'Splash', 'Clave', 'Metal', 'TomL', 'TomH', 'Rim', 'Ride', 'Crash', 'Beep', 'Shaker', 'Ride'], type: 'drum', adsr: { a: 0.005, d: 0.2, s: 0.0, r: 0.2 } },
'auxPerc': { name: 'Aux Perc', rows: ['Clave', 'Shaker', 'Clap', 'Splash', 'TomH', 'TomL', 'BongoH', 'BongoL', 'Splash', 'Clave', 'Metal', 'Beep'], type: 'drum', adsr: { a: 0.005, d: 0.2, s: 0.0, r: 0.2 } },
'synthwave': { name: '80s Lead', rows: [], type: 'synth', adsr: { a: 0.05, d: 0.4, s: 0.5, r: 0.3 }, xy: { x: 0.6, y: 0.2 } },
'bass': { name: 'Sub Bass', rows: [], type: 'synth', adsr: { a: 0.01, d: 0.4, s: 0.3, r: 0.2 }, baseOctaveOffset: -2, xy: { x: 0.2, y: 0.0 } },
'pad': { name: 'Ethereal Pad', rows: [], type: 'synth', adsr: { a: 0.6, d: 1.0, s: 0.9, r: 2.0 }, xy: { x: 0.4, y: 0.0 }, baseOctaveOffset: 0 },
'pluck': { name: 'FM Pluck', rows: [], type: 'synth', adsr: { a: 0.005, d: 0.15, s: 0.0, r: 0.1 }, xy: { x: 0.4, y: 0.2 } },
'arp': { name: 'Chiptune Arp', rows: [], type: 'synth', adsr: { a: 0.01, d: 0.15, s: 0.1, r: 0.1 }, xy: { x: 0.5, y: 0.1 } },
'piano': { name: 'Grand Piano', rows: [], type: 'synth', adsr: { a: 0.005, d: 1.5, s: 0.0, r: 0.5 }, xy: { x: 0.4, y: 0.0 } },
'acousticGuitar': { name: 'Acoustic Guitar', rows: [], type: 'synth', adsr: { a: 0.005, d: 1.0, s: 0.0, r: 0.4 }, xy: { x: 0.5, y: 0.0 } },
'electricGuitar': { name: 'Electric Guitar', rows: [], type: 'synth', adsr: { a: 0.01, d: 1.5, s: 0.2, r: 0.3 }, xy: { x: 0.7, y: 0.3 } },
'organ': { name: 'Hammond Organ', rows: [], type: 'synth', adsr: { a: 0.02, d: 0.1, s: 1.0, r: 0.1 }, xy: { x: 0.6, y: 0.1 } },
'marimba': { name: 'Marimba', rows: [], type: 'synth', adsr: { a: 0.005, d: 0.5, s: 0.0, r: 0.3 }, xy: { x: 0.5, y: 0.0 } },
'vibraphone': { name: 'Vibraphone', rows: [], type: 'synth', adsr: { a: 0.01, d: 2.5, s: 0.0, r: 1.5 }, xy: { x: 0.4, y: 0.0 } },
'brass': { name: 'Brass Section', rows: [], type: 'synth', adsr: { a: 0.15, d: 0.4, s: 0.8, r: 0.3 }, xy: { x: 0.5, y: 0.1 } },
'flute': { name: 'Orchestral Flute', rows: [], type: 'synth', adsr: { a: 0.2, d: 0.2, s: 0.8, r: 0.4 }, xy: { x: 0.3, y: 0.0 }, baseOctaveOffset: 1 },
'supersaw': { name: 'Supersaw Lead', rows: [], type: 'synth', adsr: { a: 0.05, d: 0.4, s: 0.6, r: 0.4 }, xy: { x: 0.8, y: 0.2 } },
'wobblebass': { name: 'Wobble Bass', rows: [], type: 'synth', adsr: { a: 0.02, d: 0.5, s: 0.4, r: 0.2 }, xy: { x: 0.25, y: 0.4 }, baseOctaveOffset: -1, voiceLfoDefault: true },
'celeste': { name: 'Celeste', rows: [], type: 'synth', adsr: { a: 0.01, d: 1.0, s: 0.0, r: 0.5 }, xy: { x: 0.5, y: 0.0 }, baseOctaveOffset: 1 },
'clavinet': { name: 'Funk Clav', rows: [], type: 'synth', adsr: { a: 0.005, d: 0.3, s: 0.0, r: 0.1 }, xy: { x: 0.6, y: 0.1 } },
'theremin': { name: 'Theremin', rows: [], type: 'synth', adsr: { a: 0.3, d: 0.1, s: 1.0, r: 0.5 }, xy: { x: 0.4, y: 0.0 }, baseOctaveOffset: 1, voiceLfoDefault: true },
'whiteNoise': { name: 'White Noise', rows: [], type: 'synth', adsr: { a: 0.05, d: 0.5, s: 0.1, r: 0.5 }, xy: { x: 0.8, y: 0.0 } },
'bassGuitar': { name: 'Bass Guitar', rows: [], type: 'synth', adsr: { a: 0.01, d: 0.4, s: 0.1, r: 0.3 }, baseOctaveOffset: -2, xy: { x: 0.15, y: 0.1 } }
};

const fxDefaults = {
delay: { time: 0.25, feedback: 0.4, mix: 0.3, sync: false },
tape_echo: { time: 0.25, feedback: 0.4, mix: 0.3, sync: false },
reverb: { mix: 0.4, size: 0.7, damp: 3000 },
distortion: { drive: 0.5, mix: 1.0, color: 0.5 },
bitcrusher: { bits: 8, norm: 0.5, mix: 0.6 },
filter: { freq: 1000, q: 1, type: 'lowpass', mix: 1.0 },
chorus: { rate: 1.5, depth: 0.002, mix: 0.5 },
phaser: { rate: 0.5, depth: 0.7, mix: 0.5, feedback: 0.5 },
limiter: { threshold: -3, release: 0.1, mix: 1.0 },
compressor: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25, mix: 1.0 },
sidechain: { ratio: 4, attack: 0.003, release: 0.1, threshold: -30 }
};

const ARP_RATE_OPTIONS = [
{ label: '1/4', value: 24 },
{ label: '1/8', value: 12 },
{ label: '1/16', value: 6 },
{ label: '1/32', value: 3 },
{ label: '1/8T', value: 8 },
{ label: '1/16T', value: 4 }
];

const ARP_DIRECTION_OPTIONS = [
{ label: 'UP', value: 'up' },
{ label: 'DOWN', value: 'down' },
{ label: 'UP DN', value: 'updown' },
{ label: 'DN UP', value: 'downup' },
{ label: 'RANDOM', value: 'random' }
];
