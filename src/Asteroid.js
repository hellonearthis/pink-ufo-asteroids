/* ============================================================================
 * Asteroid.js — CELESTIAL HAZARDOUS ASTEROID
 * ============================================================================
 *
 * This module creates and manages individual asteroids — the primary hazards
 * in the game. Each asteroid is a procedurally deformed icosahedron that
 * drifts across the play field, tumbling as it goes.
 *
 * KEY CONCEPTS DEMONSTRATED:
 *
 *   1. PROCEDURAL GEOMETRY DEFORMATION:
 *      Starting from a regular IcosahedronGeometry, we manually modify
 *      individual vertex positions in the geometry's BufferAttribute
 *      to create unique, jagged rock shapes.
 *
 *   2. BUFFER GEOMETRY INTERNALS:
 *      Three.js stores geometry data in typed arrays (Float32Array)
 *      accessible through BufferAttributes. We directly read and write
 *      vertex coordinates using getX/setXYZ methods.
 *
 *   3. NORMAL RECOMPUTATION:
 *      After modifying vertices, surface normals must be recalculated
 *      so that lighting reacts correctly to the new surface orientations.
 *
 *   4. EDGE SPAWNING:
 *      New asteroids spawn just outside the visible screen boundaries,
 *      then drift inward — preventing sudden "pop-in" appearances.
 *
 *   5. SCREEN WRAPPING WITH BUFFER:
 *      Asteroids wrap at screen edges with a radius-based buffer so
 *      they fully disappear before reappearing on the opposite side.
 *
 *   6. DAMAGE SYSTEM & HIT FLASH:
 *      Multi-hit health system with temporary emissive color flash
 *      for visual hit feedback.
 *
 *   7. LINEAGE TRACKING:
 *      Each asteroid carries a lineageId linking it to its original
 *      parent. When all descendants of a single parent are destroyed,
 *      the game awards a bonus "Family Wipe" reward.
 * ============================================================================ */

import * as THREE from "three";

/**
 * Represents a hazardous celestial body (asteroid) in the game world.
 * Features randomized visual deformation, drift movement, tumbling rotation,
 * a multi-hit health system, and lineage tracking for bonus rewards.
 */
export class CelestialHazardousAsteroid {
  /**
   * Creates an asteroid entity.
   *
   * @param {THREE.Scene} parentGameRenderingScene - The scene to add the asteroid to.
   * @param {Object} gameplayAreaBoundaryLimits - Screen boundaries for spawning and wrapping.
   *   Shape: { left: number, right: number, top: number, bottom: number }
   * @param {THREE.Vector3|null} specificSpawnCoordinate - If provided, spawn here (used for
   *   child asteroids when a parent splits). If null, spawn at a random screen edge.
   * @param {number} relativeHazardSizeCategory - The size tier:
   *   3 = Large (4.5 unit radius), 2 = Medium (3.0), 1 = Small (1.5).
   *   Affects: collision radius, visual size, drift speed, and score value.
   * @param {number} asteroidColor - The hex color for this asteroid's material.
   * @param {number} asteroidHealth - Number of hits needed to destroy this asteroid.
   *   Scales with wave number (calculated by Game.js).
   * @param {string} lineageId - Tracking ID linking back to the original ancestor.
   *   Child asteroids inherit this from their parent. New root asteroids generate
   *   a random ID (e.g., "lin_a7bx3k2f9").
   */
  constructor(
    parentGameRenderingScene,
    gameplayAreaBoundaryLimits,
    specificSpawnCoordinate = null,
    relativeHazardSizeCategory = 3,
    asteroidColor = 0x888888,
    asteroidHealth = 1,
    lineageId = "",
  ) {
    this.parentGameRenderingScene = parentGameRenderingScene;
    this.gameplayAreaBoundaryLimits = gameplayAreaBoundaryLimits;
    this.relativeHazardSizeCategory = relativeHazardSizeCategory;
    this.asteroidColor = asteroidColor;
    this.maxHealth = asteroidHealth;
    this.currentHealth = asteroidHealth;

    /* LINEAGE ID:
     * If no lineageId is provided (root asteroid), generate a unique one.
     * Math.random().toString(36) converts a random float to a base-36 string
     * (using digits 0-9 and letters a-z), then .substr(2, 9) extracts 9
     * characters after the "0." prefix. This creates a short, unique-enough
     * identifier for tracking asteroid family trees. */
    this.lineageId =
      lineageId || `lin_${Math.random().toString(36).substr(2, 9)}`;

    /* Hit flash timer: counts down to zero after a hit.
     * While > 0, the asteroid's emissive channel shows white. */
    this.hitFlashTimer = 0;

    /* Physical radius scales linearly with the size category.
     * Category 3 → radius 4.5, Category 2 → radius 3.0, Category 1 → radius 1.5 */
    const physicalRadiusBasedOnSizeCategory = relativeHazardSizeCategory * 1.5;
    this.physicalCollisionRadius = physicalRadiusBasedOnSizeCategory;

    /* =====================================================================
     * GEOMETRY CREATION — ICOSAHEDRON
     * =====================================================================
     *
     * THREE.IcosahedronGeometry(radius, detail):
     *   radius: physicalRadiusBasedOnSizeCategory — matches the collision radius.
     *   detail: 0 — The subdivision level. 0 = the base icosahedron (20 triangular
     *               faces, 12 vertices). Higher values subdivide each triangle into
     *               4 smaller triangles (detail=1 → 80 faces, detail=2 → 320 faces).
     *               We use 0 for a low-poly, faceted look that suits space rocks.
     *
     * WHY ICOSAHEDRON and not SphereGeometry?
     *   - IcosahedronGeometry at detail=0 has evenly-distributed faces.
     *   - SphereGeometry at low segment counts has "poles" (degenerate triangles
     *     where uvs and normals converge), creating visible artifacts.
     *   - The icosahedron's near-uniform face distribution makes procedural
     *     deformation look more natural — no polar distortion.
     * ===================================================================== */
    const asteroidVisualGeometry = new THREE.IcosahedronGeometry(
      physicalRadiusBasedOnSizeCategory,
      0,
    );

    /* =====================================================================
     * PROCEDURAL VERTEX DEFORMATION
     * =====================================================================
     *
     * This is where each asteroid gets its unique, jagged shape.
     *
     * Three.js stores geometry data in BUFFER ATTRIBUTES — typed arrays
     * (Float32Array) that live on the GPU for efficient rendering.
     *
     * geometry.attributes.position is a BufferAttribute containing all
     * vertex positions as interleaved [x1, y1, z1, x2, y2, z2, ...] values.
     *
     * BufferAttribute methods:
     *   .count        — Total number of vertices (length / 3)
     *   .getX(i)      — Returns the X coordinate of vertex i
     *   .getY(i)      — Returns the Y coordinate of vertex i
     *   .getZ(i)      — Returns the Z coordinate of vertex i
     *   .setXYZ(i, x, y, z) — Sets all three coordinates of vertex i
     *
     * OUR DEFORMATION ALGORITHM:
     * For each vertex, we multiply its coordinates by a random factor
     * between 0.8 and 1.2. This "pushes" some vertices outward (+20%) and
     * "pulls" some inward (-20%), creating an irregular, rocky surface.
     *
     * Because we scale the EXISTING coordinates (rather than adding random
     * offsets), vertices farther from the center are displaced more in
     * absolute terms, which naturally creates larger dents and bumps on
     * the outer surface while keeping small-scale details proportional.
     * ===================================================================== */
    const geometryVertexPositionAttribute =
      asteroidVisualGeometry.attributes.position;
    for (let i = 0; i < geometryVertexPositionAttribute.count; i++) {
      const x_coord = geometryVertexPositionAttribute.getX(i);
      const y_coord = geometryVertexPositionAttribute.getY(i);
      const z_coord = geometryVertexPositionAttribute.getZ(i);

      /* Random displacement factor: range [0.8, 1.2]
       * Math.random() returns [0, 1), so:
       *   Math.random() * 0.4 → [0, 0.4)
       *   - 0.2 → [-0.2, 0.2)
       *   + 1 → [0.8, 1.2) */
      const displacementNoiseFactor = 1 + (Math.random() * 0.4 - 0.2);
      geometryVertexPositionAttribute.setXYZ(
        i,
        x_coord * displacementNoiseFactor,
        y_coord * displacementNoiseFactor,
        z_coord * displacementNoiseFactor,
      );
    }

    /* =====================================================================
     * NORMAL RECALCULATION
     * =====================================================================
     *
     * WHAT ARE NORMALS?
     * Surface normals are unit vectors perpendicular to each face/vertex.
     * The lighting system uses normals to determine how much light reflects
     * off each point: surfaces facing the light are bright, surfaces facing
     * away are dark (Lambert's cosine law: brightness = dot(normal, lightDir)).
     *
     * WHY RECOMPUTE?
     * The original icosahedron's normals were calculated for perfectly flat,
     * evenly-sized faces. After deformation, faces have changed their
     * orientation and size. If we don't recompute normals, the lighting
     * would still be calculated using the old face orientations, creating
     * incorrect highlights and shadows that don't match the actual geometry.
     *
     * computeVertexNormals() averages the normals of all faces that share
     * each vertex, then stores the result in geometry.attributes.normal.
     * With flatShading enabled (below), Three.js will actually use the
     * FACE normals instead, but this call still ensures the internal
     * normal buffer is valid and correctly sized.
     * ===================================================================== */
    asteroidVisualGeometry.computeVertexNormals();

    /* =====================================================================
     * MATERIAL SETUP
     * =====================================================================
     *
     * MeshStandardMaterial with flatShading:
     *   color: this.asteroidColor — Set by Game.js from the color palette.
     *   roughness: 0.8  — High roughness = broad, diffuse reflections (matte rock).
     *   flatShading: true — Each triangular face gets a SINGLE light value
     *                       (calculated from the face normal), creating hard-edged
     *                       facets. This is the defining visual characteristic of
     *                       low-poly 3D art. Without it, normals are interpolated
     *                       across faces, making the icosahedron look like a
     *                       smooth sphere (which defeats the purpose of our
     *                       procedural deformation).
     * ===================================================================== */
    const asteroidVisualMaterial = new THREE.MeshStandardMaterial({
      color: this.asteroidColor,
      roughness: 0.8,
      flatShading: true,
    });

    this.asteroidRenderingMesh = new THREE.Mesh(
      asteroidVisualGeometry,
      asteroidVisualMaterial,
    );

    /* =====================================================================
     * SPAWN POSITION
     * =====================================================================
     *
     * TWO SPAWN MODES:
     *
     * A) INHERITING POSITION (specificSpawnCoordinate != null):
     *    Used when a larger asteroid splits into two smaller children.
     *    The children spawn at the EXACT same position as the parent,
     *    then drift apart due to their random velocity directions.
     *
     * B) EDGE SPAWNING (specificSpawnCoordinate == null):
     *    New root asteroids spawn AT the screen boundaries (not beyond).
     *    We randomly pick one of the four edges (left, right, bottom, top)
     *    and randomize the position along that edge.
     *
     *    WHY EDGES? Spawning in the center would "pop in" dangerously
     *    close to the player. Edge spawning ensures asteroids always
     *    approach from the periphery, giving the player time to react.
     * ===================================================================== */
    if (specificSpawnCoordinate) {
      /* Vector3.copy() sets this mesh's position to match the source vector. */
      this.asteroidRenderingMesh.position.copy(specificSpawnCoordinate);
    } else {
      /* Pick a random edge: 0=Left, 1=Right, 2=Bottom, 3=Top */
      const randomlySelectedScreenEdge = Math.floor(Math.random() * 4);
      const limits = this.gameplayAreaBoundaryLimits;

      if (randomlySelectedScreenEdge === 0) {
        // LEFT EDGE
        /* X = left boundary, Y = random position along the full height */
        this.asteroidRenderingMesh.position.set(
          limits.left,
          Math.random() * (limits.top - limits.bottom) + limits.bottom,
          0, // Z = 0 (on the gameplay plane)
        );
      } else if (randomlySelectedScreenEdge === 1) {
        // RIGHT EDGE
        this.asteroidRenderingMesh.position.set(
          limits.right,
          Math.random() * (limits.top - limits.bottom) + limits.bottom,
          0,
        );
      } else if (randomlySelectedScreenEdge === 2) {
        // BOTTOM EDGE
        this.asteroidRenderingMesh.position.set(
          Math.random() * (limits.right - limits.left) + limits.left,
          limits.bottom,
          0,
        );
      } else {
        // TOP EDGE
        this.asteroidRenderingMesh.position.set(
          Math.random() * (limits.right - limits.left) + limits.left,
          limits.top,
          0,
        );
      }
    }

    /* Add the mesh to the scene so it becomes visible. */
    this.parentGameRenderingScene.add(this.asteroidRenderingMesh);

    /* =====================================================================
     * MOVEMENT (Drift Velocity)
     * =====================================================================
     *
     * SPEED VS SIZE RELATIONSHIP:
     * Smaller asteroids move FASTER than larger ones. This is a classic
     * Asteroids game design choice that:
     *   - Makes small asteroids harder to hit (rewarding precision).
     *   - Creates increasing danger as large asteroids split into small ones.
     *   - Visually communicates mass (heavy = slow, light = fast).
     *
     * Speed formula: (4 - sizeCategory) * 5
     *   Category 3 (large):  (4-3)*5 = 5 units/sec
     *   Category 2 (medium): (4-2)*5 = 10 units/sec
     *   Category 1 (small):  (4-1)*5 = 15 units/sec
     *
     * DIRECTION:
     * A random angle (0 to 2π) determines the drift direction.
     * cos(angle) and sin(angle) convert the angle to a unit direction vector,
     * which is then scaled by the calculated speed.
     * Z velocity is always 0 (movement stays on the X-Y gameplay plane).
     * ===================================================================== */
    const calculatedDriftSpeedScale = (4 - relativeHazardSizeCategory) * 5;
    const randomizedInitialHeadingAngle = Math.random() * Math.PI * 2;
    this.currentLinearVelocityVector = new THREE.Vector3(
      Math.cos(randomizedInitialHeadingAngle) * calculatedDriftSpeedScale,
      Math.sin(randomizedInitialHeadingAngle) * calculatedDriftSpeedScale,
      0,
    );

    /* =====================================================================
     * TUMBLING ROTATION
     * =====================================================================
     * Random angular velocity on each axis creates a natural-looking
     * "tumbling" effect. The 0.5 multiplier keeps the spin rate gentle
     * (max ±0.5 radians/sec per axis) so asteroids rotate slowly
     * and majestically, fitting the "massive space rock" aesthetic.
     *
     * multiplyScalar(0.5) scales ALL three components of the vector by 0.5,
     * which is a convenient shorthand for scaling random values.
     * ===================================================================== */
    this.internalTumblingRotationSpeedVector = new THREE.Vector3(
      Math.random() * 2 - 1, // Range: [-1, +1] before scaling
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
    ).multiplyScalar(0.5);

    this.isCurrentlyActiveAndValid = true;
  }

  /* ==========================================================================
   * performFrameUpdate() — ASTEROID UPDATE TICK
   * ==========================================================================
   * Called once per frame from Game.js for each active asteroid.
   *
   * @param {number} timeDeltaInSeconds - Time since previous frame.
   * ========================================================================== */
  performFrameUpdate(timeDeltaInSeconds) {
    if (!this.isCurrentlyActiveAndValid) return;

    /* --- HIT FLASH VISUAL FEEDBACK ---
     * When takeDamage() is called, it sets hitFlashTimer to 0.1 seconds
     * and turns the emissive channel white. We count down the timer here
     * and reset the emissive to black (no glow) when it expires.
     *
     * material.emissive is a THREE.Color on MeshStandardMaterial.
     * setHex(0x000000) = black = no emissive contribution = normal appearance.
     * setHex(0xffffff) = white = maximum emissive = fully bright flash. */
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= timeDeltaInSeconds;
      if (this.hitFlashTimer <= 0) {
        this.asteroidRenderingMesh.material.emissive.setHex(0x000000);
      }
    }

    /* --- POSITION UPDATE ---
     * addScaledVector(v, s) is equivalent to: position += velocity * deltaTime.
     * This is more efficient than creating a temporary vector because it avoids
     * object allocation (no .clone() or new Vector3() needed). */
    this.asteroidRenderingMesh.position.addScaledVector(
      this.currentLinearVelocityVector,
      timeDeltaInSeconds,
    );

    /* --- ROTATION UPDATE ---
     * Each axis rotates independently at the pre-calculated speed.
     * The combination of three independent rotations on different axes
     * at different speeds creates the complex tumbling motion. */
    this.asteroidRenderingMesh.rotation.x +=
      this.internalTumblingRotationSpeedVector.x * timeDeltaInSeconds;
    this.asteroidRenderingMesh.rotation.y +=
      this.internalTumblingRotationSpeedVector.y * timeDeltaInSeconds;
    this.asteroidRenderingMesh.rotation.z +=
      this.internalTumblingRotationSpeedVector.z * timeDeltaInSeconds;

    /* --- SCREEN WRAPPING ---
     * Identical to Player.js and Bullet.js wrapping logic.
     * The boundaryBuffer (equal to collision radius) ensures the asteroid
     * is fully off-screen before it wraps to the opposite edge,
     * preventing jarring visual pops. */
    const limits = this.gameplayAreaBoundaryLimits;
    const pos = this.asteroidRenderingMesh.position;
    const boundaryBuffer = this.physicalCollisionRadius;

    if (pos.x > limits.right + boundaryBuffer)
      pos.x = limits.left - boundaryBuffer;
    else if (pos.x < limits.left - boundaryBuffer)
      pos.x = limits.right + boundaryBuffer;

    if (pos.y > limits.top + boundaryBuffer)
      pos.y = limits.bottom - boundaryBuffer;
    else if (pos.y < limits.bottom - boundaryBuffer)
      pos.y = limits.top + boundaryBuffer;
  }

  /* ==========================================================================
   * takeDamage() — DAMAGE HANDLER
   * ==========================================================================
   * Called by Game.js when a bullet hits this asteroid.
   *
   * VISUAL FEEDBACK STRATEGY:
   * Instead of reducing the asteroid's visual size or changing its color
   * permanently, we use a brief WHITE FLASH on the emissive channel.
   * This provides instant "I hit something" feedback without adding
   * complexity to the rendering pipeline.
   *
   * @returns {boolean} True if the asteroid is destroyed (health ≤ 0),
   *   false if it survived the hit (still has remaining health).
   *   Game.js uses this return value to decide whether to split the asteroid.
   * ========================================================================== */
  takeDamage() {
    this.currentHealth--;

    /* Set the emissive color to pure white for 0.1 seconds (flash effect).
     * The timer is decremented in performFrameUpdate(). */
    this.hitFlashTimer = 0.1;
    this.asteroidRenderingMesh.material.emissive.setHex(0xffffff);

    return this.currentHealth <= 0;
  }

  /* ==========================================================================
   * initiateDecompositionSequence() — CLEANUP
   * ==========================================================================
   * Removes the asteroid mesh from the 3D scene and marks it for
   * removal by Game.js's array cleanup logic.
   *
   * This is called in TWO scenarios:
   *   1. When the asteroid is destroyed by a bullet (after takeDamage returns true).
   *   2. When the game restarts and all asteroids need to be purged.
   *
   * Note: We call this "decomposition" rather than "destruction" because
   * the asteroid may still spawn child asteroids (handled by Game.js, not here).
   * This method only handles the visual/scene cleanup of THIS asteroid.
   * ========================================================================== */
  initiateDecompositionSequence() {
    this.isCurrentlyActiveAndValid = false;
    this.parentGameRenderingScene.remove(this.asteroidRenderingMesh);
  }
}
