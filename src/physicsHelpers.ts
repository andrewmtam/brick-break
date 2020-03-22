import { v4 as uuidv4 } from 'uuid';
import { Circle, Shape, Body, Vec2, World, Box, Polygon, BodyDef } from 'planck-js';
import { forEach, slice, range } from 'lodash';
import {
    gameData,
    height,
    blockSize,
    width,
    ballVelocityMap,
    indexedBodyData,
    ballPosition,
    ballRadius,
    bodyData,
    graphicsMap,
} from './state';
import { BodyType, Powerup, UserData } from './types';

export function updateBallVelocityMap(ballBody: Body, velocity: Vec2) {
    const id = ballBody.getUserData().id;
    if (!ballVelocityMap[id]) {
        ballVelocityMap[id] = [];
    }
    ballVelocityMap[id].push(velocity);
}

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

export function getRandomBlockShape() {
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

export function fillRow(world: World) {
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

export function createBlock({
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

export function createBall(world: World) {
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

export function createPowerup(world: World, bodyParams: BodyDef) {
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
        powerup: Powerup.AddBall,
        active: true,
    });

    return powerup;
}

export function setupNextRound(world: World) {
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

export function createBody({
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

export function destroyBody(body: Body, stage: PIXI.Container) {
    const { id, bodyType } = body.getUserData();
    body.getWorld().destroyBody(body);
    delete bodyData[id];
    delete indexedBodyData[bodyType][id];
    stage.removeChild(graphicsMap[id]);
}
