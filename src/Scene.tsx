import React from 'react';
import { flatMap, reduce, slice, size, last, range, forEach, first, values } from 'lodash';
import {
    Edge,
    Circle,
    Box,
    Vec2,
    World,
    Body,
    Polygon,
    Shape,
    BodyDef,
    PolygonShape,
} from 'planck-js';
import * as PIXI from 'pixi.js';
import { UserData, Powerup, BodyType } from './types';
import { drawBody, drawRays } from './renderHelpers';
import {
    retinaScale,
    physicalWidth,
    physicalHeight,
    zoom,
    width,
    height,
    ballRadius,
    initialBallVelocity,
    gameData,
    bodyData,
    indexedBodyData,
    graphicsMap,
    rayHelper,
    ballPosition,
    ballVelocityMap,
} from './state';
import { transformCanvasCoordinateToPhysical } from './eventHelpers';
import { createBody, updateBallVelocityMap, setupNextRound } from './physicsHelpers';

// TODO:
// Make a way to call balls back
// Add power ups
//  * clear row
// Add fast forward button
// Fix offset for text in triangle
// Add remembering game state
//
//

// computed values
let stepCallbacks: Function[] = [];

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

function destroyBody(body: Body, stage: PIXI.Container) {
    const { id, bodyType } = body.getUserData();
    body.getWorld().destroyBody(body);
    delete bodyData[id];
    delete indexedBodyData[bodyType][id];
    stage.removeChild(graphicsMap[id]);
}

function queueStepCallback(cb: () => void) {
    stepCallbacks.push(cb);
}

function processStepCallbacks() {
    stepCallbacks.forEach(cb => cb());
    stepCallbacks = [];
}

const onClickFactory = (world: World) => (event: MouseEvent | TouchEvent) => {
    event.preventDefault();
    // TODO: This could be updated...
    rayHelper.resetRay();
    const { x, y } = transformCanvasCoordinateToPhysical(event);
    const trajectory = Vec2.sub(Vec2(x, y), ballPosition);
    trajectory.normalize();

    // TODO: Also update this
    forEach(ballVelocityMap, (value, key) => delete ballVelocityMap[key]);

    reduce(
        values(indexedBodyData.ball),
        async (acc: Promise<any>, ballBody) => {
            await acc;
            const velocity = Vec2.mul(trajectory, initialBallVelocity);

            ballBody.setLinearVelocity(velocity);
            updateBallVelocityMap(ballBody, velocity);
            return new Promise(resolve => {
                setTimeout(() => resolve(), 50);
            });
        },
        Promise.resolve(),
    );
};

const onMoveFactory = (world: World) => (event: MouseEvent | TouchEvent) => {
    event.preventDefault();
    const { x, y } = transformCanvasCoordinateToPhysical(event);
    const mousePosition = Vec2(x, y);
    const trajectory = Vec2.sub(mousePosition, ballPosition);
    trajectory.normalize();
    const rayLength = height * 0.75;

    const nextPosition = Vec2.add(ballPosition, Vec2.mul(trajectory, rayLength));

    rayHelper.setRay([ballPosition, nextPosition]);
    world.rayCast(ballPosition, nextPosition, function(fixture, point, normal, fraction) {
        if (fixture.getBody().getUserData().bodyType === 'powerup') {
            return -1;
        }
        const ray = rayHelper.getRay();
        // Always start with a fresh ray
        if (size(ray) > 1) {
            rayHelper.setRay(slice(ray, 0, 1));
        }
        rayHelper.addToRay(point);
        normal.normalize();
        const reflectionVector = Vec2.sub(
            trajectory,
            Vec2.mul(normal, 2 * Vec2.dot(trajectory, normal)),
        );
        reflectionVector.normalize();
        const nextPoint = Vec2.add(point, Vec2.mul(reflectionVector, rayLength * (1 - fraction)));

        rayHelper.addToRay(nextPoint);

        return fraction;
    });
};

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

        const onClick = onClickFactory(world);
        const onMove = onMoveFactory(world);

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

        // Iniital blocks
        setupNextRound(world);

        canvas.onclick = onClick;
        canvas.ontouchend = onClick;
        canvas.onmousemove = onMove;
        canvas.ontouchmove = onMove;

        // Only for physical collision
        world.on('begin-contact', contact => {
            const fixtureA = contact.getFixtureA();
            const fixtureB = contact.getFixtureB();

            const bodyA = fixtureA.getBody();
            const bodyB = fixtureB.getBody();

            // Find the fixture that is a block
            const bodyTypeA = bodyA.getUserData().bodyType;
            const bodyTypeB = bodyB.getUserData().bodyType;

            const wallBody =
                bodyTypeA === 'wall' ? bodyA : bodyTypeB === 'wall' ? bodyB : undefined;

            const ballBody =
                bodyTypeA === 'ball' ? bodyA : bodyTypeB === 'ball' ? bodyB : undefined;

            const powerupBody =
                bodyTypeA === 'powerup' ? bodyA : bodyTypeB === 'powerup' ? bodyB : undefined;

            const blockBody =
                bodyTypeA === 'block' ? bodyA : bodyTypeB === 'block' ? bodyB : undefined;

            if (ballBody) {
                const velocityAfterCollision = ballBody.getLinearVelocity();
                updateBallVelocityMap(ballBody, velocityAfterCollision);
                const { x, y } = velocityAfterCollision;
                if (powerupBody) {
                    const userData = powerupBody.getUserData();
                    if (userData.powerup === 'addBall') {
                        console.log('got powerup');
                        // Set velocity to previous value
                        ballVelocityMap[ballBody.getUserData().id].pop();
                        const previousVelocity = last(ballVelocityMap[ballBody.getUserData().id]);

                        // Immediately deactivate this as we wait to destroy this object
                        powerupBody.setUserData({
                            ...userData,
                            active: false,
                        });

                        if (userData.active) {
                            gameData.balls++;
                        }

                        queueStepCallback(() => {
                            // This should always be set though
                            if (previousVelocity) {
                                ballBody.setLinearVelocity(Vec2(previousVelocity));
                            }
                            destroyBody(powerupBody, app.stage);
                        });
                    }
                } else if (wallBody) {
                    if (wallBody.getUserData().isBottomWall) {
                        // Track the posiition of the first ball that left
                        if (size(indexedBodyData.ball) === gameData.ballsAtStartOfRound) {
                            ballPosition.x = Math.max(
                                Math.min(ballBody.getPosition().x, width / 2 - ballRadius * 2),
                                -width / 2 + ballRadius * 2,
                            );
                        }
                        queueStepCallback(() => {
                            destroyBody(ballBody, app.stage);
                            // If after destroying this ball, there are no more
                            // then start the next round
                            if (!size(indexedBodyData.ball)) {
                                setupNextRound(world);
                            }
                        });
                    }
                    // Edge case handling for when the ball basically stops moving
                    if (x && Math.abs(y) < Math.abs(0.01)) {
                        console.log(y, 'reset velocity', ballBody);
                        ballBody.setLinearVelocity(Vec2(x, Math.random() * ballRadius));
                    }
                } else if (blockBody) {
                    const existingData = blockBody.getUserData();
                    const hitPoints = existingData.hitPoints || 0;
                    // Destroy the block
                    if (hitPoints <= 1) {
                        queueStepCallback(() => destroyBody(blockBody, app.stage));
                    }
                    // Decrement the counter
                    else {
                        blockBody.setUserData({
                            ...existingData,
                            hitPoints: hitPoints - 1,
                        });
                    }
                }
            }
        });

        // rendering loop
        let prevTime = new Date().getTime();
        (function loop() {
            let newTime = new Date().getTime();
            let elapsedTime = newTime - prevTime;
            processStepCallbacks();

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
                    console.log(graphic.x, bodyPosition.x);
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
