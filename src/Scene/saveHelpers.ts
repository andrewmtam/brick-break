import { Polygon, Vec2, World, PolygonShape } from 'planck-js';
import { gameData, bodyData } from './state';
import { compact, map, forEach } from 'lodash';
import { BodyType, SavedData } from './types';
import { createBall, createBlock, createPowerup } from './physicsHelpers';

export const getSavedData: () => SavedData = () =>
    JSON.parse(window.localStorage.getItem('world') || '{}', (key, value) => {
        const className = value?._class;
        if (className === 'Vec2') {
            return new Vec2(value?.x, value?.y);
        } else if (className === 'Shape') {
            return new Polygon(value.vertices);
        }
        return value;
    });

export function saveStateOfTheWorld(): SavedData {
    const dataToStore = {
        gameData,
        bodyData: compact(
            map(bodyData, body => {
                const { textGraphic, ...userData } = body.getUserData();
                return {
                    userData,
                    // TODO: Remember to transform this into a vec2
                    bodyParams: {
                        position: body.getPosition(),
                    },
                    shape:
                        userData.bodyType === BodyType.Block
                            ? body.getFixtureList()?.getShape()
                            : undefined,
                };
            }),
        ),
    };

    window.localStorage.setItem(
        'world',
        JSON.stringify(dataToStore, (key, value) => {
            const className = value?.constructor?.name;
            console.log(key, value, className);
            if (className === 'Vec2') {
                const vec = value as Vec2;
                return { x: vec.x, y: vec.y, _class: 'Vec2' };
            } else if (className === 'Shape') {
                const polygon = value as PolygonShape;
                return { vertices: polygon.m_vertices, _class: 'Shape' };
            }
            return value;
        }),
    );

    return dataToStore;
}

export function restoreStateOfTheWorld(world: World) {
    const worldData = getSavedData();

    // Ignore recreating walls, we don't need these
    //
    // Set all the game data back
    forEach(worldData.gameData, (val, key) => {
        // @ts-ignore
        gameData[key] = val;
    });

    forEach(worldData.bodyData, ({ userData, bodyParams, shape }, key) => {
        if (userData.bodyType === BodyType.Ball) {
            createBall(world);
        } else if (userData.bodyType === BodyType.Block && shape) {
            createBlock({
                world,
                bodyParams: {
                    ...bodyParams,
                    userData,
                },
                shape,
            });
        } else if (userData.bodyType === BodyType.Powerup) {
            createPowerup(world, { ...bodyParams, userData });
        }
    });
}

