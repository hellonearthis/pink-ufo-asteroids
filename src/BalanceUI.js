/**
 * Manages the Tactical Tuning Console UI and binds its controls
 * directly to the PrimaryGameLogicController instance.
 */
export class TacticalBalanceUI {
    /**
     * @param {PrimaryGameLogicController} game - The game instance to control.
     */
    constructor(game) {
        this.game = game;
        this.container = document.getElementById('tactical-tuning-console');
        this.isActive = false;

        // Sliders
        this.sliderSpeed = document.getElementById('tuning-shot-speed');
        this.sliderRange = document.getElementById('tuning-shot-range');
        this.sliderCooldown = document.getElementById('tuning-shot-cooldown');
        this.sliderLimit = document.getElementById('tuning-on-screen-limit');

        // Value Displays
        this.valSpeed = document.getElementById('v_val-speed');
        this.valRange = document.getElementById('v_val-range');
        this.valCooldown = document.getElementById('v_val-cooldown');
        this.valLimit = document.getElementById('v_val-limit');

        this.setupEventListeners();
        this.synchronizeUIFromGameState();
    }

    /**
     * Toggles the visibility of the tuning panel.
     */
    toggle() {
        this.isActive = !this.isActive;
        if (this.isActive) {
            this.container.classList.add('active');
            this.synchronizeUIFromGameState();
        } else {
            this.container.classList.remove('active');
        }
    }

    /**
     * Reads the current game state and updates the slider positions.
     */
    synchronizeUIFromGameState() {
        this.sliderSpeed.value = this.game.w_ShotSpeed;
        this.sliderRange.value = this.game.w_ShotRange;
        this.sliderCooldown.value = this.game.w_ShotCooldown;
        this.sliderLimit.value = this.game.w_OnScreenLimit;

        this.updateValueLabels();
    }

    /**
     * Updates the text labels next to the sliders.
     */
    updateValueLabels() {
        this.valSpeed.innerText = Math.round(this.game.w_ShotSpeed);
        this.valRange.innerText = Math.round(this.game.w_ShotRange);
        this.valCooldown.innerText = Math.round(this.game.w_ShotCooldown);
        this.valLimit.innerText = this.game.w_OnScreenLimit;
    }

    /**
     * Binds input events to game properties.
     */
    setupEventListeners() {
        this.sliderSpeed.addEventListener('input', (e) => {
            this.game.w_ShotSpeed = parseFloat(e.target.value);
            this.updateValueLabels();
        });

        this.sliderRange.addEventListener('input', (e) => {
            this.game.w_ShotRange = parseFloat(e.target.value);
            this.updateValueLabels();
        });

        this.sliderCooldown.addEventListener('input', (e) => {
            this.game.w_ShotCooldown = parseFloat(e.target.value);
            this.updateValueLabels();
        });

        this.sliderLimit.addEventListener('input', (e) => {
            this.game.w_OnScreenLimit = parseInt(e.target.value);
            this.game.updateAmmunitionHUDDisplay();
            this.updateValueLabels();
        });

        // Toggle key (T) handled globally or here?
        // Let's add it globally in InputManager but we can listen here for specific panel focus if needed.
    }
}
