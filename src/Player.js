import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * This class represents the player-controlled spacecraft within our 3D environment.
 * It has been redesigned as a stylized Pink UFO with internal animations.
 */
export class ControlledPlayerSpacecraft {
  /**
   * Constructs the player spacecraft with physical properties and visual geometry.
   * @param {THREE.Scene} parentGameRenderingScene - The scene where the ship will be rendered.
   * @param {Object} gameplayAreaBoundaryLimits - The rectangular limits of the visible game world.
   */
  constructor(parentGameRenderingScene, gameplayAreaBoundaryLimits) {
    this.parentGameRenderingScene = parentGameRenderingScene;
    this.gameplayAreaBoundaryLimits = gameplayAreaBoundaryLimits;
    
    /**
     * HIERARCHICAL STRUCTURE (The "Heading Container"):
     * We use a Group as a parent container for the entire ship.
     * Rotating this group handles the ship's 2D heading (ArrowKeys/WASD)
     * without perturbing the internal 3D animations of the ship's components.
     */
    this.spacecraftHeadingContainer = new THREE.Group();
    this.parentGameRenderingScene.add(this.spacecraftHeadingContainer);

    /**
     * INTERNAL ANIMATION GROUPS:
     * We separate 'Static' parts (like the indicator) from 'Spinning' parts (the saucer).
     * We also apply a global 'Lean' (rotation.x) so that the UFO is viewed at 
     * a 45-degree angle from the top, giving it more 3D depth on a 2D plane.
     */
    this.spacecraftSpinningVisualsGroup = new THREE.Group();
    this.spacecraftSpinningVisualsGroup.rotation.x = Math.PI / 4; 
    this.spacecraftHeadingContainer.add(this.spacecraftSpinningVisualsGroup);
    
    this.spacecraftStaticDecorationsGroup = new THREE.Group();
    this.spacecraftStaticDecorationsGroup.rotation.x = Math.PI / 4;
    this.spacecraftHeadingContainer.add(this.spacecraftStaticDecorationsGroup);

    // 1. THE MAIN SAUCER BODY: 
    // We create a Sphere and then scale its Y-dimension to 0.3 to flatten it.
    const saucerBodyGeometry = new THREE.SphereGeometry(2, 32, 16);
    saucerBodyGeometry.scale(1, 0.3, 1); 
    
    const saucerMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xff00ff,        // Base color (Hot Pink)
      emissive: 0xaa00aa,     // Emissive color for a self-illuminated magenta glow
      emissiveIntensity: 0.5, // Subtle glow intensity
      roughness: 0.2,         // Smooth surface for sharp reflections
      metalness: 0.8          // High metallic value for a sci-fi finish
    });
    this.mainHullMaterial = saucerMaterial;
    const saucerMesh = new THREE.Mesh(saucerBodyGeometry, saucerMaterial);
    this.spacecraftSpinningVisualsGroup.add(saucerMesh);
    
    // 2. THE COCKPIT DOME:
    // We use the phi/theta arguments of SphereGeometry to render only the top half of the sphere.
    const cockpitDomeGeometry = new THREE.SphereGeometry(0.8, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const cockpitMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffff,        // Cyan base
      transparent: true,      // Required for opacity < 1.0
      opacity: 0.6,           // Glass-like transparency
      emissive: 0x008888,
      emissiveIntensity: 0.2
    });
    const cockpitMesh = new THREE.Mesh(cockpitDomeGeometry, cockpitMaterial);
    cockpitMesh.position.y = 0.2; // Offset slightly relative to the flattened saucer hull
    this.spacecraftSpinningVisualsGroup.add(cockpitMesh);

    // 3. UFO LIGHTS:
    // We programmatically place individual light spheres around the perimeter of the saucer.
    this.ufoRimLights = [];
    const lightQuantity = 8;
    const lightRadius = 1.8;
    for (let i = 0; i < lightQuantity; i++) {
        const lightGeom = new THREE.SphereGeometry(0.15, 8, 8);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const lightMesh = new THREE.Mesh(lightGeom, lightMat);
        
        // Circular placement using Sine/Cosine trigonometry.
        const angle = (i / lightQuantity) * Math.PI * 2;
        lightMesh.position.set(Math.cos(angle) * lightRadius, -0.1, Math.sin(angle) * lightRadius);
        
        this.spacecraftSpinningVisualsGroup.add(lightMesh);
        this.ufoRimLights.push(lightMesh);
    }
    
    // 4. THE DIRECTIONAL INDICATOR:
    // This helper mesh (yellow cone) shows the user exactly which way is 'forward'.
    // Rescaled larger per user feedback to ensure visibility with the new GLB model.
    const indicatorVisualGeometry = new THREE.ConeGeometry(0.5, 1.5, 3);
    const indicatorVisualMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffff00, 
        emissive: 0xffff00, 
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.5 
    }); 
    const primaryDirectionalIndicatorTriangle = new THREE.Mesh(indicatorVisualGeometry, indicatorVisualMaterial);
    
    // Position it slightly higher on the Z-axis (normalized from the saucer crown)
    // to ensure it doesn't clip through the new, larger 3D model.
    primaryDirectionalIndicatorTriangle.position.set(0, 1.8, 0.4); 
    primaryDirectionalIndicatorTriangle.rotation.x = -Math.PI / 4; 
    
    // Important: We add this to the STATIC group so it stays aligned with 
    // the heading and DOES NOT spin when the UFO body spins.
    this.spacecraftStaticDecorationsGroup.add(primaryDirectionalIndicatorTriangle);
    
    // 5. ASSET LOADING (GLB & SHADER/MATCAP):
    const textureLoader = new THREE.TextureLoader();
    const gltfLoader = new GLTFLoader();
    
    // We use the ufo.jpg as a Matcap (Material Capture) texture.
    // This provides high-quality lighting and reflections with very low performance cost.
    const matcapTexture = textureLoader.load('/ufo.jpg');
    const customUfoMaterial = new THREE.MeshMatcapMaterial({
      matcap: matcapTexture,
      color: 0xff00ff // Tint it pink to maintain the "Pink UFO" theme
    });

    gltfLoader.load('/ufo.glb', (gltf) => {
      const model = gltf.scene;
      
      // Apply our custom material to all meshes in the model
      model.traverse((child) => {
        if (child.isMesh) {
          child.material = customUfoMaterial;
        }
      });

      // SCALING: The user mentioned it needs scaling. 
      // We use Box3 to find the model's actual dimensions and scale it to a specific size.
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      
      // Target size is about 4.0 units (the previous ship's exact diameter). 
      // This matches the user's request for a '2x' size multiplier over the base visibility.
      const scaleFactor = 4.0 / maxDim;
      model.scale.setScalar(scaleFactor); 
      
      // Orientation adjustment: 
      // Most GLB models use Y-up. Since our spin animation works on the parent's Y-axis,
      // and the parent is tilted on X to give depth, we align the model directly.
      // Removed the PI/2 rotation that was causing the 'wrong axis' tumbling.
      model.rotation.x = 0; 

      this.spacecraftSpinningVisualsGroup.add(model);
      
      // Hide the procedural saucer if the model loaded successfully
      saucerMesh.visible = false;
      cockpitMesh.visible = false;
      this.ufoRimLights.forEach(l => l.visible = false);
    }, undefined, (error) => {
      console.error('Error loading UFO model:', error);
    });
    
    // PHYSICS PROPERTIES:
    this.currentLinearVelocityVector = new THREE.Vector3(0, 0, 0); // Active movement vector
    this.angularRotationSpeedPerSecond = 4.5;                      // How fast the ship turns (radians/sec)
    this.proportionalThrustForcePower = 38.0;                      // Thrust multiplier
    this.momentumDecayCoefficient = 0.98;                          // Simulated friction/drag
    this.physicalCollisionRadius = 2.0;                            // Logic boundary for hit detection

    // ANIMATION STATE:
    this.totalRunningTime = 0;
  }
  
  /**
   * Main logic loop for the player ship, handling input, physics, and visual secondary motion.
   */
  performFrameUpdate(timeDeltaInSeconds, playerInputTracker) {
    this.totalRunningTime += timeDeltaInSeconds;

    // 1. INPUT HANDLING (ROTATION):
    // Directly modifying the Z-rotation of the parent heading container.
    if (playerInputTracker.verifyIfSpecificKeyIsCurrentlyPressed('ArrowLeft') || 
        playerInputTracker.verifyIfSpecificKeyIsCurrentlyPressed('KeyA')) {
      this.spacecraftHeadingContainer.rotation.z += this.angularRotationSpeedPerSecond * timeDeltaInSeconds;
    }
    if (playerInputTracker.verifyIfSpecificKeyIsCurrentlyPressed('ArrowRight') || 
        playerInputTracker.verifyIfSpecificKeyIsCurrentlyPressed('KeyD')) {
      this.spacecraftHeadingContainer.rotation.z -= this.angularRotationSpeedPerSecond * timeDeltaInSeconds;
    }
    
    // 2. INPUT HANDLING (THRUST):
    // We calculate a 'Forward' vector based on the current heading and add it to our velocity.
    if (playerInputTracker.verifyIfSpecificKeyIsCurrentlyPressed('ArrowUp') || 
        playerInputTracker.verifyIfSpecificKeyIsCurrentlyPressed('KeyW')) {
      
      const forwardDirectionVector = new THREE.Vector3(0, 1, 0);
      forwardDirectionVector.applyAxisAngle(new THREE.Vector3(0, 0, 1), this.spacecraftHeadingContainer.rotation.z);
      this.currentLinearVelocityVector.add(forwardDirectionVector.multiplyScalar(this.proportionalThrustForcePower * timeDeltaInSeconds));
    }
    
    // 3. SECONDARY ANIMATIONS:
    // Saucer Spin: Rotates the visual sub-group independently of heading.
    this.spacecraftSpinningVisualsGroup.rotation.y += timeDeltaInSeconds * 2.0;
    
    // Hover Bobbing: Uses a Sine wave to create vertical oscillation for a "floating" look.
    const bobValue = Math.sin(this.totalRunningTime * 3.0) * 0.5;
    this.spacecraftSpinningVisualsGroup.position.z = bobValue;
    this.spacecraftStaticDecorationsGroup.position.z = bobValue;

    // Light Pulsing: Cycles the HSL lightness and scale of the rim lights.
    this.ufoRimLights.forEach((light, index) => {
        const pulse = Math.sin(this.totalRunningTime * 10 + index) * 0.5 + 0.5;
        light.material.color.setHSL(0.8, 1, 0.5 + pulse * 0.5); 
        light.scale.setScalar(0.8 + pulse * 0.4);
    });

    // 4. PHYSICS UPDATES:
    // Apply constant momentum decay (simulated space drag).
    this.currentLinearVelocityVector.multiplyScalar(Math.pow(this.momentumDecayCoefficient, timeDeltaInSeconds * 60));
    // Apply velocity to position.
    this.spacecraftHeadingContainer.position.addScaledVector(this.currentLinearVelocityVector, timeDeltaInSeconds);
    
    // 5. SCREEN WRAPPING:
    const limits = this.gameplayAreaBoundaryLimits;
    const pos = this.spacecraftHeadingContainer.position;
    const buffer = this.physicalCollisionRadius;

    if (pos.x > limits.right + buffer) pos.x = limits.left - buffer;
    else if (pos.x < limits.left - buffer) pos.x = limits.right + buffer;
    
    if (pos.y > limits.top + buffer) pos.y = limits.bottom - buffer;
    else if (pos.y < limits.bottom - buffer) pos.y = limits.top + buffer;
  }

  /**
   * Logical accessors for external systems.
   */
  get spacecraftRenderingMesh() {
    return this.spacecraftHeadingContainer;
  }

  get spacecraftRenderingGroup() {
      return this.spacecraftSpinningVisualsGroup;
  }
}
