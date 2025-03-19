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
    runSpeed: 10,
    rotationSpeed: 3,
    isAttacking: false,
    isJumping: false,
    jumpHeight: 3,
    jumpSpeed: 5
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
        RUN: { clip: null, duration: 0 },
        JUMP: { clip: null, duration: 0 },
        ATTACK: { clip: null, duration: 0 }
    },
    enemy: {
        IDLE: { clip: null, duration: 0 },
        WALK: { clip: null, duration: 0 },
        RUN: { clip: null, duration: 0 },
        JUMP: { clip: null, duration: 0 },
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
    space: false,
    shift: false,
    f: false
};

window.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {
        case 'w': keys.w = true; break;
        case 'a': keys.a = true; break;
        case 's': keys.s = true; break;
        case 'd': keys.d = true; break;
        case ' ':
            keys.space = true;
            // Only try to jump if not already jumping and not attacking
            if (!playerState.isJumping && !playerState.isAttacking) {
                performJump('player');
            }
            break;
        case 'shift': keys.shift = true; break;
        case 'f':
            keys.f = true;
            if (!playerState.isAttacking && !playerState.isJumping) {
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
        case 'shift': keys.shift = false; break;
        case 'f': keys.f = false; break;
    }
});

// Update mouse click for attack
window.addEventListener('click', () => {
    if (!playerState.isAttacking && !playerState.isJumping) {
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
        debugLog(`Requested animation: ${animationName}`);
    }

    const info = character === 'player' ?
        { state: playerState, animations: playerAnimations, mixer: playerMixer } :
        { state: enemyState, animations: enemyAnimations, mixer: enemyMixer };

    // If animation doesn't exist, do nothing
    if (!info.animations[animationName]) {
        if (character === 'player') {
            debugLog(`Animation ${animationName} not found - ignoring request`);
        }
        return;
    }

    // If we're already playing this animation, don't do anything
    if (info.state.currentAnimation === animationName) {
        if (character === 'player') {
            debugLog(`Animation ${animationName} already playing, skipping`);
        }
        return;
    }

    // First stop all current animations
    if (info.mixer) {
        info.mixer.stopAllAction();
        if (character === 'player') {
            debugLog(`Stopped all animations before playing ${animationName}`);
        }
    }

    // Configure the animation
    if (animationName === 'ATTACK' || animationName === 'JUMP') {
        info.animations[animationName].setLoop(THREE.LoopOnce);
        info.animations[animationName].clampWhenFinished = true;
    } else {
        info.animations[animationName].setLoop(THREE.LoopRepeat, Infinity);
    }

    // Make sure animation has proper weight
    info.animations[animationName].setEffectiveWeight(1.0);

    // Play the animation
    info.animations[animationName].reset();
    info.animations[animationName].play();
    info.state.currentAnimation = animationName;

    if (character === 'player') {
        debugLog(`Now playing ${animationName} animation`);
    }
}

function performAttack(character) {
    const info = character === 'player' ?
        { state: playerState, animations: playerAnimations, map: animationMap.player } :
        { state: enemyState, animations: enemyAnimations, map: animationMap.enemy };

    // If attack animation doesn't exist, don't do anything
    if (!info.animations.ATTACK) {
        if (character === 'player') {
            debugLog(`Cannot perform attack - no ATTACK animation exists`);
        }
        return;
    }

    info.state.isAttacking = true;
    setAnimation(character, 'ATTACK');

    // Use animation duration if available, otherwise default to 1 second
    const attackDuration = info.map.ATTACK.duration > 0 ?
        info.map.ATTACK.duration : 1.0;

    // Reset to IDLE after attack animation completes
    setTimeout(() => {
        info.state.isAttacking = false;
        // Only try to set IDLE if it exists
        if (info.animations.IDLE) {
            setAnimation(character, 'IDLE');
        }
    }, attackDuration * 1000);
}

// Player movement and camera following
function updatePlayer(deltaTime) {
    if (!playerModel) return;

    // If attacking and not jumping, don't process movement
    if (playerState.isAttacking && !playerState.isJumping) return;

    let moving = false;
    let running = false;

    // Rotate with A/D keys
    if (keys.a) {
        playerModel.rotation.y += playerState.rotationSpeed * deltaTime;
    }
    if (keys.d) {
        playerModel.rotation.y -= playerState.rotationSpeed * deltaTime;
    }

    // Store the current rotation
    playerState.rotation.y = playerModel.rotation.y;

    // Handle jumping (vertical movement)
    if (playerState.isJumping) {
        // Apply gravity to vertical movement
        playerState.velocity.y -= 9.8 * deltaTime;

        // Update vertical position
        playerState.position.y += playerState.velocity.y * deltaTime;

        // Check if player has returned to the ground
        if (playerState.position.y <= 0) {
            playerState.position.y = 0;
            playerState.velocity.y = 0;
            playerState.isJumping = false;
            debugLog("Player landed on the ground");

            // Return to IDLE or WALK/RUN animation depending on if moving
            if (keys.w || keys.s) {
                moving = true;
                running = keys.shift;

                if (running && playerAnimations.RUN) {
                    setAnimation('player', 'RUN');
                } else if (playerAnimations.WALK) {
                    setAnimation('player', 'WALK');
                }
            } else if (playerAnimations.IDLE) {
                setAnimation('player', 'IDLE');
            }
        }

        // Update the vertical position of the model
        playerModel.position.y = playerState.position.y;
    }

    // Move forward/backward with W/S keys
    if (keys.w || keys.s) {
        moving = true;
        running = keys.shift;

        // Calculate forward direction based on current rotation
        const direction = keys.w ? -1 : 1; // Inverted to fix the backward/forward issue

        // Calculate movement direction based on the model's forward direction
        const forwardX = -Math.sin(playerModel.rotation.y);
        const forwardZ = -Math.cos(playerModel.rotation.y);

        // Determine speed based on running or walking
        const currentSpeed = running ? playerState.runSpeed : playerState.moveSpeed;

        // Move player in the direction they're facing
        playerState.velocity.x = forwardX * currentSpeed * direction;
        playerState.velocity.z = forwardZ * currentSpeed * direction;

        // Calculate new position
        const newPosX = playerState.position.x + playerState.velocity.x * deltaTime;
        const newPosZ = playerState.position.z + playerState.velocity.z * deltaTime;

        // Define map boundaries (half-width and half-depth of the ground plane)
        const mapBoundary = 25;

        // Simple collision detection with the tree - ADJUSTING RADIUS TO MATCH TRUNK SIZE
        const treeRadius = 0.7;
        const distanceToTree = Math.sqrt(newPosX * newPosX + newPosZ * newPosZ);

        // Only update position if not colliding with tree AND within map boundaries
        if (distanceToTree > treeRadius &&
            Math.abs(newPosX) < mapBoundary &&
            Math.abs(newPosZ) < mapBoundary) {
            playerState.position.x = newPosX;
            playerState.position.z = newPosZ;
            playerModel.position.x = playerState.position.x;
            playerModel.position.z = playerState.position.z;
        }
    }

    // Update animation only if we have the needed animations and not jumping or attacking
    if (!playerState.isJumping && !playerState.isAttacking) {
        if (moving) {
            if (running && playerAnimations.RUN) {
                setAnimation('player', 'RUN');
            } else if (playerAnimations.WALK) {
                setAnimation('player', 'WALK');
            }
        } else if (playerAnimations.IDLE) {
            setAnimation('player', 'IDLE');
        }
    }

    // Update camera position to follow player - adjusted to consider vertical position
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

        // Calculate new position for enemy
        const newPosX = enemyState.position.x + enemyState.velocity.x * deltaTime;
        const newPosZ = enemyState.position.z + enemyState.velocity.z * deltaTime;

        // Define map boundaries (half-width and half-depth of the ground plane)
        const mapBoundary = 25; // Half of the 50x50 ground size

        // Simple collision detection with the tree
        const treeRadius = 0.7; // Adjusted to match actual tree trunk radius
        const distanceToTree = Math.sqrt(newPosX * newPosX + newPosZ * newPosZ);

        // Only update position if not colliding with tree AND within map boundaries
        if (distanceToTree > treeRadius &&
            Math.abs(newPosX) < mapBoundary &&
            Math.abs(newPosZ) < mapBoundary) {
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

// Add file upload UI
function createUploadUI() {
    const uploadContainer = document.createElement('div');
    uploadContainer.className = 'upload-container';
    uploadContainer.innerHTML = `
        <div class="upload-box" id="upload-box">
            <p>Drag & Drop your 3D model here<br>or</p>
            <input type="file" id="file-input" accept=".glb,.gltf">
            <label for="file-input">Select File</label>
            <p class="supported-formats">Supported formats: GLB, GLTF</p>
        </div>
    `;

    document.body.appendChild(uploadContainer);

    setupUploadListeners();
}

// Set up event listeners for file upload
function setupUploadListeners() {
    const uploadBox = document.getElementById('upload-box');
    const fileInput = document.getElementById('file-input');

    // Highlight drop area when file is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadBox.addEventListener(eventName, e => {
            e.preventDefault();
            uploadBox.classList.add('highlight');
        }, false);
    });

    // Remove highlight when file leaves the drop area
    ['dragleave', 'drop'].forEach(eventName => {
        uploadBox.addEventListener(eventName, e => {
            e.preventDefault();
            uploadBox.classList.remove('highlight');
        }, false);
    });

    // Handle file drop
    uploadBox.addEventListener('drop', e => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && isValidModelFile(file)) {
            loadCustomModel(file);
        } else {
            alert('Please upload a .glb or .gltf file');
        }
    }, false);

    // Handle file selection via the input
    fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file && isValidModelFile(file)) {
            loadCustomModel(file);
        } else {
            alert('Please upload a .glb or .gltf file');
        }
    }, false);
}

// Check if file is a valid 3D model format
function isValidModelFile(file) {
    const validExtensions = ['.glb', '.gltf'];
    const fileName = file.name.toLowerCase();
    return validExtensions.some(ext => fileName.endsWith(ext));
}

// Load custom model from user's file
function loadCustomModel(file) {
    debugLog('Loading custom model', file.name);

    // Create a URL for the file
    const url = URL.createObjectURL(file);

    // Track the old models to ensure proper cleanup
    const oldPlayerModel = playerModel;
    const oldEnemyModel = enemyModel;

    // Reset all animation states
    playerAnimations = {};
    enemyAnimations = {};
    animationMap.player = {
        IDLE: { clip: null, duration: 0 },
        WALK: { clip: null, duration: 0 },
        RUN: { clip: null, duration: 0 },
        JUMP: { clip: null, duration: 0 },
        ATTACK: { clip: null, duration: 0 }
    };
    animationMap.enemy = {
        IDLE: { clip: null, duration: 0 },
        WALK: { clip: null, duration: 0 },
        RUN: { clip: null, duration: 0 },
        JUMP: { clip: null, duration: 0 },
        ATTACK: { clip: null, duration: 0 }
    };

    // First load for player
    loader.load(
        url,
        // Success callback
        (gltf) => {
            debugLog('Custom model loaded successfully for player', gltf);

            // Store player position and rotation before removing the old model
            const playerPos = playerState.position.clone();
            const playerRot = playerState.rotation.clone();

            // Remove existing player model if it exists
            if (oldPlayerModel) {
                // Stop all animations before removing
                if (playerMixer) {
                    playerMixer.stopAllAction();
                    playerMixer.uncacheRoot(oldPlayerModel);
                }
                scene.remove(oldPlayerModel);
            }

            // Player model setup
            playerModel = gltf.scene;

            // Set up model properties
            playerModel.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });

            // Apply scale to player model
            playerModel.scale.set(characterScale, characterScale, characterScale);

            // Apply rotation and position from saved values
            playerModel.rotation.copy(playerRot);
            playerModel.position.copy(playerPos);
            scene.add(playerModel);

            // Save current state
            playerState.position.copy(playerPos);
            playerState.rotation.copy(playerRot);
            playerState.currentAnimation = 'NONE';

            // Create a new animation mixer for the player
            playerMixer = new THREE.AnimationMixer(playerModel);

            // Process animations for player
            processModelAnimations(gltf, 'player');

            // Now load for the enemy
            loader.load(
                url,
                // Success callback for enemy
                (gltf) => {
                    debugLog('Custom model loaded successfully for enemy', gltf);

                    // Store enemy position and rotation before removing old model
                    const enemyPos = enemyState.position.clone();
                    const enemyRot = enemyState.rotation.clone();

                    // Remove existing enemy model if it exists
                    if (oldEnemyModel) {
                        // Stop all animations before removing
                        if (enemyMixer) {
                            enemyMixer.stopAllAction();
                            enemyMixer.uncacheRoot(oldEnemyModel);
                        }
                        scene.remove(oldEnemyModel);
                    }

                    // Enemy model setup
                    enemyModel = gltf.scene;

                    // Set up enemy model properties
                    enemyModel.traverse((node) => {
                        if (node.isMesh) {
                            node.castShadow = true;
                            node.receiveShadow = true;
                        }
                    });

                    // Apply scale to enemy model
                    enemyModel.scale.set(characterScale, characterScale, characterScale);

                    // Apply rotation and position from saved values
                    enemyModel.rotation.copy(enemyRot);
                    enemyModel.position.copy(enemyPos);
                    scene.add(enemyModel);

                    // Save current state
                    enemyState.position.copy(enemyPos);
                    enemyState.rotation.copy(enemyRot);
                    enemyState.currentAnimation = 'NONE';

                    // Create a new animation mixer for the enemy
                    enemyMixer = new THREE.AnimationMixer(enemyModel);

                    // Process animations for enemy
                    processModelAnimations(gltf, 'enemy');

                    // Clean up the object URL after both models are set up
                    URL.revokeObjectURL(url);

                    const foundAnimations = Object.keys(playerAnimations).filter(key => playerAnimations[key] !== undefined);
                    alert(`Model "${file.name}" loaded successfully!\nFound animations: ${foundAnimations.join(', ') || 'None'}`);
                },
                // Progress callback for enemy
                (xhr) => {
                    if (xhr.lengthComputable) {
                        const percent = (xhr.loaded / xhr.total * 100).toFixed(2);
                        debugLog(`Enemy model loading progress: ${percent}%`);
                    }
                },
                // Error callback for enemy
                (error) => {
                    console.error('Error loading enemy model:', error);
                    debugLog('ERROR loading enemy model', error);
                    URL.revokeObjectURL(url);
                }
            );
        },
        // Progress callback for player
        (xhr) => {
            if (xhr.lengthComputable) {
                const percent = (xhr.loaded / xhr.total * 100).toFixed(2);
                debugLog(`Player model loading progress: ${percent}%`);
            }
        },
        // Error callback for player
        (error) => {
            console.error('Error loading player model:', error);
            debugLog('ERROR loading player model', error);
            alert('Error loading model. Please try a different file.');
            URL.revokeObjectURL(url);
        }
    );
}

// Helper function to process animations for both player and enemy
function processModelAnimations(gltf, characterType) {
    const info = characterType === 'player' ?
        { animations: playerAnimations, map: animationMap.player, mixer: playerMixer, state: playerState } :
        { animations: enemyAnimations, map: animationMap.enemy, mixer: enemyMixer, state: enemyState };

    let hasFoundValidAnimation = false;

    // Process animations - only accept those with specific names
    gltf.animations.forEach((clip) => {
        const name = clip.name.toUpperCase();

        // Check for IDLE animations
        if (name.includes('IDLE') || name.includes('STOPPED')) {
            info.map.IDLE.clip = clip;
            info.map.IDLE.duration = clip.duration;
            info.animations.IDLE = info.mixer.clipAction(clip);
            info.animations.IDLE.setLoop(THREE.LoopRepeat);
            if (characterType === 'player') {
                debugLog(`Found IDLE animation for ${characterType}: "${clip.name}"`);
            }
            hasFoundValidAnimation = true;
        }
        // Check for WALK animations
        else if (name.includes('WALK')) {
            info.map.WALK.clip = clip;
            info.map.WALK.duration = clip.duration;
            info.animations.WALK = info.mixer.clipAction(clip);
            info.animations.WALK.setLoop(THREE.LoopRepeat);
            if (characterType === 'player') {
                debugLog(`Found WALK animation for ${characterType}: "${clip.name}"`);
            }
            hasFoundValidAnimation = true;
        }
        // Check for RUN animations
        else if (name.includes('RUN') || name.includes('SPRINT')) {
            info.map.RUN.clip = clip;
            info.map.RUN.duration = clip.duration;
            info.animations.RUN = info.mixer.clipAction(clip);
            info.animations.RUN.setLoop(THREE.LoopRepeat);
            if (characterType === 'player') {
                debugLog(`Found RUN animation for ${characterType}: "${clip.name}"`);
            }
            hasFoundValidAnimation = true;
        }
        // Check for JUMP animations
        else if (name.includes('JUMP') || name.includes('LEAP')) {
            info.map.JUMP.clip = clip;
            info.map.JUMP.duration = clip.duration;
            info.animations.JUMP = info.mixer.clipAction(clip);
            info.animations.JUMP.setLoop(THREE.LoopOnce);
            info.animations.JUMP.clampWhenFinished = true;
            if (characterType === 'player') {
                debugLog(`Found JUMP animation for ${characterType}: "${clip.name}"`);
            }
            hasFoundValidAnimation = true;
        }
        // Check for ATTACK animations
        else if (name.includes('ATTACK') || name.includes('SHOOT') || name.includes('FIRE')) {
            info.map.ATTACK.clip = clip;
            info.map.ATTACK.duration = clip.duration;
            info.animations.ATTACK = info.mixer.clipAction(clip);
            info.animations.ATTACK.setLoop(THREE.LoopOnce);
            info.animations.ATTACK.clampWhenFinished = true;
            if (characterType === 'player') {
                debugLog(`Found ATTACK animation for ${characterType}: "${clip.name}"`);
            }
            hasFoundValidAnimation = true;
        }
    });

    // If we found any valid animations, play IDLE if available
    if (hasFoundValidAnimation) {
        if (info.animations.IDLE) {
            // Make sure nothing else is playing
            info.mixer.stopAllAction();

            // Play the IDLE animation
            info.animations.IDLE.play();
            info.state.currentAnimation = 'IDLE';
            if (characterType === 'player') {
                debugLog(`Started playing IDLE animation for ${characterType}`);
            }
        } else if (characterType === 'player') {
            // No IDLE found but we have other animations - don't auto-play anything
            debugLog('No IDLE animation found. Model loaded without automatic animation.');
        }
    } else if (characterType === 'player') {
        // No valid animations found at all
        debugLog('No valid animations found in model. The model will be static.');
    }
}

// Create the upload UI
createUploadUI();

// Fix the jump function to work properly with physics
function performJump(character) {
    const info = character === 'player' ?
        { state: playerState, animations: playerAnimations, map: animationMap.player } :
        { state: enemyState, animations: enemyAnimations, map: animationMap.enemy };

    // If no jump animation or already jumping, don't do anything
    if (info.state.isJumping) {
        if (character === 'player') {
            debugLog(`Cannot perform jump - already jumping`);
        }
        return;
    }

    // Set the jumping state
    info.state.isJumping = true;

    // Set initial jump velocity
    info.state.velocity.y = info.state.jumpSpeed;

    // Play jump animation if it exists
    if (info.animations.JUMP) {
        setAnimation(character, 'JUMP');
    }

    // Log the jump
    if (character === 'player') {
        debugLog(`Player is jumping with velocity: ${info.state.velocity.y}`);
    }
}

