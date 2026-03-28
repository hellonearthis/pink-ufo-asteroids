import * as THREE from 'three';

/**
 * This class represents a single projectile discharged from the spacecraft.
 * It handles the bullet's creation, movement logic, and self-destruction 
 * after its lifespan expires.
 */
export class ProjectileParticle {
  /**
   * Constructs a new projectile starting at a specific 3D coordinate.
   * @param {THREE.Scene} parentGameRenderingScene - The scene where the bullet exists.
   * @param {THREE.Vector3} initialStartingPosition - The exact coordinate where the bullet is born.
   * @param {THREE.Vector3} ejectionDirectionVector - The normalized direction the bullet travels.
   * @param {Object} gameplayAreaBoundaryLimits - The rectangular boundaries for screen wrapping.
   * @param {number} travelSpeed - The velocity magnitude (units per second).
   * @param {number} maxRange - The maximum distance (units) before self-destruction.
   */
  constructor(parentGameRenderingScene, initialStartingPosition, ejectionDirectionVector, gameplayAreaBoundaryLimits, travelSpeed = 40.0, maxRange = 50.0, initialInertiaVector = new THREE.Vector3(0, 0, 0)) {
    this.parentGameRenderingScene = parentGameRenderingScene;
    this.gameplayAreaBoundaryLimits = gameplayAreaBoundaryLimits;
    
    /**
     * The visual representation of the bullet is a light pink "bean-shaped" chip.
     * We use Capsules with low segments and flatShading to create a sharp, physical look.
     */
    const projectileVisualGeometry = new THREE.CapsuleGeometry(0.3, 0.6, 2, 6);
    
    // Randomize the pink hue for visual variety so the barrage looks more dynamic.
    const pinkVariants = [0xffb6c1, 0xffc0cb, 0xff69b4, 0xff1493, 0xdb7093];
    const pickedPink = pinkVariants[Math.floor(Math.random() * pinkVariants.length)];
    
    const projectileVisualMaterial = new THREE.MeshStandardMaterial({ 
        color: pickedPink, 
        emissive: pickedPink,
        emissiveIntensity: 0.6,
        roughness: 0.1,    // Low roughness for sharp specular highlights
        metalness: 0.7,    // High metalness for a premium surface feel
        flatShading: true  // Faceted look for maximum definition
    });
    
    this.projectileRenderingMesh = new THREE.Mesh(projectileVisualGeometry, projectileVisualMaterial);
    
    // 1b. DYNAMIC PINK EDGES (Cycling highlights)
    const bulletEdgesGeometry = new THREE.EdgesGeometry(projectileVisualGeometry);
    
    // We store the base and target (brighter) colors for the cycling animation.
    this.bulletBaseColor = new THREE.Color(pickedPink);
    this.bulletHighlightColor = this.bulletBaseColor.clone().offsetHSL(0, 0, 0.2); // 20% brighter
    
    this.bulletEdgesMaterial = new THREE.LineBasicMaterial({ 
        color: this.bulletBaseColor, 
        transparent: true, 
        opacity: 0.8 
    });
    
    const bulletEdgesMesh = new THREE.LineSegments(bulletEdgesGeometry, this.bulletEdgesMaterial);
    this.projectileRenderingMesh.add(bulletEdgesMesh); 
    
    // Randomize initial rotation so each bullet starts at a different orientation.
    this.projectileRenderingMesh.rotation.set(Math.random() * 5, Math.random() * 5, Math.random() * 5);
    
    // Copy the starting position from the player's firing point (the ship's tip).
    this.projectileRenderingMesh.position.copy(initialStartingPosition);
    
    // Add the bullet to the global 3D scene.
    this.parentGameRenderingScene.add(this.projectileRenderingMesh);
    
    /**
     * TUMBLING LOGIC: 
     * We assign a random set of angular velocities for each axis.
     * This makes the bullet "spin" naturally through space as it travels.
     */
    this.internalTumblingRotationVelocity = new THREE.Vector3(
        Math.random() * 10 - 5,
        Math.random() * 10 - 5,
        Math.random() * 10 - 5
    );

    /**
     * VELOCITY CALCULATION:
     * We take the fire direction and scale it by the current 'travelSpeed' upgrade level.
     * Then, we add the 'initialInertiaVector' (the ship's velocity at the moment of firing)
     * to implement realistic Newtonian momentum.
     */
    this.currentLinearVelocityVector = ejectionDirectionVector.clone().normalize().multiplyScalar(travelSpeed);
    this.currentLinearVelocityVector.add(initialInertiaVector);
    
    /**
     * RANGE TRACKING:
     * Instead of a timed lifespan, we track the total Euclidean distance traveled.
     */
    this.maxTravelDistance = maxRange; 
    this.currentTravelDistance = 0;
    
    // State flags and collision properties.
    this.isCurrentlyActiveAndValid = true;
    this.physicalCollisionRadius = 0.5;
  }
  
  /**
   * Updates the bullet's physics and state every frame.
   * @param {number} timeDeltaInSeconds - Time elapsed since the last tick.
   */
  performFrameUpdate(timeDeltaInSeconds) {
    if (!this.isCurrentlyActiveAndValid) return;
    
    // 1. UPDATE ROTATION (TUMBLING):
    // We increment rotation on all axes based on the pre-assigned tumbling velocities.
    this.projectileRenderingMesh.rotation.x += this.internalTumblingRotationVelocity.x * timeDeltaInSeconds;
    this.projectileRenderingMesh.rotation.y += this.internalTumblingRotationVelocity.y * timeDeltaInSeconds;
    this.projectileRenderingMesh.rotation.z += this.internalTumblingRotationVelocity.z * timeDeltaInSeconds;

    // 1.5. UPDATE EDGE COLOR CYCLING:
    // We oscillate between the base plane color and a 20% brighter highlight.
    const colorPulse = Math.sin(this.currentTravelDistance * 0.5 + Math.random()) * 0.5 + 0.5;
    this.bulletEdgesMaterial.color.copy(this.bulletBaseColor).lerp(this.bulletHighlightColor, colorPulse);

    // 2. UPDATE POSITION:
    // We calculate the movement vector for this specific frame.
    const displacementThisFrame = this.currentLinearVelocityVector.clone().multiplyScalar(timeDeltaInSeconds);
    this.projectileRenderingMesh.position.add(displacementThisFrame);
    
    // 3. TRACK DISTANCE:
    // We add the length of the movement vector to our total travel distance counter.
    this.currentTravelDistance += displacementThisFrame.length();
    
    // 4. RANGE CHECK: 
    // If the bullet has exceeded its allowed range, we initiate destruction.
    if (this.currentTravelDistance >= this.maxTravelDistance) {
      this.initiateSelfDestructionSequence();
      return;
    }
    
    // 5. SCREEN WRAPPING:
    // If the bullet crosses a boundary, it wraps instantly to the opposite side 
    // to maintain a continuous play field.
    const pos = this.projectileRenderingMesh.position;
    const limits = this.gameplayAreaBoundaryLimits;

    if (pos.x > limits.right) pos.x = limits.left;
    else if (pos.x < limits.left) pos.x = limits.right;
    
    if (pos.y > limits.top) pos.y = limits.bottom;
    else if (pos.y < limits.bottom) pos.y = limits.top;
  }
  
  /**
   * Removes the bullet from the scene and marks it as inactive for the game controller.
   */
  initiateSelfDestructionSequence() {
    this.isCurrentlyActiveAndValid = false;
    this.parentGameRenderingScene.remove(this.projectileRenderingMesh);
  }
}
