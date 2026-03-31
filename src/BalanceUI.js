/* ============================================================================
 * BalanceUI.js — TACTICAL TUNING CONSOLE (Developer Debug Panel)
 * ============================================================================
 *
 * This module provides a real-time parameter adjustment interface for
 * weapon tuning during gameplay. It creates a two-way binding between
 * HTML range sliders and the game's weapon properties.
 *
 * PURPOSE:
 * During game development, balancing weapon parameters (speed, range,
 * cooldown, capacity) is one of the most time-consuming tasks. This panel
 * lets developers adjust parameters WHILE PLAYING to find the "sweet spot"
 * without restarting the game or modifying source code.
 *
 * ARCHITECTURE:
 * This class acts as a MEDIATOR between the DOM (HTML sliders) and the
 * game engine (PrimaryGameLogicController). It maintains references to
 * both sides and handles synchronization in both directions:
 *
 *   USER MOVES SLIDER → Event listener reads slider value → writes to game state
 *   GAME UPGRADES WEAPON → synchronizeUIFromGameState() reads game state → updates sliders
 *
 * TWO-WAY BINDING:
 * The panel must stay synchronized with the game state at all times:
 *   - When the user drags a slider, the new value is written to the game.
 *   - When the game engine upgrades a weapon stat (bonus pickup), the
 *     slider positions and value labels must update to reflect the change.
 *   - Without both directions, the UI would show stale/incorrect values
 *     after in-game upgrades.
 *
 * DOM ACCESS PATTERN:
 * We use document.getElementById() extensively to get references to HTML
 * elements defined in index.html. This is the most direct and performant
 * way to access specific DOM nodes. We cache these references in the
 * constructor (stored as class properties) to avoid repeated DOM lookups
 * on every input event — getElementById traverses the DOM tree each call,
 * so caching is a meaningful optimization for frequently-accessed elements.
 * ============================================================================ */


/**
 * Manages the Tactical Tuning Console UI panel.
 * Provides two-way binding between HTML slider controls and the game engine's
 * weapon parameters (shot speed, range, cooldown, on-screen limit).
 */
export class TacticalBalanceUI {
    /**
     * Initializes the tuning console by caching DOM references and setting up
     * event listeners for two-way data binding.
     *
     * @param {PrimaryGameLogicController} game - The game engine instance.
     *   This is the same object that manages asteroids, bullets, and scoring.
     *   We read from and write to its weapon properties directly (e.g.,
     *   game.w_ShotSpeed, game.w_ShotCooldown, game.w_OnScreenLimit).
     */
    constructor(game) {
        /* Store a reference to the game engine for reading/writing weapon stats. */
        this.game = game;

        /* Cache the container element. Used for toggling visibility via CSS classes.
         * The panel is defined in index.html as <div id="tactical-tuning-console">. */
        this.container = document.getElementById('tactical-tuning-console');

        /* Visibility state. Toggled by pressing 'T' (handled in Game.js constructor). */
        this.isActive = false;


        /* =================================================================
         * SLIDER ELEMENT REFERENCES
         * =================================================================
         * We cache references to each <input type="range"> element so we
         * can read their values on 'input' events and set their values
         * when synchronizing from game state.
         *
         * HTML range inputs have these relevant properties:
         *   .value — The current slider position (string, must be parsed).
         *   .min / .max — The allowed range (set in HTML attributes).
         *
         * These map to index.html elements:
         *   #tuning-shot-speed    → game.w_ShotSpeed    (min:5, max:100)
         *   #tuning-shot-range    → game.w_ShotRange    (min:1, max:100)
         *   #tuning-shot-cooldown → game.w_ShotCooldown (min:50, max:2000)
         *   #tuning-on-screen-limit → game.w_OnScreenLimit (min:1, max:15)
         * ================================================================= */
        this.sliderSpeed = document.getElementById('tuning-shot-speed');
        this.sliderRange = document.getElementById('tuning-shot-range');
        this.sliderCooldown = document.getElementById('tuning-shot-cooldown');
        this.sliderLimit = document.getElementById('tuning-on-screen-limit');


        /* =================================================================
         * VALUE DISPLAY LABEL REFERENCES
         * =================================================================
         * Each slider has a companion <span> element that shows the current
         * numeric value. These are the "16" in "SHOT SPEED: 16".
         *
         * We update these labels whenever:
         *   - The user moves a slider (via setupEventListeners).
         *   - The game state changes (via synchronizeUIFromGameState).
         * ================================================================= */
        this.valSpeed = document.getElementById('v_val-speed');
        this.valRange = document.getElementById('v_val-range');
        this.valCooldown = document.getElementById('v_val-cooldown');
        this.valLimit = document.getElementById('v_val-limit');


        /* Set up event listeners for slider interactions (user → game direction). */
        this.setupEventListeners();

        /* Initial sync: ensure sliders match the game's starting weapon values.
         * This is important because the HTML 'value' attributes may differ from
         * the game's actual starting values if either is changed independently. */
        this.synchronizeUIFromGameState();
    }


    /* =====================================================================
     * toggle() — SHOW/HIDE THE PANEL
     * =====================================================================
     *
     * Called by Game.js when the player presses 'T'.
     *
     * CSS CLASS TOGGLE PATTERN:
     * Instead of directly modifying style.right, we add/remove the 'active'
     * CSS class. The CSS rules handle the actual visual change:
     *   .tuning-console-container { right: -320px; transition: right 0.4s; }
     *   .tuning-console-container.active { right: 0; }
     *
     * This separation of concerns keeps animation logic in CSS (where it
     * belongs) and state logic in JavaScript. The CSS transition property
     * automatically animates the change — no JavaScript animation code needed.
     *
     * classList.add() / classList.remove() are the modern API for manipulating
     * CSS classes. They replaced the older className string manipulation
     * approach which was error-prone with multiple classes.
     * ===================================================================== */
    toggle() {
        this.isActive = !this.isActive;
        if (this.isActive) {
            this.container.classList.add('active');
            /* Re-sync values when opening, in case the game state changed
             * while the panel was hidden (e.g., player collected a bonus). */
            this.synchronizeUIFromGameState();
        } else {
            this.container.classList.remove('active');
        }
    }


    /* =====================================================================
     * synchronizeUIFromGameState() — GAME → UI DIRECTION
     * =====================================================================
     *
     * Reads the game engine's current weapon properties and updates BOTH
     * the slider positions and the text value labels.
     *
     * WHEN IS THIS CALLED?
     *   1. On initialization (constructor) — set initial slider positions.
     *   2. When the panel is opened (toggle) — refresh in case values changed.
     *   3. After a weapon upgrade (Game.js upgradeWeaponSystem) — reflect
     *      the new stat values caused by collecting a bonus pickup.
     *
     * Setting slider.value = number automatically moves the slider thumb
     * to the correct position. The browser handles the visual update.
     * ===================================================================== */
    synchronizeUIFromGameState() {
        this.sliderSpeed.value = this.game.w_ShotSpeed;
        this.sliderRange.value = this.game.w_ShotRange;
        this.sliderCooldown.value = this.game.w_ShotCooldown;
        this.sliderLimit.value = this.game.w_OnScreenLimit;

        this.updateValueLabels();
    }


    /* =====================================================================
     * updateValueLabels() — REFRESH TEXT DISPLAYS
     * =====================================================================
     *
     * Updates the <span> elements next to each slider with the current
     * numeric values from the game engine.
     *
     * Math.round() is used for speed, range, and cooldown because these
     * are floating-point values (e.g., 16.0, 18.0, 900.0) that might have
     * decimal artifacts after slider interaction. We display whole numbers
     * for cleaner readability.
     *
     * innerText vs innerHTML:
     * We use innerText because we're setting plain text content (numbers).
     * innerHTML would parse the string as HTML, which is unnecessary here
     * and would be a potential XSS vector if the values came from user input
     * (they don't in this case, but it's good practice).
     * ===================================================================== */
    updateValueLabels() {
        this.valSpeed.innerText = Math.round(this.game.w_ShotSpeed);
        this.valRange.innerText = Math.round(this.game.w_ShotRange);
        this.valCooldown.innerText = Math.round(this.game.w_ShotCooldown);
        this.valLimit.innerText = this.game.w_OnScreenLimit;
    }


    /* =====================================================================
     * setupEventListeners() — UI → GAME DIRECTION
     * =====================================================================
     *
     * Registers 'input' event listeners on each slider that write the
     * slider's new value directly to the game engine's properties.
     *
     * EVENT TYPE: 'input' vs 'change'
     *   - 'input' fires CONTINUOUSLY as the user drags the slider.
     *     This provides real-time feedback — the game parameters update
     *     instantly as the slider moves, so the player can see the effect
     *     immediately during gameplay.
     *   - 'change' only fires when the user RELEASES the slider (mouseup).
     *     This would create a delayed, less responsive tuning experience.
     *
     * VALUE PARSING:
     *   - parseFloat() for speed, range, cooldown — these are decimal values.
     *   - parseInt() for on-screen limit — this is a whole number (can't have
     *     1.5 bullets on screen).
     *
     * e.target.value is always a STRING (HTML attribute values are strings).
     * parseInt/parseFloat converts it to the appropriate numeric type.
     * ===================================================================== */
    setupEventListeners() {
        /* SHOT SPEED SLIDER:
         * When dragged, updates game.w_ShotSpeed. This affects the velocity
         * of newly created bullets (existing bullets keep their original speed). */
        this.sliderSpeed.addEventListener('input', (e) => {
            this.game.w_ShotSpeed = parseFloat(e.target.value);
            this.updateValueLabels();
        });

        /* SHOT RANGE SLIDER:
         * Updates game.w_ShotRange. Affects how far new bullets can travel
         * before self-destructing. */
        this.sliderRange.addEventListener('input', (e) => {
            this.game.w_ShotRange = parseFloat(e.target.value);
            this.updateValueLabels();
        });

        /* SHOT COOLDOWN SLIDER:
         * Updates game.w_ShotCooldown (in milliseconds). Lower values = faster
         * fire rate. The game checks performance.now() against this cooldown
         * to determine if the player can shoot again. */
        this.sliderCooldown.addEventListener('input', (e) => {
            this.game.w_ShotCooldown = parseFloat(e.target.value);
            this.updateValueLabels();
        });

        /* MAX SHOTS (ON-SCREEN LIMIT) SLIDER:
         * Updates game.w_OnScreenLimit. This controls how many bullets can
         * exist simultaneously. We also call updateAmmunitionHUDDisplay()
         * because the HUD shows the current limit to the player. */
        this.sliderLimit.addEventListener('input', (e) => {
            this.game.w_OnScreenLimit = parseInt(e.target.value);
            this.game.updateAmmunitionHUDDisplay();
            this.updateValueLabels();
        });
    }
}
