# 3D Model Tester

A simple Three.js application for testing 3D models with animations. This project allows you to quickly load and visualize your character models in a 3D environment with basic movement and animation controls.

## Features

- Real-time 3D rendering with Three.js
- Camera that follows the player character
- Basic character controls with animations
- Simple enemy AI behavior
- Environment with lighting and shadows

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

## Running the Project

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or another port if 5173 is already in use).

To build for production:

```bash
npm run build
```

To preview the production build:

```bash
npm run preview
```

## Controls

- **W**: Move forward
- **S**: Move backward
- **A**: Rotate left
- **D**: Rotate right
- **Space**: Attack

## Using Your Own Character Model

The player character model is located at `public/models/character.glb`. To use your own model:

1. Prepare your GLB file with the following animations:
   - IDLE: A standing idle animation
   - WALK: A walking animation
   - ATTACK: An attack animation

2. Replace the existing `character.glb` file in the `public/models/` directory with your own model file (keep the same filename).

3. If your model has different animation names or requirements, you may need to adjust the animation mapping in the source code.

## Customization Options

You can modify several aspects of the character and environment in the code:

### Character Customization

- **Character Scale**: Change the `characterScale` variable in the source code to adjust the size of your character model.
- **Initial Position and Rotation**: Modify the `playerState.position` and `playerState.rotation` values to change where and how your character initially appears.
- **Shadow Properties**: Character meshes have `castShadow` and `receiveShadow` enabled by default - these can be modified for different lighting effects.

### Animation Customization

- The project uses Three.js AnimationMixer to handle animations
- You can adjust animation speeds, transitions, and blending in the animation controller code
- Animation names can be remapped to match your model's specific animation naming conventions

### Debug Options

The code includes a debugging system that logs model information to the console:
- Model hierarchy details
- Animation information
- Draco compression detection
- Mesh and material properties

## Technical Requirements

- Your model should be in GLB format with embedded animations
- For best results, the model should be Y-up oriented
- Animations should be named consistently (IDLE, WALK, ATTACK)

## Troubleshooting

If your model doesn't appear or animate correctly:
- Check the browser console for errors
- Verify your model has the required animations
- Ensure your model is properly rigged if using animations
- Make sure the scale of your model is appropriate
