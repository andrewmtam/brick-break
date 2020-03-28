import React from 'react';
import { noop } from 'lodash';
import { Edge, Vec2, World } from 'planck-js';
import * as PIXI from 'pixi.js';
import { BodyType } from './Scene/types';
import { renderToPixi, setupCanvas } from './Scene/renderHelpers';
import {
    retinaScale,
    physicalWidth,
    physicalHeight,
    zoom,
    width,
    height,
    gameData,
    indexedBodyData,
    graphicsMap,
    stepCallbacksManager,
    resetData,
} from './Scene/state';
import {
    transformCanvasCoordinateToPhysical,
    onClickFactory,
    onMoveFactory,
} from './Scene/eventHelpers';
import { createBody, setupNextRound } from './Scene/physicsHelpers';
import { onBeginContact, onRemoveBody, onAddBody } from './Scene/worldHooks';
import { restoreStateOfTheWorld } from './Scene/saveHelpers';

// TODO:
// Make a way to call balls back
// Add power ups
//  * clear row
// Add fast forward button
// Fix offset for text in triangle
// Add remembering game state
//
//

// @ts-ignore
window.gameData = gameData;
// @ts-ignore
window.indexedBodyData = indexedBodyData;
// @ts-ignore
window.graphicsMap = graphicsMap;

// Destroy all the balls
// Create all the new balls
// Create the next round of blocks

// Each round renders 3 - 6 more squares
// Sometimes squares are double value
// Sometimes there are +1 balls
// Sometimes there are blasters
export const Scene = ({ restoreFromState }: { restoreFromState: boolean }) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const pixiRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        const pixiContainer = pixiRef.current;
        if (!pixiContainer) {
            return;
        }

        const world = new World(Vec2(0, 0));

        PIXI.settings.RESOLUTION = window.devicePixelRatio;
        const app = new PIXI.Application({
            antialias: true,
            width: physicalWidth,
            height: physicalHeight,
            resizeTo: pixiContainer,
        });

        pixiContainer.append(app.view);
        app.view.style.width = '100%';
        app.view.style.height = '100%';

        const onClick = onClickFactory(world)(transformCanvasCoordinateToPhysical);
        const onMove = onMoveFactory(world)(transformCanvasCoordinateToPhysical);

        app.stage.transform.scale.set(zoom / retinaScale, -zoom / retinaScale);
        app.stage.transform.position.set(physicalWidth / 2, physicalHeight / 2);
        app.stage.interactive = true;
        app.renderer.plugins.interaction.on('mousedown', (e: PIXI.interaction.InteractionEvent) => {
            onClick(e.data.originalEvent);
        });
        app.renderer.plugins.interaction.on('mousemove', (e: PIXI.interaction.InteractionEvent) => {
            onMove(e.data.originalEvent);
        });
        app.renderer.plugins.interaction.on('touchend', (e: PIXI.interaction.InteractionEvent) => {
            onClick(e.data.originalEvent);
        });
        app.renderer.plugins.interaction.on('touchmove', (e: PIXI.interaction.InteractionEvent) => {
            onMove(e.data.originalEvent);
        });

        // Add the ray
        const rayGraphic = new PIXI.Graphics();
        app.stage.addChild(rayGraphic);

        const style = new PIXI.TextStyle({
            align: 'center',
            fontFamily: 'Arial',
            fontSize: 24,
            fontWeight: 'bold',
            fill: ['#ffffff', '#00ff99'], // gradient
            stroke: '#4a1850',
            strokeThickness: 1,
            wordWrap: true,
            wordWrapWidth: 440,
        });
        const ballText = new PIXI.Text('testinggg', style);
        ballText.scale.set(1 / zoom, -1 / zoom);
        app.stage.addChild(ballText);

        // Only for physical collision
        world.on('begin-contact', onBeginContact(world, app));
        world.on('remove-body', onRemoveBody(app));

        // @ts-ignore
        world.on('add-body', onAddBody(app));

        // Create walls, but we don't need to draw them on the canvas
        // Left wall
        createBody({
            world,
            bodyType: BodyType.Wall,
            onAfterCreateBody: body =>
                body.createFixture({
                    shape: Edge(Vec2(-width / 2, height / 2), Vec2(-width / 2, -height / 2)),
                    restitution: 1,
                    friction: 0,
                }),
        });

        // Right wall
        createBody({
            world,
            bodyType: BodyType.Wall,
            onAfterCreateBody: body =>
                body.createFixture({
                    shape: Edge(Vec2(width / 2, -height / 2), Vec2(width / 2, height / 2)),
                    restitution: 1,
                    friction: 0,
                }),
        });

        // Top wall
        createBody({
            world,
            bodyType: BodyType.Wall,
            onAfterCreateBody: body =>
                body.createFixture({
                    shape: Edge(Vec2(width / 2, height / 2), Vec2(-width / 2, height / 2)),
                    restitution: 1,
                    friction: 0,
                }),
        });

        // Bottom wall
        createBody({
            world,
            bodyType: BodyType.Wall,
            bodyParams: {
                userData: { isBottomWall: true },
            },
            onAfterCreateBody: body =>
                body.createFixture({
                    shape: Edge(Vec2(width / 2, -height / 2), Vec2(-width / 2, -height / 2)),
                    restitution: 1,
                    friction: 0,
                }),
        });

        resetData();

        // Iniital blocks
        if (restoreFromState) {
            // Need to capture all of the block locations
            // Given the gameData, and the block/ball/powertup locations,
            // generate the next board
            restoreStateOfTheWorld(world);
        } else {
            setupNextRound(world);
        }

        const canvasRenderer = canvasRef.current ? setupCanvas(world, canvasRef.current) : noop;

        // rendering loop
        let prevTime = new Date().getTime();
        (function loop() {
            let newTime = new Date().getTime();
            let elapsedTime = newTime - prevTime;
            stepCallbacksManager.processStepCallbacks();

            world.step(elapsedTime / 1000);

            canvasRenderer();
            renderToPixi(app, rayGraphic, ballText);

            // request a new frame
            window.requestAnimationFrame(loop);
            prevTime = new Date().getTime();
        })();
    });

    const style = {
        border: '1px solid black',
        width: '100%',
        height: '100%',
    };

    //<canvas style={style} ref={canvasRef} width={width * zoom} height={height * zoom} />
    return <div ref={pixiRef} style={style} />;
};
