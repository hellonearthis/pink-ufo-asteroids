import * as THREE from 'three';

/**
 * Represents a collectible power-up element that appears in the game world
 * when a specific color-set of asteroids is eliminated.
 */
export class BonusPickupElement {
  /**
   * Initializes a bonus item at a specific location.
   * @param {THREE.Scene} parentGameRenderingScene - The scene where this bonus exists.
   * @param {THREE.Vector3} spawnCoordinate - The 3D position where the bonus is born.
   * @param {number} identifyingColor - The hex color associated with the bonus.
   * @param {string} rewardType - The type of reward (e.g., 'AMMO', 'POINTS').
   */
  constructor(parentGameRenderingScene, spawnCoordinate, identifyingColor, rewardType = 'CAPACITY') {
    this.parentGameRenderingScene = parentGameRenderingScene;
    this.rewardType = rewardType;
    
    // COLOR MAPPING based on Reward Type:
    const rewardColorMap = {
        'CAPACITY': 0xff0000, // Red
        'SPEED':    0xffa500, // Orange
        'RATE':     0xffff00, // Yellow
        'RANGE':    0xff69b4, // Pink
        'POINTS':   0x00ff00  // Green (Fallthrough)
    };
    
    this.identifyingColor = rewardColorMap[rewardType] || identifyingColor;

    // 1. THE MAIN PICKUP VISUAL (Glowing Gem)
    const gemGeometry = new THREE.IcosahedronGeometry(1.0, 0);
    const gemMaterial = new THREE.MeshStandardMaterial({
      color: this.identifyingColor,
      emissive: this.identifyingColor,
      emissiveIntensity: 1.5, // Increased for a vibrant neon glow
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.9
    });
    this.gemMesh = new THREE.Mesh(gemGeometry, gemMaterial);
    this.gemMesh.position.copy(spawnCoordinate);
    this.parentGameRenderingScene.add(this.gemMesh);
    
    // 2. THE TIMER BAR (PROGRESS BAR)
    // A small plane that sits above the gem and shrinks as time runs out.
    const barBackgroundGeometry = new THREE.PlaneGeometry(2.0, 0.2);
    const barBackgroundMaterial = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
    this.timerBarBackground = new THREE.Mesh(barBackgroundGeometry, barBackgroundMaterial);
    this.timerBarBackground.position.set(0, 1.8, 0);
    this.gemMesh.add(this.timerBarBackground);
    
    const barForegroundGeometry = new THREE.PlaneGeometry(2.0, 0.2);
    const barForegroundMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    this.timerBarForeground = new THREE.Mesh(barForegroundGeometry, barForegroundMaterial);
    this.timerBarForeground.position.set(0, 0, 0.01); // Sit slightly in front of background
    this.timerBarBackground.add(this.timerBarForeground);
    
    // DATA STATE
    this.maximumLifespanDuration = 10.0; // 10 seconds to collect
    this.remainingLifespanDuration = this.maximumLifespanDuration;
    this.isCurrentlyActiveAndValid = true;
    this.physicalCollisionRadius = 1.2;
    this.accumulatedRotationTime = 0;
  }
  
  /**
   * Updates the bonus item's animations and timer progress.
   * @param {number} timeDeltaInSeconds - Time since previous frame.
   */
  performFrameUpdate(timeDeltaInSeconds) {
    if (!this.isCurrentlyActiveAndValid) return;
    
    this.accumulatedRotationTime += timeDeltaInSeconds;
    this.remainingLifespanDuration -= timeDeltaInSeconds;
    
    // 1. ANIMATION: Spin, float, and Pulse
    this.gemMesh.rotation.y += timeDeltaInSeconds * 2.0;
    this.gemMesh.rotation.x += timeDeltaInSeconds * 1.5;
    this.gemMesh.position.z = Math.sin(this.accumulatedRotationTime * 4) * 0.3;
    
    // Pulsing Scale Effect
    const pulseFactor = 1.0 + Math.sin(this.accumulatedRotationTime * 6) * 0.15;
    this.gemMesh.scale.set(pulseFactor, pulseFactor, pulseFactor);
    
    // 2. TIMER BAR LOGIC: Update foreground scale
    const lifespanPercentageRemaining = Math.max(0, this.remainingLifespanDuration / this.maximumLifespanDuration);
    this.timerBarForeground.scale.x = lifespanPercentageRemaining;
    // Shift the bar so it shrinks from one side (optional, currently shrinks from center)
    // To shrink from left: this.timerBarForeground.position.x = -(1 - lifespanPercentageRemaining);
    
    // 3. EXPIRATION CHECK
    if (this.remainingLifespanDuration <= 0) {
      this.initiateSelfDestructionSequence();
    }
  }
  
  /**
   * Gracefully removes the bonus from the scene.
   */
  initiateSelfDestructionSequence() {
    this.isCurrentlyActiveAndValid = false;
    this.parentGameRenderingScene.remove(this.gemMesh);
  }
}
