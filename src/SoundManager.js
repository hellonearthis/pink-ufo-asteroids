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
      shotFired: "Sprite 26", // ~427ms  — short, snappy
      shotHit: "Sprite 27", // ~422ms  — short impact
      shipHum: "Sprite 7", // ~1834ms — longer, loopable ambient
      shipThrust: "Sprite 5", // ~868ms  — medium engine burst
      gameOver: "Sprite 17", // ~2387ms — dramatic, longer
      startScreen: "Sprite 32", // ~1956ms — atmospheric, longer
      bonusPickup: "Sprite 24", // ~586ms  — short reward chime
      asteroidBreak: "Sprite 28", // ~539ms  — short crunch/crack
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
      "Sprite 1": [0, 1598],
      "Sprite 2": [2198, 461],
      "Sprite 3": [2678, 460],
      "Sprite 4": [3546, 708],
      "Sprite 5": [5075, 868],
      "Sprite 6": [6238, 689],
      "Sprite 7": [6946, 1834],
      "Sprite 8": [8902, 1449],
      "Sprite 9": [11214, 990],
      "Sprite 10": [13311, 1140],
      "Sprite 11": [15478, 1454],
      "Sprite 12": [17415, 877],
      "Sprite 13": [18489, 1074],
      "Sprite 14": [20098, 793],
      "Sprite 15": [22171, 1074],
      "Sprite 16": [23259, 1468],
      "Sprite 17": [27128, 2387],
      "Sprite 18": [29722, 2125],
      "Sprite 19": [31880, 994],
      "Sprite 20": [33502, 976],
      "Sprite 21": [34487, 924],
      "Sprite 22": [37686, 694],
      "Sprite 23": [36584, 990],
      "Sprite 24": [38948, 586],
      "Sprite 25": [41701, 1332],
      "Sprite 26": [43493, 427],
      "Sprite 27": [43924, 422],
      "Sprite 28": [44764, 539],
      "Sprite 29": [45852, 1126],
      "Sprite 30": [46982, 713],
      "Sprite 31": [50125, 769],
      "Sprite 32": [52310, 1956],
      "Sprite 33": [56968, 361],
    };

    /* Mark looping sprites by adding the 3rd boolean element.
     * Howler format: [startMs, durationMs, loop?] */
    const loopingSprites = [
      this.SPRITE_MAP.shipHum,
      this.SPRITE_MAP.startScreen,
      this.SPRITE_MAP.shipThrust,
    ];
    const spriteDefinition = {};
    for (const [name, timing] of Object.entries(rawSprites)) {
      if (loopingSprites.includes(name)) {
        spriteDefinition[name] = [timing[0], timing[1], true]; // Loop = true
      } else {
        spriteDefinition[name] = timing;
      }
    }

    /* Create the main Howl instance. */
    this.sound = new Howl({
      src: ["GameSounds.wav"],
      sprite: spriteDefinition,
      volume: 0.5,
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
      gameOver: 0.6,
      startScreen: 0.2,
      bonusPickup: 0.5,
      asteroidBreak: 0.4,
    };

    /* Track IDs of currently playing looping sounds so we can stop them.
     * Howl.play() returns a numeric ID that can be passed to .stop(id). */
    this._loopIds = {
      shipHum: null,
      startScreen: null,
    };

    /* Track thrust state to avoid re-triggering every frame. */
    this._isThrustPlaying = false;
    this._thrustId = null;
  }

  /* ==========================================================================
   * ONE-SHOT SOUND METHODS
   * ==========================================================================
   * These play a sound once and forget about it. Howler handles cleanup.
   * sound.play('spriteName') returns an ID and starts playback immediately.
   * sound.volume(level, id) sets volume for that specific playback instance.
   * ========================================================================== */

  /** Play when the player fires a bullet. */
  playShotFired() {
    const id = this.sound.play(this.SPRITE_MAP.shotFired);
    this.sound.volume(this.volumes.shotFired, id);
  }

  /** Play a specific sprite by name (used for sound testing). */
  playSprite(spriteName) {
    const id = this.sound.play(spriteName);
    this.sound.volume(0.8, id);
  }

  /** Play when a bullet hits an asteroid. */
  playShotHit() {
    const id = this.sound.play(this.SPRITE_MAP.shotHit);
    this.sound.volume(this.volumes.shotHit, id);
  }

  /** Play when an asteroid splits or is destroyed. */
  playAsteroidBreak() {
    const id = this.sound.play(this.SPRITE_MAP.asteroidBreak);
    this.sound.volume(this.volumes.asteroidBreak, id);
  }

  /** Play when the player collects a bonus gem. */
  playBonusPickup() {
    const id = this.sound.play(this.SPRITE_MAP.bonusPickup);
    this.sound.volume(this.volumes.bonusPickup, id);
  }

  /** Play the game over sound. */
  playGameOver() {
    const id = this.sound.play(this.SPRITE_MAP.gameOver);
    this.sound.volume(this.volumes.gameOver, id);
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
  startStartScreen() {
    if (this._loopIds.startScreen !== null) return;
    this._loopIds.startScreen = this.sound.play(this.SPRITE_MAP.startScreen);
    this.sound.volume(this.volumes.startScreen, this._loopIds.startScreen);
  }

  /** Stop the start screen sound. */
  stopStartScreen() {
    if (this._loopIds.startScreen !== null) {
      this.sound.stop(this._loopIds.startScreen);
      this._loopIds.startScreen = null;
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
    this._thrustId = this.sound.play(this.SPRITE_MAP.shipThrust);
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

  /* ==========================================================================
   * GLOBAL CONTROLS
   * ========================================================================== */

  /** Stop ALL sounds (used during state transitions). */
  stopAll() {
    this.sound.stop();
    this._loopIds.shipHum = null;
    this._loopIds.startScreen = null;
    this._isThrustPlaying = false;
    this._thrustId = null;
  }

  /** Set master volume (0.0 to 1.0). */
  setMasterVolume(level) {
    this.sound.volume(level);
  }
}
