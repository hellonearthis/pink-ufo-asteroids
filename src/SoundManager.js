/* ============================================================================
 * SoundManager.js — GAME AUDIO CONTROLLER (Howler.js)
 * ============================================================================
 *
 * Centralized audio system using Howler.js with an AUDIO SPRITE approach.
 *
 * WHAT IS AN AUDIO SPRITE?
 * Instead of loading 33 separate audio files (33 HTTP requests, 33 decode
 * operations), we pack ALL sounds into a SINGLE .wav file and use a JSON
 * map of [startTime, duration] pairs to play specific segments. This is
 * the audio equivalent of a CSS sprite sheet — one file, many sounds.
 *
 * HOWLER.JS:
 * A lightweight audio library that abstracts the Web Audio API and provides:
 *   - Audio sprite support (play segments of a single file)
 *   - Automatic codec detection and fallback
 *   - Volume, rate, and spatial audio controls
 *   - Looping with seamless boundaries
 *   - Mobile audio unlock handling (iOS requires user interaction before audio)
 *
 * SPRITE MAPPING:
 * The assignments below are PLACEHOLDER picks. The user will swap sprite
 * numbers to match the actual sounds later. Each mapping is clearly labeled
 * so it's easy to reassign.
 * ============================================================================ */

import { Howl } from "howler";

/**
 * Manages all game audio through a single Howler.js audio sprite instance.
 * Provides named methods for each game action so the rest of the codebase
 * doesn't need to know about sprite names or Howler internals.
 */
export class SoundManager {
  constructor() {
    /* =====================================================================
     * SPRITE NAME → GAME ACTION MAPPING
     * =====================================================================
     * CHANGE THESE to reassign which sprite plays for each game event.
     * The sprite names ("Sprite 1", "Sprite 2", etc.) correspond to the
     * entries in GameSound_sprite.json, which define [startMs, durationMs]
     * offsets within the GameSounds.wav file.
     *
     * TIPS FOR REASSIGNING:
     *   - Short, punchy sounds (< 500ms) work best for shotFired / shotHit
     *   - Longer sounds (> 1500ms) work best for gameOver / startScreen
     *   - Medium sounds (500-1000ms) work well for thrust / bonusPickup
     * ===================================================================== */
    this.SPRITE_MAP = {
      /* Randomized Shot Pool (Sprites 1, 2, 4, 5, 6, 12, 13, 25, 26, 31) */
      shotFiredPool: [
        "Sprite 1",
        "Sprite 2",
        "Sprite 4",
        "Sprite 5",
        "Sprite 6",
        "Sprite 12",
        "Sprite 13",
        "Sprite 25",
        "Sprite 26",
        "Sprite 31",
      ],
      shotHit: "Sprite 3", // ~460ms  — User preference (Large Boom)
      shipHum: "Sprite 17", // ~1834ms — longer, loopable ambient
      shipThrust: ["Sprite 17", "Sprite 19", "Sprite 33"], // ~361ms-2300ms — Randomized Thrust!
      shipRotate: "Sprite 21", // ~924ms   — User preference (turning noise)
      gameOver: ["Sprite 9", "Sprite 10", "Sprite 11"], // ~990ms-1500ms — Randomized Game Over!
      startScreen: "Sprite 16", // ~1468ms — User preference
      startScreenAmbience: "Sprite 32", // ~1956ms — retry/press r sound
      levelCleared: "Sprite 24", // ~586ms   — User preference (well done)
      bonusPickup: "Sprite 15", // ~1074ms  — General
      bonusCapacity: "Sprite 29", // ~1126ms — User preference
      bonusSpeedup: "Sprite 23", // ~990ms   — User preference
      asteroidBreak: "Sprite 3", // ~460ms   — User preference (Large Boom)
      asteroidBreakSmall: "Sprite 27", // ~422ms   — User preference
      proximityAlert: "Sprite 8", // ~1449ms — Dialog: "Oh no an asteroid"
    };

    /* =====================================================================
     * HOWLER.JS INITIALIZATION
     * =====================================================================
     *
     * new Howl({ src, sprite, ... }) creates an audio sprite instance.
     *
     * OPTIONS:
     *   src: ['/GameSounds.wav']
     *     Array of source URLs. Howler tries each in order until one works.
     *     The leading '/' means "relative to the web root" (Vite's public/ dir).
     *
     *   sprite: { name: [startMs, durationMs, loop?] }
     *     Defines named segments within the audio file.
     *     The optional 3rd element (boolean) sets whether the sprite loops.
     *     We add loop=true for shipHum and startScreen.
     *
     *   volume: 0.5
     *     Master volume (0.0 to 1.0). Set conservatively so sounds don't
     *     blast the player on first load.
     *
     * WHY BUILD THE SPRITE MAP DYNAMICALLY?
     * The raw GameSound_sprite.json has the format { "Sprite 1": [start, duration] }.
     * Howler expects the same format, so we can use the JSON directly.
     * But we need to add the loop flag to specific sprites, so we build
     * the final sprite definition programmatically.
     * ===================================================================== */

    /* We'll construct the Howl sprite definition from the raw JSON data.
     * The raw data is embedded here to avoid an async fetch on startup.
     * If you update GameSound_sprite.json, update this object too. */
    const rawSprites = {
      "Sprite 1": [400, 1598], // bang
      "Sprite 2": [2198, 461], // bang
      "Sprite 3": [2678, 460], // bang
      "Sprite 4": [3546, 708], // bang
      "Sprite 5": [5075, 868], // bang
      "Sprite 6": [6238, 689], // bang
      "Sprite 7": [6946, 1834], // ship hum
      "Sprite 8": [8902, 1449], // dialog
      "Sprite 9": [11214, 990], // game over
      "Sprite 10": [13311, 1140], // game over
      "Sprite 11": [15478, 1454], // game over
      "Sprite 12": [17415, 877], // bang
      "Sprite 13": [18489, 1074], // bang
      "Sprite 14": [20098, 793], // bang
      "Sprite 15": [22171, 1074], // bang
      "Sprite 16": [23259, 1468], // bang
      "Sprite 17": [27128, 2387], // ship thrust
      "Sprite 18": [29722, 2125], // dialog
      "Sprite 19": [31880, 994], // ship thrust
      "Sprite 20": [33502, 976], // dialog
      "Sprite 21": [34487, 924], // ship rotate
      "Sprite 22": [37686, 694], // dialog
      "Sprite 23": [36584, 990], // bonus speedup
      "Sprite 24": [38948, 586], // level clear
      "Sprite 25": [41701, 1332], // bang
      "Sprite 26": [43493, 427], // bang
      "Sprite 27": [43924, 422], // small explosion
      "Sprite 28": [44764, 539], // dialog
      "Sprite 29": [45852, 1126], // bonus capacity
      "Sprite 30": [46982, 713], // dialog
      "Sprite 31": [50125, 769], // bang
      "Sprite 32": [52310, 1956], // start screen ambience
      "Sprite 33": [56968, 361], // ship thrust
    };

    /* Mark looping sprites by adding the 3rd boolean element.
     * Howler format: [startMs, durationMs, loop?] */
    const loopingSprites = [
      this.SPRITE_MAP.shipHum,
      ...this.SPRITE_MAP.shipThrust, // Ensure all potential thrust sprites loop
    ];
    const spriteDefinition = {};
    for (const [name, timing] of Object.entries(rawSprites)) {
      /* We define ALL sprites as one-shots at the library level.
       * Looping is enabled dynamically on a per-instance basis in SoundManager methods.
       * This is the ONLY reliable way to ensure the Mix Deck respects durations. */
      spriteDefinition[name] = [timing[0], timing[1]];
    }

    /* Create the main Howl instance. */
    this.sound = new Howl({
      src: ["GameSounds.mp3"],
      sprite: spriteDefinition,
      volume: 0.5,
      pool: 64, // Increase pool size to allow many overlapping sounds (important for the Mix Deck)
      onloaderror: (id, error) => {
        console.error("Audio load error:", error);
      },
      onplayerror: (id, error) => {
        console.error("Audio play error:", error);
        this.sound.once("unlock", () => {
          this.sound.play(id);
        });
      },
    });

    /* =====================================================================
     * VOLUME SETTINGS PER CATEGORY
     * =====================================================================
     * Different sound types need different volumes so they don't compete.
     * Ambient/loop sounds are quieter; one-shot effects are louder.
     * ===================================================================== */
    this.volumes = {
      shotFired: 0.3,
      shotHit: 0.4,
      shipHum: 0.15,
      shipThrust: 0.25,
      shipRotate: 0.2,
      gameOver: 0.6,
      startScreen: 0.2,
      startScreenAmbience: 0.3,
      levelCleared: 0.6,
      bonusPickup: 0.5,
      bonusCapacity: 0.5,
      bonusSpeedup: 0.6,
      asteroidBreak: 0.4,
      asteroidBreakSmall: 0.5,
      proximityAlert: 0.4, // Default base volume
    };

    /* Proximity Alert State */
    this._lastProximityAlertTime = 0;
    this._proximityAlertCooldown = 5000; // 5 seconds as requested

    /* Track IDs of currently playing looping sounds so we can stop them.
     * Howl.play() returns a numeric ID that can be passed to .stop(id). */
    this._loopIds = {
      shipHum: null,
      startScreen: null,
      startScreenAmbience: null,
      shipRotate: null,
    };

    /* Track thrust state to avoid re-triggering every frame. */
    this._isThrustPlaying = false;
    this._thrustId = null;

    /* =====================================================================
     * MUSIC MANAGEMENT (NEW)
     * =====================================================================
     * Background tracks are stored as individual files in public/music.
     * Each track has its own persistence volume setting.
     * ===================================================================== */
    this.musicTracks = [
      {
        file: "music/audio_383809987989677.mp3",
        title: "Starlight Echoes",
        volume: 0.3,
      },
      {
        file: "music/audio_383809987989678.mp3",
        title: "Neon Nebula",
        volume: 0.3,
      },
      {
        file: "music/audio_383809987989681.mp3",
        title: "Cosmic Resonance",
        volume: 0.3,
      },
      {
        file: "music/audio_383809987989682.mp3",
        title: "Void Runner",
        volume: 0.3,
      },
      {
        file: "music/audio_383818459963618.mp3",
        title: "Plasma Storm",
        volume: 0.3,
      },
      {
        file: "music/audio_383819505115296.mp3",
        title: "Event Horizon",
        volume: 0.3,
      },
      {
        file: "music/audio_383819505115297.mp3",
        title: "Quantum Drift",
        volume: 0.3,
      },
      {
        file: "music/audio_383819505115298.mp3",
        title: "Cyber Sphere",
        volume: 0.3,
      },
    ];
    this.currentMusicIndex = 0;
    this.musicHowl = null;
    this._musicFadeTimeout = null;
  }

  /* ==========================================================================
   * INTERNAL UTILITIES
   * ========================================================================== */

  /**
   * Resolves a sprite mapping key to a specific sprite name.
   * If the mapping is an array, it picks one at random.
   * @param {string} key - The key in this.SPRITE_MAP to resolve.
   * @returns {string} - The name of the sprite to play.
   * @private
   */
  _resolveSprite(key) {
    const value = this.SPRITE_MAP[key];
    if (value && value.type === 'sequence') {
      return value; // Return the whole sequence object
    }
    if (Array.isArray(value)) {
      return value[Math.floor(Math.random() * value.length)];
    }
    return value;
  }

  /* ==========================================================================
   * ONE-SHOT SOUND METHODS
   * ========================================================================== */

  /** 
   * Helper to play either a regular sprite/pool or a dynamic sequence.
   * Modifies existing methods to seamlessly support sequencer mappings.
   */
  _playResolved(resolvedValue, categoryVolumeKey, loop = false) {
    if (resolvedValue && resolvedValue.type === 'sequence') {
      this.playSequenceAsSFX(resolvedValue.data, this.volumes[categoryVolumeKey]);
      return null; // Sequences don't return a single ID
    } else {
      const id = this.sound.play(resolvedValue);
      this.sound.loop(loop, id);
      this.sound.volume(this.volumes[categoryVolumeKey] || 0.5, id);
      return id;
    }
  }

  /** Play when the player fires a bullet (Randomly selects from pool). */
  playShotFired() {
    const resolved = this._resolveSprite("shotFiredPool");
    this._playResolved(resolved, "shotFired");
  }

  /**
   * Play a specific sprite by name (used for sound testing).
   * @param {string} spriteName - The name of the sprite to play.
   * @param {boolean} loop - Whether to loop the sound (defaults to false).
   * @returns {number} - The Howler sound ID.
   */
  playSprite(spriteName, loop = false) {
    const id = this.sound.play(spriteName);
    this.sound.volume(0.8, id);
    this.sound.loop(loop, id); // Always set explicitly to reset pooled state
    return id;
  }

  /** Stop a specific sound instance by ID. */
  stopSpriteInstance(id) {
    if (id !== null) {
      this.sound.stop(id);
    }
  }

  /** Play when a bullet hits an asteroid. */
  playShotHit() {
    const resolved = this._resolveSprite("shotHit");
    this._playResolved(resolved, "shotHit");
  }

  /** Play when an asteroid splits or is destroyed. */
  playAsteroidBreak() {
    const resolved = this._resolveSprite("asteroidBreak");
    this._playResolved(resolved, "asteroidBreak");
  }

  /** Play when a SMALL asteroid is destroyed (Sprite 27). */
  playAsteroidBreakSmall() {
    const resolved = this._resolveSprite("asteroidBreakSmall");
    this._playResolved(resolved, "asteroidBreakSmall");
  }

  /** Play when the player collects a general bonus gem. */
  playBonusPickup() {
    const resolved = this._resolveSprite("bonusPickup");
    this._playResolved(resolved, "bonusPickup");
  }

  /** Play when a Capacity bonus is collected. */
  playBonusCapacity() {
    const resolved = this._resolveSprite("bonusCapacity");
    this._playResolved(resolved, "bonusCapacity");
  }

  /** Play when a Speedup bonus is collected. */
  playBonusSpeedup() {
    const resolved = this._resolveSprite("bonusSpeedup");
    this._playResolved(resolved, "bonusSpeedup");
  }

  /** Play when a level/wave is cleared ("Well Done" / Sprite 24). */
  playLevelCleared() {
    const resolved = this._resolveSprite("levelCleared");
    this._playResolved(resolved, "levelCleared");
  }

  /**
   * Play the proximity alert dialog ("Oh no an asteroid").
   * Enforces a 3000ms cooldown and scales volume by asteroid size.
   * @param {number} hazardSizeCategory - 1 (small), 2 (medium), or 3 (large).
   */
  playProximityAlert(hazardSizeCategory) {
    const now = Date.now();
    if (now - this._lastProximityAlertTime < this._proximityAlertCooldown) {
      return;
    }

    const resolved = this._resolveSprite("proximityAlert");
    
    /* Dynamic Volume: Large (3) = 0.8, Medium (2) = 0.55, Small (1) = 0.3 */
    const volumeMultiplier = 0.3 + (hazardSizeCategory - 1) * 0.25;
    const finalVolume = this.volumes.proximityAlert * volumeMultiplier;

    const id = this._playResolved(resolved, "proximityAlert");
    if (id !== null) {
        this.sound.volume(finalVolume, id);
    }
    
    this._lastProximityAlertTime = now;
  }

  /** Play the game over sound. */
  playGameOver() {
    const resolved = this._resolveSprite("gameOver");
    const id = this._playResolved(resolved, "gameOver");

    if (resolved && resolved.type === 'sequence') {
      // Sequence timing: 8 steps of 8th notes = 4 beats
      const bpm = parseFloat(resolved.data.bpm) || 120;
      const durationMs = (60 / bpm) * 1000 * 4; 
      setTimeout(() => this.startStartScreenAmbience(), durationMs);
    } else if (id !== null) {
      /* When the game-over sound ends, start the start screen ambience. */
      this.sound.once("end", (soundId) => {
          if (soundId === id) {
            this.startStartScreenAmbience();
          }
        }, id);
    }
  }

  /* ==========================================================================
   * SEQUENCE SFX METHOD (NEW)
   * ========================================================================== */

  /**
   * Plays an 8x8 sequence captured from the sequencer as a one-shot sound effect.
   * Uses setTimeout to schedule playing sprites overlappingly in the Howler pool.
   * 
   * @param {Object} sequenceData - { grid, rowSamples, bpm, mutes }
   * @param {number} baseVolume - Base volume scale for the effect
   */
  playSequenceAsSFX(sequenceData, baseVolume = 1.0) {
    if (!sequenceData || !sequenceData.grid) return;

    const bpm = parseFloat(sequenceData.bpm) || 120;
    // 8th notes: 1 beat = 60/BPM seconds. 1 beat = 2 8th notes.
    const stepDurationMs = (60 / bpm) * 1000 / 2;
    
    console.log(`[SoundManager] Playing Sequence SFX: ${bpm} BPM, step: ${stepDurationMs}ms`);

    for (let step = 0; step < sequenceData.grid[0].length; step++) {
      const delay = step * stepDurationMs;

      setTimeout(() => {
        for (let r = 0; r < sequenceData.grid.length; r++) {
          if (sequenceData.mutes && sequenceData.mutes[r]) continue;

          const velocity = sequenceData.grid[r][step];
          if (velocity > 0) {
            const spriteName = sequenceData.rowSamples[r];
            if (this.sound && this.sound._sprite && this.sound._sprite[spriteName]) { 
              const id = this.sound.play(spriteName);
              this.sound.loop(false, id); // Ensure one-shot
              
              // Scale volume by velocity AND base volume of the effect category
              const finalVolume = velocity * baseVolume;
              this.sound.volume(finalVolume, id);
            }
          }
        }
      }, delay);
    }
  }

  /* ==========================================================================
   * LOOPING SOUND METHODS
   * ==========================================================================
   * Looping sounds need start/stop control. We store the playback ID
   * returned by play() so we can pass it to stop() later.
   * ========================================================================== */

  /** Start the ambient ship hum (loops continuously during gameplay). */
  startShipHum() {
    if (this._loopIds.shipHum !== null) return; // Already playing
    this._loopIds.shipHum = this.sound.play(this.SPRITE_MAP.shipHum);
    this.sound.volume(this.volumes.shipHum, this._loopIds.shipHum);
  }

  /** Stop the ship hum. */
  stopShipHum() {
    if (this._loopIds.shipHum !== null) {
      this.sound.stop(this._loopIds.shipHum);
      this._loopIds.shipHum = null;
    }
  }

  /** Start the start screen ambient sound (loops). */
  startStartScreenAmbience() {
    if (this._loopIds.startScreenAmbience !== null) return;
    const spriteName = this._resolveSprite("startScreenAmbience");
    this._loopIds.startScreenAmbience = this.sound.play(spriteName);
    this.sound.volume(
      this.volumes.startScreenAmbience,
      this._loopIds.startScreenAmbience,
    );
  }

  /** Stop the start screen sound. */
  stopStartScreenAmbience() {
    if (this._loopIds.startScreenAmbience !== null) {
      this.sound.stop(this._loopIds.startScreenAmbience);
      this._loopIds.startScreenAmbience = null;
    }
  }

  /* ==========================================================================
   * THRUST SOUND (Semi-Looping)
   * ==========================================================================
   * Thrust is special: it should play while the key is held, but NOT loop
   * endlessly. We play it on key-press and stop on key-release, with a
   * guard to prevent re-triggering every frame.
   * ========================================================================== */

  /** Start thrust sound (called when thrust key is pressed). */
  startThrust() {
    if (this._isThrustPlaying) return;
    this._isThrustPlaying = true;
    const spriteName = this._resolveSprite("shipThrust");
    this._thrustId = this.sound.play(spriteName);
    this.sound.volume(this.volumes.shipThrust, this._thrustId);
  }

  /** Stop thrust sound (called when thrust key is released). */
  stopThrust() {
    if (this._isThrustPlaying && this._thrustId !== null) {
      this.sound.stop(this._thrustId);
      this._isThrustPlaying = false;
      this._thrustId = null;
    }
  }

  /** Start the ship turning noise (loops). */
  playShipRotate() {
    if (this._loopIds.shipRotate !== null) return;
    this._loopIds.shipRotate = this.sound.play(this.SPRITE_MAP.shipRotate);
    this.sound.volume(this.volumes.shipRotate, this._loopIds.shipRotate);
  }

  /** Stop the ship turning noise. */
  stopShipRotate() {
    if (this._loopIds.shipRotate !== null) {
      this.sound.stop(this._loopIds.shipRotate);
      this._loopIds.shipRotate = null;
    }
  }

  /* ==========================================================================
   * GLOBAL CONTROLS
   * ========================================================================== */

  /** Stop ALL sounds (used during state transitions). */
  stopAll() {
    this.sound.stop();
    this._loopIds.shipHum = null;
    this._loopIds.startScreen = null;
    this._loopIds.shipRotate = null;
    this._isThrustPlaying = false;
    this._thrustId = null;
  }

  /** Set master volume (0.0 to 1.0). */
  setMasterVolume(level) {
    this.sound.volume(level);
  }

  /* ==========================================================================
   * MUSIC CONTROL METHODS (NEW)
   * ========================================================================== */

  /**
   * Plays the current music track. Used for initial play, cycle, and resume.
   * Creates a new Howl instance if it doesn't exist or track changed.
   */
  _playMusicTrack() {
    const track = this.musicTracks[this.currentMusicIndex];

    // If there's already a track playing, stop it.
    if (this.musicHowl) {
      this.musicHowl.stop();
      this.musicHowl.unload(); // Free memory
    }

    this.musicHowl = new Howl({
      src: [track.file],
      html5: true, // Use HTML5 Audio for large files to stream
      loop: true,
      volume: track.volume,
    });

    this.musicHowl.play();
    this.showTrackName();
  }

  /** Display the track name UI for 10 seconds. */
  showTrackName() {
    const track = this.musicTracks[this.currentMusicIndex];
    const el = document.getElementById("music-track-info");
    if (!el) return;

    // Reset visibility and clear existing timeouts
    if (this._musicFadeTimeout) clearTimeout(this._musicFadeTimeout);

    el.innerText = `Track: ${track.title} [Vol: ${Math.round(track.volume * 100)}%]`;
    el.style.transition = "none"; // Jump to visible
    el.style.opacity = "1";

    // Wait 10s then fade
    this._musicFadeTimeout = setTimeout(() => {
      el.style.transition = "opacity 2s ease-in-out";
      el.style.opacity = "0";
    }, 10000);
  }

  /** Hide the track name UI instantly. */
  hideTrackName(instantly = false) {
    const el = document.getElementById("music-track-info");
    if (!el) return;

    if (this._musicFadeTimeout) clearTimeout(this._musicFadeTimeout);

    if (instantly) {
      el.style.transition = "none";
      el.style.opacity = "0";
    } else {
      el.style.transition = "opacity 2s ease-in-out";
      el.style.opacity = "0";
    }
  }

  /** Cycle to the next music track. */
  playNextMusicTrack() {
    this.currentMusicIndex =
      (this.currentMusicIndex + 1) % this.musicTracks.length;
    this._playMusicTrack();
  }

  /** Toggle start/stop for music. */
  toggleMusic() {
    if (this.musicHowl && this.musicHowl.playing()) {
      this.musicHowl.pause();
      this.hideTrackName(true);
    } else {
      if (!this.musicHowl) {
        this._playMusicTrack();
      } else {
        this.musicHowl.play();
        this.showTrackName();
      }
    }
  }

  /** Increase current track volume. */
  increaseMusicVolume() {
    const track = this.musicTracks[this.currentMusicIndex];
    track.volume = Math.min(1.0, track.volume + 0.1);
    if (this.musicHowl) {
      this.musicHowl.volume(track.volume);
    }
    this.showTrackName(); // Reshow to show volume change
  }

  /** Decrease current track volume. */
  decreaseMusicVolume() {
    const track = this.musicTracks[this.currentMusicIndex];
    track.volume = Math.max(0.0, track.volume - 0.1);
    if (this.musicHowl) {
      this.musicHowl.volume(track.volume);
    }
    this.showTrackName(); // Reshow to show volume change
  }
}
