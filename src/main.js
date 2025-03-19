import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import './style.css';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Add a hemisphere light for better ambient lighting
const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5);
scene.add(hemisphereLight);

// Debug logging utility
function debugLog(message, data) {
    console.log(`%c[DEBUG] ${message}`, 'background: #222; color: #bada55', data || '');
}

// Ground
const groundGeometry = new THREE.PlaneGeometry(50, 50);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x3c5e35 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Add a simple pine tree in the center
function createSimplePineTree() {
    const tree = new THREE.Group();

    // Tree trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, 5, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 2.5;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    // Tree top (single cone)
    const coneGeometry = new THREE.ConeGeometry(3, 7, 8);
    const coneMaterial = new THREE.MeshStandardMaterial({ color: 0x2E8B57 });
    const cone = new THREE.Mesh(coneGeometry, coneMaterial);
    cone.position.y = 8.5;
    cone.castShadow = true;
    cone.receiveShadow = true;
    tree.add(cone);

    return tree;
}

// Create and add the pine tree to the scene
const pineTree = createSimplePineTree();
pineTree.position.set(0, 0, 0); // Position at center of the scene
scene.add(pineTree);

// Character state - moved the player away from the tree
const characterScale = 1.0;

// Set initial rotation for models to fix sideways movement
const initialYRotation = 0;

const playerState = {
    position: new THREE.Vector3(-8, 0, -8),
    rotation: new THREE.Euler(0, initialYRotation, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    currentAnimation: 'IDLE',
    moveSpeed: 5,
    rotationSpeed: 3,
    isAttacking: false
};

const enemyState = {
    position: new THREE.Vector3(10, 0, 10),
    rotation: new THREE.Euler(0, initialYRotation, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    currentAnimation: 'IDLE',
    moveSpeed: 3,
    attackDistance: 2,
    followDistance: 15,
    isAttacking: false,
    attackCooldown: 0
};

// Animation map for tracking animations
const animationMap = {
    player: {
        IDLE: { clip: null, duration: 0 },
        WALK: { clip: null, duration: 0 },
        ATTACK: { clip: null, duration: 0 }
    },
    enemy: {
        IDLE: { clip: null, duration: 0 },
        WALK: { clip: null, duration: 0 },
        ATTACK: { clip: null, duration: 0 }
    }
};

// Animation mixers
let playerMixer, enemyMixer;
let playerModel, enemyModel;
let playerAnimations = {};
let enemyAnimations = {};

// Load character model with Draco support and animation debugging
const loader = new GLTFLoader();

// Setup and attach Draco loader
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/');
dracoLoader.setDecoderConfig({ type: 'js' }); // Use JavaScript decoder
loader.setDRACOLoader(dracoLoader);

debugLog('Starting to load character model', 'models/character.glb');

loader.load('models/character.glb',
    // Success callback
    (gltf) => {
        debugLog('Character model loaded successfully', gltf);

        // Check for Draco compression
        let hasDraco = false;
        if (gltf.parser && gltf.parser.extensions) {
            hasDraco = !!gltf.parser.extensions.KHR_draco_mesh_compression;
            debugLog('Model uses Draco compression?', hasDraco);
        }

        // Player model setup
        playerModel = gltf.scene;
        debugLog('Player model scene', playerModel);

        // Debugging model hierarchy
        debugLog('Model hierarchy:');
        playerModel.traverse((node) => {
            debugLog(`- Node: ${node.name}, Type: ${node.type}`);

            if (node.isMesh) {
                debugLog(`  Mesh found: ${node.name}`, {
                    geometry: node.geometry,
                    material: node.material,
                    vertices: node.geometry.attributes.position ? node.geometry.attributes.position.count : 'N/A'
                });

                node.castShadow = true;
                node.receiveShadow = true;
            }
        });

        // Apply scale to player model
        playerModel.scale.set(characterScale, characterScale, characterScale);
        debugLog('Applied scale to player model', characterScale);

        // Apply initial rotation to fix sideways orientation
        playerModel.rotation.copy(playerState.rotation);
        debugLog('Applied initial rotation to player model', playerState.rotation);

        playerModel.position.copy(playerState.position);
        scene.add(playerModel);
        debugLog('Added player model to scene at position', playerState.position);

        // Set up animations
        playerMixer = new THREE.AnimationMixer(playerModel);
        debugLog('Created animation mixer for player', playerMixer);

        // Debug all available animations
        debugLog(`Model has ${gltf.animations.length} animations`);
        gltf.animations.forEach((clip, index) => {
            debugLog(`Animation ${index}: ${clip.name}`, {
                duration: clip.duration,
                tracks: clip.tracks.length
            });
        });

        // Process animations
        debugLog('Begin processing animations for player');
        gltf.animations.forEach((clip) => {
            const name = clip.name.toUpperCase();
            debugLog(`Processing animation: ${clip.name} (${name})`, {
                duration: clip.duration,
                tracks: clip.tracks.length
            });

            // Check for IDLE animations
            if ((name.includes('IDLE') || name.includes('STOPPED')) && !animationMap.player.IDLE.clip) {
                debugLog(`Found IDLE animation: ${clip.name}`);
                animationMap.player.IDLE.clip = clip;
                animationMap.player.IDLE.duration = clip.duration;
                playerAnimations.IDLE = playerMixer.clipAction(clip);
                debugLog('Created IDLE animation action', playerAnimations.IDLE);
            }
            // Check for ATTACK animations
            else if ((name.includes('ATTACK') || name.includes('SHOOT') || name.includes('FIRE')) && !animationMap.player.ATTACK.clip) {
                debugLog(`Found ATTACK animation: ${clip.name}`);
                animationMap.player.ATTACK.clip = clip;
                animationMap.player.ATTACK.duration = clip.duration;
                playerAnimations.ATTACK = playerMixer.clipAction(clip);
                debugLog('Created ATTACK animation action', playerAnimations.ATTACK);
            }
            // Check for WALK animations
            else if ((name.includes('WALK') || name.includes('RUN')) && !animationMap.player.WALK.clip) {
                debugLog(`Found WALK animation: ${clip.name}`);
                animationMap.player.WALK.clip = clip;
                animationMap.player.WALK.duration = clip.duration;
                playerAnimations.WALK = playerMixer.clipAction(clip);
                debugLog('Created WALK animation action', playerAnimations.WALK);
            }
        });

        // Debug animation state
        debugLog('Final animation mapping for player', {
            IDLE: animationMap.player.IDLE.clip ? animationMap.player.IDLE.clip.name : 'Not found',
            WALK: animationMap.player.WALK.clip ? animationMap.player.WALK.clip.name : 'Not found',
            ATTACK: animationMap.player.ATTACK.clip ? animationMap.player.ATTACK.clip.name : 'Not found'
        });

        // Start with IDLE animation
        if (playerAnimations.IDLE) {
            playerAnimations.IDLE.play();
            debugLog('Started playing IDLE animation');
        } else {
            debugLog('WARNING: No IDLE animation found to play!');
        }

        // Load enemy model (same character model)
        debugLog('Starting to load enemy model');
        loader.load(
            'models/character.glb',
            // Success callback for enemy
            (gltf) => {
                debugLog('Enemy model loaded successfully');
                enemyModel = gltf.scene;
                enemyModel.traverse((node) => {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;

                        // Apply the same material adjustments to enemy model
                        if (node.material) {
                            if (node.material.isMeshStandardMaterial) {
                                node.material.roughness = 0.7;
                                node.material.metalness = 0.3;
                            }
                        }
                    }
                });

                // Apply scale to enemy model
                enemyModel.scale.set(characterScale, characterScale, characterScale);

                // Apply initial rotation to fix sideways orientation
                enemyModel.rotation.copy(enemyState.rotation);
                debugLog('Applied initial rotation to enemy model', enemyState.rotation);

                enemyModel.position.copy(enemyState.position);
                scene.add(enemyModel);

                // Set up animations
                enemyMixer = new THREE.AnimationMixer(enemyModel);

                // Process animations
                gltf.animations.forEach((clip) => {
                    const name = clip.name.toUpperCase();

                    // Check for IDLE animations
                    if ((name.includes('IDLE') || name.includes('STOPPED')) && !animationMap.enemy.IDLE.clip) {
                        animationMap.enemy.IDLE.clip = clip;
                        animationMap.enemy.IDLE.duration = clip.duration;
                        enemyAnimations.IDLE = enemyMixer.clipAction(clip);
                    }
                    // Check for ATTACK animations
                    else if ((name.includes('ATTACK') || name.includes('SHOOT') || name.includes('FIRE')) && !animationMap.enemy.ATTACK.clip) {
                        animationMap.enemy.ATTACK.clip = clip;
                        animationMap.enemy.ATTACK.duration = clip.duration;
                        enemyAnimations.ATTACK = enemyMixer.clipAction(clip);
                    }
                    // Check for WALK animations
                    else if ((name.includes('WALK') || name.includes('RUN')) && !animationMap.enemy.WALK.clip) {
                        animationMap.enemy.WALK.clip = clip;
                        animationMap.enemy.WALK.duration = clip.duration;
                        enemyAnimations.WALK = enemyMixer.clipAction(clip);
                    }
                });

                // Start with IDLE animation
                if (enemyAnimations.IDLE) {
                    enemyAnimations.IDLE.play();
                }
            },
            // Progress callback for enemy
            (xhr) => {
                const percent = (xhr.loaded / xhr.total * 100).toFixed(2);
                debugLog(`Enemy model loading progress: ${percent}%`);
            },
            // Error callback for enemy
            (error) => {
                console.error('Error loading enemy model:', error);
            }
        );
    },
    // Progress callback
    (xhr) => {
        if (xhr.lengthComputable) {
            const percent = (xhr.loaded / xhr.total * 100).toFixed(2);
            debugLog(`Character model loading progress: ${percent}%`);
        } else {
            debugLog('Loading progress update (size unknown)');
        }
    },
    // Error callback
    (error) => {
        console.error('Error loading character model:', error);
        debugLog('ERROR loading character model', error);
    }
);

// Input handling
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    space: false
};

window.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {
        case 'w': keys.w = true; break;
        case 'a': keys.a = true; break;
        case 's': keys.s = true; break;
        case 'd': keys.d = true; break;
        case ' ':
            keys.space = true;
            if (!playerState.isAttacking) {
                performAttack('player');
            }
            break;
    }
});

window.addEventListener('keyup', (e) => {
    switch (e.key.toLowerCase()) {
        case 'w': keys.w = false; break;
        case 'a': keys.a = false; break;
        case 's': keys.s = false; break;
        case 'd': keys.d = false; break;
        case ' ': keys.space = false; break;
    }
});

// Add mouse click for attack
window.addEventListener('click', () => {
    if (!playerState.isAttacking) {
        performAttack('player');
    }
});

// Resize handler - improved to properly handle window resizing
function handleWindowResize() {
    // Update camera
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    // Update renderer
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

// Initial call to set everything up correctly
handleWindowResize();

// Add event listener for window resize
window.addEventListener('resize', handleWindowResize);

// Animation handling
function setAnimation(character, animationName) {
    if (character === 'player') {
        debugLog(`Setting player animation to ${animationName}`);
    }

    const info = character === 'player' ?
        { state: playerState, animations: playerAnimations } :
        { state: enemyState, animations: enemyAnimations };

    if (info.state.currentAnimation === animationName) {
        if (character === 'player') {
            debugLog(`Animation ${animationName} already playing, skipping`);
        }
        return;
    }

    // Fade out current animation
    if (info.animations[info.state.currentAnimation]) {
        if (character === 'player') {
            debugLog(`Fading out current animation: ${info.state.currentAnimation}`);
        }
        info.animations[info.state.currentAnimation].fadeOut(0.2);
    } else if (character === 'player') {
        debugLog(`No current animation to fade out`);
    }

    // Fade in new animation
    if (info.animations[animationName]) {
        if (character === 'player') {
            debugLog(`Fading in new animation: ${animationName}`);
        }
        info.animations[animationName].reset();
        info.animations[animationName].fadeIn(0.2);
        info.animations[animationName].play();
        info.state.currentAnimation = animationName;
    } else if (character === 'player') {
        debugLog(`WARNING: Animation ${animationName} not found`);
    }
}

function performAttack(character) {
    const info = character === 'player' ?
        { state: playerState, animations: playerAnimations, map: animationMap.player } :
        { state: enemyState, animations: enemyAnimations, map: animationMap.enemy };

    info.state.isAttacking = true;
    setAnimation(character, 'ATTACK');

    // Reset to IDLE after attack animation completes
    setTimeout(() => {
        info.state.isAttacking = false;
        setAnimation(character, 'IDLE');
    }, info.map.ATTACK.duration * 1000);
}

// Player movement and camera following
function updatePlayer(deltaTime) {
    if (playerState.isAttacking || !playerModel) return;

    let moving = false;

    // Rotate with A/D keys
    if (keys.a) {
        playerModel.rotation.y += playerState.rotationSpeed * deltaTime;
    }
    if (keys.d) {
        playerModel.rotation.y -= playerState.rotationSpeed * deltaTime;
    }

    // Store the current rotation
    playerState.rotation.y = playerModel.rotation.y;

    // Move forward/backward with W/S keys
    if (keys.w || keys.s) {
        moving = true;

        // Calculate forward direction based on current rotation
        const direction = keys.w ? -1 : 1; // Inverted to fix the backward/forward issue

        // Calculate movement direction based on the model's forward direction
        const forwardX = -Math.sin(playerModel.rotation.y);
        const forwardZ = -Math.cos(playerModel.rotation.y);

        // Move player in the direction they're facing
        playerState.velocity.x = forwardX * playerState.moveSpeed * direction;
        playerState.velocity.z = forwardZ * playerState.moveSpeed * direction;

        // Calculate new position
        const newPosX = playerState.position.x + playerState.velocity.x * deltaTime;
        const newPosZ = playerState.position.z + playerState.velocity.z * deltaTime;

        // Simple collision detection with the tree
        const treeRadius = 4; // Approximate radius of tree base
        const distanceToTree = Math.sqrt(newPosX * newPosX + newPosZ * newPosZ);

        // Only update position if not colliding with tree
        if (distanceToTree > treeRadius) {
            playerState.position.x = newPosX;
            playerState.position.z = newPosZ;
            playerModel.position.copy(playerState.position);
        }
    }

    // Update animation
    if (moving) {
        setAnimation('player', 'WALK');
    } else {
        setAnimation('player', 'IDLE');
    }

    // Update camera position to follow player
    const cameraOffsetX = -Math.sin(playerModel.rotation.y) * 10;
    const cameraOffsetZ = -Math.cos(playerModel.rotation.y) * 10;

    camera.position.x = playerState.position.x + cameraOffsetX;
    camera.position.z = playerState.position.z + cameraOffsetZ;
    camera.position.y = playerState.position.y + 5;
    camera.lookAt(playerState.position);
}

// Enemy AI
function updateEnemy(deltaTime) {
    if (!enemyModel || !playerModel || enemyState.isAttacking) return;

    // Calculate direction to player
    const direction = new THREE.Vector3().subVectors(playerState.position, enemyState.position);
    const distance = direction.length();

    // Update enemy behavior based on distance to player
    if (distance < enemyState.attackDistance) {
        // Attack the player if cooldown expired
        if (enemyState.attackCooldown <= 0) {
            performAttack('enemy');
            enemyState.attackCooldown = 2; // 2 seconds cooldown
        }
    } else if (distance < enemyState.followDistance) {
        // Follow the player
        direction.normalize();

        // Determine the angle to rotate the enemy
        const targetAngle = Math.atan2(direction.x, direction.z);

        // Smoothly rotate the enemy
        const currentAngle = enemyModel.rotation.y;
        let angleDiff = targetAngle - currentAngle;

        // Handle crossing the -PI to PI boundary
        if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        enemyModel.rotation.y += angleDiff * Math.min(3 * deltaTime, 1.0);
        enemyState.rotation.y = enemyModel.rotation.y;

        // Calculate movement direction based on the model's forward direction
        const forwardX = -Math.sin(enemyModel.rotation.y);
        const forwardZ = -Math.cos(enemyModel.rotation.y);

        // Move enemy towards player (use -1 to match the player's forward direction)
        enemyState.velocity.x = forwardX * enemyState.moveSpeed * -1;
        enemyState.velocity.z = forwardZ * enemyState.moveSpeed * -1;

        // Calculate new position
        const newPosX = enemyState.position.x + enemyState.velocity.x * deltaTime;
        const newPosZ = enemyState.position.z + enemyState.velocity.z * deltaTime;

        // Simple collision detection with the tree
        const treeRadius = 4; // Approximate radius of tree base
        const distanceToTree = Math.sqrt(newPosX * newPosX + newPosZ * newPosZ);

        // Only update position if not colliding with tree
        if (distanceToTree > treeRadius) {
            enemyState.position.x = newPosX;
            enemyState.position.z = newPosZ;
            enemyModel.position.copy(enemyState.position);
        }

        setAnimation('enemy', 'WALK');
    } else {
        // Idle when too far
        setAnimation('enemy', 'IDLE');
    }

    // Update attack cooldown
    if (enemyState.attackCooldown > 0) {
        enemyState.attackCooldown -= deltaTime;
    }
}

// Animation loop
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();

    // Update animation mixers
    if (playerMixer) playerMixer.update(deltaTime);
    if (enemyMixer) enemyMixer.update(deltaTime);

    // Update player and camera
    updatePlayer(deltaTime);

    // Update enemy AI
    updateEnemy(deltaTime);

    // Render scene
    renderer.render(scene, camera);
}

animate();

