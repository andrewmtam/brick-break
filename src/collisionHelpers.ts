import { Contact, Vec2, World } from 'planck-js';
import * as PIXI from 'pixi.js';
import { last, size } from 'lodash';
import { updateBallVelocityMap, setupNextRound } from './physicsHelpers';
import {
    gameData,
    ballVelocityMap,
    stepCallbacksManager,
    ballRadius,
    indexedBodyData,
    width,
    ballPosition,
} from './state';
export const onBeginContact = (world: World, app: PIXI.Application) => (contact: Contact) => {
    const fixtureA = contact.getFixtureA();
    const fixtureB = contact.getFixtureB();

    const bodyA = fixtureA.getBody();
    const bodyB = fixtureB.getBody();

    // Find the fixture that is a block
    const bodyTypeA = bodyA.getUserData().bodyType;
    const bodyTypeB = bodyB.getUserData().bodyType;

    const wallBody = bodyTypeA === 'wall' ? bodyA : bodyTypeB === 'wall' ? bodyB : undefined;

    const ballBody = bodyTypeA === 'ball' ? bodyA : bodyTypeB === 'ball' ? bodyB : undefined;

    const powerupBody =
        bodyTypeA === 'powerup' ? bodyA : bodyTypeB === 'powerup' ? bodyB : undefined;

    const blockBody = bodyTypeA === 'block' ? bodyA : bodyTypeB === 'block' ? bodyB : undefined;

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

                stepCallbacksManager.queueStepCallback(() => {
                    // This should always be set though
                    if (previousVelocity) {
                        ballBody.setLinearVelocity(Vec2(previousVelocity));
                    }
                    powerupBody.getWorld().destroyBody(powerupBody);
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
                stepCallbacksManager.queueStepCallback(() => {
                    ballBody.getWorld().destroyBody(ballBody);
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
                stepCallbacksManager.queueStepCallback(() =>
                    blockBody.getWorld().destroyBody(blockBody),
                );
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
};
