/* ============================================================================
 * Bullet.js — PROJECTILE PARTICLE
 * ============================================================================
 *
 * This module creates and manages individual projectiles (bullets) fired
 * by the player's spacecraft. Each bullet is a small, tumbling "chip" that
 * travels in a straight line until it either hits an asteroid or exceeds
 * its maximum range.
 *
 * KEY CONCEPTS DEMONSTRATED:
 *
 *   1. CAPSULE GEOMETRY WITH FLAT SHADING:
 *      Uses THREE.CapsuleGeometry with low polygon count + flatShading
 *      to create a faceted, gemstone-like projectile appearance.
 *
 *   2. EDGE GEOMETRY (Wireframe Outlines):
 *      THREE.EdgesGeometry extracts visible edges from a mesh, and
 *      THREE.LineSegments renders them as colored outlines.
 *
 *   3. NEWTONIAN PROJECTILE PHYSICS:
 *      Bullets inherit the ship's velocity at the moment of firing and
 *      add their own ejection velocity, creating realistic momentum transfer.
 *
 *   4. DISTANCE-BASED LIFESPAN:
 *      Instead of a timer, bullets track how far they've traveled and
 *      self-destruct when they exceed a maximum range.
 *
 *   5. PARENT-CHILD TRANSFORM INHERITANCE:
 *      The edge wireframe is a CHILD of the main mesh, so it automatically
 *      inherits all position, rotation, and scale changes.
 * ============================================================================ */

import * as THREE from 'three';


/**
 * Represents a single projectile discharged from the spacecraft.
 * Handles the bullet's creation, movement, visual animation, and cleanup.
 */
export class ProjectileParticle {
  /**
   * Constructs a new projectile starting at a specific 3D coordinate.
   *
   * @param {THREE.Scene} parentGameRenderingScene - The scene graph root.
   * @param {THREE.Vector3} initialStartingPosition - World-space spawn coordinate (ship's tip).
   * @param {THREE.Vector3} ejectionDirectionVector - Normalized direction the bullet will travel.
   * @param {Object} gameplayAreaBoundaryLimits - Screen boundaries for wrapping.
   *   Shape: { left: number, right: number, top: number, bottom: number }
   * @param {number} travelSpeed - Velocity magnitude in units per second (upgradeable).
   * @param {number} maxRange - Maximum travel distance in units before self-destruction (upgradeable).
   * @param {THREE.Vector3} initialInertiaVector - The ship's velocity at fire time (momentum transfer).
   */
  constructor(parentGameRenderingScene, initialStartingPosition, ejectionDirectionVector, gameplayAreaBoundaryLimits, travelSpeed = 40.0, maxRange = 50.0, initialInertiaVector = new THREE.Vector3(0, 0, 0)) {
    this.parentGameRenderingScene = parentGameRenderingScene;
    this.gameplayAreaBoundaryLimits = gameplayAreaBoundaryLimits;


    /* =====================================================================
     * 1a. BULLET GEOMETRY & MATERIAL
     * =====================================================================
     *
     * THREE.CapsuleGeometry(radius, length, capSegments, radialSegments):
     *   radius: 0.3       — The radius of the hemispherical caps.
     *   length: 0.6       — The length of the cylindrical middle section.
     *   capSegments: 2    — Very low subdivision on the caps (creates facets).
     *   radialSegments: 6 — Only 6 sides around the circumference.
     *
     * With only 2 cap segments and 6 radial segments, the capsule becomes
     * a crude, angular shape rather than a smooth pill. Combined with
     * flatShading, this creates a stylized "chip" or "crystal shard" look.
     *
     * RANDOMIZED PINK COLOR:
     * Each bullet picks a random shade of pink from a curated palette.
     * This adds visual variety to rapid-fire barrages, making them feel
     * more organic and less like identical clones.
     * ===================================================================== */
    const projectileVisualGeometry = new THREE.CapsuleGeometry(0.3, 0.6, 2, 6);

    /* Color palette — five distinct shades of pink, from soft to vivid. */
    const pinkVariants = [0xffb6c1, 0xffc0cb, 0xff69b4, 0xff1493, 0xdb7093];
    const pickedPink = pinkVariants[Math.floor(Math.random() * pinkVariants.length)];

    const projectileVisualMaterial = new THREE.MeshStandardMaterial({
        color: pickedPink,
        emissive: pickedPink,        // Emissive = same color = the bullet glows its own color.
                                     // This ensures visibility even in dark areas of the scene.
        emissiveIntensity: 0.6,
        roughness: 0.1,              // Very smooth surface → sharp specular highlights
        metalness: 0.7,              // High metalness → reflects its own color (like a gem)
        flatShading: true            /* FLAT SHADING forces each polygon face to use a single
                                      * normal vector (perpendicular to the face) instead of
                                      * interpolating normals across the face (smooth shading).
                                      * This creates hard edges between faces, making the low-poly
                                      * geometry look intentionally faceted rather than poorly
                                      * approximating a smooth surface. */
    });

    this.projectileRenderingMesh = new THREE.Mesh(projectileVisualGeometry, projectileVisualMaterial);


    /* =====================================================================
     * 1b. EDGE WIREFRAME (Outline Effect)
     * =====================================================================
     *
     * THREE.EdgesGeometry vs THREE.WireframeGeometry:
     *   - WireframeGeometry shows ALL edges (including diagonals that split
     *     quads into triangles). This looks messy and exposes the internal
     *     triangulation.
     *   - EdgesGeometry shows only edges where adjacent faces meet at a
     *     sharp angle (>1° by default). This produces clean outlines that
     *     trace the visible shape boundaries.
     *
     * THREE.LineSegments renders the edge geometry as GPU line primitives
     * (GL_LINES), which are typically 1 pixel wide (linewidth > 1 is only
     * supported on some platforms, not in WebGL).
     *
     * COLOR CYCLING ANIMATION:
     * We store a base color and a brighter highlight color, then interpolate
     * between them using Color.lerp() in performFrameUpdate() to create
     * a shimmering edge effect.
     *
     * offsetHSL(hue, saturation, lightness):
     * Shifts the color in HSL space. We offset lightness by +0.2 (20% brighter)
     * to create the highlight target without changing the hue or saturation.
     * ===================================================================== */
    const bulletEdgesGeometry = new THREE.EdgesGeometry(projectileVisualGeometry);

    this.bulletBaseColor = new THREE.Color(pickedPink);
    this.bulletHighlightColor = this.bulletBaseColor.clone().offsetHSL(0, 0, 0.2);

    this.bulletEdgesMaterial = new THREE.LineBasicMaterial({
        color: this.bulletBaseColor,
        transparent: true,
        opacity: 0.8
    });

    const bulletEdgesMesh = new THREE.LineSegments(bulletEdgesGeometry, this.bulletEdgesMaterial);

    /* PARENT-CHILD RELATIONSHIP:
     * By adding the edges mesh as a CHILD of the main projectile mesh,
     * it automatically inherits all transformations (position, rotation, scale).
     * When we rotate the projectile, the edges rotate with it.
     * When we move the projectile, the edges move with it.
     * We don't need to manually synchronize their transforms. */
    this.projectileRenderingMesh.add(bulletEdgesMesh);


    /* =====================================================================
     * INITIAL TRANSFORM SETUP
     * ===================================================================== */

    /* Randomize the starting rotation so each bullet begins at a different
     * orientation, making rapid-fire shots look more chaotic and dynamic.
     * Math.random() * 5 gives a range of ~0 to 5 radians (nearly a full rotation). */
    this.projectileRenderingMesh.rotation.set(
      Math.random() * 5,
      Math.random() * 5,
      Math.random() * 5
    );

    /* Copy the spawn position (which is at the tip of the player's ship). */
    this.projectileRenderingMesh.position.copy(initialStartingPosition);

    /* Add the bullet to the scene so it becomes visible. */
    this.parentGameRenderingScene.add(this.projectileRenderingMesh);


    /* =====================================================================
     * TUMBLING ROTATION
     * =====================================================================
     * Random angular velocities on all three axes create a natural-looking
     * "tumbling" spin as the bullet flies. The range [-5, +5] radians/sec
     * gives fast, noticeable rotation without being nauseating.
     * ===================================================================== */
    this.internalTumblingRotationVelocity = new THREE.Vector3(
        Math.random() * 10 - 5,     // Range: -5 to +5 radians/sec on X
        Math.random() * 10 - 5,     // Range: -5 to +5 radians/sec on Y
        Math.random() * 10 - 5      // Range: -5 to +5 radians/sec on Z
    );


    /* =====================================================================
     * VELOCITY CALCULATION (Newtonian Momentum Transfer)
     * =====================================================================
     *
     * PROJECTILE VELOCITY = EJECTION VELOCITY + SHIP VELOCITY
     *
     * In classical mechanics, a projectile launched from a moving platform
     * inherits the platform's velocity. This is why a ball thrown forward
     * from a moving car appears to travel faster than one thrown from
     * a stationary car.
     *
     * Clone & normalize the direction vector (makes it unit length = 1.0),
     * then scale it by the travel speed to get the ejection velocity.
     * Finally, add the ship's current velocity (initialInertiaVector)
     * for realistic momentum transfer.
     *
     * GAMEPLAY IMPLICATION:
     * - Shooting while moving forward: bullets go FASTER than base speed.
     * - Shooting while moving backward: bullets go SLOWER (or even backward
     *   if the ship is moving faster than the bullet speed).
     * ===================================================================== */
    this.currentLinearVelocityVector = ejectionDirectionVector.clone().normalize().multiplyScalar(travelSpeed);
    this.currentLinearVelocityVector.add(initialInertiaVector);


    /* =====================================================================
     * RANGE TRACKING (Distance-Based Lifespan)
     * =====================================================================
     *
     * WHY DISTANCE instead of TIME?
     * If we used a timer, faster bullets would travel further before
     * running out of time. By tracking distance, ALL bullets travel
     * exactly the same maximum distance regardless of their speed.
     * This makes the 'RANGE' upgrade independent from the 'SPEED' upgrade.
     * ===================================================================== */
    this.maxTravelDistance = maxRange;
    this.currentTravelDistance = 0;

    /* State and collision properties. */
    this.isCurrentlyActiveAndValid = true;
    this.physicalCollisionRadius = 0.5;   // Used by Game.js for bullet↔asteroid collision checks
  }


  /* ==========================================================================
   * performFrameUpdate() — BULLET UPDATE TICK
   * ==========================================================================
   * Called once per frame from Game.js for each active bullet.
   *
   * @param {number} timeDeltaInSeconds - Time since previous frame.
   * ========================================================================== */
  performFrameUpdate(timeDeltaInSeconds) {
    /* Early exit if this bullet has already been destroyed.
     * The Game.js loop removes inactive bullets from the array after this call. */
    if (!this.isCurrentlyActiveAndValid) return;


    /* --- 1. UPDATE ROTATION (Tumbling Animation) ---
     * Each axis rotates at its own independent speed, creating complex
     * tumbling motion that looks natural and unpredictable.
     * Multiply by deltaTime for frame-rate independent animation speed. */
    this.projectileRenderingMesh.rotation.x += this.internalTumblingRotationVelocity.x * timeDeltaInSeconds;
    this.projectileRenderingMesh.rotation.y += this.internalTumblingRotationVelocity.y * timeDeltaInSeconds;
    this.projectileRenderingMesh.rotation.z += this.internalTumblingRotationVelocity.z * timeDeltaInSeconds;


    /* --- 1.5. EDGE COLOR CYCLING ---
     * The edge wireframe oscillates between the base pink color and a
     * 20% brighter version, creating a shimmering/pulsing outline effect.
     *
     * Color.lerp(target, alpha):
     * Linearly interpolates between the current color and the target color.
     * alpha=0 → base color, alpha=1 → highlight color.
     * We use Math.sin() to oscillate alpha between 0 and 1 smoothly.
     *
     * The Math.random() in the sine input adds slight per-frame randomness,
     * making the shimmer feel more organic than a perfectly smooth oscillation. */
    const colorPulse = Math.sin(this.currentTravelDistance * 0.5 + Math.random()) * 0.5 + 0.5;
    this.bulletEdgesMaterial.color.copy(this.bulletBaseColor).lerp(this.bulletHighlightColor, colorPulse);


    /* --- 2. UPDATE POSITION ---
     * Calculate the displacement vector for this specific frame.
     *
     * velocity.clone().multiplyScalar(deltaTime):
     * We CLONE the velocity first because multiplyScalar() modifies
     * the vector IN PLACE. If we didn't clone, we'd be permanently
     * shrinking the velocity vector each frame.
     *
     * position.add() then adds this displacement to the current position. */
    const displacementThisFrame = this.currentLinearVelocityVector.clone().multiplyScalar(timeDeltaInSeconds);
    this.projectileRenderingMesh.position.add(displacementThisFrame);


    /* --- 3. TRACK DISTANCE ---
     * Vector3.length() returns the Euclidean length of the vector
     * (√(x² + y² + z²)). This gives us the actual distance traveled
     * this frame, accounting for diagonal movement. */
    this.currentTravelDistance += displacementThisFrame.length();


    /* --- 4. RANGE CHECK ---
     * When total distance traveled exceeds the configured maximum,
     * the bullet expires. This prevents bullets from orbiting the
     * screen indefinitely due to screen wrapping. */
    if (this.currentTravelDistance >= this.maxTravelDistance) {
      this.initiateSelfDestructionSequence();
      return;   // Skip screen wrapping since the bullet is being removed
    }


    /* --- 5. SCREEN WRAPPING ---
     * Identical logic to the player ship: when the bullet crosses a
     * screen boundary, it teleports to the opposite edge.
     * This maintains the toroidal topology of the play field — a bullet
     * that flies off the right edge reappears on the left. */
    const pos = this.projectileRenderingMesh.position;
    const limits = this.gameplayAreaBoundaryLimits;

    if (pos.x > limits.right) pos.x = limits.left;
    else if (pos.x < limits.left) pos.x = limits.right;

    if (pos.y > limits.top) pos.y = limits.bottom;
    else if (pos.y < limits.bottom) pos.y = limits.top;
  }


  /* ==========================================================================
   * initiateSelfDestructionSequence() — CLEANUP
   * ==========================================================================
   * Removes the bullet from the 3D scene and marks it as inactive.
   *
   * WHY scene.remove() AND a flag?
   *   - scene.remove() takes the mesh out of the scene graph so it's no
   *     longer rendered. This is the GPU-side cleanup.
   *   - isCurrentlyActiveAndValid = false tells Game.js to remove this
   *     bullet from the currentlyActiveProjectiles array. This is the
   *     logic-side cleanup. Both are needed.
   *
   * GARBAGE COLLECTION NOTE:
   * In a production game, we'd also call geometry.dispose() and
   * material.dispose() to explicitly free GPU memory. Three.js does not
   * automatically release WebGL resources when a mesh is removed from the
   * scene — they're only freed when the garbage collector collects the
   * JavaScript object references. For our small game with few bullets,
   * this isn't a problem, but for games with thousands of particles,
   * manual disposal is critical to prevent GPU memory leaks.
   * ========================================================================== */
  initiateSelfDestructionSequence() {
    this.isCurrentlyActiveAndValid = false;
    this.parentGameRenderingScene.remove(this.projectileRenderingMesh);
  }
}
