import * as THREE from 'three';

/**
 * This class represents the player-controlled spacecraft within our 3D environment.
 * It has been redesigned as a stylized Pink UFO with internal animations.
 */
export class ControlledPlayerSpacecraft {
  /**
   * Constructs the player spacecraft with physical properties and visual geometry.
   * @param {THREE.Scene} parentGameRenderingScene - The scene where the ship will be rendered.
   * @param {Object} gameplayAreaBoundaryLimits - The rectangular limits of the visible game world.
   */
  constructor(parentGameRenderingScene, gameplayAreaBoundaryLimits) {
    this.parentGameRenderingScene = parentGameRenderingScene;
    this.gameplayAreaBoundaryLimits = gameplayAreaBoundaryLimits;
    
    /**
     * Important: We use a heading container group to rotate the overall direction 
     * without affecting the internal "lean" or "spinning" animations of the UFO parts.
     */
    this.spacecraftHeadingContainer = new THREE.Group();
    this.parentGameRenderingScene.add(this.spacecraftHeadingContainer);

    /**
     * This group holds parts of the UFO that spin dynamically.
     */
    this.spacecraftSpinningVisualsGroup = new THREE.Group();
    // By default, the UFO 'top' is +Y. We want to 'lean' it so we see it from above.
    this.spacecraftSpinningVisualsGroup.rotation.x = Math.PI / 4; 
    this.spacecraftHeadingContainer.add(this.spacecraftSpinningVisualsGroup);
    
    /**
     * This group holds parts of the UFO that stay fixed relative to the heading 
     * but still share the "lean" (tilt) of the ship.
     */
    this.spacecraftStaticDecorationsGroup = new THREE.Group();
    this.spacecraftStaticDecorationsGroup.rotation.x = Math.PI / 4;
    this.spacecraftHeadingContainer.add(this.spacecraftStaticDecorationsGroup);

    // 1. THE MAIN SAUCER BODY: 
    const saucerBodyGeometry = new THREE.SphereGeometry(2, 32, 16);
    saucerBodyGeometry.scale(1, 0.3, 1); // Flatten into a disc
    
    const saucerMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xff00ff,        // Hot Pink 
      emissive: 0xaa00aa,     // Magenta glow
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.8
    });
    this.mainHullMaterial = saucerMaterial;
    const saucerMesh = new THREE.Mesh(saucerBodyGeometry, saucerMaterial);
    this.spacecraftSpinningVisualsGroup.add(saucerMesh);
    
    // 2. THE COCKPIT DOME:
    const cockpitDomeGeometry = new THREE.SphereGeometry(0.8, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const cockpitMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffff,        // Cyan glass look
      transparent: true,
      opacity: 0.6,
      emissive: 0x008888,
      emissiveIntensity: 0.2
    });
    const cockpitMesh = new THREE.Mesh(cockpitDomeGeometry, cockpitMaterial);
    cockpitMesh.position.y = 0.2; // Sit it on top of the saucer
    this.spacecraftSpinningVisualsGroup.add(cockpitMesh);

    // 3. UFO LIGHTS:
    this.ufoRimLights = [];
    const lightQuantity = 8;
    const lightRadius = 1.8;
    for (let i = 0; i < lightQuantity; i++) {
        const lightGeom = new THREE.SphereGeometry(0.15, 8, 8);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const lightMesh = new THREE.Mesh(lightGeom, lightMat);
        
        const angle = (i / lightQuantity) * Math.PI * 2;
        lightMesh.position.set(Math.cos(angle) * lightRadius, -0.1, Math.sin(angle) * lightRadius);
        
        this.spacecraftSpinningVisualsGroup.add(lightMesh);
        this.ufoRimLights.push(lightMesh);
    }
    
    // 4. THE DIRECTIONAL INDICATOR:
    // This triangle points exactly where the player is aiming.
    // We've moved it to sit exactly over the center of the cockpit.
    const indicatorVisualGeometry = new THREE.ConeGeometry(0.3, 1.0, 3);
    const indicatorVisualMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // Bright Yellow
    const primaryDirectionalIndicatorTriangle = new THREE.Mesh(indicatorVisualGeometry, indicatorVisualMaterial);
    
    // Position it on top of the cockpit dome (y=1.0) and tilt it forward slightly.
    primaryDirectionalIndicatorTriangle.position.set(0, 1.0, 0.2); 
    // Rotate so it points 'forward' (up the Y axis relative to the tilted ship).
    primaryDirectionalIndicatorTriangle.rotation.x = -Math.PI / 4; 
    
    // We add this to the STATIC decorations group so it doesn't spin with the saucer!
    this.spacecraftStaticDecorationsGroup.add(primaryDirectionalIndicatorTriangle);
    
    // PHYSICS PROPERTIES:
    this.currentLinearVelocityVector = new THREE.Vector3(0, 0, 0);
    this.angularRotationSpeedPerSecond = 4.5; 
    this.proportionalThrustForcePower = 38.0;
    this.momentumDecayCoefficient = 0.98; 
    this.physicalCollisionRadius = 2.0;

    // ANIMATION STATE:
    this.totalRunningTime = 0;
  }
  
  /**
   * Updates the spacecraft's state for a single animation frame.
   * @param {number} timeDeltaInSeconds - The time elapsed since the last frame.
   * @param {KeyboardInputStateTracker} playerInputTracker - The object tracking keyboard keys.
   */
  performFrameUpdate(timeDeltaInSeconds, playerInputTracker) {
    this.totalRunningTime += timeDeltaInSeconds;

    // HANDLE ROTATION:
    if (playerInputTracker.verifyIfSpecificKeyIsCurrentlyPressed('ArrowLeft') || 
        playerInputTracker.verifyIfSpecificKeyIsCurrentlyPressed('KeyA')) {
      this.spacecraftHeadingContainer.rotation.z += this.angularRotationSpeedPerSecond * timeDeltaInSeconds;
    }
    if (playerInputTracker.verifyIfSpecificKeyIsCurrentlyPressed('ArrowRight') || 
        playerInputTracker.verifyIfSpecificKeyIsCurrentlyPressed('KeyD')) {
      this.spacecraftHeadingContainer.rotation.z -= this.angularRotationSpeedPerSecond * timeDeltaInSeconds;
    }
    
    // HANDLE THRUST:
    if (playerInputTracker.verifyIfSpecificKeyIsCurrentlyPressed('ArrowUp') || 
        playerInputTracker.verifyIfSpecificKeyIsCurrentlyPressed('KeyW')) {
      
      const forwardDirectionVector = new THREE.Vector3(0, 1, 0);
      forwardDirectionVector.applyAxisAngle(new THREE.Vector3(0, 0, 1), this.spacecraftHeadingContainer.rotation.z);
      this.currentLinearVelocityVector.add(forwardDirectionVector.multiplyScalar(this.proportionalThrustForcePower * timeDeltaInSeconds));
    }
    
    // INTERNAL UFO ANIMATIONS:
    // 1. Spinning the entire saucer visuals group
    this.spacecraftSpinningVisualsGroup.rotation.y += timeDeltaInSeconds * 2.0;
    
    // 2. Bobbing effect (Sine wave oscillation for a "hovering" feel)
    const bobbingAmplitude = 0.5;
    const bobbingFrequency = 3.0;
    // Both groups bob together for consistency.
    const bobValue = Math.sin(this.totalRunningTime * bobbingFrequency) * bobbingAmplitude;
    this.spacecraftSpinningVisualsGroup.position.z = bobValue;
    this.spacecraftStaticDecorationsGroup.position.z = bobValue;

    // 3. Pulsing lights
    this.ufoRimLights.forEach((light, index) => {
        const pulse = Math.sin(this.totalRunningTime * 10 + index) * 0.5 + 0.5;
        light.material.color.setHSL(0.8, 1, 0.5 + pulse * 0.5); 
        light.scale.setScalar(0.8 + pulse * 0.4);
    });

    // PHYSICS UPDATES:
    this.currentLinearVelocityVector.multiplyScalar(Math.pow(this.momentumDecayCoefficient, timeDeltaInSeconds * 60));
    this.spacecraftHeadingContainer.position.addScaledVector(this.currentLinearVelocityVector, timeDeltaInSeconds);
    
    // SCREEN WRAPPING LOGIC:
    const leftLimit = this.gameplayAreaBoundaryLimits.left - this.physicalCollisionRadius;
    const rightLimit = this.gameplayAreaBoundaryLimits.right + this.physicalCollisionRadius;
    const topLimit = this.gameplayAreaBoundaryLimits.top + this.physicalCollisionRadius;
    const bottomLimit = this.gameplayAreaBoundaryLimits.bottom - this.physicalCollisionRadius;

    const pos = this.spacecraftHeadingContainer.position;
    if (pos.x > rightLimit) pos.x = leftLimit;
    else if (pos.x < leftLimit) pos.x = rightLimit;
    if (pos.y > topLimit) pos.y = bottomLimit;
    else if (pos.y < bottomLimit) pos.y = topLimit;
  }

  /**
   * Getter for the logical mesh used by the Game class for collisions and positioning.
   */
  get spacecraftRenderingMesh() {
    return this.spacecraftHeadingContainer;
  }

  // Renamed for clarity in internal logic
  get spacecraftRenderingGroup() {
      return this.spacecraftSpinningVisualsGroup;
  }
}
