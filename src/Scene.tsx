import React from 'react';
import { Edge, Vec2, World, Body } from 'planck-js';
import * as PIXI from 'pixi.js';
import { BodyType } from './Scene/types';
import { renderToPixi, renderToCanvas } from './Scene/renderHelpers';
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
    bodyData,
} from './Scene/state';
import {
    transformCanvasCoordinateToPhysical,
    onClickFactory,
    onMoveFactory,
} from './Scene/eventHelpers';
import { createBody, setupNextRound } from './Scene/physicsHelpers';
import { onBeginContact, onRemoveBody, onAddBody } from './Scene/worldHooks';

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
export const Scene = () => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        const ctx = canvas.getContext('2d');

        const world = new World(Vec2(0, 0));

        //PIXI.settings.RESOLUTION = window.devicePixelRatio;
        const app = new PIXI.Application({
            antialias: true,
            width: physicalWidth,
            height: physicalHeight,
        });
        document.body.appendChild(app.view);

        // Only for physical collision
        world.on('begin-contact', onBeginContact(world, app));
        world.on('remove-body', onRemoveBody(app));

        // @ts-ignore
        world.on('add-body', onAddBody(app));

        // Create walls, but we don't need to draw them on the canvas
        // Left wall
        createBody({ world, bodyType: BodyType.Wall }).createFixture({
            shape: Edge(Vec2(-width / 2, height / 2), Vec2(-width / 2, -height / 2)),
            restitution: 1,
            friction: 0,
        });

        // Right wall
        createBody({ world, bodyType: BodyType.Wall }).createFixture({
            shape: Edge(Vec2(width / 2, -height / 2), Vec2(width / 2, height / 2)),
            restitution: 1,
            friction: 0,
        });

        // Top wall
        createBody({ world, bodyType: BodyType.Wall }).createFixture({
            shape: Edge(Vec2(width / 2, height / 2), Vec2(-width / 2, height / 2)),
            restitution: 1,
            friction: 0,
        });

        // Bottom wall
        createBody({
            world,
            bodyType: BodyType.Wall,
            userData: { isBottomWall: true },
        }).createFixture({
            shape: Edge(Vec2(width / 2, -height / 2), Vec2(-width / 2, -height / 2)),
            restitution: 1,
            friction: 0,
        });

        const onClick = onClickFactory(world)(transformCanvasCoordinateToPhysical);
        const onMove = onMoveFactory(world)(transformCanvasCoordinateToPhysical);

        // TODO: Blurry
        // TODO: Remove images

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

        // Iniital blocks
        setupNextRound(world);

        canvas.onclick = onClick;
        canvas.ontouchend = onClick;
        canvas.onmousemove = onMove;
        canvas.ontouchmove = onMove;

        // rendering loop
        let prevTime = new Date().getTime();
        (function loop() {
            let newTime = new Date().getTime();
            let elapsedTime = newTime - prevTime;
            stepCallbacksManager.processStepCallbacks();

            world.step(elapsedTime / 1000);

            if (ctx) {
                renderToCanvas(ctx);
            }
            renderToPixi(app, rayGraphic);

            // request a new frame
            window.requestAnimationFrame(loop);
            prevTime = new Date().getTime();
        })();
    });

    const style = {
        border: '1px solid black',
        width: `${physicalWidth}px`,
        height: `${physicalHeight}px`,
    };

    return (
        <div>
            <span>Text</span>
            <canvas style={style} ref={canvasRef} width={width * zoom} height={height * zoom} />
        </div>
    );
};
