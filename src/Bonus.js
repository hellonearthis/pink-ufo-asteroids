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
    // We use an Icosahedron with 0 detail to get a sharp, faceted "gem-like" appearance.
    const gemGeometry = new THREE.IcosahedronGeometry(1.0, 0);
    const gemMaterial = new THREE.MeshStandardMaterial({
      color: this.identifyingColor,        // The base color determined by the boost type (e.g. Red for Capacity)
      emissive: this.identifyingColor,     // Matches base color to create an internal glow effect
      emissiveIntensity: 0.8,              // Tuned to provide a vibrant glow without washing out the white wireframe
      metalness: 0.9,                      // High value for crisp, sci-fi reflections on the facets
      roughness: 0.1,                      // Low value for a polished, glass-like surface finish
      transparent: true,                   // Enable transparency to allow the background stars to subtly show through
      opacity: 0.85                        // High opacity ensures the gem's form remains solid and punchy
    });
    this.gemMesh = new THREE.Mesh(gemGeometry, gemMaterial);
    
    // 1b. WHITE EDGES (Outlines)
    // EdgesGeometry extracts the wireframe from the faces, avoiding the "diagonal" lines found in standard WireframeGeometry.
    const gemEdgesGeometry = new THREE.EdgesGeometry(gemGeometry);
    const gemEdgesMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const gemEdgesMesh = new THREE.LineSegments(gemEdgesGeometry, gemEdgesMaterial);
    
    // By adding the edges as a child of the gemMesh, they will automatically inherit 
    // all transformations (rotation, position, scaling) applied to the parent.
    this.gemMesh.add(gemEdgesMesh); 

    this.gemMesh.position.copy(spawnCoordinate);
    this.parentGameRenderingScene.add(this.gemMesh);
    
    // 2. THE TIMER BAR (PROGRESS BAR)
    // We use a hierarchical setup where the background plane is a child of the gem,
    // and the foreground (filled) plane is a child of the background.
    const barBackgroundGeometry = new THREE.PlaneGeometry(2.0, 0.2);
    const barBackgroundMaterial = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
    this.timerBarBackground = new THREE.Mesh(barBackgroundGeometry, barBackgroundMaterial);
    
    // Position the HUD element floating just above the gem.
    this.timerBarBackground.position.set(0, 1.8, 0);
    this.gemMesh.add(this.timerBarBackground);
    
    const barForegroundGeometry = new THREE.PlaneGeometry(2.0, 0.2);
    const barForegroundMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    this.timerBarForeground = new THREE.Mesh(barForegroundGeometry, barForegroundMaterial);
    
    // We offset the foreground slightly on the Z axis (0.01) to prevent "Z-Fighting"
    // where the GPU can't decide which of two overlapping planes to render.
    this.timerBarForeground.position.set(0, 0, 0.01); 
    this.timerBarBackground.add(this.timerBarForeground);
    
    // DATA STATE
    this.maximumLifespanDuration = 10.0; // The total time the bonus stays on screen.
    this.remainingLifespanDuration = this.maximumLifespanDuration;
    this.isCurrentlyActiveAndValid = true;
    this.physicalCollisionRadius = 1.2;
    this.accumulatedRotationTime = 0;
  }
  
  /**
   * Updates the bonus item's animations and timer progress every frame.
   * @param {number} timeDeltaInSeconds - Time since previous frame (for frame-rate independence).
   */
  performFrameUpdate(timeDeltaInSeconds) {
    if (!this.isCurrentlyActiveAndValid) return;
    
    this.accumulatedRotationTime += timeDeltaInSeconds;
    this.remainingLifespanDuration -= timeDeltaInSeconds;
    
    // 1. ANIMATION: Spin, Bob, and Pulse
    // We apply rotation on different axes at different speeds for a more organic feel.
    this.gemMesh.rotation.y += timeDeltaInSeconds * 2.0;
    this.gemMesh.rotation.x += timeDeltaInSeconds * 1.5;
    
    // Bobbing: We use Math.sin (Sine Wave) to create a smooth up/down oscillation on the Z axis.
    this.gemMesh.position.z = Math.sin(this.accumulatedRotationTime * 4) * 0.3;
    
    // Pulsing: Scaling the mesh up and down over time using another Sine wave.
    const pulseFactor = 1.0 + Math.sin(this.accumulatedRotationTime * 6) * 0.15;
    this.gemMesh.scale.set(pulseFactor, pulseFactor, pulseFactor);
    
    // 2. TIMER BAR LOGIC: Update foreground scale
    // We calculate a percentage (0.0 to 1.0) and use it to scale the X-axis of the plane.
    const lifespanPercentageRemaining = Math.max(0, this.remainingLifespanDuration / this.maximumLifespanDuration);
    this.timerBarForeground.scale.x = lifespanPercentageRemaining;
    
    // 3. EXPIRATION CHECK
    if (this.remainingLifespanDuration <= 0) {
      this.initiateSelfDestructionSequence();
    }
  }
  
  /**
   * Gracefully removes the bonus from the scene and marks it for cleanup.
   */
  initiateSelfDestructionSequence() {
    this.isCurrentlyActiveAndValid = false;
    
    // Removing the parent (gemMesh) from the scene also removes all of its children 
    // (the edges and the timer bar) automatically.
    this.parentGameRenderingScene.remove(this.gemMesh);
  }
}
