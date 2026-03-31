/* ============================================================================
 * Game.js — PRIMARY GAME LOGIC CONTROLLER
 * ============================================================================
 *
 * This is the BRAIN of the entire game. It orchestrates:
 *   - Game state machine (Splash → Playing → Game Over → Splash)
 *   - Entity lifecycle (spawning, updating, destroying asteroids/bullets/bonuses)
 *   - Collision detection (bullet↔asteroid, player↔asteroid, player↔bonus)
 *   - Weapon upgrade progression system
 *   - Wave spawning and difficulty scaling
 *   - Score tracking and persistent high scores (localStorage)
 *   - DOM manipulation for HUD and splash screen UI
 *
 * DESIGN PATTERN: GOD OBJECT / GAME MANAGER
 * In small games, a single controller that owns all entities and manages
 * all interactions is the simplest viable architecture. For larger games,
 * you'd split this into separate Systems (PhysicsSystem, SpawnSystem,
 * UISystem, etc.) using an Entity-Component-System (ECS) pattern.
 *
 * STATE MACHINE:
 * The game has three states, managed by two boolean flags:
 *
 *   ┌─────────────┐  click/space  ┌─────────────┐  player dies  ┌─────────────┐
 *   │   SPLASH    │──────────────→│   PLAYING   │──────────────→│  GAME OVER  │
 *   │   SCREEN    │               │             │               │             │
 *   └─────────────┘               └─────────────┘               └─────────────┘
 *         ↑                                                           │
 *         └───────────────── timeout (5s) or restart ─────────────────┘
 *
 *   isCurrentlyInSplashScreenMode = true  → SPLASH state
 *   isGameCurrentlyInGameOverState = true → GAME OVER state
 *   Both false                            → PLAYING state
 * ============================================================================ */

import * as THREE from "three";
import { ControlledPlayerSpacecraft } from "./Player.js";
import { ProjectileParticle } from "./Bullet.js";
import { CelestialHazardousAsteroid } from "./Asteroid.js";
import { KeyboardInputStateTracker } from "./InputManager.js";
import { BonusPickupElement } from "./Bonus.js";
import { TacticalBalanceUI } from "./BalanceUI.js";
import { SoundManager } from "./SoundManager.js";

export class PrimaryGameLogicController {
  /**
   * Initializes the game engine, sets up all systems, and prepares the splash screen.
   *
   * @param {THREE.Scene} primaryRenderingScene - The Three.js scene graph root.
   *   All 3D objects (player, asteroids, bullets, bonuses) are added to this scene.
   * @param {THREE.PerspectiveCamera} primaryPerspectiveCamera - The camera used to
   *   calculate the visible play area boundaries via FOV trigonometry.
   */
  constructor(primaryRenderingScene, primaryPerspectiveCamera) {
    this.primaryRenderingScene = primaryRenderingScene;
    this.primaryPerspectiveCamera = primaryPerspectiveCamera;

    /* INPUT SYSTEM:
     * Create the polling-based input tracker (see InputManager.js).
     * This registers keydown/keyup listeners and records key states
     * that we query each frame in processGameLogicFrameUpdate(). */
    this.playerInputStateTracker = new KeyboardInputStateTracker();

    /* BOUNDARY CALCULATION:
     * Determine the visible play area in world-space units based on
     * the camera's FOV and Z-position (see method below for math). */
    this.recalculateGameplayAreaBoundaryLimits();

    /* PLAYER SHIP:
     * Create the player's UFO spacecraft (see Player.js).
     * Pass the scene (for adding meshes) and boundaries (for screen wrapping). */
    this.playerSpacecraft = new ControlledPlayerSpacecraft(
      this.primaryRenderingScene,
      this.gameplayAreaBoundaryLimits,
    );

    /* ENTITY ARRAYS:
     * We use plain JavaScript arrays to track all active game entities.
     * Each frame, we iterate these arrays to update physics, check collisions,
     * and remove dead entities.
     *
     * WHY ARRAYS (not Sets or Maps)?
     * - We need indexed iteration for backward-looping removal (splice).
     * - Order doesn't matter for game logic.
     * - Arrays have the best cache locality for sequential iteration. */
    this.currentlyActiveProjectiles = [];
    this.currentlyActiveAsteroids = [];
    this.currentlyActiveBonuses = [];

    /* GAME STATE VARIABLES: */
    this.currentTotalPlayerScore = 0;
    this.isGameCurrentlyInGameOverState = false;
    this.isCurrentlyInSplashScreenMode = true; // Start on splash screen
    this.gameOverTimeoutRemainingSeconds = 5.0; // Countdown to auto-return
    this.timestampOfLastDischargedProjectile = 0; // For fire rate limiting

    /* WEAPON PROGRESSION SYSTEM:
     * The player starts with weak weapons and upgrades them by collecting
     * bonus pickups dropped by destroyed asteroids.
     *
     * w_OnScreenLimit: Max simultaneous bullets. Starts at 1 (very limited).
     * w_ShotRange:     Max travel distance per bullet (world units).
     * w_ShotSpeed:     Bullet velocity (world units per second).
     * w_ShotCooldown:  Minimum time between shots (milliseconds).
     *                  Lower = faster fire rate. 900ms ≈ 1.1 shots/sec. */
    this.w_OnScreenLimit = 1;
    this.w_ShotRange = 18.0;
    this.w_ShotSpeed = 16.0;
    this.w_ShotCooldown = 900.0;

    /* Tracks the upgrade level for each stat (used for UI display). */
    this.w_StatsLevels = { CAPACITY: 0, SPEED: 0, RATE: 0, RANGE: 0 };

    /* WAVE SYSTEM:
     * currentWaveLevel increases each time all asteroids are destroyed.
     * Higher waves spawn more asteroids with more health. */
    this.currentWaveLevel = 0;

    /* LINEAGE TRACKING:
     * A Map<string, number> that tracks how many active fragments exist
     * for each original "root" asteroid. When all fragments of a root
     * asteroid are destroyed (count reaches 0), a special "Family Wipe"
     * bonus is spawned.
     *
     * Example: A large asteroid (lineageId="lin_abc") splits into 2 medium,
     * each medium splits into 2 small = 7 total fragments tracked.
     * When the 7th fragment is destroyed → Family Wipe bonus! */
    this.lineageRegistry = new Map();
    this.lastSessionEndingScore = 0;

    /* COLOR PALETTE:
     * Asteroids are randomly assigned one of these colors on spawn.
     * The color is purely cosmetic and inherited by child fragments
     * when a larger asteroid splits. */
    this.asteroidColorPalette = [
      0xbf00ff, // Purple
      0x00ffff, // Cyan
      0xffff00, // Yellow
      0x00ff00, // Green
    ];

    /* PERSISTENT HIGH SCORE:
     * localStorage.getItem() returns a string (or null if not set).
     * parseInt() converts the string to an integer.
     * The || 0 fallback handles null (first visit) and NaN (corrupted data). */
    this.persistentLocalStorageHighScore =
      parseInt(localStorage.getItem("pink-ufo-asteroids-high-score")) || 0;

    /* SOUND SYSTEM:
     * Initialize Howler.js audio sprite manager (see SoundManager.js).
     * Provides named methods for each game event: playShotFired(), playShotHit(), etc.
     * Start the splash screen ambience immediately so the player hears
     * atmosphere on first load (Howler handles the mobile audio unlock). */
    this.soundManager = new SoundManager();
    this.soundManager.startStartScreen();

    /* BALANCE UI:
     * Initialize the developer tuning panel (see BalanceUI.js).
     * We pass 'this' (the game instance) so it can read/write weapon properties. */
    this.balanceTuningUI = new TacticalBalanceUI(this);

    /* HOTKEY LISTENERS:
     * 'T' toggles the tuning console.
     * 'Space' starts the game from the splash screen.
     *
     * NOTE: We use 'keydown' (not the InputManager) because these are
     * one-shot actions (toggle, start), not continuous held-key inputs. */
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyT") {
        this.balanceTuningUI.toggle();
      }
      if (e.code === "Space" && this.isCurrentlyInSplashScreenMode) {
        this.beginActiveMission();
      }
    });

    /* Update splash screen stats with any saved high score. */
    this.synchronizeScoreStatisticsUI();

    /* Recalculate play boundaries when the window is resized. */
    window.addEventListener("resize", () => {
      this.recalculateGameplayAreaBoundaryLimits();
    });

    /* UI BUTTON BINDINGS:
     * Connect the HTML button elements to their handler methods.
     * addEventListener('click', ...) is the standard DOM event API. */
    document
      .getElementById("begin-active-mission-button")
      .addEventListener("click", () => {
        this.beginActiveMission();
      });

    document
      .getElementById("reset-high-score-button")
      .addEventListener("click", () => {
        this.wipePersistentHighScoreRecords();
      });
  }

  /* ==========================================================================
   * recalculateGameplayAreaBoundaryLimits()
   * ==========================================================================
   * VISIBLE AREA MATH:
   * Given a perspective camera's vertical FOV and its Z-distance from the
   * origin plane, we can calculate the exact visible world-space rectangle.
   *
   *            Camera
   *              │\
   *              │ \  ← half of the vertical FOV angle
   *     Z dist   │  \
   *              │   \
   *   ───────────┼────● ← edge of visible area
   *            Origin
   *
   * Using trigonometry:
   *   tan(halfFOV) = (halfHeight) / Z
   *   halfHeight = tan(halfFOV) * Z
   *   fullHeight = 2 * halfHeight
   *   fullWidth = fullHeight * aspectRatio
   *
   * The boundaries are then ±halfWidth and ±halfHeight centered on (0,0).
   * ========================================================================== */
  recalculateGameplayAreaBoundaryLimits() {
    /* Convert FOV from degrees to radians (Three.js stores FOV in degrees,
     * but JavaScript's Math.tan() expects radians). */
    const verticalFieldOfViewInRadians = THREE.MathUtils.degToRad(
      this.primaryPerspectiveCamera.fov,
    );

    /* Calculate dimensions of the visible rectangle at Z=0 (the gameplay plane). */
    const visibleHeightAtOriginPlane =
      2 *
      Math.tan(verticalFieldOfViewInRadians / 2) *
      this.primaryPerspectiveCamera.position.z;
    const visibleWidthAtOriginPlane =
      visibleHeightAtOriginPlane * this.primaryPerspectiveCamera.aspect;

    this.gameplayAreaBoundaryLimits = {
      left: -visibleWidthAtOriginPlane / 2,
      right: visibleWidthAtOriginPlane / 2,
      bottom: -visibleHeightAtOriginPlane / 2,
      top: visibleHeightAtOriginPlane / 2,
    };

    /* Propagate updated boundaries to the player ship for screen wrapping. */
    if (this.playerSpacecraft) {
      this.playerSpacecraft.gameplayAreaBoundaryLimits =
        this.gameplayAreaBoundaryLimits;
    }
  }

  /* ==========================================================================
   * processGameLogicFrameUpdate() — THE MAIN GAME TICK
   * ==========================================================================
   * Called once per frame from main.js's animation loop.
   * This is the central hub where ALL game logic is processed each frame.
   *
   * EXECUTION ORDER MATTERS:
   *   1. State checks (splash screen / game over — early returns)
   *   2. Player update (input → movement)
   *   3. Shooting logic (input → bullet creation)
   *   4. Entity updates (move all bullets, asteroids, bonuses)
   *   5. Collision detection (after everything has moved to new positions)
   *
   * @param {number} timeDeltaInSeconds - Seconds since previous frame (~0.016 at 60fps).
   * ========================================================================== */
  processGameLogicFrameUpdate(timeDeltaInSeconds) {
    /* STATE: SPLASH SCREEN — Skip all game logic. The 3D scene is rendered
     * but nothing moves or interacts. */
    if (this.isCurrentlyInSplashScreenMode) {
      return;
    }

    /* STATE: GAME OVER — Only process the countdown timer and restart input. */
    if (this.isGameCurrentlyInGameOverState) {
      this.gameOverTimeoutRemainingSeconds -= timeDeltaInSeconds;

      /* Update the "Returning to base in Xs..." countdown text.
       * Math.ceil() rounds UP so the display shows "1" until the very last moment
       * (not "0" while still counting). */
      const timeoutTextElement = document.getElementById(
        "game-over-timeout-info",
      );
      if (timeoutTextElement) {
        timeoutTextElement.innerText = `Returning to base in ${Math.ceil(this.gameOverTimeoutRemainingSeconds)}s...`;
      }

      /* Auto-return to splash screen when countdown completes. */
      if (this.gameOverTimeoutRemainingSeconds <= 0) {
        this.returnToSplashScreen();
        return;
      }

      /* Allow manual restart via 'R' key during game-over. */
      if (
        this.playerInputStateTracker.verifyIfSpecificKeyIsCurrentlyPressed(
          "KeyR",
        )
      ) {
        this.initiateGameSessionRestart();
      }
      return;
    }

    /* --- STATE: ACTIVE GAMEPLAY --- */

    /* Update the player ship's position, rotation, and animations. */
    this.playerSpacecraft.performFrameUpdate(
      timeDeltaInSeconds,
      this.playerInputStateTracker,
    );

    /* THRUST SOUND:
     * Start the engine sound when the player is thrusting, stop when released.
     * The SoundManager internally guards against re-triggering every frame. */
    const isThrusting =
      this.playerInputStateTracker.verifyIfSpecificKeyIsCurrentlyPressed(
        "ArrowUp",
      ) ||
      this.playerInputStateTracker.verifyIfSpecificKeyIsCurrentlyPressed(
        "KeyW",
      );
    if (isThrusting) {
      this.soundManager.startThrust();
    } else {
      this.soundManager.stopThrust();
    }

    /* SHOOTING LOGIC:
     * Check if Spacebar is held AND the weapon cooldown has elapsed AND
     * there are fewer on-screen bullets than the capacity limit.
     *
     * performance.now() returns a high-resolution timestamp in MILLISECONDS.
     * We compare against w_ShotCooldown (also in ms) to enforce fire rate. */
    if (
      this.playerInputStateTracker.verifyIfSpecificKeyIsCurrentlyPressed(
        "Space",
      )
    ) {
      const currentHighResolutionTimestamp = performance.now();
      const hasAvailableShotCapacity =
        this.currentlyActiveProjectiles.length < this.w_OnScreenLimit;

      if (
        hasAvailableShotCapacity &&
        currentHighResolutionTimestamp -
          this.timestampOfLastDischargedProjectile >
          this.w_ShotCooldown
      ) {
        this.timestampOfLastDischargedProjectile =
          currentHighResolutionTimestamp;
        this.dischargeSpacecraftProjectile();
      }
    }

    /* UPDATE ALL ACTIVE PROJECTILES:
     * BACKWARD ITERATION PATTERN: We loop from the end to the start so that
     * when we splice (remove) an element, it doesn't shift the indices of
     * elements we haven't processed yet.
     *
     * If we looped forward (i=0 to length):
     *   array = [A, B, C, D], remove B at index 1
     *   → array becomes [A, C, D], but i increments to 2
     *   → we skip C (which is now at index 1) and process D
     *
     * Backward looping avoids this by only shifting elements AFTER
     * the current index (which we've already processed). */
    for (let i = this.currentlyActiveProjectiles.length - 1; i >= 0; i--) {
      const currentPulse = this.currentlyActiveProjectiles[i];
      currentPulse.performFrameUpdate(timeDeltaInSeconds);
      if (!currentPulse.isCurrentlyActiveAndValid) {
        this.currentlyActiveProjectiles.splice(i, 1);
      }
    }

    /* UPDATE ALL ACTIVE ASTEROIDS (same backward iteration pattern). */
    for (let i = this.currentlyActiveAsteroids.length - 1; i >= 0; i--) {
      const currentHazard = this.currentlyActiveAsteroids[i];
      currentHazard.performFrameUpdate(timeDeltaInSeconds);
      if (!currentHazard.isCurrentlyActiveAndValid) {
        this.currentlyActiveAsteroids.splice(i, 1);
      }
    }

    /* RUN COLLISION DETECTION after all entities have moved to their new positions. */
    this.executeCollisionDetectionPass(timeDeltaInSeconds);

    /* UPDATE ALL ACTIVE BONUSES (same backward iteration pattern). */
    for (let i = this.currentlyActiveBonuses.length - 1; i >= 0; i--) {
      const bonus = this.currentlyActiveBonuses[i];
      bonus.performFrameUpdate(timeDeltaInSeconds);
      if (!bonus.isCurrentlyActiveAndValid) {
        this.currentlyActiveBonuses.splice(i, 1);
      }
    }
  }

  /* ==========================================================================
   * dischargeSpacecraftProjectile() — FIRE A BULLET
   * ==========================================================================
   * Creates a new ProjectileParticle at the tip of the player's ship,
   * traveling in the ship's current forward direction.
   *
   * DIRECTION CALCULATION:
   * 1. Start with local "forward" vector (0, 1, 0) — "up" in local space.
   * 2. Rotate it by the ship's current Z-rotation using applyAxisAngle().
   *    This converts from local space to world space.
   *
   * SPAWN POSITION:
   * We start from the ship's center and add the forward direction * radius
   * to place the bullet at the ship's nose (not inside the ship body).
   * ========================================================================== */
  dischargeSpacecraftProjectile() {
    const forwardDirectionUnitVector = new THREE.Vector3(0, 1, 0);
    forwardDirectionUnitVector.applyAxisAngle(
      new THREE.Vector3(0, 0, 1),
      this.playerSpacecraft.spacecraftRenderingMesh.rotation.z,
    );

    /* Clone the ship's position and offset forward by the collision radius. */
    const projectileSpawnLocationCoordinate =
      this.playerSpacecraft.spacecraftRenderingMesh.position.clone();
    projectileSpawnLocationCoordinate.addScaledVector(
      forwardDirectionUnitVector,
      this.playerSpacecraft.physicalCollisionRadius,
    );

    /* Create the bullet with current weapon stats and ship momentum. */
    const newlyCreatedProjectile = new ProjectileParticle(
      this.primaryRenderingScene,
      projectileSpawnLocationCoordinate,
      forwardDirectionUnitVector,
      this.gameplayAreaBoundaryLimits,
      this.w_ShotSpeed,
      this.w_ShotRange,
      this.playerSpacecraft.currentLinearVelocityVector, // Newtonian momentum transfer
    );
    this.currentlyActiveProjectiles.push(newlyCreatedProjectile);
    this.updateAmmunitionHUDDisplay();

    /* SOUND: Play the shot fired audio cue. */
    this.soundManager.playShotFired();
  }

  /* Updates the weapon stats text in the HUD. */
  updateAmmunitionHUDDisplay() {
    const ammoElem = document.getElementById("game-current-ammo-display");
    if (ammoElem) {
      const limit = this.w_OnScreenLimit;
      const rate = Math.round(900 - this.w_ShotCooldown) + 1;
      const speed = Math.round(this.w_ShotSpeed);
      const range = Math.round(this.w_ShotRange);
      ammoElem.innerText = `Shots: ${limit} | Shot Rate: ${rate} | Shot Velocity: ${speed} | Shot Range: ${range}`;
    }
  }

  /* ==========================================================================
   * executeCollisionDetectionPass() — PHYSICS COLLISION ENGINE
   * ==========================================================================
   * Checks for overlaps between all entity pairs that can interact.
   *
   * COLLISION METHOD: CIRCLE-TO-CIRCLE (Sphere-to-Sphere in 3D)
   * Two circles collide when the distance between their centers is less
   * than the sum of their radii:
   *   collision = distance(A, B) < radiusA + radiusB
   *
   * This is the simplest and fastest collision detection method.
   * It works well for our game because all entities are roughly circular.
   *
   * PERFORMANCE: O(n*m) brute force — checks every bullet against every
   * asteroid. For our small entity counts (~50 total), this is fine.
   * Larger games would use spatial partitioning (quadtree, grid) to
   * reduce the number of pair checks.
   *
   * @param {number} timeDeltaInSeconds - Not used directly but passed for API consistency.
   * ========================================================================== */
  executeCollisionDetectionPass(timeDeltaInSeconds) {
    /* --- 1. PROJECTILE ↔ ASTEROID COLLISIONS ---
     * Double backward loop: for each bullet, check against each asteroid.
     * When a hit is found, destroy the bullet and damage the asteroid. */
    for (
      let projectileIdx = this.currentlyActiveProjectiles.length - 1;
      projectileIdx >= 0;
      projectileIdx--
    ) {
      const activeProjectile = this.currentlyActiveProjectiles[projectileIdx];

      for (
        let asteroidIdx = this.currentlyActiveAsteroids.length - 1;
        asteroidIdx >= 0;
        asteroidIdx--
      ) {
        const candidateAsteroid = this.currentlyActiveAsteroids[asteroidIdx];

        /* Vector3.distanceTo() calculates the Euclidean distance between two points:
         * √((x2-x1)² + (y2-y1)² + (z2-z1)²) */
        const euclideanDistanceBetweenEntities =
          activeProjectile.projectileRenderingMesh.position.distanceTo(
            candidateAsteroid.asteroidRenderingMesh.position,
          );

        if (
          euclideanDistanceBetweenEntities <
          activeProjectile.physicalCollisionRadius +
            candidateAsteroid.physicalCollisionRadius
        ) {
          activeProjectile.initiateSelfDestructionSequence();

          /* SOUND: Play the shot hit audio cue on every bullet↔asteroid contact. */
          this.soundManager.playShotHit();

          /* takeDamage() returns true if the asteroid's health reaches zero. */
          const isAsteroidDestroyed = candidateAsteroid.takeDamage();
          if (isAsteroidDestroyed) {
            /* SOUND: Play the asteroid break/crunch sound on destruction. */
            this.soundManager.playAsteroidBreak();
            this.executeAsteroidDecompositionAndSplitting(candidateAsteroid);
          }
          break; // This bullet is spent — stop checking it against other asteroids.
        }
      }
    }

    /* --- 2. PLAYER ↔ ASTEROID COLLISIONS ---
     * If the player ship overlaps any asteroid, trigger game over.
     * The 0.8 scale factor on the asteroid radius creates a slightly
     * forgiving collision, compensating for the visual jaggedness that
     * extends beyond the mathematical radius. */
    for (const imminentHazard of this.currentlyActiveAsteroids) {
      if (!imminentHazard.isCurrentlyActiveAndValid) continue;

      const distanceToPlayerSpacecraftCenter =
        this.playerSpacecraft.spacecraftRenderingMesh.position.distanceTo(
          imminentHazard.asteroidRenderingMesh.position,
        );

      const collisionBufferScaleFactor = 0.8;
      if (
        distanceToPlayerSpacecraftCenter <
        this.playerSpacecraft.physicalCollisionRadius +
          imminentHazard.physicalCollisionRadius * collisionBufferScaleFactor
      ) {
        this.transitionToGameOverState();
      }
    }

    /* --- 3. PLAYER ↔ BONUS COLLISIONS ---
     * When the player touches a bonus gem, apply the upgrade and remove the gem. */
    for (let i = this.currentlyActiveBonuses.length - 1; i >= 0; i--) {
      const bonus = this.currentlyActiveBonuses[i];
      const distanceToPlayer =
        this.playerSpacecraft.spacecraftRenderingMesh.position.distanceTo(
          bonus.gemMesh.position,
        );

      if (
        distanceToPlayer <
        this.playerSpacecraft.physicalCollisionRadius +
          bonus.physicalCollisionRadius
      ) {
        /* SOUND: Play the bonus pickup chime. */
        this.soundManager.playBonusPickup();

        this.upgradeWeaponSystem(bonus.rewardType);

        if (bonus.rewardType === "POINTS") {
          this.currentTotalPlayerScore += 2000;
          document.getElementById("game-current-score-display").innerText =
            `Score: ${this.currentTotalPlayerScore}`;
        }

        this.updateAmmunitionHUDDisplay();
        bonus.initiateSelfDestructionSequence();
      }
    }

    /* --- 4. WAVE COMPLETION CHECK ---
     * When all asteroids are destroyed, spawn the next wave.
     * This creates an endless wave progression system. */
    if (this.currentlyActiveAsteroids.length === 0) {
      this.currentWaveLevel++;
      this.spawnInitialHazardWave();
    }
  }

  /* ==========================================================================
   * executeAsteroidDecompositionAndSplitting() — ASTEROID SPLITTING
   * ==========================================================================
   * When a large or medium asteroid is destroyed, it splits into two
   * smaller child asteroids. Small asteroids (size 1) simply disappear.
   *
   * SPLITTING HIERARCHY:
   *   Size 3 (Large)  → 2x Size 2 (Medium)
   *   Size 2 (Medium) → 2x Size 1 (Small)
   *   Size 1 (Small)  → Nothing (fully destroyed)
   *
   * SCORING:
   * Smaller asteroids are worth MORE points to reward precision:
   *   Large (3):  100 * (4-3) = 100 points
   *   Medium (2): 100 * (4-2) = 200 points
   *   Small (1):  100 * (4-1) = 300 points
   *
   * @param {CelestialHazardousAsteroid} asteroidToDecompose - The asteroid that was just destroyed.
   * ========================================================================== */
  executeAsteroidDecompositionAndSplitting(asteroidToDecompose) {
    const originalDecompositionSourceCoordinate =
      asteroidToDecompose.asteroidRenderingMesh.position.clone();
    const childAsteroidSizeCategoryValue =
      asteroidToDecompose.relativeHazardSizeCategory - 1;

    /* Remove the parent asteroid from the scene. */
    asteroidToDecompose.initiateDecompositionSequence();

    /* Award points (inversely proportional to size). */
    const scoreRewardIncrement =
      100 * (4 - asteroidToDecompose.relativeHazardSizeCategory);
    this.currentTotalPlayerScore += scoreRewardIncrement;
    document.getElementById("game-current-score-display").innerText =
      `Score: ${this.currentTotalPlayerScore}`;

    const parentColor = asteroidToDecompose.asteroidColor;

    /* LINEAGE TRACKING: Decrement the fragment count for this family. */
    const linId = asteroidToDecompose.lineageId;
    const currentCount = this.lineageRegistry.get(linId) || 1;
    this.lineageRegistry.set(linId, currentCount - 1);

    /* SPAWN CHILDREN (if not already the smallest size). */
    if (childAsteroidSizeCategoryValue > 0) {
      const childHealth = this.calculateAsteroidHealth(
        this.currentWaveLevel,
        childAsteroidSizeCategoryValue,
      );

      /* Two children spawn at the parent's position with random velocities.
       * They inherit the parent's color and lineageId for family tracking. */
      const childA = new CelestialHazardousAsteroid(
        this.primaryRenderingScene,
        this.gameplayAreaBoundaryLimits,
        originalDecompositionSourceCoordinate.clone(),
        childAsteroidSizeCategoryValue,
        parentColor,
        childHealth,
        linId,
      );
      const childB = new CelestialHazardousAsteroid(
        this.primaryRenderingScene,
        this.gameplayAreaBoundaryLimits,
        originalDecompositionSourceCoordinate.clone(),
        childAsteroidSizeCategoryValue,
        parentColor,
        childHealth,
        linId,
      );

      this.currentlyActiveAsteroids.push(childA);
      this.currentlyActiveAsteroids.push(childB);

      /* Update lineage: we removed 1 parent (-1 above) and added 2 children. */
      this.lineageRegistry.set(linId, this.lineageRegistry.get(linId) + 2);
    }

    /* CHECK FOR FAMILY WIPE:
     * If all fragments of this lineage are destroyed (count === 0),
     * spawn a special high-value bonus reward. */
    if (this.lineageRegistry.get(linId) === 0) {
      const familyWipeTypes = ["CAPACITY", "POINTS"];
      const type =
        familyWipeTypes[Math.floor(Math.random() * familyWipeTypes.length)];

      this.currentlyActiveBonuses.push(
        new BonusPickupElement(
          this.primaryRenderingScene,
          originalDecompositionSourceCoordinate.clone(),
          parentColor,
          type,
        ),
      );
      this.lineageRegistry.delete(linId); // Clean up the Map entry
    } else {
      /* RANDOM DROP: 25% chance to spawn a weapon upgrade on any asteroid kill. */
      if (Math.random() < 0.25) {
        const dropTypes = ["CAPACITY", "SPEED", "RATE", "RANGE"];
        const randomType =
          dropTypes[Math.floor(Math.random() * dropTypes.length)];

        this.currentlyActiveBonuses.push(
          new BonusPickupElement(
            this.primaryRenderingScene,
            originalDecompositionSourceCoordinate.clone(),
            0xffffff,
            randomType,
          ),
        );
      }
    }
  }

  /* ==========================================================================
   * transitionToGameOverState() — PLAYER DEATH HANDLER
   * ========================================================================== */
  transitionToGameOverState() {
    this.isGameCurrentlyInGameOverState = true;
    this.gameOverTimeoutRemainingSeconds = 5.0;

    /* Save session score and update persistent high score via localStorage.
     * localStorage.setItem() writes a key-value pair that persists across
     * browser sessions (survives tab close, browser restart, even reboots). */
    this.lastSessionEndingScore = this.currentTotalPlayerScore;
    if (this.currentTotalPlayerScore > this.persistentLocalStorageHighScore) {
      this.persistentLocalStorageHighScore = this.currentTotalPlayerScore;
      localStorage.setItem(
        "pink-ufo-asteroids-high-score",
        this.persistentLocalStorageHighScore,
      );
    }

    /* SOUND: Stop all gameplay audio and play the game over sound. */
    this.soundManager.stopShipHum();
    this.soundManager.stopThrust();
    this.soundManager.playGameOver();

    /* Visual feedback: change ship color to red.
     * material.color and material.emissive are THREE.Color objects with setHex(). */
    this.playerSpacecraft.mainHullMaterial.color.setHex(0xff0000);
    this.playerSpacecraft.mainHullMaterial.emissive.setHex(0x550000);

    /* Show the game-over DOM panel and restore the mouse cursor. */
    document.getElementById("game-over-notification-panel").style.display =
      "block";
    document.body.style.cursor = "auto";
  }

  /* ==========================================================================
   * initiateGameSessionRestart() — FULL GAME RESET
   * ==========================================================================
   * Resets ALL game state to initial values and spawns a fresh wave.
   * Called when:
   *   1. Player presses 'R' during game-over.
   *   2. beginActiveMission() is called from the splash screen.
   * ========================================================================== */
  initiateGameSessionRestart() {
    this.isGameCurrentlyInGameOverState = false;
    this.currentTotalPlayerScore = 0;
    this.currentWaveLevel = 0;

    /* Reset all weapon stats to starting values. */
    this.w_StatsLevels = { CAPACITY: 0, SPEED: 0, RATE: 0, RANGE: 0 };
    this.w_OnScreenLimit = 1;
    this.w_ShotRange = 18.0;
    this.w_ShotSpeed = 16.0;
    this.w_ShotCooldown = 900.0;

    /* Reset HUD displays. */
    document.getElementById("game-current-score-display").innerText =
      `Score: 0`;
    this.updateAmmunitionHUDDisplay();
    document.getElementById("game-over-notification-panel").style.display =
      "none";

    /* Reset ship appearance and physics. */
    this.playerSpacecraft.mainHullMaterial.color.setHex(0xff00ff);
    this.playerSpacecraft.mainHullMaterial.emissive.setHex(0xaa00aa);
    this.playerSpacecraft.spacecraftHeadingContainer.position.set(0, 0, 0);
    this.playerSpacecraft.currentLinearVelocityVector.set(0, 0, 0);
    this.playerSpacecraft.spacecraftHeadingContainer.rotation.z = 0;

    /* Purge all existing entities from the scene. */
    for (const pulse of this.currentlyActiveProjectiles)
      pulse.initiateSelfDestructionSequence();
    this.currentlyActiveProjectiles = [];

    for (const hazard of this.currentlyActiveAsteroids)
      hazard.initiateDecompositionSequence();
    this.currentlyActiveAsteroids = [];

    for (const bonus of this.currentlyActiveBonuses)
      bonus.initiateSelfDestructionSequence();
    this.currentlyActiveBonuses = [];

    /* Spawn the first wave of asteroids. */
    this.spawnInitialHazardWave();
  }

  /* ==========================================================================
   * spawnInitialHazardWave() — WAVE GENERATION
   * ==========================================================================
   * Spawns a new wave of large (size 3) asteroids at screen edges.
   * Quantity scales with wave level: 5 base + up to 5 bonus (capped at wave 5).
   *   Wave 0: 5 asteroids, Wave 3: 8, Wave 5+: 10 (maximum).
   * ========================================================================== */
  spawnInitialHazardWave() {
    this.lineageRegistry.clear();
    const initialWaveAsteroidQuantity = 5 + Math.min(this.currentWaveLevel, 5);

    for (let i = 0; i < initialWaveAsteroidQuantity; i++) {
      const randomColor =
        this.asteroidColorPalette[
          Math.floor(Math.random() * this.asteroidColorPalette.length)
        ];
      const health = this.calculateAsteroidHealth(this.currentWaveLevel, 3);

      const asteroid = new CelestialHazardousAsteroid(
        this.primaryRenderingScene,
        this.gameplayAreaBoundaryLimits,
        null,
        3,
        randomColor,
        health,
      );
      this.currentlyActiveAsteroids.push(asteroid);

      /* Register this asteroid in the lineage system (starts with count 1). */
      this.lineageRegistry.set(asteroid.lineageId, 1);
    }
  }

  /* ==========================================================================
   * calculateAsteroidHealth() — DIFFICULTY SCALING
   * ==========================================================================
   * Returns the number of hits an asteroid can absorb before destruction.
   * Health increases with wave number and is higher for larger asteroids.
   *
   * Formula uses staggered thresholds (every 3 waves) so difficulty
   * ramps up gradually rather than linearly with each wave.
   *   Wave 0-1: Large=1hp, Medium=1hp, Small=1hp
   *   Wave 2:   Large=1hp, Medium=1hp, Small=1hp
   *   Wave 3:   Large=2hp, Medium=1hp, Small=1hp
   *   Wave 6:   Large=3hp, Medium=3hp, Small=2hp
   * ========================================================================== */
  calculateAsteroidHealth(wave, size) {
    if (size === 3) return 1 + Math.floor((wave + 2) / 3);
    if (size === 2) return 1 + Math.floor((wave + 1) / 3);
    if (size === 1) return 1 + Math.floor(wave / 3);
    return 1;
  }

  /* ==========================================================================
   * upgradeWeaponSystem() — WEAPON STAT UPGRADE
   * ==========================================================================
   * Called when the player collects a bonus pickup. Increases the
   * corresponding weapon stat up to a hard cap.
   *
   * Each stat has a maximum level to prevent the game from becoming trivial:
   *   CAPACITY: max 6 simultaneous bullets
   *   RANGE:    max 50% of screen width
   *   SPEED:    max 80 units/sec
   *   RATE:     min 100ms cooldown (10 shots/sec)
   *
   * @param {string} rewardType - 'CAPACITY', 'SPEED', 'RATE', 'RANGE', or 'POINTS'.
   * ========================================================================== */
  upgradeWeaponSystem(rewardType) {
    if (!this.w_StatsLevels[rewardType] && rewardType !== "POINTS") {
      this.w_StatsLevels[rewardType] = 0;
    }

    let upgraded = false;
    let atMax = false;

    switch (rewardType) {
      case "CAPACITY":
        if (this.w_OnScreenLimit < 6) {
          this.w_OnScreenLimit = Math.min(6, this.w_OnScreenLimit + 1);
          this.w_StatsLevels["CAPACITY"]++;
          upgraded = true;
        } else {
          atMax = true;
        }
        break;

      case "RANGE":
        const screenWidth =
          this.gameplayAreaBoundaryLimits.right -
          this.gameplayAreaBoundaryLimits.left;
        const maxRange = screenWidth * 0.5;
        if (this.w_ShotRange < maxRange) {
          this.w_ShotRange = Math.min(maxRange, this.w_ShotRange + 8);
          this.w_StatsLevels["RANGE"]++;
          upgraded = true;
        } else {
          atMax = true;
        }
        break;

      case "SPEED":
        if (this.w_ShotSpeed < 80) {
          this.w_ShotSpeed = Math.min(80, this.w_ShotSpeed + 10);
          this.w_StatsLevels["SPEED"]++;
          upgraded = true;
        } else {
          atMax = true;
        }
        break;

      case "RATE":
        if (this.w_ShotCooldown > 100) {
          this.w_ShotCooldown = Math.max(100, this.w_ShotCooldown - 60);
          this.w_StatsLevels["RATE"]++;
          upgraded = true;
        } else {
          atMax = true;
        }
        break;

      case "POINTS":
        break; // Points don't upgrade weapon stats
    }

    /* Show a floating notification popup (see showBoostNotification below). */
    this.showBoostNotification(rewardType, upgraded, atMax);
    this.updateAmmunitionHUDDisplay();

    /* Sync the tuning console sliders to reflect the new values. */
    if (this.balanceTuningUI) {
      this.balanceTuningUI.synchronizeUIFromGameState();
    }
  }

  /* ==========================================================================
   * showBoostNotification() — FLOATING POPUP
   * ==========================================================================
   * Creates a temporary DOM element with the upgrade info, positions it
   * semi-randomly on screen, and lets the CSS animation handle the
   * float-up-and-fade effect. Auto-removed after 2 seconds.
   *
   * WHY DOM ELEMENTS instead of 3D text?
   * HTML/CSS is far better at rendering styled text than Three.js:
   *   - No texture atlas or SDF font rendering needed.
   *   - CSS animations handle the float/fade for free.
   *   - Font rendering is crisp at any size (vector, not rasterized).
   * ========================================================================== */
  showBoostNotification(type, upgraded, atMax) {
    const container = document.body;
    const notification = document.createElement("div");
    notification.className = "boost-notification-popup";

    if (type === "POINTS") {
      notification.innerHTML = `<div class="boost-type" style="color: #ffffff">BONUS POINTS!</div><div class="boost-level">+2000</div>`;
    } else {
      const level = this.w_StatsLevels[type] || 0;
      let label = type;
      if (type === "CAPACITY") label = "CAPACITY";
      if (type === "RATE") label = "RATE";

      const statusText = atMax ? "MAXED" : "UP";
      const prefix = "BULLET ";

      notification.innerHTML = `
            <div class="boost-type" style="color: ${this.getBoostColor(type)}">${prefix}${label} ${statusText}</div>
            <div class="boost-level">${atMax ? "LEVEL MAX" : "LEVEL " + level}</div>
          `;
    }

    /* Position using percentage values for viewport-relative placement.
     * The ±10% randomness prevents stacking if multiple boosts are collected rapidly. */
    const x = 50 + (Math.random() * 20 - 10);
    const y = 40 + (Math.random() * 20 - 10);
    notification.style.left = `${x}%`;
    notification.style.top = `${y}%`;

    container.appendChild(notification);

    /* setTimeout schedules removal after the CSS animation completes (2s).
     * element.remove() detaches it from the DOM, freeing memory. */
    setTimeout(() => {
      notification.remove();
    }, 2000);
  }

  /** Returns the CSS color string for a given boost type. */
  getBoostColor(type) {
    const colors = {
      CAPACITY: "#ff0000",
      SPEED: "#ffa500",
      RATE: "#ffff00",
      RANGE: "#ff69b4",
    };
    return colors[type] || "#ffffff";
  }

  /* ==========================================================================
   * beginActiveMission() — START GAME FROM SPLASH SCREEN
   * ==========================================================================
   * Transitions from splash screen to active gameplay:
   *   1. Hide cursor (immersive game feel).
   *   2. Fade out splash screen (CSS opacity transition over 1.5s).
   *   3. After fade, swap display states (splash → none, HUD → flex).
   *   4. Reset game state and spawn the first wave.
   * ========================================================================== */
  beginActiveMission() {
    this.isCurrentlyInSplashScreenMode = false;
    document.body.style.cursor = "none";

    /* SOUND: Transition audio from splash ambience to gameplay hum. */
    this.soundManager.stopStartScreen();
    this.soundManager.startShipHum();

    /* Trigger the CSS opacity transition (defined in style.css). */
    document.getElementById("game-loading-splash-screen").style.opacity = "0";

    /* Wait for the fade to complete before swapping display properties.
     * If we set display:none immediately, the fade transition would be
     * cancelled (elements with display:none can't animate). */
    setTimeout(() => {
      document.getElementById("game-loading-splash-screen").style.display =
        "none";
      document.getElementById("game-heads-up-display-overlay").style.display =
        "flex";
    }, 1000);

    this.initiateGameSessionRestart();
  }

  /* ==========================================================================
   * returnToSplashScreen() — RETURN FROM GAME OVER
   * ==========================================================================
   * Reverses the splash screen transition. Uses a micro-delay (10ms) between
   * setting display:flex and opacity:1 because CSS transitions don't trigger
   * when both properties change in the same execution frame — the browser
   * needs to "see" the element as display:flex before it can animate opacity.
   * ========================================================================== */
  returnToSplashScreen() {
    this.isCurrentlyInSplashScreenMode = true;
    this.isGameCurrentlyInGameOverState = false;
    document.body.style.cursor = "auto";

    /* SOUND: Stop all gameplay audio and restart the splash screen ambience. */
    this.soundManager.stopAll();
    this.soundManager.startStartScreen();

    document.getElementById("game-heads-up-display-overlay").style.display =
      "none";
    const splashScreen = document.getElementById("game-loading-splash-screen");
    splashScreen.style.display = "flex";
    setTimeout(() => {
      splashScreen.style.opacity = "1";
    }, 10);

    this.synchronizeScoreStatisticsUI();
  }

  /* Updates the score labels on the splash screen. */
  synchronizeScoreStatisticsUI() {
    const lastScoreElem = document.getElementById("last-session-score-value");
    const highScoreElem = document.getElementById(
      "persistent-high-score-value",
    );
    if (lastScoreElem) lastScoreElem.innerText = this.lastSessionEndingScore;
    if (highScoreElem)
      highScoreElem.innerText = this.persistentLocalStorageHighScore;
  }

  /* Clears the persistent high score after a confirmation dialog.
   * confirm() is a browser-native modal dialog that returns true/false. */
  wipePersistentHighScoreRecords() {
    if (confirm("Are you sure you want to clear your Best Score?")) {
      this.persistentLocalStorageHighScore = 0;
      localStorage.removeItem("pink-ufo-asteroids-high-score");
      this.synchronizeScoreStatisticsUI();
    }
  }
}
