/* ============================================================================
 * Bonus.js — COLLECTIBLE POWER-UP ELEMENT
 * ============================================================================
 *
 * This module creates and manages collectible bonus pickups that appear
 * when asteroids are destroyed. Each pickup is a spinning, pulsing gemstone
 * with a timer bar that shows how long it will remain available.
 *
 * KEY CONCEPTS DEMONSTRATED:
 *
 *   1. ICOSAHEDRON AS A GEM:
 *      Using IcosahedronGeometry with 0 detail and high metalness/low roughness
 *      creates a convincing gemstone/crystal appearance.
 *
 *   2. EDGE WIREFRAME OVERLAY:
 *      White LineSegments on top of the gem mesh create a stylized "facet
 *      outline" effect that enhances the gemstone aesthetic.
 *
 *   3. NESTED SCENE GRAPH FOR HUD ELEMENTS:
 *      The timer bar is a CHILD of the gem mesh. This means it automatically
 *      moves, rotates, and scales with the gem without manual synchronization.
 *
 *   4. Z-FIGHTING PREVENTION:
 *      The timer bar's foreground plane is offset 0.01 units on Z to prevent
 *      the GPU from flickering between two coplanar surfaces.
 *
 *   5. SCALE-BASED PROGRESS BAR:
 *      Instead of resizing geometry, we scale the foreground plane's X-axis
 *      to shrink it from 100% to 0% as time runs out — a GPU-efficient
 *      technique for animated UI elements within a 3D scene.
 *
 *   6. SINE-WAVE ANIMATIONS:
 *      Bobbing and pulsing use Math.sin() with different frequencies to
 *      create organic, non-repetitive-feeling motion.
 * ============================================================================ */

import * as THREE from 'three';


/**
 * Represents a collectible power-up that appears when asteroid families
 * are wiped out or on random drops from destroyed asteroids.
 */
export class BonusPickupElement {
  /**
   * Initializes a bonus pickup at a specific world position.
   *
   * @param {THREE.Scene} parentGameRenderingScene - The scene to add the bonus to.
   * @param {THREE.Vector3} spawnCoordinate - The 3D position where the bonus appears
   *   (typically the death location of the asteroid that spawned it).
   * @param {number} identifyingColor - Fallback hex color if the reward type has no mapping.
   * @param {string} rewardType - What the player gains on collection:
   *   'CAPACITY' — Increases max simultaneous shots (Red gem).
   *   'SPEED'    — Increases bullet travel speed (Orange gem).
   *   'RATE'     — Decreases shot cooldown / increases fire rate (Yellow gem).
   *   'RANGE'    — Increases bullet travel distance (Pink gem).
   *   'POINTS'   — Awards bonus score points (Green gem).
   */
  constructor(parentGameRenderingScene, spawnCoordinate, identifyingColor, rewardType = 'CAPACITY') {
    this.parentGameRenderingScene = parentGameRenderingScene;
    this.rewardType = rewardType;


    /* =====================================================================
     * COLOR MAPPING BY REWARD TYPE
     * =====================================================================
     *
     * Each reward type has a distinct color so players can quickly identify
     * what a pickup will do before collecting it. This is a core principle
     * of game UI design: "communicate through visuals, not text."
     *
     * The color map acts as a lookup table. If the rewardType isn't found
     * (shouldn't happen, but defensive coding), we fall back to the
     * identifyingColor parameter (which is the asteroid's color).
     * ===================================================================== */
    const rewardColorMap = {
        'CAPACITY': 0xff0000, // Red    — "More ammo" is traditionally red
        'SPEED':    0xffa500, // Orange — Warm colors suggest speed/energy
        'RATE':     0xffff00, // Yellow — Rapid-fire, electric energy
        'RANGE':    0xff69b4, // Pink   — Matches the game's pink brand
        'POINTS':   0x00ff00  // Green  — Currency/value is traditionally green
    };

    this.identifyingColor = rewardColorMap[rewardType] || identifyingColor;


    /* =====================================================================
     * 1. THE GEM MESH (Faceted Crystal)
     * =====================================================================
     *
     * THREE.IcosahedronGeometry(radius, detail):
     *   radius: 1.0  — 1 unit radius, giving the gem a 2-unit diameter.
     *   detail: 0    — Base icosahedron with 20 triangular faces.
     *                  This creates sharp facets that catch the light
     *                  differently on each face, like a real gemstone.
     *
     * The material is configured for a PREMIUM GEM LOOK:
     *   metalness: 0.9  — Near-pure metal reflections make the gem look
     *                      like a polished jewel rather than plastic.
     *   roughness: 0.1  — Very smooth surface = tight, bright specular
     *                      highlights on each facet.
     *   emissive + emissiveIntensity: 0.8 — Strong self-illumination so the
     *                      gem is clearly visible even in dark areas.
     *   transparent + opacity: 0.85 — Slight translucency adds depth and
     *                      allows background elements to subtly show through,
     *                      enhancing the crystal/glass illusion.
     * ===================================================================== */
    const gemGeometry = new THREE.IcosahedronGeometry(1.0, 0);
    const gemMaterial = new THREE.MeshStandardMaterial({
      color: this.identifyingColor,
      emissive: this.identifyingColor,
      emissiveIntensity: 0.8,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.85
    });
    this.gemMesh = new THREE.Mesh(gemGeometry, gemMaterial);


    /* =====================================================================
     * 1b. WHITE EDGE OUTLINES
     * =====================================================================
     *
     * Why add edges when the gem already has flat-shaded faces?
     * The white wireframe serves multiple purposes:
     *   1. READABILITY: High-contrast white lines are visible against any
     *      background color, ensuring the pickup is always noticeable.
     *   2. STYLE: The wireframe + transparent solid creates a "holographic
     *      gemstone" aesthetic common in sci-fi games.
     *   3. SIZE PERCEPTION: Outlines make the gem appear larger and more
     *      "pickupable" than the solid mesh alone.
     *
     * THREE.EdgesGeometry extracts only the "hard edges" where faces meet
     * at significant angles, avoiding the wireframe's internal triangulation
     * diagonals that would clutter the clean geometric look.
     *
     * NOTE: linewidth: 2 is specified but may not take effect in WebGL.
     * WebGL's GL_LINES implementation only supports linewidth=1 on most
     * platforms. For thicker lines, you'd need to use a Line2 / LineMaterial
     * from Three.js addons, which uses triangle-based line rendering.
     * ===================================================================== */
    const gemEdgesGeometry = new THREE.EdgesGeometry(gemGeometry);
    const gemEdgesMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const gemEdgesMesh = new THREE.LineSegments(gemEdgesGeometry, gemEdgesMaterial);

    /* Parent-child relationship: edges inherit the gem's transforms.
     * When the gem spins, the edges spin with it automatically. */
    this.gemMesh.add(gemEdgesMesh);


    /* Set the gem's position to the spawn coordinate and add to the scene. */
    this.gemMesh.position.copy(spawnCoordinate);
    this.parentGameRenderingScene.add(this.gemMesh);


    /* =====================================================================
     * 2. THE TIMER BAR (3D Progress Bar)
     * =====================================================================
     *
     * A two-layer progress bar floating above the gem, showing how much
     * time remains before the pickup expires and disappears.
     *
     * LAYER STRUCTURE:
     *   gemMesh (parent)
     *     └─ timerBarBackground (dark grey background plane)
     *          └─ timerBarForeground (white foreground plane, scales down over time)
     *
     * WHY NESTED IN THE SCENE GRAPH (not a separate HTML element)?
     * By making the timer bar a child of the gem mesh, it automatically:
     *   - Moves with the gem (no manual position sync needed).
     *   - Scales proportionally if the gem pulses larger/smaller.
     *   - Is removed automatically when the gem is removed from the scene.
     * This is much simpler than managing a separate DOM element overlay
     * and converting 3D positions to 2D screen coordinates.
     *
     * THREE.PlaneGeometry(width, height):
     * Creates a flat rectangular surface. We use DoubleSide rendering
     * because the plane is a child of a rotating gem — at various angles,
     * we'd see the back face, which would be invisible with default
     * single-sided rendering.
     * ===================================================================== */
    const barBackgroundGeometry = new THREE.PlaneGeometry(2.0, 0.2);
    const barBackgroundMaterial = new THREE.MeshBasicMaterial({
      color: 0x333333,         // Dark grey — unobtrusive background
      side: THREE.DoubleSide   // Visible from both sides of the plane
    });
    this.timerBarBackground = new THREE.Mesh(barBackgroundGeometry, barBackgroundMaterial);

    /* Position the bar floating 1.8 units above the gem's local origin. */
    this.timerBarBackground.position.set(0, 1.8, 0);
    this.gemMesh.add(this.timerBarBackground);

    /* FOREGROUND BAR (the "fill" that shrinks from left to right). */
    const barForegroundGeometry = new THREE.PlaneGeometry(2.0, 0.2);
    const barForegroundMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,         // White — high contrast against dark background
      side: THREE.DoubleSide
    });
    this.timerBarForeground = new THREE.Mesh(barForegroundGeometry, barForegroundMaterial);

    /* Z-FIGHTING PREVENTION:
     * When two planes occupy the EXACT same 3D position and orientation,
     * the GPU's depth buffer can't determine which one is "in front."
     * This causes flickering/shimmering as the GPU randomly picks one
     * or the other for each pixel (called "Z-fighting" or "depth fighting").
     *
     * By offsetting the foreground by just 0.01 units on Z, we give the
     * depth buffer a clear winner, eliminating the flickering.
     * The offset is small enough to be imperceptible to the viewer. */
    this.timerBarForeground.position.set(0, 0, 0.01);
    this.timerBarBackground.add(this.timerBarForeground);


    /* =====================================================================
     * STATE INITIALIZATION
     * ===================================================================== */

    /** Maximum time (in seconds) the bonus stays on screen before expiring. */
    this.maximumLifespanDuration = 10.0;

    /** Countdown timer. Decremented each frame. When it reaches 0, the bonus disappears. */
    this.remainingLifespanDuration = this.maximumLifespanDuration;

    /** Active flag for Game.js's cleanup loop. */
    this.isCurrentlyActiveAndValid = true;

    /** Collision radius used by Game.js for player↔bonus collision checks. */
    this.physicalCollisionRadius = 1.2;

    /** Accumulated time for sine-wave animation calculations. */
    this.accumulatedRotationTime = 0;
  }


  /* ==========================================================================
   * performFrameUpdate() — BONUS UPDATE TICK
   * ==========================================================================
   * Called once per frame from Game.js for each active bonus.
   *
   * @param {number} timeDeltaInSeconds - Time since previous frame.
   * ========================================================================== */
  performFrameUpdate(timeDeltaInSeconds) {
    if (!this.isCurrentlyActiveAndValid) return;

    /* Accumulate time for animation and count down the lifespan. */
    this.accumulatedRotationTime += timeDeltaInSeconds;
    this.remainingLifespanDuration -= timeDeltaInSeconds;


    /* --- 1. ROTATION ANIMATION ---
     * The gem rotates on TWO axes at DIFFERENT speeds to create a complex,
     * mesmerizing tumble pattern:
     *   Y-axis at 2.0 rad/s — Primary spin (1 revolution per ~3.14 seconds).
     *   X-axis at 1.5 rad/s — Secondary tilt (adds 3D depth to the motion).
     *
     * Using different speeds on different axes prevents the rotation from
     * looking like simple spinning on one axis. The combination creates
     * the illusion of a weightless object floating in space. */
    this.gemMesh.rotation.y += timeDeltaInSeconds * 2.0;
    this.gemMesh.rotation.x += timeDeltaInSeconds * 1.5;


    /* --- BOBBING ANIMATION ---
     * Math.sin() produces a smooth oscillation between -1 and +1.
     *   Frequency: accumulatedRotationTime * 4 → 4 radians/sec = ~0.64 Hz (bobs per second).
     *   Amplitude: * 0.3 → the gem bobs ±0.3 units vertically.
     *
     * We set the Z position (not Y) because in our top-down game, Z points
     * toward the camera. Modifying Z creates visible vertical movement.
     * If we modified Y, the bobbing would look like horizontal sliding
     * (up/down in the gameplay plane, not toward/away from the camera). */
    this.gemMesh.position.z = Math.sin(this.accumulatedRotationTime * 4) * 0.3;


    /* --- PULSING ANIMATION ---
     * Scale oscillates between 0.85x and 1.15x (1.0 ± 0.15):
     *   Frequency: accumulatedRotationTime * 6 → ~0.95 Hz (pulses per second).
     *   This is intentionally a different frequency than the bobbing (4 vs 6)
     *   so the two animations don't sync up and create a monotonous pattern.
     *
     * scale.set(x, y, z) sets all three axes independently.
     * Using the same value for all three creates uniform scaling. */
    const pulseFactor = 1.0 + Math.sin(this.accumulatedRotationTime * 6) * 0.15;
    this.gemMesh.scale.set(pulseFactor, pulseFactor, pulseFactor);


    /* --- 2. TIMER BAR LOGIC ---
     * The foreground plane's X-scale represents the remaining lifespan
     * as a percentage (1.0 = full, 0.0 = empty/expired).
     *
     * Math.max(0, ...) prevents the scale from going negative, which would
     * flip the plane horizontally (mirror effect) if the timer slightly
     * overshoots zero due to deltaTime granularity.
     *
     * SCALE-BASED PROGRESS BAR TECHNIQUE:
     * Instead of resizing the geometry (expensive), we scale the mesh's
     * transform. This is a GPU-only operation — no geometry recalculation,
     * no buffer uploads, just changing one number in the transformation
     * matrix. Extremely efficient for animated UI elements. */
    const lifespanPercentageRemaining = Math.max(0, this.remainingLifespanDuration / this.maximumLifespanDuration);
    this.timerBarForeground.scale.x = lifespanPercentageRemaining;


    /* --- 3. EXPIRATION CHECK ---
     * When the timer reaches zero, the bonus self-destructs.
     * Game.js will detect isCurrentlyActiveAndValid === false and remove
     * it from the currentlyActiveBonuses array. */
    if (this.remainingLifespanDuration <= 0) {
      this.initiateSelfDestructionSequence();
    }
  }


  /* ==========================================================================
   * initiateSelfDestructionSequence() — CLEANUP
   * ==========================================================================
   * Removes the bonus from the 3D scene and marks it inactive.
   *
   * SCENE GRAPH CASCADING REMOVAL:
   * scene.remove(gemMesh) removes the gem AND all of its children:
   *   - The edges mesh (child of gemMesh)
   *   - The timer bar background (child of gemMesh)
   *   - The timer bar foreground (child of timerBarBackground)
   *
   * This is one of the key advantages of Three.js's hierarchical scene graph:
   * removing a parent automatically removes the entire subtree, preventing
   * orphaned objects from accumulating in the scene.
   * ========================================================================== */
  initiateSelfDestructionSequence() {
    this.isCurrentlyActiveAndValid = false;
    this.parentGameRenderingScene.remove(this.gemMesh);
  }
}
