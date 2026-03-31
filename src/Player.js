/* ============================================================================
 * Player.js — CONTROLLED PLAYER SPACECRAFT (The Pink UFO)
 * ============================================================================
 *
 * This module creates and manages the player's ship — a stylized Pink UFO
 * with a spinning saucer body, pulsing rim lights, a cockpit dome, and
 * a directional indicator cone.
 *
 * KEY THREE.JS CONCEPTS DEMONSTRATED:
 *
 *   1. HIERARCHICAL SCENE GRAPH (Groups):
 *      The UFO uses a Group as the root "heading container". All visual
 *      parts are children of this group. When the group rotates, ALL
 *      children rotate with it. This lets us separate "heading rotation"
 *      (controlled by the player) from "spin animation" (cosmetic).
 *
 *   2. PROCEDURAL GEOMETRY CREATION:
 *      The saucer body, cockpit dome, and rim lights are built entirely
 *      from Three.js primitives (SphereGeometry, ConeGeometry) without
 *      any external model files.
 *
 *   3. 3D MODEL LOADING (GLTFLoader):
 *      We also load an optional .glb model file. If it loads successfully,
 *      it replaces the procedural geometry. If it fails, the procedural
 *      fallback remains visible.
 *
 *   4. MATCAP MATERIALS:
 *      MeshMatcapMaterial uses a "material capture" texture — a pre-rendered
 *      sphere image that provides lighting/reflection without scene lights.
 *      This is an extremely performant alternative to PBR materials.
 *
 *   5. PHYSICS SIMULATION:
 *      Newtonian-style movement: thrust adds to velocity, velocity decays
 *      each frame (simulated drag), and position wraps at screen edges.
 * ============================================================================ */

import * as THREE from 'three';

/* GLTFLoader is NOT part of Three.js core — it lives in the 'examples' directory.
 * GLTF (GL Transmission Format) is the "JPEG of 3D" — a standardized, efficient
 * format for transmitting 3D scenes. .glb is the binary version of .gltf.
 *
 * WHY import from 'three/examples/jsm/...'?
 * Three.js ships "addon" utilities (loaders, controls, post-processing) in
 * the examples/jsm/ directory. Vite resolves this path from node_modules. */
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';


/**
 * This class represents the player-controlled spacecraft within our 3D environment.
 * It has been redesigned as a stylized Pink UFO with internal animations.
 */
export class ControlledPlayerSpacecraft {
  /**
   * Constructs the player spacecraft with physical properties and visual geometry.
   * @param {THREE.Scene} parentGameRenderingScene - The scene where the ship will be rendered.
   * @param {Object} gameplayAreaBoundaryLimits - The rectangular limits of the visible game world.
   *   Shape: { left: number, right: number, top: number, bottom: number }
   */
  constructor(parentGameRenderingScene, gameplayAreaBoundaryLimits) {
    this.parentGameRenderingScene = parentGameRenderingScene;
    this.gameplayAreaBoundaryLimits = gameplayAreaBoundaryLimits;

    /* =====================================================================
     * HIERARCHICAL STRUCTURE — THE "HEADING CONTAINER" PATTERN
     * =====================================================================
     *
     * THREE.Group is an empty container node in the scene graph.
     * It has position, rotation, and scale — but no visible geometry.
     *
     * We use a Group as the root node so we can:
     *   1. Rotate the ENTIRE ship by rotating just this one group (Z-axis).
     *   2. Move the ENTIRE ship by translating just this one group.
     *   3. Apply INDEPENDENT animations to children without affecting heading.
     *
     * HIERARCHY:
     *   spacecraftHeadingContainer (Group) — Controls heading & position
     *     ├─ spacecraftSpinningVisualsGroup (Group) — Spins on Y-axis
     *     │   ├─ Saucer Body (Mesh)
     *     │   ├─ Cockpit Dome (Mesh)
     *     │   ├─ Rim Lights (Mesh[])
     *     │   └─ GLB Model (if loaded)
     *     └─ spacecraftStaticDecorationsGroup (Group) — Does NOT spin
     *         └─ Directional Indicator Cone (Mesh)
     *
     * WHY TWO SUB-GROUPS?
     * The saucer body spins continuously (cosmetic animation), but the
     * directional indicator must stay fixed relative to the heading.
     * By putting them in separate groups, we can spin one group's Y-axis
     * without affecting the other.
     * ===================================================================== */
    this.spacecraftHeadingContainer = new THREE.Group();
    this.parentGameRenderingScene.add(this.spacecraftHeadingContainer);

    /* SPINNING VISUALS GROUP:
     * Contains the saucer body, cockpit, and lights that spin on the Y-axis.
     *
     * rotation.x = Math.PI / 4 (45 degrees):
     * This tilts the ENTIRE spinning group 45° forward (toward the camera).
     * Since our game plays on the X-Y plane and the camera looks straight down
     * the Z-axis, a flat saucer (parallel to X-Y) would appear as a thin line.
     * Tilting it 45° reveals the top surface, giving the UFO a recognizable
     * 3D saucer shape even from above. */
    this.spacecraftSpinningVisualsGroup = new THREE.Group();
    this.spacecraftSpinningVisualsGroup.rotation.x = Math.PI / 4;
    this.spacecraftHeadingContainer.add(this.spacecraftSpinningVisualsGroup);

    /* STATIC DECORATIONS GROUP:
     * Contains elements that should follow the ship's heading but NOT spin.
     * The same 45° tilt is applied for visual consistency with the spinning group. */
    this.spacecraftStaticDecorationsGroup = new THREE.Group();
    this.spacecraftStaticDecorationsGroup.rotation.x = Math.PI / 4;
    this.spacecraftHeadingContainer.add(this.spacecraftStaticDecorationsGroup);


    /* =====================================================================
     * 1. THE MAIN SAUCER BODY (Procedural Fallback)
     * =====================================================================
     * We create a sphere and squash it vertically to form a classic saucer shape.
     *
     * THREE.SphereGeometry(radius, widthSegments, heightSegments):
     *   radius: 2       — The sphere's radius in world units.
     *   widthSeg: 32    — Horizontal subdivisions (more = smoother equator).
     *   heightSeg: 16   — Vertical subdivisions (more = smoother poles).
     *
     * geometry.scale(1, 0.3, 1):
     * This scales the geometry's vertices PERMANENTLY (not a runtime transform).
     * Scaling Y to 0.3 flattens the sphere to 30% of its height, creating
     * a flying saucer / disc shape. This is different from mesh.scale.y = 0.3
     * which would also affect child objects and normals differently.
     * ===================================================================== */
    const saucerBodyGeometry = new THREE.SphereGeometry(2, 32, 16);
    saucerBodyGeometry.scale(1, 0.3, 1);

    /* MeshStandardMaterial — PHYSICALLY BASED RENDERING (PBR):
     * The "standard" material in Three.js implements a Metallic-Roughness
     * PBR workflow, which models how light interacts with surfaces in the
     * real world (or stylized versions of it).
     *
     * Properties explained:
     *   color (0xff00ff):         The base "albedo" color — Hot Pink/Magenta.
     *   emissive (0xaa00aa):      The color the material appears to emit on its own.
     *                             This is added ON TOP of reflected light, making
     *                             the surface glow even in darkness.
     *   emissiveIntensity (0.5):  Multiplier for the emissive color. 1.0 = full glow.
     *   roughness (0.2):          0 = perfectly smooth mirror, 1 = completely matte.
     *                             0.2 gives sharp specular highlights (reflections).
     *   metalness (0.8):          0 = dielectric (plastic, wood), 1 = pure metal.
     *                             0.8 makes the surface reflect its own color
     *                             rather than the light color, like chrome tinted pink. */
    const saucerMaterial = new THREE.MeshStandardMaterial({
      color: 0xff00ff,
      emissive: 0xaa00aa,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.8
    });

    /* Store a reference to the hull material so Game.js can change the color
     * (e.g., turning the ship red on death and back to pink on restart). */
    this.mainHullMaterial = saucerMaterial;

    /* THREE.Mesh = Geometry + Material.
     * A Mesh is the fundamental visible object in Three.js. The geometry
     * defines the SHAPE (vertex positions), and the material defines the
     * APPEARANCE (color, shading, texture). */
    const saucerMesh = new THREE.Mesh(saucerBodyGeometry, saucerMaterial);
    this.spacecraftSpinningVisualsGroup.add(saucerMesh);


    /* =====================================================================
     * 2. THE COCKPIT DOME
     * =====================================================================
     * A transparent cyan hemisphere sitting on top of the saucer body.
     *
     * SphereGeometry advanced parameters:
     * SphereGeometry(radius, wSeg, hSeg, phiStart, phiLength, thetaStart, thetaLength)
     *   phiStart/phiLength:   Horizontal sweep angle (0 to 2π for full circle).
     *   thetaStart/thetaLength: Vertical sweep angle (0=north pole, π=south pole).
     *
     * By using thetaStart=0 and thetaLength=Math.PI/2, we generate ONLY the
     * top hemisphere (from north pole to equator), creating a dome shape.
     * The full sphere would have thetaLength=Math.PI (0 to π).
     * ===================================================================== */
    const cockpitDomeGeometry = new THREE.SphereGeometry(0.8, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const cockpitMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffff,        // Cyan base color
      transparent: true,      // REQUIRED to enable opacity < 1.0. Without this flag,
                              // Three.js ignores the opacity value entirely.
      opacity: 0.6,           // 60% opaque = semi-transparent glass effect.
                              // Objects behind the cockpit will be partially visible.
      emissive: 0x008888,     // Dim cyan self-illumination
      emissiveIntensity: 0.2
    });
    const cockpitMesh = new THREE.Mesh(cockpitDomeGeometry, cockpitMaterial);
    cockpitMesh.position.y = 0.2;  // Offset upward so it sits on top of the flattened saucer
    this.spacecraftSpinningVisualsGroup.add(cockpitMesh);


    /* =====================================================================
     * 3. UFO RIM LIGHTS
     * =====================================================================
     * Eight small glowing spheres placed in a circle around the saucer's edge.
     *
     * CIRCULAR PLACEMENT MATH:
     * To place N objects in a circle of radius R, we use the parametric
     * equation of a circle:
     *   x = cos(angle) * R
     *   z = sin(angle) * R
     *   where angle = (i / N) * 2π
     *
     * At i=0: angle=0,    position=(R, 0)       — 3 o'clock
     * At i=2: angle=π/2,  position=(0, R)       — 12 o'clock
     * At i=4: angle=π,    position=(-R, 0)      — 9 o'clock
     * At i=6: angle=3π/2, position=(0, -R)      — 6 o'clock
     *
     * MeshBasicMaterial vs MeshStandardMaterial:
     * BasicMaterial is UNLIT — it always appears at full brightness regardless
     * of scene lighting. Perfect for glowing lights that should always be visible.
     * StandardMaterial would make the lights dim when facing away from the
     * directional light, which would look wrong for emissive light sources.
     * ===================================================================== */
    this.ufoRimLights = [];
    const lightQuantity = 8;
    const lightRadius = 1.8;    // Distance from saucer center to each light
    for (let i = 0; i < lightQuantity; i++) {
        const lightGeom = new THREE.SphereGeometry(0.15, 8, 8);  // Tiny sphere (8 segments is enough at this size)
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const lightMesh = new THREE.Mesh(lightGeom, lightMat);

        /* Calculate the angle for this specific light (evenly spaced around the circle). */
        const angle = (i / lightQuantity) * Math.PI * 2;
        /* Place the light at the calculated position.
         * Y=-0.1 pushes it slightly below the saucer's equator (the widest point). */
        lightMesh.position.set(Math.cos(angle) * lightRadius, -0.1, Math.sin(angle) * lightRadius);

        this.spacecraftSpinningVisualsGroup.add(lightMesh);
        this.ufoRimLights.push(lightMesh);     // Keep references for animation in performFrameUpdate()
    }


    /* =====================================================================
     * 4. THE DIRECTIONAL INDICATOR (Forward-Facing Cone)
     * =====================================================================
     * A semi-transparent yellow cone that shows the player which direction
     * the ship is facing. Essential because the saucer body is rotationally
     * symmetric — without this indicator, the player can't tell their heading.
     *
     * THREE.ConeGeometry(radius, height, radialSegments):
     *   radius: 0.5   — Base radius of the cone.
     *   height: 1.5   — Height from base to tip.
     *   segments: 3   — Only 3 radial segments = a triangular pyramid (not a smooth cone).
     *                   This creates a lo-fi, stylized arrow shape.
     *
     * ADDED TO STATIC GROUP:
     * The indicator is a child of spacecraftStaticDecorationsGroup, NOT the
     * spinning group. This means it rotates with the ship's heading but does
     * NOT spin when the saucer body spins — it always points "forward".
     * ===================================================================== */
    const indicatorVisualGeometry = new THREE.ConeGeometry(0.5, 1.5, 3);
    const indicatorVisualMaterial = new THREE.MeshStandardMaterial({
        color: 0xffff00,           // Bright yellow — high contrast against the pink/cyan scheme
        emissive: 0xffff00,        // Self-illuminating so it's visible from any angle
        emissiveIntensity: 1.5,    // Very bright glow (>1.0 is allowed, makes it bloom)
        transparent: true,
        opacity: 0.5               // Semi-transparent to avoid visual clutter
    });
    const primaryDirectionalIndicatorTriangle = new THREE.Mesh(indicatorVisualGeometry, indicatorVisualMaterial);

    /* Position the cone above and in front of the saucer.
     * y=1.8: Forward along the local Y-axis (the "up" direction in our game's 2D plane).
     * z=0.4: Slightly elevated to prevent clipping with the saucer body. */
    primaryDirectionalIndicatorTriangle.position.set(0, 1.8, 0.4);

    /* Rotate the cone backwards by 45° on the X-axis.
     * This compensates for the 45° lean applied to the static group,
     * making the cone appear upright relative to the gameplay plane. */
    primaryDirectionalIndicatorTriangle.rotation.x = -Math.PI / 4;

    this.spacecraftStaticDecorationsGroup.add(primaryDirectionalIndicatorTriangle);


    /* =====================================================================
     * 5. ASSET LOADING — GLB MODEL + MATCAP TEXTURE
     * =====================================================================
     * We attempt to load a higher-quality 3D model (ufo.glb) to replace
     * the procedural geometry. This is a common pattern:
     *   - Build procedural fallback geometry (instant, no loading).
     *   - Async load the real model in the background.
     *   - On success: hide procedural geometry, show loaded model.
     *   - On failure: keep the procedural geometry visible.
     * ===================================================================== */

    /* THREE.TextureLoader — Loads image files (JPEG, PNG, etc.) as GPU textures.
     * Textures are uploaded to the GPU as 2D sampler objects and referenced
     * by materials during rendering. */
    const textureLoader = new THREE.TextureLoader();

    /* GLTFLoader — Loads .gltf/.glb 3D model files.
     * GLTF files can contain meshes, materials, textures, animations,
     * and even entire scene hierarchies in a single file.
     * .glb is the binary version (all data in one file).
     * .gltf is the JSON version (may reference external .bin and image files). */
    const gltfLoader = new GLTFLoader();

    /* MATCAP (Material Capture) TEXTURE:
     * A matcap is a specially photographed/rendered image of a sphere that
     * captures both the material properties AND the lighting environment.
     * When applied to a mesh:
     *   1. For each pixel, the shader calculates the surface normal direction.
     *   2. It uses the normal to look up a color from the matcap image.
     *   3. The result looks like the object is lit by the same environment
     *      that was used to create the matcap image.
     *
     * PERFORMANCE ADVANTAGE:
     * Matcap rendering requires NO scene lights and NO environment maps.
     * It's a single texture lookup per pixel — extremely fast. This makes
     * it perfect for stylized games where "good enough" lighting beats
     * physically accurate but expensive PBR calculations.
     *
     * The 'color: 0xff00ff' tint multiplies the matcap color by pink,
     * ensuring the loaded model stays on-brand regardless of the matcap
     * image's original colors. */
    const matcapTexture = textureLoader.load('/ufo.jpg');
    const customUfoMaterial = new THREE.MeshMatcapMaterial({
      matcap: matcapTexture,
      color: 0xff00ff
    });

    /* GLTFLoader.load() is ASYNCHRONOUS.
     * Arguments: (url, onSuccess, onProgress, onError)
     *
     * The onSuccess callback receives a 'gltf' object containing:
     *   gltf.scene    — A THREE.Group containing all meshes in the model.
     *   gltf.animations — Array of AnimationClip objects (if the model has animations).
     *   gltf.cameras  — Array of cameras defined in the model.
     *   gltf.asset    — Metadata (version, generator, copyright).
     *
     * IMPORTANT: The model is NOT in the scene yet after loading.
     * We must explicitly add gltf.scene (or its children) to our scene graph. */
    gltfLoader.load('/ufo.glb', (gltf) => {
      const model = gltf.scene;

      /* model.traverse() walks through EVERY node in the model's hierarchy
       * (including the root, all children, grandchildren, etc.).
       * We use it to replace all materials with our custom matcap material.
       *
       * child.isMesh is a Three.js type-check flag. The hierarchy may contain
       * Groups, Bones, Lights, and Meshes — we only want to modify Meshes. */
      model.traverse((child) => {
        if (child.isMesh) {
          child.material = customUfoMaterial;
        }
      });

      /* AUTO-SCALING TECHNIQUE:
       * 3D models come in varying unit scales (some in meters, some in
       * centimeters, some in arbitrary units). Instead of guessing the
       * right scale factor, we:
       *
       * 1. Compute the model's BOUNDING BOX using Box3.setFromObject().
       *    This analyzes all vertices in all child meshes to find the
       *    minimum and maximum coordinates on each axis.
       *
       * 2. Get the SIZE of the bounding box (max - min on each axis).
       *
       * 3. Find the LARGEST dimension (so the model fits within our target
       *    regardless of its proportions).
       *
       * 4. Calculate scaleFactor = targetSize / largestDimension.
       *    This ensures the model's largest dimension equals exactly 4.0 units
       *    (matching the procedural saucer's diameter).
       *
       * model.scale.setScalar(factor) applies the same scale to X, Y, and Z,
       * preserving the model's proportions (no stretching). */
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scaleFactor = 4.0 / maxDim;
      model.scale.setScalar(scaleFactor);

      /* Reset the model's X rotation to 0.
       * Some GLB exporters bake a rotation into the model to convert between
       * coordinate systems (e.g., Blender uses Z-up, Three.js uses Y-up).
       * We clear this to let our parent group's rotation handle orientation. */
      model.rotation.x = 0;

      this.spacecraftSpinningVisualsGroup.add(model);

      /* Hide the procedural fallback geometry now that the real model is loaded.
       * We set .visible = false instead of removing them from the scene because
       * removal would require null-checks elsewhere in the code. */
      saucerMesh.visible = false;
      cockpitMesh.visible = false;
      this.ufoRimLights.forEach(l => l.visible = false);

    }, undefined, (error) => {
      /* If the model fails to load (404, network error, corrupted file),
       * we log the error but the game continues with procedural geometry.
       * This is the graceful degradation pattern. */
      console.error('Error loading UFO model:', error);
    });


    /* =====================================================================
     * 6. PHYSICS PROPERTIES
     * =====================================================================
     * These values control how the ship moves through space.
     * The game uses a simplified Newtonian physics model:
     *   - Thrust adds to velocity (F = ma, simplified to v += thrust * dt).
     *   - Velocity decays each frame (simulated drag / friction).
     *   - Position wraps at screen edges (toroidal topology).
     * ===================================================================== */

    /* The current velocity vector. Updated by thrust and decayed each frame.
     * Starts at (0,0,0) = stationary. */
    this.currentLinearVelocityVector = new THREE.Vector3(0, 0, 0);

    /* Angular rotation speed in RADIANS PER SECOND.
     * 4.5 rad/s ≈ 258°/s, meaning a full 360° rotation takes ~1.4 seconds. */
    this.angularRotationSpeedPerSecond = 4.5;

    /* Thrust power multiplier. When the player holds 'W', velocity increases by
     * (forwardDirection * 38.0 * deltaTime) per frame. Higher = snappier acceleration. */
    this.proportionalThrustForcePower = 38.0;

    /* Momentum decay coefficient (0 to 1). Applied exponentially each frame.
     * 0.98 means the ship retains 98% of its velocity per frame at 60fps.
     * After 1 second (60 frames): velocity * 0.98^60 ≈ velocity * 0.30
     * So the ship loses ~70% of its speed per second when not thrusting. */
    this.momentumDecayCoefficient = 0.98;

    /* The collision radius for hit detection. Other entities (asteroids, bonuses)
     * check distance to this ship and trigger collision if the distance is less
     * than the sum of both entities' collision radii. */
    this.physicalCollisionRadius = 2.0;


    /* =====================================================================
     * 7. ANIMATION STATE
     * =====================================================================
     * totalRunningTime accumulates real time (in seconds) since the ship
     * was created. Used as input to Math.sin() for bobbing and pulsing
     * animations, creating continuous oscillation effects.
     * ===================================================================== */
    this.totalRunningTime = 0;
  }


  /* ==========================================================================
   * performFrameUpdate() — PLAYER SHIP UPDATE TICK
   * ==========================================================================
   * Called once per frame from Game.js. Handles:
   *   1. Input → Rotation (turning the ship)
   *   2. Input → Thrust (accelerating)
   *   3. Cosmetic animations (spin, bob, light pulse)
   *   4. Physics (decay, position update)
   *   5. Screen wrapping
   *
   * @param {number} timeDeltaInSeconds - Time since previous frame.
   * @param {KeyboardInputStateTracker} playerInputTracker - The input state manager.
   * ========================================================================== */
  performFrameUpdate(timeDeltaInSeconds, playerInputTracker) {
    /* Accumulate total time for animation calculations. */
    this.totalRunningTime += timeDeltaInSeconds;


    /* --- 1. INPUT HANDLING: ROTATION ---
     * Directly modifying the Z-rotation of the heading container.
     *
     * WHY Z-AXIS?
     * In our top-down 2D game, the play area is the X-Y plane.
     * Rotation around the Z-axis (perpendicular to X-Y) is what creates
     * the 2D turning motion. Think of Z as pointing straight up out of
     * your screen.
     *
     * Positive Z rotation = counter-clockwise (left turn).
     * Negative Z rotation = clockwise (right turn).
     *
     * We multiply by timeDeltaInSeconds to make rotation speed consistent
     * regardless of frame rate (see delta time explanation in main.js). */
    if (playerInputTracker.verifyIfSpecificKeyIsCurrentlyPressed('ArrowLeft') ||
        playerInputTracker.verifyIfSpecificKeyIsCurrentlyPressed('KeyA')) {
      this.spacecraftHeadingContainer.rotation.z += this.angularRotationSpeedPerSecond * timeDeltaInSeconds;
    }
    if (playerInputTracker.verifyIfSpecificKeyIsCurrentlyPressed('ArrowRight') ||
        playerInputTracker.verifyIfSpecificKeyIsCurrentlyPressed('KeyD')) {
      this.spacecraftHeadingContainer.rotation.z -= this.angularRotationSpeedPerSecond * timeDeltaInSeconds;
    }


    /* --- 2. INPUT HANDLING: THRUST ---
     * We calculate a FORWARD DIRECTION vector based on the current heading,
     * then add it to the velocity to accelerate the ship in that direction.
     *
     * MATH BREAKDOWN:
     *   1. Start with (0, 1, 0) — "up" in local space = "forward" for the ship.
     *   2. applyAxisAngle(Z-axis, currentRotation) rotates this vector by the
     *      ship's current heading angle. This converts the local "forward"
     *      into a world-space direction.
     *   3. Multiply by thrust power and deltaTime for frame-rate independence.
     *   4. Add to velocity (NOT set velocity). This creates MOMENTUM —
     *      the ship keeps moving even after you release thrust.
     *
     * applyAxisAngle(axis, angle) uses the Rodrigues' rotation formula
     * internally to rotate a 3D vector around an arbitrary axis. */
    if (playerInputTracker.verifyIfSpecificKeyIsCurrentlyPressed('ArrowUp') ||
        playerInputTracker.verifyIfSpecificKeyIsCurrentlyPressed('KeyW')) {

      const forwardDirectionVector = new THREE.Vector3(0, 1, 0);
      forwardDirectionVector.applyAxisAngle(
        new THREE.Vector3(0, 0, 1),  // Rotation axis (Z)
        this.spacecraftHeadingContainer.rotation.z   // Current heading angle
      );
      /* multiplyScalar() scales the direction vector by the thrust magnitude.
       * .add() then adds this thrust impulse to the current velocity. */
      this.currentLinearVelocityVector.add(
        forwardDirectionVector.multiplyScalar(this.proportionalThrustForcePower * timeDeltaInSeconds)
      );
    }


    /* --- 3. COSMETIC ANIMATIONS ---
     * These animations are purely visual and don't affect gameplay physics. */

    /* SAUCER SPIN:
     * Rotates the spinning visuals group around its LOCAL Y-axis.
     * Since the group is tilted 45° on X, this creates a visible spinning
     * saucer effect when viewed from above. Speed: 2.0 rad/s ≈ 1 revolution
     * every π seconds (~3.14 seconds). */
    this.spacecraftSpinningVisualsGroup.rotation.y += timeDeltaInSeconds * 2.0;

    /* HOVER BOBBING:
     * Math.sin() creates a smooth oscillation: output ranges from -1 to +1.
     *   totalRunningTime * 3.0 = oscillation frequency (3 radians per second).
     *   * 0.5 = amplitude (bobs ±0.5 units up and down).
     *
     * We apply this to BOTH groups (spinning and static) so all parts of the
     * ship bob together. The Z-axis is used because the groups are tilted,
     * making Z appear as "vertical" to the viewer. */
    const bobValue = Math.sin(this.totalRunningTime * 3.0) * 0.5;
    this.spacecraftSpinningVisualsGroup.position.z = bobValue;
    this.spacecraftStaticDecorationsGroup.position.z = bobValue;

    /* RIM LIGHT PULSING:
     * Each light's color and scale oscillate based on a Sine wave.
     * The 'index' offset in the sine function creates a PHASE DIFFERENCE
     * between lights, so they don't all pulse simultaneously — instead,
     * the pulse appears to "chase" around the saucer rim.
     *
     * color.setHSL(hue, saturation, lightness):
     *   hue=0.8 — Purple-pink range in the HSL color wheel (0=red, 0.33=green, 0.67=blue).
     *   saturation=1 — Fully saturated (vivid color, not grey).
     *   lightness=0.5+pulse*0.5 — Oscillates between 0.5 (normal) and 1.0 (white-bright).
     *
     * scale.setScalar() uniformly scales the mesh. Oscillating between 0.8x
     * and 1.2x makes the lights visually "breathe". */
    this.ufoRimLights.forEach((light, index) => {
        const pulse = Math.sin(this.totalRunningTime * 10 + index) * 0.5 + 0.5;
        light.material.color.setHSL(0.8, 1, 0.5 + pulse * 0.5);
        light.scale.setScalar(0.8 + pulse * 0.4);
    });


    /* --- 4. PHYSICS UPDATES --- */

    /* MOMENTUM DECAY (Simulated Drag):
     * multiplyScalar() scales the velocity vector's magnitude.
     *
     * WHY Math.pow(coefficient, deltaTime * 60)?
     * If we just multiplied by 0.98 each frame, the decay rate would depend
     * on frame rate (at 30fps: 0.98^30 per second, at 60fps: 0.98^60 per second).
     * By raising to the power of (deltaTime * 60), we normalize to a consistent
     * decay rate regardless of frame rate.
     *
     * At 60fps: deltaTime ≈ 0.0167, exponent = 0.0167 * 60 = 1.0 → 0.98^1.0
     * At 30fps: deltaTime ≈ 0.0333, exponent = 0.0333 * 60 = 2.0 → 0.98^2.0
     * Both produce the same velocity reduction per second (~0.98^60 ≈ 0.30). */
    this.currentLinearVelocityVector.multiplyScalar(
      Math.pow(this.momentumDecayCoefficient, timeDeltaInSeconds * 60)
    );

    /* POSITION UPDATE:
     * position.addScaledVector(velocity, deltaTime) is equivalent to:
     *   position += velocity * deltaTime
     * This is Euler integration — the simplest (and fastest) numerical integration
     * method. For our arcade game, it's accurate enough. More complex simulations
     * might use Verlet or Runge-Kutta integration for better accuracy. */
    this.spacecraftHeadingContainer.position.addScaledVector(
      this.currentLinearVelocityVector,
      timeDeltaInSeconds
    );


    /* --- 5. SCREEN WRAPPING ---
     * When the ship crosses a boundary, it teleports to the opposite edge.
     * This creates the classic "Asteroids" infinite-play-field feeling
     * (technically a toroidal topology — the left edge connects to the right,
     * the top connects to the bottom).
     *
     * We use a 'buffer' equal to the collision radius so the ship fully
     * disappears before reappearing on the other side, preventing the jarring
     * visual of half the ship suddenly popping to the opposite edge. */
    const limits = this.gameplayAreaBoundaryLimits;
    const pos = this.spacecraftHeadingContainer.position;
    const buffer = this.physicalCollisionRadius;

    if (pos.x > limits.right + buffer) pos.x = limits.left - buffer;
    else if (pos.x < limits.left - buffer) pos.x = limits.right + buffer;

    if (pos.y > limits.top + buffer) pos.y = limits.bottom - buffer;
    else if (pos.y < limits.bottom - buffer) pos.y = limits.top + buffer;
  }


  /* ==========================================================================
   * PROPERTY ACCESSORS
   * ==========================================================================
   * These getters provide a clean API for external systems (like Game.js's
   * collision detection) to access the ship's position and rendering objects
   * without knowing the internal hierarchy structure.
   *
   * 'get' keyword defines a JavaScript getter — accessed like a property
   * (ship.spacecraftRenderingMesh) rather than a method call (ship.getMesh()).
   * ========================================================================== */

  /** Returns the heading container, which is used for position/collision checks. */
  get spacecraftRenderingMesh() {
    return this.spacecraftHeadingContainer;
  }

  /** Returns the spinning visuals group (used internally for animation control). */
  get spacecraftRenderingGroup() {
      return this.spacecraftSpinningVisualsGroup;
  }
}
