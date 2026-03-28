# Asteroids 3D: Pink UFO Edition

A stylized, three.js-powered remake of the classic Asteroids game, featuring a procedurally animated Pink UFO and "tutorial-style" source code designed for learning 3D game development.

## 🎮 How to Play

*   **Move & Rotate**: Use the **WASD** keys or **Arrow Keys**.
*   **Shoot**: Press the **Spacebar** to fire yellow energy pulses.
*   **Tactical Tuning**: Press **[T]** to open the real-time balance console.
*   **Restart**: Press the **R** key on the "Game Over" screen to try again.

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

*   **Tactical Tuning Console**: A real-time balance menu (press `T`) that allows you to live-adjust shot speed, fire rate, and capacity while playing.
*   **Weapon Progression System**: Collect color-coded hexagonal gems to upgrade your spacecraft:
    *   🔴 **Shots (Capacity)**: Increase the number of pellets you can have on-screen.
    *   🟡 **Shot Rate**: Reduce the cooldown between shots.
    *   🟠 **Shot Velocity**: Increase bullet travel speed.
    *   💗 **Shot Range**: Increase how far your projectiles travel.
*   **Animated UFO**: Features a spinning saucer body, a hovering "bob" animation, and a pulsing sequence of rim lights.
*   **Dynamic Visual Style**: High-contrast "gemstone" pickups and projectiles with pulsing energy outlines.
*   **Realistic Momentum**: Projectiles inherit the ship's current linear velocity at the moment of firing for a more tactical flight feel.
*   **Educational Source Code**: The codebase features extremely verbose variable names and comprehensive 'Deep-Dive' comments explaining core Three.js routines, geometry deformation, and physics logic.

## 📁 Project Structure

*   `src/main.js`: Initialization of the Three.js scene, lighting, and core animation loop.
*   `src/Game.js`: The primary controller managing wave spawning, collision logic, and the weapon upgrade system.
*   `src/Player.js`: The animated UFO spacecraft implementation and hierarchical group management.
*   `src/Asteroid.js`: Procedurally deformed space rock logic and vertex-normal calculation.
*   `src/Bullet.js`: Projectile physics, momentum inheritance, and dynamic color cycling.
*   `src/Bonus.js`: Collection of宝石 (gems) with hierarchical timer bars.
*   `src/BalanceUI.js`: Implementation of the Tactical Tuning Console and UI synchronization.
