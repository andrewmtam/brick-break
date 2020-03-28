import { World, Vec2 } from 'planck-js';
import * as PIXI from 'pixi.js';
import { first, forEach, reduce, values, size, slice } from 'lodash';
import {
    physicalWidth,
    physicalHeight,
    gameData,
    zoom,
    height,
    width,
    retinaScale,
    rayHelper,
    ballVelocityMap,
    indexedBodyData,
    initialBallVelocity,
} from './state';
import { updateBallVelocityMap } from './physicsHelpers';

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

export function transformCanvasCoordinateToPhysical(event: MouseEvent | TouchEvent) {
    const { x, y } =
        event.constructor.name === 'TouchEvent'
            ? transformTouchEvent(event as TouchEvent)
            : transformMouseEvent(event as MouseEvent);

    const target = event.target as HTMLCanvasElement;

    const offsetWidth = target.offsetWidth;
    const correction = offsetWidth / physicalWidth;

    return {
        x: ((x / zoom) * retinaScale) / correction - width / 2,
        y: ((-y / zoom) * retinaScale) / correction + width / 2,
    };
}

export const onClickFactory = (world: World) => (
    eventTransformer: (event: any) => { x: any; y: any },
) => (event: MouseEvent | TouchEvent) => {
    event.preventDefault();
    // TODO: This could be updated...
    rayHelper.resetRay();
    const { x, y } = eventTransformer(event);
    const trajectory = Vec2.sub(Vec2(x, y), gameData.ballPosition);
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

export const onMoveFactory = (world: World) => (
    eventTransformer: (event: any) => { x: any; y: any },
) => (event: MouseEvent | TouchEvent) => {
    event.preventDefault();
    const { x, y } = eventTransformer(event);
    const mousePosition = Vec2(x, y);
    const trajectory = Vec2.sub(mousePosition, gameData.ballPosition);
    trajectory.normalize();
    const rayLength = height;

    const nextPosition = Vec2.add(gameData.ballPosition, Vec2.mul(trajectory, rayLength));

    rayHelper.setRay([gameData.ballPosition, nextPosition]);
    world.rayCast(gameData.ballPosition, nextPosition, function(fixture, point, normal, fraction) {
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

export const onResizeFactory = (app: PIXI.Application, container: HTMLDivElement) => (e: Event) => {
    const { offsetHeight, offsetWidth } = container;
    const correction = offsetWidth / physicalWidth;
    app.stage.transform.scale.set(
        (zoom / retinaScale) * correction,
        (-zoom / retinaScale) * correction,
    );
    app.stage.transform.position.set(offsetWidth / 2, offsetHeight / 2);
};
