import React from 'react';
import { flatMap, forEach } from 'lodash';
import { Edge, Vec2, World, Body, PolygonShape } from 'planck-js';
import * as PIXI from 'pixi.js';
import { BodyType } from './types';
import { drawBody, drawRays } from './renderHelpers';
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

function createGraphicFromBody(body: Body) {
    const graphics = new PIXI.Graphics();

    const x = body.getPosition().x;
    const y = body.getPosition().y;
    const fixtures = body.getFixtureList();
    if (fixtures) {
        const shape = fixtures.getShape() as PolygonShape;
        const vertices = shape.m_vertices;
        const shapeType = shape.getType();

        if (shapeType === 'circle') {
            graphics.lineStyle(0);
            graphics.beginFill(0xffff0b, 0.5);
            graphics.drawCircle(0, 0, shape.getRadius());
            graphics.endFill();
            graphics.transform.position.set(x, y);
        } else {
            graphics.beginFill(0xde3249);
            console.log({ body });
            const points = flatMap(vertices, vertex => {
                const xVertex = vertex.x;
                const yVertex = vertex.y;
                return [xVertex, yVertex];
            });
            graphics.drawPolygon(points);
            graphics.transform.position.set(x, y);
            graphics.endFill();
            /*
            vertices.forEach((vertex, idx) => {
                const x = vertex.x;
                const y = vertex.y;
                if (idx === 0) {
                    graphics.moveTo(x, y);
                } else {
                    graphics.lineTo(x, y);
                }
            });
                 */
        }
    }
    return graphics;
}

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
        app.renderer.plugins.interaction.on('pointerup', (e: PIXI.interaction.InteractionEvent) => {
            onClick(e.data.originalEvent);
        });
        app.renderer.plugins.interaction.on(
            'pointerdown',
            (e: PIXI.interaction.InteractionEvent) => {
                onMove(e.data.originalEvent);
            },
        );
        app.renderer.plugins.interaction.on('touchend', (e: PIXI.interaction.InteractionEvent) => {
            onMove(e.data.originalEvent);
        });
        app.renderer.plugins.interaction.on('touchmove', (e: PIXI.interaction.InteractionEvent) => {
            onMove(e.data.originalEvent);
        });

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
