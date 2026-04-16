/* ============================================================================
 * Sequencer.js — 8x8 STEP SEQUENCER ENGINE (Tone.js)
 * ============================================================================
 *
 * This module handles the timing, state, and audio triggering for the 
 * 8x8 step sequencer. It uses Tone.js for sub-millisecond timing precision.
 *
 * AUDIO ARCHITECTURE:
 * We use a single Tone.Buffer to load the GameSounds.mp3, then trigger 
 * specific time regions (sprites) on each step.
 * ============================================================================ */

import * as Tone from "tone";

export class StepSequencer {
    constructor() {
        this.rows = 8;
        this.cols = 8;
        
        // State: 8x8 grid of velocity levels (0 to 1)
        this.grid = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
        
        this.currentStep = 0;
        this.isPlaying = false;
        this.bpm = 120;

        // Visual mapping of cells
        this.cells = []; 

        // Sound mapping (Row index -> Sprite ID)
        this.rowSamples = [
            "Sprite 1", "Sprite 2", "Sprite 4", "Sprite 13", 
            "Sprite 14", "Sprite 15", "Sprite 27", "Sprite 31"
        ];

        // Mute state
        this.rowMutes = Array(this.rows).fill(false);

        // Mapping index -> [offsetMs, durationMs] (Internal metadata)
        this.spriteMetadata = {
            "Sprite 1": [400, 1598], "Sprite 2": [2198, 461], "Sprite 3": [2678, 460],
            "Sprite 4": [3546, 708], "Sprite 5": [5075, 868], "Sprite 6": [6238, 689],
            "Sprite 7": [6946, 1834], "Sprite 8": [8902, 1449], "Sprite 9": [11214, 990],
            "Sprite 10": [13311, 1140], "Sprite 11": [15478, 1454], "Sprite 12": [17415, 877],
            "Sprite 13": [18489, 1074], "Sprite 14": [20098, 793], "Sprite 15": [22171, 1074],
            "Sprite 16": [23259, 1468], "Sprite 17": [27128, 2387], "Sprite 18": [29722, 2125],
            "Sprite 19": [31880, 994], "Sprite 20": [33502, 976], "Sprite 21": [34487, 924],
            "Sprite 22": [37686, 694], "Sprite 23": [36584, 990], "Sprite 24": [38948, 586],
            "Sprite 25": [41701, 1332], "Sprite 26": [43493, 427], "Sprite 27": [43924, 422],
            "Sprite 28": [44764, 539], "Sprite 29": [45852, 1126], "Sprite 30": [46982, 713],
            "Sprite 31": [50125, 769], "Sprite 32": [52310, 1956], "Sprite 33": [56968, 361],
        };

        this.awaitingRemapRow = null; // Index of row being remapped
        this.buffer = null;
        this.players = []; // Array of Tone.Player
        this.isLoaded = false;

        this.initUI();
        this.loadAudio();
        this.setupTransport();
    }

    /**
     * Create the clickable grid in the DOM.
     */
    initUI() {
        const gridContainer = document.getElementById("sequencer-grid");
        if (!gridContainer) return;

        gridContainer.innerHTML = ""; // Clear
        this.cells = [];

        for (let r = 0; r < this.rows; r++) {
            // Steps 0-7
            for (let c = 0; c < this.cols; c++) {
                const cell = document.createElement("div");
                cell.className = "sequencer-cell";
                cell.dataset.row = r;
                cell.dataset.col = c;
                
                let pressTimer;
                
                cell.onmousedown = (e) => {
                    if (e.button !== 0) return;
                    pressTimer = window.setTimeout(() => {
                        this.cycleVelocity(r, c);
                        pressTimer = null;
                    }, 500); 
                };

                cell.onmouseup = (e) => {
                    if (e.button !== 0) return;
                    if (pressTimer) {
                        clearTimeout(pressTimer);
                        this.toggleCell(r, c);
                    }
                };

                cell.onmouseleave = () => {
                    if (pressTimer) clearTimeout(pressTimer);
                };
                
                gridContainer.appendChild(cell);
                this.cells.push(cell);
            }

            // Column 8: Sample Selector
            const selectorCell = document.createElement("div");
            selectorCell.className = "sequencer-cell sample-selector";
            selectorCell.id = `sample-selector-${r}`;
            selectorCell.innerText = "SMPL";
            selectorCell.onclick = () => this.startRemap(r);
            gridContainer.appendChild(selectorCell);

            // Column 9: Mute Toggle
            const muteCell = document.createElement("div");
            muteCell.className = "sequencer-cell mute-toggle";
            muteCell.id = `mute-toggle-${r}`;
            muteCell.innerText = "MUTE";
            muteCell.onclick = () => this.toggleMute(r);
            gridContainer.appendChild(muteCell);
        }

        // Initialize tooltips and visual states
        this.refreshAdvancedUI();

        // Bind Controls
        document.getElementById("sequencer-play-btn")?.addEventListener("click", () => this.start());
        document.getElementById("sequencer-stop-btn")?.addEventListener("click", () => this.stop());
        document.getElementById("sequencer-clear-btn")?.addEventListener("click", () => this.clearAll());
        
        const bpmSlider = document.getElementById("sequencer-bpm-slider");
        if (bpmSlider) {
            bpmSlider.oninput = (e) => {
                this.bpm = e.target.value;
                document.getElementById("sequencer-bpm-value").innerText = this.bpm;
                Tone.Transport.bpm.value = this.bpm;
            };
        }
    }

    /**
     * Load the game sound buffer once and slice it for players.
     */
    async loadAudio() {
        try {
            this.buffer = await new Tone.ToneAudioBuffer().load("/GameSounds.mp3");
            
            // Create a player for each row to handle overlapping voices
            for (let i = 0; i < this.rows; i++) {
                const player = new Tone.Player(this.buffer).toDestination();
                this.players.push(player);
            }
            
            this.isLoaded = true;
            console.log("Sequencer audio engine ready.");
        } catch (e) {
            console.error("Failed to load sequencer audio:", e);
        }
    }

    /**
     * Set up the Tone.Transport loop.
     */
    setupTransport() {
        Tone.Transport.bpm.value = this.bpm;

        // Schedule a repeat every 8th note
        Tone.Transport.scheduleRepeat((time) => {
            this.tick(time);
        }, "8n");
    }

    /**
     * Logic executed on every step.
     */
    tick(time) {
        const step = this.currentStep % this.cols;

        // Trigger sounds
        for (let r = 0; r < this.rows; r++) {
            if (this.rowMutes[r]) continue;

            const velocity = this.grid[r][step];
            if (velocity > 0) {
                const spriteCode = this.rowSamples[r];
                const sound = this.spriteMetadata[spriteCode];
                if (sound) {
                    this.players[r].start(time, sound[0] / 1000, sound[1] / 1000);
                    this.players[r].volume.value = Tone.gainToDb(velocity);
                }
            }
        }

        // Update UI (Visual Playhead)
        Tone.Draw.schedule(() => {
            this.updatePlayheadUI(step);
        }, time);

        this.currentStep++;
    }

    updatePlayheadUI(activeStep) {
        this.cells.forEach((cell, index) => {
            const col = index % this.cols;
            if (col === activeStep) {
                cell.classList.add("playing");
            } else {
                cell.classList.remove("playing");
            }
        });
    }

    toggleCell(r, c) {
        if (this.grid[r][c] > 0) {
            this.grid[r][c] = 0;
        } else {
            this.grid[r][c] = 1.0;
        }
        this.updateCellUI(r, c);
        
        // One-shot preview
        if (this.grid[r][c] > 0 && this.isLoaded) {
            const spriteCode = this.rowSamples[r];
            const sound = this.spriteMetadata[spriteCode];
            if (sound) {
                this.players[r].volume.value = Tone.gainToDb(this.grid[r][c]);
                this.players[r].start(Tone.now(), sound[0] / 1000, sound[1] / 1000);
            }
        }
    }

    startRemap(row) {
        // If already remapping this row, cancel
        if (this.awaitingRemapRow === row) {
            this.awaitingRemapRow = null;
        } else {
            this.awaitingRemapRow = row;
        }
        this.refreshAdvancedUI();
    }

    finalizeRemap(spriteCode) {
        if (this.awaitingRemapRow === null) return;
        
        const row = this.awaitingRemapRow;
        this.rowSamples[row] = spriteCode;
        this.awaitingRemapRow = null;
        
        this.refreshAdvancedUI();
        
        // Preview the new sound
        if (this.isLoaded) {
            const sound = this.spriteMetadata[spriteCode];
            this.players[row].volume.value = 0; // standard preview vol
            this.players[row].start(Tone.now(), sound[0] / 1000, sound[1] / 1000);
        }
    }

    toggleMute(row) {
        this.rowMutes[row] = !this.rowMutes[row];
        this.refreshAdvancedUI();
    }

    refreshAdvancedUI() {
        for (let r = 0; r < this.rows; r++) {
            const selector = document.getElementById(`sample-selector-${r}`);
            const mute = document.getElementById(`mute-toggle-${r}`);
            
            if (selector) {
                selector.dataset.tooltip = `Current: ${this.rowSamples[r]}`;
                selector.classList.toggle("remap-waiting", this.awaitingRemapRow === r);
                selector.innerText = this.awaitingRemapRow === r ? "KEY?" : "SMPL";
            }
            
            if (mute) {
                mute.classList.toggle("row-muted", this.rowMutes[r]);
                mute.innerText = this.rowMutes[r] ? "MUTED" : "MUTE";
            }
        }
    }

    exportSequenceData() {
        // Create a deep copy of the grid to prevent future edits from altering the assigned FX
        const gridCopy = this.grid.map(row => [...row]);
        return {
            grid: gridCopy,
            rowSamples: [...this.rowSamples],
            mutes: [...this.rowMutes],
            bpm: parseFloat(this.bpm)
        };
    }

    cycleVelocity(r, c) {
        // Cycle: 0 -> 0.3 -> 0.6 -> 1.0 -> 0.3...
        const current = this.grid[r][c];
        if (current === 0) this.grid[r][c] = 0.3;
        else if (current <= 0.35) this.grid[r][c] = 0.6;
        else if (current <= 0.65) this.grid[r][c] = 1.0;
        else this.grid[r][c] = 0.3;

        this.updateCellUI(r, c);
        
        // Preview sound at new velocity
        if (this.isLoaded) {
            const spriteCode = this.rowSamples[r];
            const sound = this.spriteMetadata[spriteCode];
            if (sound) {
                this.players[r].volume.value = Tone.gainToDb(this.grid[r][c]);
                this.players[r].start(Tone.now(), sound[0] / 1000, sound[1] / 1000);
            }
        }
    }

    updateCellUI(r, c) {
        const cell = this.cells[r * this.cols + c];
        const velocity = this.grid[r][c];
        
        if (velocity === 0) {
            cell.classList.remove("active");
            cell.style.opacity = "1"; // Reset
        } else {
            cell.classList.add("active");
            cell.style.opacity = velocity;
        }
    }

    start() {
        if (!this.isLoaded) return;
        Tone.start();
        Tone.Transport.start();
        this.isPlaying = true;
    }

    stop() {
        Tone.Transport.stop();
        this.isPlaying = false;
        this.currentStep = 0;
        this.updatePlayheadUI(-1); // Clear playhead
    }

    clearAll() {
        this.grid = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
        this.cells.forEach((c, index) => {
            const r = Math.floor(index / this.cols);
            const col = index % this.cols;
            this.updateCellUI(r, col);
        });
    }

}
