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
   */
  constructor(parentGameRenderingScene, initialStartingPosition, ejectionDirectionVector, gameplayAreaBoundaryLimits) {
    this.parentGameRenderingScene = parentGameRenderingScene;
    this.gameplayAreaBoundaryLimits = gameplayAreaBoundaryLimits;
    
    /**
     * The visual representation of the bullet is a small yellow sphere.
     */
    const projectileVisualGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const projectileVisualMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    
    this.projectileRenderingMesh = new THREE.Mesh(projectileVisualGeometry, projectileVisualMaterial);
    
    // Copy the starting position from the player's tip.
    this.projectileRenderingMesh.position.copy(initialStartingPosition);
    
    // Add the bullet to the 3D scene.
    this.parentGameRenderingScene.add(this.projectileRenderingMesh);
    
    /**
     * The flight velocity is based on the ejection direction, scaled by a speed constant.
     */
    const projectileTravelSpeedConstant = 40.0;
    this.currentLinearVelocityVector = ejectionDirectionVector.clone().normalize().multiplyScalar(projectileTravelSpeedConstant);
    
    /**
     * Remaining time (in seconds) that the bullet will exist before being automatically removed.
     */
    this.remainingLifespanInSeconds = 2.0; 
    
    /**
     * A flag to indicate if this bullet is currently active in the game world.
     */
    this.isCurrentlyActiveAndValid = true;
    
    /**
     * The collision radius for detecting hits on asteroids.
     */
    this.physicalCollisionRadius = 0.3;
  }
  
  /**
   * Updates the bullet's position and reduces its lifespan.
   * @param {number} timeDeltaInSeconds - The duration of the current physics frame.
   */
  performFrameUpdate(timeDeltaInSeconds) {
    if (!this.isCurrentlyActiveAndValid) return;
    
    // Position Update: Move the bullet forward based on its velocity.
    this.projectileRenderingMesh.position.addScaledVector(this.currentLinearVelocityVector, timeDeltaInSeconds);
    
    // Lifespan Logic: Subtract elapsed time.
    this.remainingLifespanInSeconds -= timeDeltaInSeconds;
    
    // Self-Destruction: If the lifespan reaches zero, the bullet 'dies'.
    if (this.remainingLifespanInSeconds <= 0) {
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
