/**
 * This class is responsible for monitoring and recording the state of keyboard inputs.
 * It serves as a central registry that other game components can query to determine 
 * if specific keys are currently being held down by the player.
 * 
 * In a Three.js game, we often need to check input state every frame (within the animation loop),
 * and this manager provides a clean, non-blocking way to do that.
 */
export class KeyboardInputStateTracker {
  /**
   * Initializes the input tracker and sets up global event listeners.
   */
  constructor() {
    /**
     * An object acting as a dictionary to store the boolean 'pressed' state of keys.
     * The keys of this object correspond to the standard 'event.code' strings (e.g., 'KeyW', 'ArrowUp').
     * @type {Object.<string, boolean>}
     */
    this.activelyPressedKeyboardKeys = {};
    
    // We attach an event listener to the global window object to capture when a key is pressed.
    window.addEventListener('keydown', (keyboardEvent) => {
      // We set the value to true when the 'keydown' event triggers for a specific key code.
      this.activelyPressedKeyboardKeys[keyboardEvent.code] = true;
    });
    
    // We attach another event listener to capture when a key is released by the user.
    window.addEventListener('keyup', (keyboardEvent) => {
      // When the 'keyup' event triggers, we mark that key as no longer being pressed.
      this.activelyPressedKeyboardKeys[keyboardEvent.code] = false;
    });
  }

  /**
   * Checks if a specific keyboard key is currently in the 'pressed' state.
   * @param {string} specificKeyboardKeyCode - The standardized code of the key to check.
   * @returns {boolean} - Returns true if the key is currently held down, otherwise false.
   */
  verifyIfSpecificKeyIsCurrentlyPressed(specificKeyboardKeyCode) {
    // We explicitly check for strict equality to true to handle undefined/null states gracefully.
    return this.activelyPressedKeyboardKeys[specificKeyboardKeyCode] === true;
  }
}
