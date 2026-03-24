import * as THREE from 'three';
import { ControlledPlayerSpacecraft } from './Player.js';
import { ProjectileParticle } from './Bullet.js';
import { CelestialHazardousAsteroid } from './Asteroid.js';
import { KeyboardInputStateTracker } from './InputManager.js';

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
    
    // Global gameplay tracking variables.
    this.currentTotalPlayerScore = 0;
    this.isGameCurrentlyInGameOverState = false;
    this.timestampOfLastDischargedProjectile = 0;
    
    /**
     * Respond to window resize events by recalculating the safe play area 
     * based on the new aspect ratio of the camera view.
     */
    window.addEventListener('resize', () => {
      this.recalculateGameplayAreaBoundaryLimits();
    });
    
    // SPAWN INITIAL CONTENT:
    // Create 5 large asteroids at the game start.
    const initialAsteroidSpawnQuantity = 5;
    for(let i = 0; i < initialAsteroidSpawnQuantity; i++) {
        this.currentlyActiveAsteroids.push(
            new CelestialHazardousAsteroid(this.primaryRenderingScene, this.gameplayAreaBoundaryLimits)
        );
    }
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
    // If we've reached Game Over, we only listen for a restart command.
    if (this.isGameCurrentlyInGameOverState) {
      if (this.playerInputStateTracker.verifyIfSpecificKeyIsCurrentlyPressed('KeyR')) {
        this.initiateGameSessionRestart();
      }
      return;
    }
    
    // Update the player's spacecraft position and rotation.
    this.playerSpacecraft.performFrameUpdate(timeDeltaInSeconds, this.playerInputStateTracker);
    
    // HANDLE SHOOTING LOGIC:
    // Check if the Spacebar is pressed and if enough time has passed since the last shot.
    if (this.playerInputStateTracker.verifyIfSpecificKeyIsCurrentlyPressed('Space')) {
      const currentHighResolutionTimestamp = performance.now();
      const projectileCooldownDurationInMilliseconds = 250;
      
      if (currentHighResolutionTimestamp - this.timestampOfLastDischargedProjectile > projectileCooldownDurationInMilliseconds) {
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
    this.executeCollisionDetectionPass();
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
  }
  
  /**
   * Checks for overlaps between ship/asteroids and projectiles/asteroids using basic circle-to-circle collision.
   */
  executeCollisionDetectionPass() {
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
      const distanceToPlayerSpacecraftCenter = this.playerSpacecraft.spacecraftRenderingMesh.position.distanceTo(imminentHazard.asteroidRenderingMesh.position);
      
      // We reduce the asteroid's effective radius slightly for a 'fairer' collision feeling (the jagged bits).
      const collisionBufferScaleFactor = 0.8;
      if (distanceToPlayerSpacecraftCenter < this.playerSpacecraft.physicalCollisionRadius + (imminentHazard.physicalCollisionRadius * collisionBufferScaleFactor)) {
        // Player dies on impact.
        this.transitionToGameOverState();
      }
    }
    
    // 3. GENERATION CHECK:
    // If all hazards are cleared, we automatically spawn another wave.
    if (this.currentlyActiveAsteroids.length === 0) {
        const nextLevelAsteroidQuantity = 7;
        for(let i = 0; i < nextLevelAsteroidQuantity; i++) {
            this.currentlyActiveAsteroids.push(
                new CelestialHazardousAsteroid(this.primaryRenderingScene, this.gameplayAreaBoundaryLimits)
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
    
    // If the asteroid wasn't already the smallest possible size, spawn two children.
    if (childAsteroidSizeCategoryValue > 0) {
      this.currentlyActiveAsteroids.push(new CelestialHazardousAsteroid(this.primaryRenderingScene, this.gameplayAreaBoundaryLimits, originalDecompositionSourceCoordinate.clone(), childAsteroidSizeCategoryValue));
      this.currentlyActiveAsteroids.push(new CelestialHazardousAsteroid(this.primaryRenderingScene, this.gameplayAreaBoundaryLimits, originalDecompositionSourceCoordinate.clone(), childAsteroidSizeCategoryValue));
    }
  }
  
  /**
   * Triggers the game-over screen and pauses gameplay.
   */
  transitionToGameOverState() {
    if (this.isGameCurrentlyInGameOverState) return;
    
    this.isGameCurrentlyInGameOverState = true;
    
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
    
    // Reset UI displays.
    document.getElementById('game-current-score-display').innerText = `Score: 0`;
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
    
    // Spawn fresh initial hazards.
    const initialAsteroidRestartQuantity = 5;
    for(let i = 0; i < initialAsteroidRestartQuantity; i++) {
        this.currentlyActiveAsteroids.push(new CelestialHazardousAsteroid(this.primaryRenderingScene, this.gameplayAreaBoundaryLimits));
    }
  }
}
