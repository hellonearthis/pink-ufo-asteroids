/* ============================================================================
 * InputManager.js — KEYBOARD INPUT STATE TRACKER
 * ============================================================================
 *
 * PURPOSE:
 * Provides a polling-based input system for real-time gameplay. Instead of
 * responding to individual key events (event-driven), the game engine checks
 * the current state of any key on every frame (state-driven / polling).
 *
 * WHY POLLING vs EVENT-DRIVEN?
 * In a typical web application, you'd listen for 'keydown' and execute code
 * directly in the event handler. But in a game:
 *
 *   - Event handlers fire asynchronously, outside the animation loop.
 *     This means input would be processed at unpredictable times relative
 *     to physics updates, causing inconsistent movement.
 *
 *   - We need to know if a key IS CURRENTLY HELD DOWN (continuous input),
 *     not just that it WAS pressed (discrete input). 'keydown' fires once
 *     on first press, then repeats at the OS repeat rate (usually ~30ms
 *     delay, then every ~33ms), which doesn't match our 60fps game loop.
 *
 *   - By recording key states and checking them each frame, we ensure that
 *     input is sampled at exactly the same rate as the game logic update.
 *
 * USAGE:
 *   const input = new KeyboardInputStateTracker();
 *   // In the game loop:
 *   if (input.verifyIfSpecificKeyIsCurrentlyPressed('ArrowUp')) {
 *     // Apply thrust...
 *   }
 *
 * KEY CODES:
 * We use the 'event.code' property (not 'event.key') because:
 *   - event.code represents the PHYSICAL key position on the keyboard.
 *     'KeyW' is always the key in the W position, regardless of keyboard layout.
 *   - event.key represents the CHARACTER produced, which changes with layout.
 *     On a French AZERTY keyboard, the 'W' position produces 'z'.
 *   - For game controls, physical position matters more than character output.
 *
 * Common event.code values used in this game:
 *   'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight' — Arrow keys
 *   'KeyW', 'KeyA', 'KeyS', 'KeyD' — WASD keys (by physical position)
 *   'Space' — Spacebar
 *   'KeyR' — R key (restart)
 *   'KeyT' — T key (tuning console toggle)
 * ============================================================================ */

export class KeyboardInputStateTracker {
  /**
   * Initializes the input tracker and registers global keyboard event listeners.
   *
   * WHY GLOBAL (window) EVENT LISTENERS?
   * We attach to 'window' rather than a specific DOM element because:
   *   1. The game has no focused input fields (no <input> or <textarea>).
   *   2. We want to capture keys regardless of which element has focus.
   *   3. The Three.js canvas doesn't naturally receive keyboard events
   *      (it would need tabindex="0" and explicit focus management).
   *
   * These listeners run for the entire lifetime of the page. In a more
   * complex application, you'd want to call removeEventListener() when
   * the game component unmounts to prevent memory leaks.
   */
  constructor() {
    /**
     * Internal key state dictionary.
     * Keys:   Standard 'event.code' strings (e.g., 'KeyW', 'ArrowUp', 'Space')
     * Values: boolean (true = currently pressed, false = released)
     *
     * IMPLEMENTATION DETAIL:
     * We use a plain object (not a Map) because:
     *   - String keys with boolean values is the simplest possible lookup.
     *   - Object property access (obj[key]) is extremely fast in V8/SpiderMonkey.
     *   - A Map would work equally well but adds unnecessary API complexity.
     *
     * Keys that have never been pressed will return 'undefined' from property
     * access, which is why verifyIfSpecificKeyIsCurrentlyPressed() checks
     * for strict equality to 'true' (undefined !== true → returns false).
     *
     * @type {Object.<string, boolean>}
     */
    this.activelyPressedKeyboardKeys = {};

    /* KEYDOWN EVENT:
     * Fires when a physical key is pressed down. The browser also fires
     * repeated 'keydown' events if the key is held (auto-repeat), but
     * since we just set the value to 'true' each time, repeated events
     * are harmless — idempotent operation.
     *
     * NOTE: We don't call event.preventDefault() here because:
     *   - It would break browser shortcuts (Ctrl+R for reload, F12 for DevTools).
     *   - The game doesn't need to prevent default behavior for most keys.
     *   - Spacebar scrolling is already prevented by 'overflow: hidden' on body. */
    window.addEventListener('keydown', (keyboardEvent) => {
      this.activelyPressedKeyboardKeys[keyboardEvent.code] = true;
    });

    /* KEYUP EVENT:
     * Fires when a physical key is released. We mark the key as no longer
     * pressed so the game engine knows to stop the associated action
     * (e.g., stop thrusting when 'W' is released).
     *
     * EDGE CASE — "Stuck Keys":
     * If the user switches browser tabs while holding a key, the 'keyup'
     * event may fire in the other tab (or not at all), leaving the key
     * "stuck" in the pressed state. A production game would handle this
     * by listening for 'blur' events on the window and clearing all keys:
     *   window.addEventListener('blur', () => { this.activelyPressedKeyboardKeys = {}; });
     * This is omitted here for tutorial simplicity. */
    window.addEventListener('keyup', (keyboardEvent) => {
      this.activelyPressedKeyboardKeys[keyboardEvent.code] = false;
    });
  }

  /**
   * Checks if a specific keyboard key is currently in the 'pressed' state.
   *
   * This method is called EVERY FRAME from the game loop for each action
   * the game needs to check (rotation, thrust, shooting). On a typical
   * frame, this is called 4-6 times.
   *
   * @param {string} specificKeyboardKeyCode - The standardized event.code
   *   string to check. Example: 'KeyW', 'ArrowUp', 'Space'.
   * @returns {boolean} True if the key is currently held down, false otherwise.
   *
   * WHY STRICT EQUALITY (=== true)?
   * If the key has never been pressed, accessing it returns 'undefined'.
   * Using loose equality (==) would still work since 'undefined == true'
   * is false, but strict equality makes the intent explicit and is a
   * defensive programming best practice. It also slightly optimizes the
   * comparison since the JS engine can skip type coercion.
   */
  verifyIfSpecificKeyIsCurrentlyPressed(specificKeyboardKeyCode) {
    return this.activelyPressedKeyboardKeys[specificKeyboardKeyCode] === true;
  }
}
