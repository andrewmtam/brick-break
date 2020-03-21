import React from 'react';
import { reduce, slice, size, last, range, forEach, first, values } from 'lodash';
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
import { v4 as uuidv4 } from 'uuid';

declare module 'planck-js' {
    interface Body {
        getUserData(): UserData;
        setUserData(data: UserData): void;
    }
}

// TODO:
// Make a way to call balls back
// Add power ups
//  * clear row
// Add fast forward button
// Fix offset for text in triangle
//
//

// computed values
const retinaScale = 2;
const physicalWidth = 300;
const physicalHeight = 500;
const zoom = 100;
const width = (physicalWidth / zoom) * retinaScale;
const height = (physicalHeight / zoom) * retinaScale;
const blockSize = width / 10;
const ballRadius = blockSize / 2 / 3;
const initialBallVelocity = 25;
const initialBalls = 100;
const gameData = {
    round: 0,
    balls: initialBalls,
    ballsAtStartOfRound: initialBalls,
};

enum BodyType {
    Block = 'block',
    Ball = 'ball',
    Wall = 'wall',
    Powerup = 'powerup',
}

enum Powerup {
    AddBall = 'addBall',
}

interface UserData {
    id: string;
    bodyType: BodyType;
    hitPoints?: number;
    isBottomWall: boolean;
    powerup: Powerup;
    active: boolean;
}

// This changes based on where we last exited
const ballPosition = Vec2(0, -height / 2 + ballRadius * 2);

let bodyData: {
    [bodyId: string]: Body;
} = {};

let indexedBodyData: {
    [TKey in BodyType]: { [key: string]: Body };
} = {
    block: {},
    ball: {},
    wall: {},
    powerup: {},
};

let ballVelocityMap: { [id: string]: Vec2[] } = {};

let stepCallbacks: Function[] = [];

// @ts-ignore
window.gameData = gameData;
// @ts-ignore
window.indexedBodyData = indexedBodyData;

const blockShapes = [
    Box(blockSize / 2, blockSize / 2),
    Polygon([
        Vec2(-blockSize / 2, -blockSize / 2),
        Vec2(-blockSize / 2, blockSize / 2),
        Vec2(blockSize / 2, blockSize / 2),
    ]),
    Polygon([
        Vec2(-blockSize / 2, -blockSize / 2),
        Vec2(-blockSize / 2, blockSize / 2),
        Vec2(blockSize / 2, -blockSize / 2),
    ]),
    Polygon([
        Vec2(-blockSize / 2, -blockSize / 2),
        Vec2(blockSize / 2, blockSize / 2),
        Vec2(blockSize / 2, -blockSize / 2),
    ]),
    Polygon([
        Vec2(-blockSize / 2, blockSize / 2),
        Vec2(blockSize / 2, blockSize / 2),
        Vec2(blockSize / 2, -blockSize / 2),
    ]),
];

function updateBallVelocityMap(ballBody: Body, velocity: Vec2) {
    const id = ballBody.getUserData().id;
    if (!ballVelocityMap[id]) {
        ballVelocityMap[id] = [];
    }
    ballVelocityMap[id].push(velocity);
}

function getRandomBlockShape() {
    const randomNum = Math.random();
    if (randomNum < 0.6) {
        return blockShapes[0];
    } else if (randomNum < 0.7) {
        return blockShapes[1];
    } else if (randomNum < 0.8) {
        return blockShapes[2];
    } else if (randomNum < 0.9) {
        return blockShapes[3];
    } else {
        return blockShapes[4];
    }
}

function fillRow(world: World) {
    const xCoordinates = range(-width / 2 + blockSize, width / 2 - blockSize, blockSize);
    // Fill a random spot with a ball
    const idxForBallPowerup = Math.floor(Math.random() * xCoordinates.length);
    createPowerup(world, {
        position: Vec2(xCoordinates[idxForBallPowerup], height / 2 - blockSize),
    });

    // Render blocks
    forEach(
        [
            ...slice(xCoordinates, 0, idxForBallPowerup),
            ...slice(xCoordinates, idxForBallPowerup + 1),
        ],
        xCoordinate => {
            // New block appears 50% of the time
            if (Math.random() < 0.5) {
                const bodyParams = { position: Vec2(xCoordinate, height / 2 - blockSize) };
                // Start doing triangles!
                // And also introduce double healthblocks
                if (gameData.round > 5) {
                    createBlock({
                        world,
                        hasDoubleHitpoints: Math.random() > 0.9,
                        bodyParams,
                        shape: getRandomBlockShape(),
                    });
                }
                // only blocks please
                else {
                    createBlock({ world, bodyParams, shape: blockShapes[0] });
                }
            }
        },
    );
    // Iterate over each spot
    // Add new block
    // Add plus ball
    // Add laser
    // Iniital blocks
}

function createBlock({
    world,
    bodyParams,
    hasDoubleHitpoints,
    shape,
}: {
    world: World;
    bodyParams: BodyDef;
    hasDoubleHitpoints?: boolean;
    shape: Shape;
}) {
    return createBody({
        world,
        bodyType: BodyType.Block,
        bodyParams,
        userData: {
            hitPoints: hasDoubleHitpoints ? gameData.round * 2 : gameData.round,
        },
    }).createFixture({
        shape,
        restitution: 1,
        friction: 0,
    });
}

function createBall(world: World) {
    return createBody({
        world,
        bodyType: BodyType.Ball,
        bodyParams: {
            type: 'dynamic',
            position: ballPosition,
            bullet: true,
        },
    }).createFixture({
        shape: Circle(ballRadius),
        restitution: 1,
        friction: 0,
        // All balls bust have this filter group because they don't collide with each other
        // All powerups must also have this filter group because they also don' collied
        filterGroupIndex: -1,
    });
}

function createPowerup(world: World, bodyParams: BodyDef) {
    const powerup = createBody({
        world,
        bodyType: BodyType.Powerup,
        bodyParams,
    });

    powerup.createFixture({
        shape: Circle(ballRadius),
        restitution: 1,
        friction: 0,
        isSensor: true,
    });

    powerup.setUserData({
        ...powerup.getUserData(),
        powerup: 'addBall',
        active: true,
    });

    return powerup;
}

function setupNextRound(world: World) {
    // Recreate all the balls now

    forEach(range(0, gameData.balls), () => createBall(world));
    forEach(indexedBodyData.ball, ballBlock => {
        ballBlock.setLinearVelocity(Vec2(0, 0));
        ballBlock.setPosition(ballPosition);
    });

    // Increment the level
    gameData.round++;

    // Move all existing blocks down 1 row
    forEach(indexedBodyData.block, (body: Body) => {
        body.setPosition(Vec2.add(body.getPosition(), Vec2(0, -blockSize)));
    });

    // Move all existing powerups down 1 row
    forEach(indexedBodyData.powerup, (body: Body) => {
        body.setPosition(Vec2.add(body.getPosition(), Vec2(0, -blockSize)));
    });

    // Add a new row of blocks
    // and other stuffs
    fillRow(world);

    gameData.ballsAtStartOfRound = gameData.balls;
}

function createBody({
    world,
    bodyType,
    bodyParams,
    userData,
}: {
    world: World;
    bodyType: BodyType;
    bodyParams?: BodyDef;
    userData?: Partial<UserData>;
}): Body {
    const body = bodyParams ? world.createBody(bodyParams) : world.createBody();
    const id = uuidv4();
    body.setUserData({ ...userData, id, bodyType });
    bodyData[id] = body;

    // For easier access to all bodies
    if (!indexedBodyData[bodyType]) {
        indexedBodyData[bodyType] = {};
    }
    indexedBodyData[bodyType][id] = body;

    return body;
}

function destroyBody(body: Body) {
    const { id, bodyType } = body.getUserData();
    body.getWorld().destroyBody(body);
    delete bodyData[id];
    delete indexedBodyData[bodyType][id];
}

function queueStepCallback(cb: () => void) {
    stepCallbacks.push(cb);
}

function processStepCallbacks() {
    stepCallbacks.forEach(cb => cb());
    stepCallbacks = [];
}

function transformMouseEvent(event: MouseEvent): { x: any; y: any } {
    const { offsetX, offsetY } = event;
    return { x: offsetX, y: offsetY };
}

function transformTouchEvent(event: TouchEvent): { x: any; y: any } {
    const target = event.target as HTMLElement;
    if (target) {
        const rect = target.getBoundingClientRect();
        const { x, y } = {
            x: ((first(event.touches) || first(event.changedTouches))?.clientX || 0) - rect.left,
            y: ((first(event.touches) || first(event.changedTouches))?.clientY || 0) - rect.top,
        };
        return { x, y };
    }
    return { x: 0, y: 0 };
}
function transformCanvasCoordinateToPhysical(event: MouseEvent | TouchEvent) {
    const { x, y } =
        event.constructor.name === 'TouchEvent'
            ? transformTouchEvent(event as TouchEvent)
            : transformMouseEvent(event as MouseEvent);

    return {
        x: (x / zoom) * retinaScale - width / 2,
        y: (-y / zoom) * retinaScale + height / 2,
    };
}

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
        let ray: Vec2[] = [];

        var world = new World(Vec2(0, 0));

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

        // Iniital blocks
        setupNextRound(world);

        function onClick(event: MouseEvent | TouchEvent) {
            event.preventDefault();
            ray = [];
            const { x, y } = transformCanvasCoordinateToPhysical(event);
            const trajectory = Vec2.sub(Vec2(x, y), ballPosition);
            trajectory.normalize();

            ballVelocityMap = {};

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
        }

        function onMove(event: MouseEvent | TouchEvent) {
            event.preventDefault();
            const { x, y } = transformCanvasCoordinateToPhysical(event);
            const mousePosition = Vec2(x, y);
            const trajectory = Vec2.sub(mousePosition, ballPosition);
            trajectory.normalize();
            const rayLength = height * 0.75;

            const nextPosition = Vec2.add(ballPosition, Vec2.mul(trajectory, rayLength));

            ray = [ballPosition, nextPosition];
            world.rayCast(ballPosition, nextPosition, function(fixture, point, normal, fraction) {
                if (fixture.getBody().getUserData().bodyType === 'powerup') {
                    return -1;
                }
                // Always start with a fresh ray
                if (size(ray) > 1) {
                    ray = slice(ray, 0, 1);
                }
                ray.push(point);
                normal.normalize();
                const reflectionVector = Vec2.sub(
                    trajectory,
                    Vec2.mul(normal, 2 * Vec2.dot(trajectory, normal)),
                );
                reflectionVector.normalize();
                const nextPoint = Vec2.add(
                    point,
                    Vec2.mul(reflectionVector, rayLength * (1 - fraction)),
                );

                ray.push(nextPoint);

                return fraction;
            });
        }

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
                            destroyBody(powerupBody);
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
                            destroyBody(ballBody);
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
                        queueStepCallback(() => destroyBody(blockBody));
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

        function transformPhysicsCoordinateToCanvasCoordinate(value: number) {
            return value * zoom;
        }

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
            drawRays(ctx, ray);

            ctx.restore();
        }

        function drawRays(ctx: CanvasRenderingContext2D, ray: Vec2[]) {
            ctx.save();

            ctx.beginPath();
            ray.forEach((vertex, idx) => {
                const x = transformPhysicsCoordinateToCanvasCoordinate(vertex.x);
                const y = transformPhysicsCoordinateToCanvasCoordinate(vertex.y);
                if (idx === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.closePath();
            ctx.restore();
        }

        function drawBody(ctx: CanvasRenderingContext2D, body: Body, fillStyle = 'black') {
            const x = transformPhysicsCoordinateToCanvasCoordinate(body.getPosition().x);
            const y = transformPhysicsCoordinateToCanvasCoordinate(body.getPosition().y);
            const fixtures = body.getFixtureList();
            if (fixtures) {
                const shape = fixtures.getShape() as PolygonShape;
                const vertices = shape.m_vertices;
                const shapeType = shape.getType();
                const rotation = body.getAngle();

                ctx.fillStyle = fillStyle;
                ctx.save();

                ctx.translate(x, y); // Translate to the position of the box
                ctx.rotate(rotation); // Rotate to the box body frame
                if (shapeType === 'circle') {
                    ctx.beginPath();
                    ctx.arc(
                        0,
                        0,
                        transformPhysicsCoordinateToCanvasCoordinate(shape.getRadius()),
                        0,
                        Math.PI * 2,
                    );
                    ctx.closePath();
                } else {
                    ctx.beginPath();
                    vertices.forEach((vertex, idx) => {
                        const x = transformPhysicsCoordinateToCanvasCoordinate(vertex.x);
                        const y = transformPhysicsCoordinateToCanvasCoordinate(vertex.y);
                        if (idx === 0) {
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                    });
                    ctx.closePath();
                }
                ctx.fill();
                // Add text for blocks
                if (body.getUserData().bodyType === 'block') {
                    // Reset the zoom
                    ctx.fillStyle = 'white';
                    // TODO: Make this dynamic properly
                    ctx.font = `24px serif`;
                    //ctx.translate(x * zoom, y * zoom); // Translate to the position of the box
                    ctx.rotate(-Math.PI); // Rotate to the box body frame

                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    ctx.scale(-1, 1); // Zoom in and flip y axis
                    ctx.fillText(body.getUserData().hitPoints + '', 0, blockSize / 4);
                }
                ctx.restore();
            }
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
