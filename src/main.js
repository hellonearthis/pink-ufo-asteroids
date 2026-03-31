/* ============================================================================
 * main.js — APPLICATION ENTRY POINT
 * ============================================================================
 *
 * This is the first JavaScript file that runs when the game starts.
 * It has three responsibilities:
 *
 *   1. SET UP THE THREE.JS RENDERING PIPELINE (Scene, Camera, Renderer, Lights)
 *   2. INSTANTIATE THE GAME ENGINE (which manages all gameplay logic)
 *   3. RUN THE MAIN ANIMATION LOOP (the heartbeat of any real-time application)
 *
 * WHAT IS THREE.JS?
 * Three.js is a JavaScript library that wraps the low-level WebGL API,
 * providing high-level abstractions like Scenes, Cameras, Meshes, Materials,
 * and Lights. Without Three.js, rendering a single textured triangle in
 * WebGL requires ~100+ lines of shader code. Three.js lets us do it in ~5.
 *
 * MODULE SYSTEM:
 * We use ES Module imports (import/export), which Vite processes to enable:
 *   - Tree-shaking: Only the parts of Three.js we actually use get bundled.
 *   - Hot Module Replacement (HMR): Edits refresh instantly during development.
 *   - Code splitting: Production builds can be split into optimized chunks.
 * ============================================================================ */

import * as THREE from "three";
import { PrimaryGameLogicController } from "./Game.js";

/* ==========================================================================
 * STEP 1: SCENE SETUP
 * ==========================================================================
 *
 * A THREE.Scene is the top-level container in the Three.js scene graph.
 * Think of it like the "world" — every object (meshes, lights, cameras)
 * must be added to the scene to be rendered.
 *
 * The scene graph is a hierarchical tree structure:
 *   Scene
 *     ├─ AmbientLight
 *     ├─ DirectionalLight
 *     ├─ Player (Group)
 *     │   ├─ UFO Body (Mesh)
 *     │   ├─ Cockpit (Mesh)
 *     │   └─ Lights (Mesh[])
 *     ├─ Asteroid[] (Mesh)
 *     ├─ Bullet[] (Mesh)
 *     └─ Bonus[] (Mesh)
 *
 * Objects added as children of other objects inherit their parent's
 * transformations (position, rotation, scale). This is how the UFO's
 * body parts move together when the player ship moves.
 * ========================================================================== */
const primaryRenderingScene = new THREE.Scene();

/* SET BACKGROUND COLOR:
 * THREE.Color accepts hex integers (0x050510), CSS strings ('#050510'),
 * or RGB floats. Here we use a very dark blue-purple to simulate the
 * depths of outer space. Pure black (0x000000) would make dark objects
 * invisible, so this slight tint preserves silhouette visibility. */
primaryRenderingScene.background = new THREE.Color(0x050510);

/* ==========================================================================
 * STEP 2: CAMERA CONFIGURATION
 * ==========================================================================
 *
 * THREE.PerspectiveCamera simulates how human eyes (and real cameras) see
 * the world: objects farther away appear smaller (perspective projection).
 *
 * Constructor arguments:
 *   fov (75)  — Field of View in DEGREES (vertical). 75° is a wide-angle
 *               view that shows a large portion of the game world. Lower
 *               values (e.g., 30°) would create a telephoto/zoomed effect.
 *               Higher values (e.g., 120°) would add fish-eye distortion.
 *
 *   aspect    — The width-to-height ratio of the rendering viewport.
 *               Must match the actual canvas dimensions to prevent stretching.
 *               We recalculate this on window resize.
 *
 *   near (0.1) — The NEAR clipping plane distance. Objects closer than 0.1
 *                 units to the camera will not be rendered. Setting this too
 *                 low (e.g., 0.001) causes "z-fighting" (flickering) on
 *                 distant surfaces due to depth buffer precision loss.
 *
 *   far (1000) — The FAR clipping plane distance. Objects beyond 1000 units
 *                 will not be rendered. This saves GPU performance by not
 *                 processing geometry that's too far away to see.
 *
 * COORDINATE SYSTEM:
 * Three.js uses a right-handed coordinate system by default:
 *   X-axis: Right (+) / Left (-)
 *   Y-axis: Up (+) / Down (-)
 *   Z-axis: Towards viewer (+) / Away from viewer (-)
 *
 * Our game plays on the X-Y plane (like a 2D game), with the camera
 * positioned high on the Z-axis looking down at (0, 0, 0).
 * ========================================================================== */
const primaryPerspectiveCamera = new THREE.PerspectiveCamera(
  75, // FOV in degrees
  window.innerWidth / window.innerHeight, // Aspect ratio
  0.1, // Near clipping plane
  1000, // Far clipping plane
);

/* Position the camera 60 units along the positive Z-axis.
 * Since the camera looks toward -Z by default (towards the origin),
 * this gives us a top-down view of the X-Y gameplay plane.
 * The Z distance directly affects how much of the play area is visible —
 * moving the camera further back (higher Z) shows more of the world. */
primaryPerspectiveCamera.position.z = 60;

/* ==========================================================================
 * STEP 3: RENDERER INITIALIZATION
 * ==========================================================================
 *
 * THREE.WebGLRenderer is the engine that actually draws pixels to the screen.
 * It takes the Scene and Camera and produces a 2D image using the GPU via
 * the WebGL API (a browser-native wrapper around OpenGL ES).
 *
 * WHAT HAPPENS ON EACH RENDER CALL:
 *   1. The renderer traverses the scene graph to find all visible objects.
 *   2. For each object, it computes the final screen position using the
 *      camera's projection matrix and the object's world transform matrix.
 *   3. It sends geometry data (vertices) and material data (shaders, textures)
 *      to the GPU.
 *   4. The GPU rasterizes triangles into pixels and writes them to the canvas.
 *
 * OPTIONS:
 *   antialias: true — Enables Multi-Sample Anti-Aliasing (MSAA), which
 *   smooths the jagged staircasing effect on diagonal edges. This costs
 *   ~10-20% GPU performance but dramatically improves visual quality.
 *   For a game with visible polygon edges (like our low-poly asteroids),
 *   this is essential.
 * ========================================================================== */
const primaryWebGLGraphicsRenderer = new THREE.WebGLRenderer({
  antialias: true,
});

/* Set the renderer's output resolution to match the browser window.
 * This creates a <canvas> element internally with these pixel dimensions.
 * NOTE: On high-DPI displays (Retina), you might also call
 * renderer.setPixelRatio(window.devicePixelRatio) to render at native
 * resolution, but this quadruples the pixel count (2x width × 2x height)
 * and can significantly impact performance on mobile devices. */
primaryWebGLGraphicsRenderer.setSize(window.innerWidth, window.innerHeight);

/* MOUNT THE CANVAS TO THE DOM:
 * renderer.domElement is the actual <canvas> HTML element that Three.js
 * created internally. We append it to our <div id="app"> in index.html.
 * This is how the 3D world becomes visible on the page.
 *
 * WHY <div id="app"> and not <body>?
 * Keeping the canvas inside a dedicated container makes it easier to
 * manage the DOM hierarchy — our HTML overlays (splash screen, HUD)
 * are siblings of this div, not children of the canvas. */
document
  .getElementById("app")
  .appendChild(primaryWebGLGraphicsRenderer.domElement);

/* ==========================================================================
 * STEP 4: LIGHTING SETUP
 * ==========================================================================
 *
 * Without lights, a Three.js scene with MeshStandardMaterial objects would
 * render completely BLACK (since standard materials require light to reflect).
 * Only MeshBasicMaterial (unlit) and emissive properties work without lights.
 *
 * We use two complementary light types:
 *
 * 1. AMBIENT LIGHT (THREE.AmbientLight)
 *    Illuminates ALL objects equally from ALL directions with the same intensity.
 *    No shadows, no directionality. Think of it as "the minimum brightness level"
 *    — it prevents any part of any object from being in total darkness.
 *    Arguments: (color: 0x404040 [dim grey], intensity: 2)
 *
 * 2. DIRECTIONAL LIGHT (THREE.DirectionalLight)
 *    Simulates an infinitely distant light source (like the Sun). All light
 *    rays are parallel, creating consistent shadow angles across the scene.
 *    The position (10, 20, 30) defines the DIRECTION the light comes FROM
 *    (not where the light "is"), since directional lights have no falloff.
 *    This creates highlights on surfaces facing upper-right and shadows on
 *    surfaces facing lower-left.
 *    Arguments: (color: 0xffffff [pure white], intensity: 1.5)
 *
 * The combination of dim ambient + bright directional creates the classic
 * "space lit by a single star" look: bright highlights plus deep shadows.
 * ========================================================================== */
const generalAmbientIllumination = new THREE.AmbientLight(0x404040, 2);
primaryRenderingScene.add(generalAmbientIllumination);

const directionalSolarLightSource = new THREE.DirectionalLight(0xffffff, 1.5);
directionalSolarLightSource.position.set(10, 20, 30);
primaryRenderingScene.add(directionalSolarLightSource);

/* ==========================================================================
 * STEP 5: RESPONSIVE VIEWPORT HANDLING
 * ==========================================================================
 *
 * When the browser window is resized, we must update TWO things:
 *
 * 1. CAMERA ASPECT RATIO:
 *    If the aspect ratio changes (e.g., window goes from 16:9 to 4:3)
 *    but the camera isn't updated, the scene would appear stretched or
 *    squished. updateProjectionMatrix() recomputes the internal 4x4
 *    projection matrix that converts 3D coordinates to 2D screen coordinates.
 *
 * 2. RENDERER SIZE:
 *    The canvas must be resized to match the new window dimensions,
 *    otherwise it would either clip (too small) or leave blank space
 *    (too large). setSize() updates both the canvas CSS dimensions
 *    AND the WebGL viewport.
 * ========================================================================== */
window.addEventListener("resize", () => {
  primaryPerspectiveCamera.aspect = window.innerWidth / window.innerHeight;
  primaryPerspectiveCamera.updateProjectionMatrix();
  primaryWebGLGraphicsRenderer.setSize(window.innerWidth, window.innerHeight);
});

/* ==========================================================================
 * STEP 6: GAME ENGINE INITIALIZATION
 * ==========================================================================
 *
 * The PrimaryGameLogicController (defined in Game.js) is the central brain
 * of the game. We pass it references to the scene and camera so it can:
 *   - Add/remove 3D objects (asteroids, bullets, bonuses) to/from the scene.
 *   - Calculate the visible play area based on the camera's FOV and position.
 *
 * The constructor handles:
 *   - Creating the player's spacecraft
 *   - Setting up keyboard input tracking
 *   - Initializing weapon parameters and score tracking
 *   - Binding UI event listeners (buttons, sliders)
 *   - Setting up the Balance/Debug UI panel
 * ========================================================================== */
const activeGameLogicEngine = new PrimaryGameLogicController(
  primaryRenderingScene,
  primaryPerspectiveCamera,
);

/* ==========================================================================
 * STEP 7: HIGH-PRECISION GAME CLOCK
 * ==========================================================================
 *
 * THREE.Clock is a utility class that uses performance.now() internally
 * to measure elapsed time with sub-millisecond precision.
 *
 * WHY NOT Date.now()?
 * Date.now() returns millisecond-precision timestamps from the system clock,
 * which can jump backwards during NTP synchronization or daylight saving
 * transitions. performance.now() returns a monotonically increasing
 * high-resolution timestamp measured from page navigation start, making it
 * immune to system clock changes and providing microsecond precision.
 *
 * getDelta() returns the time in SECONDS since the last getDelta() call.
 * On a 60fps display, this is approximately 0.01667 seconds (~16.67ms).
 * ========================================================================== */
const highPrecisionGameTimingClock = new THREE.Clock();

/* ==========================================================================
 * STEP 8: THE MAIN ANIMATION LOOP
 * ==========================================================================
 *
 * This is the heartbeat of the entire application. It runs continuously
 * for the lifetime of the page, typically at 60 iterations per second
 * (matching the display's refresh rate).
 *
 * THE GAME LOOP PATTERN:
 * Every interactive real-time application follows this fundamental pattern:
 *   1. PROCESS INPUT   (handled inside Game.js update)
 *   2. UPDATE STATE    (physics, collision, animation)
 *   3. RENDER FRAME    (draw the current state to the screen)
 *   4. REPEAT
 *
 * requestAnimationFrame() vs setInterval():
 *   - requestAnimationFrame() is synchronized with the display's refresh rate
 *     (V-Sync), preventing screen tearing and wasted GPU work.
 *   - It automatically pauses when the browser tab is hidden, saving CPU/GPU.
 *   - It provides a high-resolution timestamp argument (though we use Clock).
 *   - setInterval() runs on a fixed timer regardless of display refresh rate,
 *     can cause tearing, and doesn't pause when the tab is backgrounded.
 *
 * DELTA TIME:
 * We pass the elapsed time (timeDeltaInSeconds) to the game engine so that
 * all movement is FRAME-RATE INDEPENDENT. Without delta time, a player on
 * a 144Hz monitor would move 2.4x faster than a player on a 60Hz monitor.
 * By multiplying velocity by delta time, movement speed becomes consistent:
 *   position += velocity * deltaTime
 *   At 60fps:  position += 10 * 0.01667 = 0.1667 units/frame
 *   At 144fps: position += 10 * 0.00694 = 0.0694 units/frame
 *   Both result in 10 units per second of real time.
 * ========================================================================== */
function primaryExecutionAnimationLoop() {
  /* Schedule the next iteration of this function.
   * requestAnimationFrame() is a browser API that calls the provided callback
   * right before the next screen repaint (~16.67ms at 60Hz).
   * We call it at the TOP of the function so that even if the game logic
   * or rendering throws an error, the next frame will still be scheduled. */
  requestAnimationFrame(primaryExecutionAnimationLoop);

  /* Get the time elapsed since the last frame in SECONDS.
   * First call returns ~0 (or a very small value).
   * Subsequent calls return the actual frame interval. */
  const timeElapsedInSecondsSinceLastFrame =
    highPrecisionGameTimingClock.getDelta();

  /* GAME LOGIC UPDATE:
   * This single call cascades through the entire game engine:
   *   → Player input processing (rotation, thrust, shooting)
   *   → Entity updates (asteroids, bullets, bonuses movement/animation)
   *   → Collision detection (bullet↔asteroid, player↔asteroid, player↔bonus)
   *   → Game state transitions (score updates, game-over, wave spawning) */
  activeGameLogicEngine.processGameLogicFrameUpdate(
    timeElapsedInSecondsSinceLastFrame,
  );

  /* RENDER THE FRAME:
   * renderer.render(scene, camera) is the final step that produces pixels.
   * It traverses the entire scene graph, culls invisible objects, sorts
   * transparent objects back-to-front, and issues GPU draw calls.
   * The result is written to the <canvas> element in the DOM. */
  primaryWebGLGraphicsRenderer.render(
    primaryRenderingScene,
    primaryPerspectiveCamera,
  );
}

/* BOOTSTRAP: Start the loop for the first time.
 * This single call starts the perpetual cycle of
 * requestAnimationFrame → update → render → requestAnimationFrame → ... */
primaryExecutionAnimationLoop();

/* ==========================================================================
 * STEP 9: MOUSE CURSOR AUTO-HIDE LOGIC
 * ==========================================================================
 * To improve immersion, the mouse cursor is hidden when not in use.
 * Logic:
 *   1. Move mouse → Show cursor immediately, reset 1.5s timer.
 *   2. No movement for 1.5s → Hide cursor (unless Tuning Console is open).
 *   3. Tuning Console open → Always show cursor.
 * ========================================================================== */
let mouseVisibilityTimeoutId;

function showMouseCursorAndResetHideTimer() {
  /* Show the physical cursor by restoring the CSS default. */
  document.body.style.cursor = "default";

  /* Clear the previous timeout to avoid hiding while moving. */
  clearTimeout(mouseVisibilityTimeoutId);

  /* Set a new timeout to hide the cursor after 1500ms of inactivity. */
  mouseVisibilityTimeoutId = setTimeout(() => {
    /* GUARD: Never hide the cursor if the developer Tuning Console is active,
     * as the user needs the pointer to interact with sliders and buttons. */
    if (
      activeGameLogicEngine.balanceTuningUI &&
      !activeGameLogicEngine.balanceTuningUI.isActive
    ) {
      document.body.style.cursor = "none";
    }
  }, 1500);
}

/* Register the mousemove listener globally. */
window.addEventListener("mousemove", showMouseCursorAndResetHideTimer);

/* Initial trigger: Show cursor on load, then hide after 1.5s. */
showMouseCursorAndResetHideTimer();
