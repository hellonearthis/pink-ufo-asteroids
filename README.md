# Asteroids 3D: Pink UFO Edition

A stylized, three.js-powered remake of the classic Asteroids game, featuring a procedurally animated Pink UFO and "tutorial-style" source code designed for learning 3D game development.

## 🎮 How to Play

*   **Move & Rotate**: Use the **WASD** keys or **Arrow Keys**.
*   **Shoot**: Press the **Spacebar** to fire yellow energy pulses.
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

*   **Animated UFO**: Features a spinning saucer body, a hovering "bob" animation, and a chasing sequence of rim lights.
*   **Directional Compass**: A yellow triangle over the center of the ship always indicates your current heading.
*   **Tutorial Codebase**: The source code is written with extremely verbose variable names and comprehensive comments, making it easy to understand the underlying 3D math and Three.js logic.
*   **Screen Wrapping**: Classic "wrap-around" mechanics for the player, bullets, and asteroids.

## 📁 Project Structure

*   `src/main.js`: Initialization of the Three.js scene and the animation loop.
*   `src/Game.js`: The primary game logic controller and physics engine.
*   `src/Player.js`: The animated UFO spacecraft implementation.
*   `src/Asteroid.js`: Procedurally deformed space rock logic.
*   `src/Bullet.js`: Projectile mechanics.
*   `src/style.css`: UI styling with descriptive class names.
*   `index.html`: The game's entry point and UI overlay.
