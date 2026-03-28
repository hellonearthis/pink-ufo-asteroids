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
   * @param {number} asteroidColor - The hex color of the asteroid.
   * @param {number} asteroidHealth - The number of hits this rock can sustain.
   * @param {string} lineageId - Tracking ID for the original parent's family tree.
   */
  constructor(parentGameRenderingScene, gameplayAreaBoundaryLimits, specificSpawnCoordinate = null, relativeHazardSizeCategory = 3, asteroidColor = 0x888888, asteroidHealth = 1, lineageId = "") {
    this.parentGameRenderingScene = parentGameRenderingScene;
    this.gameplayAreaBoundaryLimits = gameplayAreaBoundaryLimits;
    this.relativeHazardSizeCategory = relativeHazardSizeCategory;
    this.asteroidColor = asteroidColor;
    this.maxHealth = asteroidHealth;
    this.currentHealth = asteroidHealth;
    this.lineageId = lineageId || `lin_${Math.random().toString(36).substr(2, 9)}`;
    this.hitFlashTimer = 0;
    
    /**
     * The physical size based on its category.
     */
    const physicalRadiusBasedOnSizeCategory = relativeHazardSizeCategory * 1.5;
    this.physicalCollisionRadius = physicalRadiusBasedOnSizeCategory;
    
    /**
     * GEOMETRY CREATION:
     * We use an Icosahedron (20-sided polygon) as the base for our space rock.
     * This provides a solid spherical foundation without unnecessary complexity.
     */
    const asteroidVisualGeometry = new THREE.IcosahedronGeometry(physicalRadiusBasedOnSizeCategory, 0);
    
    /**
     * PROCEDURAL DEFORMATION: 
     * To make each rock look unique, we manually iterate through the geometry's 
     * position attribute buffer. We shift every vertex slightly along its original 
     * vector to create a jagged, non-spherical shape.
     */
    const geometryVertexPositionAttribute = asteroidVisualGeometry.attributes.position;
    for (let i = 0; i < geometryVertexPositionAttribute.count; i++) {
        // Retrieve the current X, Y, Z coordinates for this vertex.
        const x_coord = geometryVertexPositionAttribute.getX(i);
        const y_coord = geometryVertexPositionAttribute.getY(i);
        const z_coord = geometryVertexPositionAttribute.getZ(i);
        
        // Displacement: We multiply the coordinates by a random factor 
        // between 0.8 and 1.2 to "dent" or "push" the rock's surface.
        const displacementNoiseFactor = 1 + (Math.random() * 0.4 - 0.2); 
        geometryVertexPositionAttribute.setXYZ(i, x_coord * displacementNoiseFactor, y_coord * displacementNoiseFactor, z_coord * displacementNoiseFactor);
    }
    
    /**
     * LIGHTING RECALCULATION:
     * After shifting vertices, the original surface normals (direction vectors 
     * used for lighting) are no longer accurate. computeVertexNormals() 
     * recalculates them so shadows and highlights align with the new jagged faces.
     */
    asteroidVisualGeometry.computeVertexNormals();

    const asteroidVisualMaterial = new THREE.MeshStandardMaterial({ 
      color: this.asteroidColor,   
      roughness: 0.8,    // High roughness for a matte, rocky texture
      flatShading: true  // Forces each face to have a single light value, highlighting the faceted geometry
    });
    
    this.asteroidRenderingMesh = new THREE.Mesh(asteroidVisualGeometry, asteroidVisualMaterial);
    
    // PLACEMENT LOGIC:
    if (specificSpawnCoordinate) {
      // COORDINATE HIERARCHY: If we are splitting a larger asteroid, we inherit its position.
      this.asteroidRenderingMesh.position.copy(specificSpawnCoordinate);
    } else {
      // EDGE SPAWNING: Force the rock to appear just outside the visible game boundaries 
      // by randomly selecting one of the four screen edges.
      const randomlySelectedScreenEdge = Math.floor(Math.random() * 4);
      const limits = this.gameplayAreaBoundaryLimits;

      if (randomlySelectedScreenEdge === 0) { // LEFT
          this.asteroidRenderingMesh.position.set(limits.left, Math.random() * (limits.top - limits.bottom) + limits.bottom, 0);
      } else if (randomlySelectedScreenEdge === 1) { // RIGHT
          this.asteroidRenderingMesh.position.set(limits.right, Math.random() * (limits.top - limits.bottom) + limits.bottom, 0);
      } else if (randomlySelectedScreenEdge === 2) { // BOTTOM
          this.asteroidRenderingMesh.position.set(Math.random() * (limits.right - limits.left) + limits.left, limits.bottom, 0);
      } else { // TOP
          this.asteroidRenderingMesh.position.set(Math.random() * (limits.right - limits.left) + limits.left, limits.top, 0);
      }
    }
    
    // Add the computed Mesh to the primary rendering scene.
    this.parentGameRenderingScene.add(this.asteroidRenderingMesh);
    
    /**
     * MOVEMENT CALCULATIONS:
     * We convert a random angle (Heading) into a persistent velocity vector.
     * Scale is determined by the size category (smaller rocks move faster).
     */
    const calculatedDriftSpeedScale = (4 - relativeHazardSizeCategory) * 5;
    const randomizedInitialHeadingAngle = Math.random() * Math.PI * 2;
    this.currentLinearVelocityVector = new THREE.Vector3(
        Math.cos(randomizedInitialHeadingAngle) * calculatedDriftSpeedScale, 
        Math.sin(randomizedInitialHeadingAngle) * calculatedDriftSpeedScale, 
        0
    );
    
    /**
     * ROTATION CALCULATIONS:
     * We use a Vector3 to store the rotation speed for each axis (X, Y, Z).
     * This creates the "tumbling" effect as the rock drifts through space.
     */
    this.internalTumblingRotationSpeedVector = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).multiplyScalar(0.5);
    
    this.isCurrentlyActiveAndValid = true;
  }
  
  /**
   * Main ticking function responsible for updating physics and visual state.
   */
  performFrameUpdate(timeDeltaInSeconds) {
    if (!this.isCurrentlyActiveAndValid) return;
    
    // VISUAL FEEDBACK (Hit Flash):
    // If the rock was recently hit, we use a timer to fade back the emissive (glow) channel.
    if (this.hitFlashTimer > 0) {
        this.hitFlashTimer -= timeDeltaInSeconds;
        if (this.hitFlashTimer <= 0) {
            this.asteroidRenderingMesh.material.emissive.setHex(0x000000);
        }
    }

    // PHYSICS UPDATE: Move the mesh along its velocity vector.
    this.asteroidRenderingMesh.position.addScaledVector(this.currentLinearVelocityVector, timeDeltaInSeconds);
    
    // ROTATION UPDATE: Apply the tumbling rotation speeds.
    this.asteroidRenderingMesh.rotation.x += this.internalTumblingRotationSpeedVector.x * timeDeltaInSeconds;
    this.asteroidRenderingMesh.rotation.y += this.internalTumblingRotationSpeedVector.y * timeDeltaInSeconds;
    this.asteroidRenderingMesh.rotation.z += this.internalTumblingRotationSpeedVector.z * timeDeltaInSeconds;
    
    // SCREEN WRAPPING:
    // When the rock's center crosses a boundary, teleport it to the opposite side 
    // to simulate an infinite, wrapping coordinate space.
    const limits = this.gameplayAreaBoundaryLimits;
    const pos = this.asteroidRenderingMesh.position;
    const boundaryBuffer = this.physicalCollisionRadius;

    if (pos.x > limits.right + boundaryBuffer) pos.x = limits.left - boundaryBuffer;
    else if (pos.x < limits.left - boundaryBuffer) pos.x = limits.right + boundaryBuffer;

    if (pos.y > limits.top + boundaryBuffer) pos.y = limits.bottom - boundaryBuffer;
    else if (pos.y < limits.bottom - boundaryBuffer) pos.y = limits.top + boundaryBuffer;
  }
  
  /**
   * Triggers a damage state and visual hit flash.
   */
  takeDamage() {
    this.currentHealth--;
    
    // Flash the emissive channel pure white to provide instant player feedback.
    this.hitFlashTimer = 0.1; 
    this.asteroidRenderingMesh.material.emissive.setHex(0xffffff);
    
    return this.currentHealth <= 0;
  }

  /**
   * Safely removes the mesh from the scene graph and marks for game-engine cleanup.
   */
  initiateDecompositionSequence() {
    this.isCurrentlyActiveAndValid = false;
    this.parentGameRenderingScene.remove(this.asteroidRenderingMesh);
  }
}
