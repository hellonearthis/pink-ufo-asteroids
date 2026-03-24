import * as THREE from 'three';

/**
 * This class represents a hazardous celestial body (an asteroid).
 * It features randomized visual deformation and basic movement mechanics.
 */
export class CelestialHazardousAsteroid {
  /**
   * Creates an asteroid, potentially at a specific location or randomly at the edges.
   * @param {THREE.Scene} parentGameRenderingScene - The scene where this rock exists.
   * @param {Object} gameplayAreaBoundaryLimits - Limits used for edge spawning and wrapping.
   * @param {THREE.Vector3|null} specificSpawnCoordinate - If provided, the rock spawns here.
   * @param {number} relativeHazardSizeCategory - The scale of the hazard (3: Large, 2: Med, 1: Small).
   */
  constructor(parentGameRenderingScene, gameplayAreaBoundaryLimits, specificSpawnCoordinate = null, relativeHazardSizeCategory = 3) {
    this.parentGameRenderingScene = parentGameRenderingScene;
    this.gameplayAreaBoundaryLimits = gameplayAreaBoundaryLimits;
    this.relativeHazardSizeCategory = relativeHazardSizeCategory;
    
    /**
     * The physical size based on its category.
     */
    const physicalRadiusBasedOnSizeCategory = relativeHazardSizeCategory * 1.5;
    this.physicalCollisionRadius = physicalRadiusBasedOnSizeCategory;
    
    /**
     * We use an Icosahedron (20-sided polygon) as the base for our space rock.
     */
    const asteroidVisualGeometry = new THREE.IcosahedronGeometry(physicalRadiusBasedOnSizeCategory, 0);
    
    // PROCEDURAL DEFORMATION: 
    // To make each rock look unique, we shift every vertex of the geometry 
    // slightly in or out using random values ('noise').
    const geometryVertexPositionAttribute = asteroidVisualGeometry.attributes.position;
    for (let i = 0; i < geometryVertexPositionAttribute.count; i++) {
        const x_coord = geometryVertexPositionAttribute.getX(i);
        const y_coord = geometryVertexPositionAttribute.getY(i);
        const z_coord = geometryVertexPositionAttribute.getZ(i);
        
        // Random displacement factor (e.g., between 0.8 and 1.2x its original distance).
        const displacementNoiseFactor = 1 + (Math.random() * 0.4 - 0.2); 
        geometryVertexPositionAttribute.setXYZ(i, x_coord * displacementNoiseFactor, y_coord * displacementNoiseFactor, z_coord * displacementNoiseFactor);
    }
    
    // Recalculate normals so the lighting looks correct after deforming the shape.
    asteroidVisualGeometry.computeVertexNormals();

    const asteroidVisualMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x888888,   // A grey stone-like color
      roughness: 0.8,    // Very little reflectivity
      flatShading: true  // Sharp edges to mimic a jagged rock
    });
    
    this.asteroidRenderingMesh = new THREE.Mesh(asteroidVisualGeometry, asteroidVisualMaterial);
    
    // PLACEMENT LOGIC:
    if (specificSpawnCoordinate) {
      // If we are splitting a larger asteroid, we spawn at the parent's location.
      this.asteroidRenderingMesh.position.copy(specificSpawnCoordinate);
    } else {
      // Otherwise, spawn randomly along one of the four screen edges.
      const randomlySelectedScreenEdge = Math.floor(Math.random() * 4);
      if (randomlySelectedScreenEdge === 0) { // LEFT
          this.asteroidRenderingMesh.position.set(gameplayAreaBoundaryLimits.left, Math.random() * (gameplayAreaBoundaryLimits.top - gameplayAreaBoundaryLimits.bottom) + gameplayAreaBoundaryLimits.bottom, 0);
      } else if (randomlySelectedScreenEdge === 1) { // RIGHT
          this.asteroidRenderingMesh.position.set(gameplayAreaBoundaryLimits.right, Math.random() * (gameplayAreaBoundaryLimits.top - gameplayAreaBoundaryLimits.bottom) + gameplayAreaBoundaryLimits.bottom, 0);
      } else if (randomlySelectedScreenEdge === 2) { // BOTTOM
          this.asteroidRenderingMesh.position.set(Math.random() * (gameplayAreaBoundaryLimits.right - gameplayAreaBoundaryLimits.left) + gameplayAreaBoundaryLimits.left, gameplayAreaBoundaryLimits.bottom, 0);
      } else { // TOP
          this.asteroidRenderingMesh.position.set(Math.random() * (gameplayAreaBoundaryLimits.right - gameplayAreaBoundaryLimits.left) + gameplayAreaBoundaryLimits.left, gameplayAreaBoundaryLimits.top, 0);
      }
    }
    
    // Add to the 3D world.
    this.parentGameRenderingScene.add(this.asteroidRenderingMesh);
    
    /**
     * MOVEMENT PHYSICS:
     * Smaller rocks travel faster than larger ones.
     */
    const calculatedDriftSpeedScale = (4 - relativeHazardSizeCategory) * 5;
    const randomizedInitialHeadingAngle = Math.random() * Math.PI * 2;
    this.currentLinearVelocityVector = new THREE.Vector3(
        Math.cos(randomizedInitialHeadingAngle) * calculatedDriftSpeedScale, 
        Math.sin(randomizedInitialHeadingAngle) * calculatedDriftSpeedScale, 
        0
    );
    
    /**
     * ROTATION PHYSICS:
     * Random tumbling rotation across all axes.
     */
    this.internalTumblingRotationSpeedVector = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).multiplyScalar(0.5);
    
    this.isCurrentlyActiveAndValid = true;
  }
  
  /**
   * Updates position and rotation for each frame.
   * @param {number} timeDeltaInSeconds - Time since previous update.
   */
  performFrameUpdate(timeDeltaInSeconds) {
    if (!this.isCurrentlyActiveAndValid) return;
    
    this.asteroidRenderingMesh.position.addScaledVector(this.currentLinearVelocityVector, timeDeltaInSeconds);
    
    // Apply the tumbling rotation.
    this.asteroidRenderingMesh.rotation.x += this.internalTumblingRotationSpeedVector.x * timeDeltaInSeconds;
    this.asteroidRenderingMesh.rotation.y += this.internalTumblingRotationSpeedVector.y * timeDeltaInSeconds;
    this.asteroidRenderingMesh.rotation.z += this.internalTumblingRotationSpeedVector.z * timeDeltaInSeconds;
    
    // SCREEN WRAPPING: Teleport when crossing the invisible boundaries.
    const leftLimit = this.gameplayAreaBoundaryLimits.left - this.physicalCollisionRadius;
    const rightLimit = this.gameplayAreaBoundaryLimits.right + this.physicalCollisionRadius;
    const topLimit = this.gameplayAreaBoundaryLimits.top + this.physicalCollisionRadius;
    const bottomLimit = this.gameplayAreaBoundaryLimits.bottom - this.physicalCollisionRadius;

    if (this.asteroidRenderingMesh.position.x > rightLimit) {
        this.asteroidRenderingMesh.position.x = leftLimit;
    } else if (this.asteroidRenderingMesh.position.x < leftLimit) {
        this.asteroidRenderingMesh.position.x = rightLimit;
    }

    if (this.asteroidRenderingMesh.position.y > topLimit) {
        this.asteroidRenderingMesh.position.y = bottomLimit;
    } else if (this.asteroidRenderingMesh.position.y < bottomLimit) {
        this.asteroidRenderingMesh.position.y = topLimit;
    }
  }
  
  /**
   * Removes the asteroid from existence.
   */
  initiateDecompositionSequence() {
    this.isCurrentlyActiveAndValid = false;
    this.parentGameRenderingScene.remove(this.asteroidRenderingMesh);
  }
}
