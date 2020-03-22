import React from 'react';
import { flatMap, forEach } from 'lodash';
import { Edge, Vec2, World, Body, PolygonShape } from 'planck-js';
import * as PIXI from 'pixi.js';
import { BodyType } from './types';
import { drawBody, drawRays, createGraphicFromBody } from './renderHelpers';
import {
    retinaScale,
    physicalWidth,
    physicalHeight,
    zoom,
    width,
    height,
    gameData,
    bodyData,
    indexedBodyData,
    graphicsMap,
    rayHelper,
    stepCallbacksManager,
    ballPosition,
} from './state';
import { transformCanvasCoordinateToPhysical, onClickFactory, onMoveFactory } from './eventHelpers';
import { createBody, setupNextRound } from './physicsHelpers';
import { onBeginContact } from './collisionHelpers';

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

function updateGraphic(body: Body, graphic: PIXI.Graphics) {}

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

        //PIXI.settings.RESOLUTION = window.devicePixelRatio;
        const app = new PIXI.Application({
            antialias: true,
            width: physicalWidth,
            height: physicalHeight,
        });
        document.body.appendChild(app.view);

        // TODO: Blurry
        // TODO: Remove images

        const graphics = new PIXI.Graphics();
        // Rectangle
        app.stage.addChild(graphics);
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
            textBaseline: 'middle',
            fontFamily: 'Arial',
            fontSize: 24,
            fontWeight: 'bold',
            fill: ['#ffffff', '#00ff99'], // gradient
            stroke: '#4a1850',
            strokeThickness: 1,
            wordWrap: true,
            wordWrapWidth: 440,
        });

        const richText = new PIXI.Text(
            'Rich text with a lot of options and across multiple lines',
            style,
        );
        console.log(richText.width, richText.height);
        richText.x = 0;
        richText.y = 0;

        richText.scale.set(1 / zoom, -1 / zoom);
        app.stage.addChild(richText);

        // Iniital blocks
        setupNextRound(world);

        canvas.onclick = onClick;
        canvas.ontouchend = onClick;
        canvas.onmousemove = onMove;
        canvas.ontouchmove = onMove;

        // Only for physical collision
        world.on('begin-contact', onBeginContact(world, app));

        // rendering loop
        let prevTime = new Date().getTime();
        (function loop() {
            let newTime = new Date().getTime();
            let elapsedTime = newTime - prevTime;
            stepCallbacksManager.processStepCallbacks();

            world.step(elapsedTime / 1000);

            if (ctx) {
                render(ctx);
            }

            // request a new frame
            window.requestAnimationFrame(loop);
            prevTime = new Date().getTime();
        })();

        function render(ctx: CanvasRenderingContext2D) {
            // Clear the canvas
            // The canvas should be twice as big, to account for retina stuffs
            ctx.clearRect(0, 0, physicalWidth * retinaScale, physicalHeight * retinaScale);

            // Transform the canvas
            // Note that we need to flip the y axis since Canvas pixel coordinates
            // goes from top to bottom, while physics does the opposite.
            ctx.save();
            ctx.translate((physicalWidth * retinaScale) / 2, (physicalHeight * retinaScale) / 2); // Translate to the center
            ctx.scale(1, -1); // Zoom in and flip y axis

            // Draw all bodies
            ctx.strokeStyle = 'none';

            forEach(indexedBodyData.powerup, powerup => drawBody(ctx, powerup, 'red'));
            forEach(indexedBodyData.block, block => drawBody(ctx, block, 'purple'));
            forEach(indexedBodyData.ball, ball => drawBody(ctx, ball, 'green'));
            drawRays(ctx, rayHelper.getRay());

            ctx.restore();

            // PIXI stuffs
            forEach(bodyData, (body, id) => {
                const userData = body.getUserData();
                if (userData.bodyType === BodyType.Wall) {
                    return;
                }
                const graphic = graphicsMap[id];
                if (graphic) {
                    const bodyPosition = body.getPosition();
                    //graphic.transform.position.set(10, 10);
                    graphic.transform.position.set(bodyPosition.x, bodyPosition.y);
                    //graphic.x = bodyPosition.x;
                    //graphic.y = bodyPosition.y;
                } else {
                    const graphic = createGraphicFromBody(body);
                    graphicsMap[userData.id] = graphic;
                    app.stage.addChild(graphic);
                }
            });
            // Also draw the rays
            rayGraphic.clear();
            forEach(rayHelper.getRay(), (point, idx) => {
                if (idx === 0) {
                    rayGraphic.lineStyle(2 / zoom, 0xffffff).moveTo(ballPosition.x, ballPosition.y);
                } else {
                    rayGraphic.lineTo(point.x, point.y);
                }
            });
        }
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
