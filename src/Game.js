import * as THREE from 'three';
import { ControlledPlayerSpacecraft } from './Player.js';
import { ProjectileParticle } from './Bullet.js';
import { CelestialHazardousAsteroid } from './Asteroid.js';
import { KeyboardInputStateTracker } from './InputManager.js';
import { BonusPickupElement } from './Bonus.js';

/**
 * The core controller responsible for orchestrating the overall game logic,
 * managing the relationship between all entities, and handling the global game state.
 */
export class PrimaryGameLogicController {
  /**
   * Initializes the game engine and spawns the initial entities.
   * @param {THREE.Scene} primaryRenderingScene - The scene where all objects live.
   * @param {THREE.Camera} primaryPerspectiveCamera - The perspective from which the player sees the world.
   */
  constructor(primaryRenderingScene, primaryPerspectiveCamera) {
    this.primaryRenderingScene = primaryRenderingScene;
    this.primaryPerspectiveCamera = primaryPerspectiveCamera;
    
    // Create the input tracker to monitor player key presses.
    this.playerInputStateTracker = new KeyboardInputStateTracker();
    
    // Initial calculation of the gameplay area's boundaries.
    this.recalculateGameplayAreaBoundaryLimits();
    
    // Instantiate the player's spacecraft.
    this.playerSpacecraft = new ControlledPlayerSpacecraft(this.primaryRenderingScene, this.gameplayAreaBoundaryLimits);
    
    // Arrays to keep track of multiple active entities.
    this.currentlyActiveProjectiles = [];
    this.currentlyActiveAsteroids = [];
    this.currentlyActiveBonuses = [];
    
    // Global gameplay tracking variables.
    this.currentTotalPlayerScore = 0;
    this.isGameCurrentlyInGameOverState = false;
    this.isCurrentlyInSplashScreenMode = true;
    this.gameOverTimeoutRemainingSeconds = 5.0;
    this.timestampOfLastDischargedProjectile = 0;
    
    // COMBAT & WEAPON LIMITS:
    this.maxOnScreenShotLimit = 3;
    this.lastSessionEndingScore = 0;
    
    // COLOR-CODED ASTEROID SYSTEM:
    this.asteroidColorPalette = [
        0xff00ff, // Pink
        0x00ffff, // Cyan
        0xffff00, // Yellow
        0x00ff00  // Green
    ];
    this.persistentLocalStorageHighScore = parseInt(localStorage.getItem('pink-ufo-asteroids-high-score')) || 0;
    
    // Update the splash screen statistics immediately upon initialization.
    this.synchronizeScoreStatisticsUI();

    /**
     * Respond to window resize events by recalculating the safe play area 
     * based on the new aspect ratio of the camera view.
     */
    window.addEventListener('resize', () => {
      this.recalculateGameplayAreaBoundaryLimits();
    });

    /**
     * Set up UI Button Event Listeners.
     */
    document.getElementById('begin-active-mission-button').addEventListener('click', () => {
      this.beginActiveMission();
    });

    document.getElementById('reset-high-score-button').addEventListener('click', () => {
        this.wipePersistentHighScoreRecords();
    });
    
    // No initial spawn here anymore; handled in beginActiveMission().
  }
  
  /**
   * Calculates the leftmost, rightmost, topmost, and bottommost visible play coordinates
   * based on the camera's FOV and its distance from the origin (Z-axis).
   */
  recalculateGameplayAreaBoundaryLimits() {
    const verticalFieldOfViewInRadians = THREE.MathUtils.degToRad(this.primaryPerspectiveCamera.fov);
    const visibleHeightAtOriginPlane = 2 * Math.tan(verticalFieldOfViewInRadians / 2) * this.primaryPerspectiveCamera.position.z;
    const visibleWidthAtOriginPlane = visibleHeightAtOriginPlane * this.primaryPerspectiveCamera.aspect;
    
    this.gameplayAreaBoundaryLimits = {
      left: -visibleWidthAtOriginPlane / 2,
      right: visibleWidthAtOriginPlane / 2,
      bottom: -visibleHeightAtOriginPlane / 2,
      top: visibleHeightAtOriginPlane / 2
    };
    
    // If the player ship exists, ensure it knows about the updated boundaries too.
    if (this.playerSpacecraft) {
        this.playerSpacecraft.gameplayAreaBoundaryLimits = this.gameplayAreaBoundaryLimits;
    }
  }

  /**
   * The core TICK function that updates all entities and processes physics/collisions.
   * Runs once per frame within the main animation loop.
   * @param {number} timeDeltaInSeconds - Time elapsed since the previous update frame.
   */
  processGameLogicFrameUpdate(timeDeltaInSeconds) {
    // 1. SPLASH SCREEN MODE: Skip state updates.
    if (this.isCurrentlyInSplashScreenMode) {
      return;
    }

    // 2. GAME OVER STATE: Handle timeout and manual restart.
    if (this.isGameCurrentlyInGameOverState) {
      this.gameOverTimeoutRemainingSeconds -= timeDeltaInSeconds;
      
      // Update UI with remaining seconds.
      const timeoutTextElement = document.getElementById('game-over-timeout-info');
      if (timeoutTextElement) {
        timeoutTextElement.innerText = `Returning to base in ${Math.ceil(this.gameOverTimeoutRemainingSeconds)}s...`;
      }

      // Auto-return to splash screen after timeout.
      if (this.gameOverTimeoutRemainingSeconds <= 0) {
        this.returnToSplashScreen();
        return;
      }

      // Manual restart still allowed.
      if (this.playerInputStateTracker.verifyIfSpecificKeyIsCurrentlyPressed('KeyR')) {
        this.initiateGameSessionRestart();
      }
      return;
    }
    
    // Update the player's spacecraft position and rotation.
    this.playerSpacecraft.performFrameUpdate(timeDeltaInSeconds, this.playerInputStateTracker);
    
    // HANDLE SHOOTING LOGIC:
    // Check if the Spacebar is pressed and if we have ammo.
    if (this.playerInputStateTracker.verifyIfSpecificKeyIsCurrentlyPressed('Space')) {
      const currentHighResolutionTimestamp = performance.now();
      const projectileCooldownDurationInMilliseconds = 250;
      
      const hasAvailableShotCapacity = this.currentlyActiveProjectiles.length < this.maxOnScreenShotLimit;

      if (hasAvailableShotCapacity && currentHighResolutionTimestamp - this.timestampOfLastDischargedProjectile > projectileCooldownDurationInMilliseconds) {
        this.timestampOfLastDischargedProjectile = currentHighResolutionTimestamp;
        this.dischargeSpacecraftProjectile();
      }
    }
    
    // UPDATE ACTIVE PROJECTILES:
    // Iterate backwards so we can safely remove dead projectiles without breaking index offsets.
    for (let i = this.currentlyActiveProjectiles.length - 1; i >= 0; i--) {
      const currentPulse = this.currentlyActiveProjectiles[i];
      currentPulse.performFrameUpdate(timeDeltaInSeconds);
      
      if (!currentPulse.isCurrentlyActiveAndValid) {
        this.currentlyActiveProjectiles.splice(i, 1);
      }
    }
    
    // UPDATE ACTIVE ASTEROIDS:
    for (let i = this.currentlyActiveAsteroids.length - 1; i >= 0; i--) {
        const currentHazard = this.currentlyActiveAsteroids[i];
        currentHazard.performFrameUpdate(timeDeltaInSeconds);
        
        if (!currentHazard.isCurrentlyActiveAndValid) {
            this.currentlyActiveAsteroids.splice(i, 1);
        }
    }
    
    // RUN PHYSICS/COLLISION ENGINE:
    this.executeCollisionDetectionPass(timeDeltaInSeconds);
    
    // UPDATE ACTIVE BONUSES:
    for (let i = this.currentlyActiveBonuses.length - 1; i >= 0; i--) {
        const bonus = this.currentlyActiveBonuses[i];
        bonus.performFrameUpdate(timeDeltaInSeconds);
        
        if (!bonus.isCurrentlyActiveAndValid) {
            this.currentlyActiveBonuses.splice(i, 1);
        }
    }
}
  
  /**
   * Spawns a new projectile oriented towards the spacecraft's current heading.
   */
  dischargeSpacecraftProjectile() {
    // Determine the forward direction vector relative to the ship mesh's rotation.
    const forwardDirectionUnitVector = new THREE.Vector3(0, 1, 0);
    forwardDirectionUnitVector.applyAxisAngle(new THREE.Vector3(0, 0, 1), this.playerSpacecraft.spacecraftRenderingMesh.rotation.z);
    
    // Calculate the launch point exactly at the tip of the ship.
    const projectileSpawnLocationCoordinate = this.playerSpacecraft.spacecraftRenderingMesh.position.clone();
    projectileSpawnLocationCoordinate.addScaledVector(forwardDirectionUnitVector, this.playerSpacecraft.physicalCollisionRadius);
    
    // Create and track the new projectile.
    const newlyCreatedProjectile = new ProjectileParticle(
        this.primaryRenderingScene, 
        projectileSpawnLocationCoordinate, 
        forwardDirectionUnitVector, 
        this.gameplayAreaBoundaryLimits
     );
     this.currentlyActiveProjectiles.push(newlyCreatedProjectile);
 
     // Update the HUD to reflect active pulses (optional, but good for feedback)
     this.updateAmmunitionHUDDisplay();
   }
 
   /**
    * Refreshes the Weapon Capacity display on the HUD.
    */
   updateAmmunitionHUDDisplay() {
     const ammoElem = document.getElementById('game-current-ammo-display');
     if (ammoElem) {
         ammoElem.innerText = `Max Shots: ${this.maxOnScreenShotLimit}`;
     }
   }
  
  /**
   * Checks for overlaps between ship/asteroids and projectiles/asteroids using basic circle-to-circle collision.
   * @param {number} timeDeltaInSeconds - Time since previous frame.
   */
  executeCollisionDetectionPass(timeDeltaInSeconds) {
    // 1. PROJECTILES vs ASTEROIDS:
    for (let projectileIdx = this.currentlyActiveProjectiles.length - 1; projectileIdx >= 0; projectileIdx--) {
      const activeProjectile = this.currentlyActiveProjectiles[projectileIdx];
      
      for (let asteroidIdx = this.currentlyActiveAsteroids.length - 1; asteroidIdx >= 0; asteroidIdx--) {
        const candidateAsteroid = this.currentlyActiveAsteroids[asteroidIdx];
        
        // Calculate distance between the two spherical centers.
        const euclideanDistanceBetweenEntities = activeProjectile.projectileRenderingMesh.position.distanceTo(candidateAsteroid.asteroidRenderingMesh.position);
        
        // Collision occurs if the distance is less than the sum of their physical radii.
        if (euclideanDistanceBetweenEntities < activeProjectile.physicalCollisionRadius + candidateAsteroid.physicalCollisionRadius) {
          // Both the projectile and the asteroid sub-units are decomposed upon impact.
          activeProjectile.initiateSelfDestructionSequence();
          this.executeAsteroidDecompositionAndSplitting(candidateAsteroid);
          break; // Projectile is spent, move to next pulse.
        }
      }
    }
    
    // 2. PLAYER vs ASTEROIDS:
    for (const imminentHazard of this.currentlyActiveAsteroids) {
      if (!imminentHazard.isCurrentlyActiveAndValid) continue;
      
      const distanceToPlayerSpacecraftCenter = this.playerSpacecraft.spacecraftRenderingMesh.position.distanceTo(imminentHazard.asteroidRenderingMesh.position);
      
      // We reduce the asteroid's effective radius slightly for a 'fairer' collision feeling (the jagged bits).
      const collisionBufferScaleFactor = 0.8;
      if (distanceToPlayerSpacecraftCenter < this.playerSpacecraft.physicalCollisionRadius + (imminentHazard.physicalCollisionRadius * collisionBufferScaleFactor)) {
        // Player dies on impact.
        this.transitionToGameOverState();
      }
    }
    
    // 3. PLAYER vs BONUSES:
    for (let i = this.currentlyActiveBonuses.length - 1; i >= 0; i--) {
        const bonus = this.currentlyActiveBonuses[i];
        const distanceToPlayer = this.playerSpacecraft.spacecraftRenderingMesh.position.distanceTo(bonus.gemMesh.position);
        
        if (distanceToPlayer < this.playerSpacecraft.physicalCollisionRadius + bonus.physicalCollisionRadius) {
            // Apply Varied Rewards based on Type (Increasing the Weapon Limit)
            if (bonus.rewardType === 'AMMO') {
                this.maxOnScreenShotLimit++;
            } else if (bonus.rewardType === 'MEGA_AMMO') {
                this.maxOnScreenShotLimit += 2;
            } else if (bonus.rewardType === 'POINTS') {
                this.currentTotalPlayerScore += 1000;
                document.getElementById('game-current-score-display').innerText = `Score: ${this.currentTotalPlayerScore}`;
            }
            
            this.updateAmmunitionHUDDisplay();
            bonus.initiateSelfDestructionSequence();
        }
    }
    
    // 4. GENERATION CHECK:
    // If all hazards are cleared, we automatically spawn another wave.
    if (this.currentlyActiveAsteroids.length === 0) {
        const nextLevelAsteroidQuantity = 7;
        for(let i = 0; i < nextLevelAsteroidQuantity; i++) {
            const randomColor = this.asteroidColorPalette[Math.floor(Math.random() * this.asteroidColorPalette.length)];
            this.currentlyActiveAsteroids.push(
                new CelestialHazardousAsteroid(this.primaryRenderingScene, this.gameplayAreaBoundaryLimits, null, 3, randomColor)
            );
        }
    }
  }
  
  /**
   * Splits a larger asteroid into two smaller ones and awards points.
   * @param {CelestialHazardousAsteroid} asteroidToDecompose - The parent asteroid being split.
   */
  executeAsteroidDecompositionAndSplitting(asteroidToDecompose) {
    const originalDecompositionSourceCoordinate = asteroidToDecompose.asteroidRenderingMesh.position.clone();
    const childAsteroidSizeCategoryValue = asteroidToDecompose.relativeHazardSizeCategory - 1;
    
    asteroidToDecompose.initiateDecompositionSequence();
    
    // Reward points inversely proportional to asteroid size.
    const scoreRewardIncrement = 100 * (4 - asteroidToDecompose.relativeHazardSizeCategory);
    this.currentTotalPlayerScore += scoreRewardIncrement;
    
    // Update the visual score display on the UI layer.
    document.getElementById('game-current-score-display').innerText = `Score: ${this.currentTotalPlayerScore}`;
    
    const parentColor = asteroidToDecompose.asteroidColor;

    // If the asteroid wasn't already the smallest possible size, spawn two children.
    if (childAsteroidSizeCategoryValue > 0) {
      this.currentlyActiveAsteroids.push(new CelestialHazardousAsteroid(this.primaryRenderingScene, this.gameplayAreaBoundaryLimits, originalDecompositionSourceCoordinate.clone(), childAsteroidSizeCategoryValue, parentColor));
      this.currentlyActiveAsteroids.push(new CelestialHazardousAsteroid(this.primaryRenderingScene, this.gameplayAreaBoundaryLimits, originalDecompositionSourceCoordinate.clone(), childAsteroidSizeCategoryValue, parentColor));
    }

    // CHECK FOR COLOR WIPE:
    // If no more asteroids of this color remain anywhere on the field, spawn a high-value bonus.
    const remainingOfSameColor = this.currentlyActiveAsteroids.filter(a => a.asteroidColor === parentColor && a.isCurrentlyActiveAndValid).length;
    if (remainingOfSameColor === 0) {
        let rewardType = 'AMMO';
        if (parentColor === 0xff00ff) rewardType = 'MEGA_AMMO'; // Pink gives mega ammo
        if (parentColor === 0xffff00) rewardType = 'POINTS';    // Yellow gives points
        
        this.currentlyActiveBonuses.push(
            new BonusPickupElement(this.primaryRenderingScene, originalDecompositionSourceCoordinate.clone(), parentColor, rewardType)
        );
    } else {
        // RANDOM DROP CHANCE: 15% on any asteroid death if not a full color wipe.
        if (Math.random() < 0.15) {
            this.currentlyActiveBonuses.push(
                new BonusPickupElement(this.primaryRenderingScene, originalDecompositionSourceCoordinate.clone(), 0xffffff, 'AMMO')
            );
        }
    }
  }
  
  /**
   * Triggers the game-over screen and pauses gameplay.
   */
  transitionToGameOverState() {
    this.isGameCurrentlyInGameOverState = true;
    this.gameOverTimeoutRemainingSeconds = 5.0; 
    
    // Update session statistics.
    this.lastSessionEndingScore = this.currentTotalPlayerScore;
    if (this.currentTotalPlayerScore > this.persistentLocalStorageHighScore) {
        this.persistentLocalStorageHighScore = this.currentTotalPlayerScore;
        localStorage.setItem('pink-ufo-asteroids-high-score', this.persistentLocalStorageHighScore);
    }
    
    // Change ship color to red to show destruction.
    this.playerSpacecraft.mainHullMaterial.color.setHex(0xff0000);
    this.playerSpacecraft.mainHullMaterial.emissive.setHex(0x550000);
    
    // Make the Game Over notification panel visible.
    document.getElementById('game-over-notification-panel').style.display = 'block';
  }
  
  /**
   * Resets all game statistics and entities to their starting values.
   */
  initiateGameSessionRestart() {
    this.isGameCurrentlyInGameOverState = false;
    this.currentTotalPlayerScore = 0;
    this.maxOnScreenShotLimit = 3;
    
    // Reset UI displays.
    document.getElementById('game-current-score-display').innerText = `Score: 0`;
    this.updateAmmunitionHUDDisplay();
    document.getElementById('game-over-notification-panel').style.display = 'none';
    
    // Reset Ship physics and visual appearance.
    this.playerSpacecraft.mainHullMaterial.color.setHex(0xff00ff); // Pink
    this.playerSpacecraft.mainHullMaterial.emissive.setHex(0xaa00aa); // Magenta
    this.playerSpacecraft.spacecraftHeadingContainer.position.set(0, 0, 0);
    this.playerSpacecraft.currentLinearVelocityVector.set(0, 0, 0);
    this.playerSpacecraft.spacecraftHeadingContainer.rotation.z = 0;
    
    // Purge all projectiles currently in flight.
    for (const pulse of this.currentlyActiveProjectiles) {
        pulse.initiateSelfDestructionSequence();
    }
    this.currentlyActiveProjectiles = [];
    
    // Purge all existing asteroids from the scene.
    for (const hazard of this.currentlyActiveAsteroids) {
        hazard.initiateDecompositionSequence();
    }
    this.currentlyActiveAsteroids = [];
    
    // Purge all existing bonuses.
    for (const bonus of this.currentlyActiveBonuses) {
        bonus.initiateSelfDestructionSequence();
    }
    this.currentlyActiveBonuses = [];
    
    // Spawn fresh initial hazards.
    this.spawnInitialHazardWave();
  }

  /**
   * Spawns the initial wave of asteroids.
   */
  spawnInitialHazardWave() {
    const initialAsteroidQuantity = 5;
    for(let i = 0; i < initialAsteroidQuantity; i++) {
        const randomColor = this.asteroidColorPalette[Math.floor(Math.random() * this.asteroidColorPalette.length)];
        this.currentlyActiveAsteroids.push(
            new CelestialHazardousAsteroid(this.primaryRenderingScene, this.gameplayAreaBoundaryLimits, null, 3, randomColor)
        );
    }
  }

  /**
   * Transitions the game from the loading splash screen into the active mission.
   */
  beginActiveMission() {
    this.isCurrentlyInSplashScreenMode = false;
    
    // UI Transitions.
    document.getElementById('game-loading-splash-screen').style.opacity = '0';
    setTimeout(() => {
      document.getElementById('game-loading-splash-screen').style.display = 'none';
      document.getElementById('game-heads-up-display-overlay').style.display = 'flex';
    }, 1000); // Wait for fade transition
    
    // Reset game state just in case.
    this.initiateGameSessionRestart();
  }

  /**
   * Returns the user to the initial splash screen mode (e.g. after a game-over timeout).
   */
  returnToSplashScreen() {
    this.isCurrentlyInSplashScreenMode = true;
    this.isGameCurrentlyInGameOverState = false;
    
    // UI Transitions.
    document.getElementById('game-heads-up-display-overlay').style.display = 'none';
    const splashScreen = document.getElementById('game-loading-splash-screen');
    splashScreen.style.display = 'flex';
    // Use small timeout to ensure display:flex is applied before opacity transition.
    setTimeout(() => {
        splashScreen.style.opacity = '1';
    }, 10);

    // Refresh the statistics shown on the splash screen.
    this.synchronizeScoreStatisticsUI();
  }

  /**
   * Refreshes the score labels on the splash screen UI elements.
   */
  synchronizeScoreStatisticsUI() {
    const lastScoreElem = document.getElementById('last-session-score-value');
    const highScoreElem = document.getElementById('persistent-high-score-value');
    
    if (lastScoreElem) lastScoreElem.innerText = this.lastSessionEndingScore;
    if (highScoreElem) highScoreElem.innerText = this.persistentLocalStorageHighScore;
  }

  /**
   * Clears all persistent score data from local storage and resets the UI.
   */
  wipePersistentHighScoreRecords() {
    if (confirm("Are you sure you want to clear your Best Score?")) {
        this.persistentLocalStorageHighScore = 0;
        localStorage.removeItem('pink-ufo-asteroids-high-score');
        this.synchronizeScoreStatisticsUI();
    }
  }
}
