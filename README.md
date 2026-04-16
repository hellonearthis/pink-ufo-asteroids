# Asteroids 3D: Pink UFO Edition

A stylized, three.js-powered remake of the classic Asteroids game, featuring a procedurally animated Pink UFO and "tutorial-style" source code designed for learning 3D game development.

## 🎮 How to Play

- **Move & Rotate**: Use the **WASD** keys or **Arrow Keys**.
- **Shoot**: Press the **Spacebar** to fire yellow energy pulses.
- **In-Game Music**: Press **[M]** to cycle tracks, **[N]** to toggle, and **[-/+]** for volume.
- **Tactical Mix Deck & Sequencer**: Press **[SHIFT + M]** on the splash screen to open the soundboard and 8x8 step sequencer.
- **Tactical Tuning**: Press **[T]** to open the real-time balance console.
- **Restart**: Press the **R** key on the "Game Over" screen to try again.

Your goal is to clear the screen of hazardous drifting asteroids. Be careful—larger asteroids split into two smaller, faster ones when hit!

## 🚀 Getting Started

### Quick Start (Windows)

Simply double-click the **`start.bat`** file in the project folder. This will:

1. Install all necessary dependencies (Node.js required).
2. Start a local development server.
3. Open the game in your default browser.

### Manual Setup

If you prefer the command line:

1. Ensure you have [Node.js](https://nodejs.org/) installed.
2. Open a terminal in the project directory.
3. Run `npm install` to download dependencies.
4. Run `npm run dev` to start the game server.

## 🛠 Features

- **Tactical Mix Deck (Advanced Sampler)**: A premium 3-part virtual studio console (press `Shift + M`).
    - **Left Column: Dynamic FX Remap**: A live matrix for reassigning in-game sound effects (Shot Fired, Asteroid Hit, etc.). Supports multi-sample pooling and **Custom Sequence Assignment**.
    - **Center Column: Sampler Deck**: A 33-slot physical-style keyboard board for live triggering and loop toggling (`Shift + Key`).
    - **Right Column: 8x8 Pulse Sequencer**: A rhythmic engine powered by Tone.js with velocity sensitivity, per-row sample remapping, and dedicated mute controls.
- **Dynamic FX Design**: Create a rhythm in the sequencer and assign it directly to a gameplay event. Want your "Shot Fired" to be a custom 8-step rhythmic burst? Just click **ASSIGN SEQ TO FX**.
- **Adaptive Music System**: Integrated soundtrack management (press `M`/`N`) with real-time HUD notifications and fade-out effects.
- **Optimized Audio Engine**: High-performance audio sprite system using Howler.js with 64 managed instances, instance pooling, and dynamic loop control.
- **Tactical Tuning Console**: A real-time balance menu (press `T`) that allows you to live-adjust shot speed, fire rate, and capacity while playing.
- **Weapon Progression System**: Collect color-coded hexagonal gems to upgrade your spacecraft (Capacity, Rate, Velocity, Range).
- **Animated UFO**: Features a spinning saucer body, a hovering "bob" animation, and a pulsing sequence of rim lights.
- **Dynamic Visual Style**: High-contrast "gemstone" pickups and projectiles with pulsing energy outlines.
- **Realistic Momentum**: Projectiles inherit the ship's linear velocity for a more tactical flight feel.
- **Educational Source Code**: Extremely verbose variable names and comprehensive 'Deep-Dive' comments explaining core logic.

## 📁 Project Structure

- `index.html`: The single HTML entry point defining all UI layers (splash screen, HUD, debug panel).
- `src/style.css`: Complete stylesheet with glassmorphism, gradient text, animations, and font integration.
- `src/main.js`: Initialization of the Three.js scene, lighting, and core animation loop.
- `src/Game.js`: The primary controller managing wave spawning, collision logic, and the weapon upgrade system.
- `src/Player.js`: The animated UFO spacecraft implementation and hierarchical group management.
- `src/Asteroid.js`: Procedurally deformed space rock logic and vertex-normal calculation.
- `src/Bullet.js`: Projectile physics, momentum inheritance, and dynamic color cycling.
- `src/SoundManager.js`: Centralized audio controller using an optimized MP3 sprite system and adaptive music management.
- `src/InputManager.js`: Polling-based keyboard input state tracker.
- `src/Sequencer.js`: The Tone.js-powered 8x8 step sequencer engine with advanced remapping and mute logic.
- `sound_readme.md`: Technical reference for all 33 sound sprites and their specific timings.

## 📖 Code Tutorial Guide

Every source file is heavily commented as a tutorial-level walkthrough. Here's a summary of the key concepts explained in each file:

| File                | Key Topics Explained                                                                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **index.html**      | Document structure, Google Fonts loading strategy, `preconnect` optimization, UI layer architecture, `pointer-events`                                                                                                                                                    |
| **style.css**       | Glassmorphism, gradient text technique, `cubic-bezier` timing, `z-index` stacking, CSS `@keyframes` animations, Z-fighting, `accent-color`                                                                                                                               |
| **main.js**         | Scene graph hierarchy, `PerspectiveCamera` math, WebGL renderer pipeline, ambient vs directional lighting, `requestAnimationFrame` vs `setInterval`, delta time for frame-rate independence                                                                              |
| **InputManager.js** | Polling vs event-driven input, `event.code` vs `event.key`, stuck key edge cases                                                                                                                                                                                         |
| **Player.js**       | Hierarchical `THREE.Group` pattern, `SphereGeometry` parameters, PBR material properties (`metalness`/`roughness`), `GLTFLoader` async loading, Matcap materials, `Box3` auto-scaling, trigonometric circular placement, Euler integration, momentum decay normalization |
| **Bullet.js**       | `CapsuleGeometry`, `flatShading` vs smooth shading, `EdgesGeometry` vs `WireframeGeometry`, Newtonian momentum transfer, distance-based lifespan, `Color.lerp()` interpolation, vector cloning for mutation safety                                                       |
| **Asteroid.js**     | `IcosahedronGeometry`, `BufferAttribute` vertex manipulation, normal recomputation (`computeVertexNormals`), edge spawning strategy, lineage tracking for family wipe bonuses                                                                                            |
| **Bonus.js**        | Gem material design, Z-fighting prevention, scale-based progress bars, sine-wave animation with desynchronized frequencies, cascading scene graph removal                                                                                                                |
| **Game.js**         | Game state machine pattern, circle-circle collision detection, backward array iteration for `splice`, FOV trigonometry for boundary calculation, `localStorage` persistence, weapon upgrade progression, difficulty scaling, DOM animation timing                        |
| **BalanceUI.js**    | Two-way data binding pattern, DOM element caching, CSS class toggle for animations, `input` vs `change` events, `parseFloat` vs `parseInt`, `innerText` vs `innerHTML`                                                                                                   |

## 🔊 Sound Design

- **Audio Sprite**: All 33 game sounds are packed into a single optimized `GameSounds.mp3` for maximum performance.
- **Credits**:
    - **Engine/Processing**: Powered by [Howler.js](https://howlerjs.com/).
    - **Sound Sprites**: Generated via [AudioSprite Tools](https://tools.dverso.io/audiosprite/).
    - **Audio Source**: Sounds by **[trishacode]**(https://trishacode.neocities.org/).
