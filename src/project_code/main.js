import { ResizeSystem } from '../engine/systems/ResizeSystem.js';
import { UpdateSystem } from '../engine/systems/UpdateSystem.js';

import { GLTFLoader } from '../engine/loaders/GLTFLoader.js';
//import { UnlitRenderer } from '../engine/renderers/UnlitRenderer.js';
import { TurntableController } from '../engine/controllers/TurntableController.js';
import { getGlobalModelMatrix } from '../engine/core/SceneUtils.js';
import { FirstPersonController } from '../engine/controllers/FirstPersonController.js';

import {
    calculateAxisAlignedBoundingBox,
    mergeAxisAlignedBoundingBoxes,
} from '../engine/core/MeshUtils.js';

import { Physics } from '../engine/Physics.js';

import { Renderer } from './Renderer.js';

import { Light } from './Light.js';

import { UILayoutLoader } from './UIcode/UILayoutLoader.js';
import { UIRenderer } from './UIcode/UIRenderer.js';

import {
    Camera,
    Material,
    Model,
    Node,
    Primitive,
    Sampler,
    Texture,
    Transform,
} from '../engine/core.js';
import { initScene } from './initScene.js';
import { RotateAnimator } from '../engine/animators/RotateAnimator.js';
import { Pause } from './pause.js';
import { PauseLayoutLoader } from './UIcode/PauseLayoutLoader.js';
import { Timer } from './timer.js';
import { PlayerGameLogic } from './playerGameLogic.js';
import { ShakingAnimation } from './shakingAnimation.js';
import { DeathLayoutLoader } from './UIcode/DeathLayoutLoader.js';
import { VictoryLayoutLoader } from './UIcode/VictoryLayoutLoader.js';
import { StartLayoutLoader } from './UIcode/StartLayoutLoader.js';

const canvas = document.getElementById('webgpuCanvas');
const renderer = new Renderer(canvas);
await renderer.initialize();

const loader = new GLTFLoader();
await loader.load('../../res/scene/mainScene.gltf');

const scene = loader.loadScene(loader.defaultScene);
const camera = loader.loadNode('Camera');

//console.log(scene)

const pauseCheck = new Pause(canvas);
let globalTimer = new Timer();

camera.addComponent(new FirstPersonController(camera, canvas));
camera.isDynamic = true;
camera.aabb = {
    min: [-0.4, -1.9, -0.4],
    max: [0.4, 0.6, 0.4],
};

var isStart = true;

// Collision and physics in the scene
const physics = new Physics(scene);
scene.traverse(node => {
    const model = node.getComponentOfType(Model);
    if (!model) {
        return;
    }

    const boxes = model.primitives.map(primitive => calculateAxisAlignedBoundingBox(primitive.mesh));
    node.aabb = mergeAxisAlignedBoundingBoxes(boxes);
    
    node.isStatic = true;
});


// Light - spotlight
const light = new Node();

light.addComponent(new Transform({
    translation: [0.4,-0.9,0],
}));
light.addComponent(new Light({
    domElement: canvas,
    node: light,
    timer: globalTimer,
}));
camera.addChild(light);

camera.addComponent(new PlayerGameLogic({node: camera, light: light ,timer: globalTimer, domElement: canvas, scene: scene}));
camera.addComponent(new ShakingAnimation({node: camera, timer: globalTimer}));

//init audio components
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

await initScene(scene, audioCtx, camera, light, globalTimer, canvas.ownerDocument, pauseCheck);


//initialize all 2D components of game
const canvas2d = document.getElementById("2dCanvas")
canvas2d.width = window.innerWidth;
canvas2d.height = window.innerHeight;
const uiLayoutLoader = new UILayoutLoader(canvas2d, camera.getComponentOfType(PlayerGameLogic), globalTimer);
const uiLayout = await uiLayoutLoader.getLayout();
const pauseLayoutLoader = new PauseLayoutLoader(canvas2d);
const pauseLayout = await pauseLayoutLoader.getLayout();
const deathLayoutLoader = new DeathLayoutLoader(canvas2d, globalTimer);
const deathLayout = await deathLayoutLoader.getLayout();
const victoryLayoutLoader = new VictoryLayoutLoader(canvas2d, globalTimer);
const victoryLayout = await victoryLayoutLoader.getLayout();
const startLayoutLoader = new StartLayoutLoader(canvas2d);
const startLayout = await startLayoutLoader.getLayout();
const uiRenderer = new UIRenderer(canvas2d);
uiRenderer.init();

//set timer before first loop
globalTimer.update();

//Key listener
document.addEventListener("mousedown", e => {
    
    if(camera.getComponentOfType(PlayerGameLogic).won || camera.getComponentOfType(PlayerGameLogic).dead){
        location.reload();
    }

});

function update(t, dt) {

    globalTimer.update();

    if(camera.getComponentOfType(PlayerGameLogic).won){
        for(const element of victoryLayout){
            element?.update();
        }
        return;
    }

    if(camera.getComponentOfType(PlayerGameLogic).dead){
        if (audioCtx.state === "running") {
            audioCtx.suspend();
        }
        for(const element of deathLayout){
            element?.update();
        }
        return;
    }

    if(pauseCheck.paused){
        if (audioCtx.state === "running") {
            audioCtx.suspend();
        }
        return;
    }
    else {
        if (audioCtx.state === "suspended") {
            audioCtx.resume()
        }
    }


    scene.traverse(node => {
        for (const component of node.components) {
            component.update?.(t, dt);
        }
    });

    physics.update(t, dt);

    for(const element of uiLayout){
        element?.update();
    }
}


function render() {
    if(camera.getComponentOfType(PlayerGameLogic).won){
        uiRenderer.render(victoryLayout);
        return;
    }

    if(camera.getComponentOfType(PlayerGameLogic).dead){
        uiRenderer.render(deathLayout);
        return;
    }

    if(!pauseCheck.paused){
        isStart = false;
        renderer.render(scene, camera, light);
        uiRenderer.render(uiLayout);
    }
    else{
        if (isStart) {
            uiRenderer.render(startLayout);
        } else {
            uiRenderer.render(pauseLayout);
        }
    }
}

function resize({ displaySize: { width, height }}) {
    camera.getComponentOfType(Camera).aspect = width / height;
}

window.addEventListener("resize", (event) => {
    canvas2d.width = window.innerWidth;
    canvas2d.height = window.innerHeight;
});

new ResizeSystem({ canvas, resize }).start();
new UpdateSystem({ update, render }).start();