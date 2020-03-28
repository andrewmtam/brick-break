import { keys, forEach } from 'lodash';
import { Vec2, Body } from 'planck-js';
import { BodyType, GameData } from './types';

export const aspectRatio = 9 / 11;
export const retinaScale = 2;
export const physicalWidth = 300;
export const physicalHeight = physicalWidth / aspectRatio;
export const zoom = 50;
export const width = (physicalWidth / zoom) * retinaScale;
export const height = (physicalHeight / zoom) * retinaScale;
export const blockSize = width / 10;
export const ballRadius = blockSize / 2 / 3;
export const initialBallVelocity = 50;

const initialBalls = 1;

export const gameData: GameData = {
    round: 0,
    balls: initialBalls,
    ballsCollected: 0,
    ballsAtStartOfRound: 0,
    ballPosition: Vec2(0, -height / 2 + ballRadius * 2),
};

export const graphicsMap: { [bodyId: string]: PIXI.Graphics } = {};
// This changes based on where we last exited
export const bodyData: {
    [bodyId: string]: Body;
} = {};
export const indexedBodyData: {
    [TKey in BodyType]: { [key: string]: Body };
} = {
    block: {},
    ball: {},
    wall: {},
    powerup: {},
};
export let ballVelocityMap: { [id: string]: Vec2[] } = {};
export const resetData = () => {
    gameData.round = 0;
    gameData.balls = initialBalls;
    gameData.ballsCollected = 0;
    gameData.ballsAtStartOfRound = 0;
    gameData.ballPosition = Vec2(0, -height / 2 + ballRadius * 2);

    forEach(keys(graphicsMap), key => delete graphicsMap[key]);
    forEach(keys(bodyData), key => delete bodyData[key]);
    indexedBodyData.block = {};
    indexedBodyData.ball = {};
    indexedBodyData.wall = {};
    indexedBodyData.powerup = {};
    ballVelocityMap = {};
};

export const rayHelper = (() => {
    let ray: Vec2[] = [];
    return {
        addToRay: (point: Vec2) => ray.push(point),
        getRay: () => ray,
        resetRay: () => (ray = []),
        setRay: (points: Vec2[]) => (ray = points),
    };
})();

// computed values
export const stepCallbacksManager = (() => {
    let stepCallbacks: Function[] = [];
    return {
        queueStepCallback: (cb: Function) => stepCallbacks.push(cb),
        processStepCallbacks: () => {
            stepCallbacks.forEach(cb => cb());
            stepCallbacks = [];
        },
    };
})();
