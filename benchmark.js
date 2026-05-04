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
