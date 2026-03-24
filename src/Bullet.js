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
  constructor(parentGameRenderingScene, initialStartingPosition, ejectionDirectionVector, gameplayAreaBoundaryLimits, travelSpeed = 40.0, maxRange = 50.0) {
    this.parentGameRenderingScene = parentGameRenderingScene;
    this.gameplayAreaBoundaryLimits = gameplayAreaBoundaryLimits;
    
    /**
     * The visual representation of the bullet is a light pink "bean-shaped" chip.
     * We use a low number of segments and flatShading to give it more definition.
     */
    const projectileVisualGeometry = new THREE.CapsuleGeometry(0.3, 0.6, 2, 6);
    const projectileVisualMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffb6c1, 
        emissive: 0xff69b4,
        emissiveIntensity: 0.4,
        roughness: 0.1,    // Low roughness for sharp specular highlights
        metalness: 0.7,    // High metalness for a premium surface feel
        flatShading: true  // Faceted look for maximum definition
    });
    
    this.projectileRenderingMesh = new THREE.Mesh(projectileVisualGeometry, projectileVisualMaterial);
    
    // Randomize initial rotation for variety.
    this.projectileRenderingMesh.rotation.set(Math.random() * 5, Math.random() * 5, Math.random() * 5);
    
    // Copy the starting position from the player's tip.
    this.projectileRenderingMesh.position.copy(initialStartingPosition);
    
    // Add the bullet to the 3D scene.
    this.parentGameRenderingScene.add(this.projectileRenderingMesh);
    
    /**
     * TUMBLING LOGIC: 
     * Random rotation speed across all three axes to create a natural 3D tumble.
     */
    this.internalTumblingRotationVelocity = new THREE.Vector3(
        Math.random() * 10 - 5,
        Math.random() * 10 - 5,
        Math.random() * 10 - 5
    );

    /**
     * The flight velocity is based on the ejection direction, scaled by the dynamic speed parameter.
     */
    this.currentLinearVelocityVector = ejectionDirectionVector.clone().normalize().multiplyScalar(travelSpeed);
    
    /**
     * Range Control: The total distance (in units) this bullet can travel 
     * before automatically self-destructing.
     */
    this.maxTravelDistance = maxRange; 
    this.currentTravelDistance = 0;
    
    /**
     * A flag to indicate if this bullet is currently active in the game world.
     */
    this.isCurrentlyActiveAndValid = true;
    
    /**
     * The collision radius for detecting hits on asteroids.
     */
    this.physicalCollisionRadius = 0.5;
  }
  
  /**
   * Updates the bullet's position and reduces its lifespan.
   * @param {number} timeDeltaInSeconds - The duration of the current physics frame.
   */
  performFrameUpdate(timeDeltaInSeconds) {
    if (!this.isCurrentlyActiveAndValid) return;
    
    // Apply Tumbling Rotation
    this.projectileRenderingMesh.rotation.x += this.internalTumblingRotationVelocity.x * timeDeltaInSeconds;
    this.projectileRenderingMesh.rotation.y += this.internalTumblingRotationVelocity.y * timeDeltaInSeconds;
    this.projectileRenderingMesh.rotation.z += this.internalTumblingRotationVelocity.z * timeDeltaInSeconds;

    // Distance Tracking: Calculate the displacement for this frame.
    const displacementThisFrame = this.currentLinearVelocityVector.clone().multiplyScalar(timeDeltaInSeconds);
    this.projectileRenderingMesh.position.add(displacementThisFrame);
    
    // Accumulate the total distance traveled.
    this.currentTravelDistance += displacementThisFrame.length();
    
    // Range-Based Self-Destruction: If the bullet exceeds its maximum travel distance, it 'dies'.
    if (this.currentTravelDistance >= this.maxTravelDistance) {
      this.initiateSelfDestructionSequence();
      return;
    }
    
    // SCREEN WRAPPING: If the bullet goes off screen, wrap it back to the other side.
    if (this.projectileRenderingMesh.position.x > this.gameplayAreaBoundaryLimits.right) {
        this.projectileRenderingMesh.position.x = this.gameplayAreaBoundaryLimits.left;
    } else if (this.projectileRenderingMesh.position.x < this.gameplayAreaBoundaryLimits.left) {
        this.projectileRenderingMesh.position.x = this.gameplayAreaBoundaryLimits.right;
    }

    if (this.projectileRenderingMesh.position.y > this.gameplayAreaBoundaryLimits.top) {
        this.projectileRenderingMesh.position.y = this.gameplayAreaBoundaryLimits.bottom;
    } else if (this.projectileRenderingMesh.position.y < this.gameplayAreaBoundaryLimits.bottom) {
        this.projectileRenderingMesh.position.y = this.gameplayAreaBoundaryLimits.top;
    }
  }
  
  /**
   * Safely removes the bullet from the game world and marked as inactive.
   */
  initiateSelfDestructionSequence() {
    this.isCurrentlyActiveAndValid = false;
    this.parentGameRenderingScene.remove(this.projectileRenderingMesh);
  }
}
