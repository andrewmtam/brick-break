// @ts-nocheck

import React from "react";
import {
  reduce,
  slice,
  size,
  last,
  every,
  range,
  map,
  forEach,
  first,
  values
} from "lodash";
import { Edge, Circle, Box, Vec2, World, Body, Polygon } from "planck-js";
import { v4 as uuidv4 } from "uuid";

// TODO:
// Make a way to call balls back
// Add power ups
//  * clear row
// Add fast forward button
// Fix powerup size -- not sure why this is even broken
//
//

// computed values
const zoom = 35;
const width = 300 / zoom;
const height = 500 / zoom;
const blockSize = width / 10;
const ballRadius = blockSize / 2 / 3;

// This changes based on where we last exited
const ballPosition = Vec2(0, -height / 2 + ballRadius * 2);

let bodyData = {};
let indexedBodyData: {
  block: { [key: string]: Body };
  ball: { [key: string]: Body };
  wall: { [key: string]: Body };
  powerup: { [key: string]: Body };
} = {};

let ballVelocityMap = {};

let stepCallbacks = [];

const gameData = {
  round: 0,
  balls: 1,
  ballsAtStartOfRound: 1
};

window.gameData = gameData;
window.indexedBodyData = indexedBodyData;

const blockShapes = [
  Box(blockSize / 2, blockSize / 2),
  Polygon([
    Vec2(-blockSize / 2, -blockSize / 2),
    Vec2(-blockSize / 2, blockSize / 2),
    Vec2(blockSize / 2, blockSize / 2)
  ]),
  Polygon([
    Vec2(-blockSize / 2, -blockSize / 2),
    Vec2(-blockSize / 2, blockSize / 2),
    Vec2(blockSize / 2, -blockSize / 2)
  ]),
  Polygon([
    Vec2(-blockSize / 2, -blockSize / 2),
    Vec2(blockSize / 2, blockSize / 2),
    Vec2(blockSize / 2, -blockSize / 2)
  ]),
  Polygon([
    Vec2(-blockSize / 2, blockSize / 2),
    Vec2(blockSize / 2, blockSize / 2),
    Vec2(blockSize / 2, -blockSize / 2)
  ])
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

function fillRow(world) {
  const xCoordinates = range(-width / 2 + blockSize, width / 2, blockSize);
  // Fill a random spot with a ball
  const idxForBallPowerup = Math.floor(Math.random() * xCoordinates.length);
  createPowerup(world, {
    position: Vec2(xCoordinates[idxForBallPowerup], height / 2 - blockSize)
  });

  // Render blocks
  forEach(
    [
      ...slice(xCoordinates, 0, idxForBallPowerup),
      ...slice(xCoordinates, idxForBallPowerup + 1)
    ],
    xCoordinate => {
      // New block appears 50% of the time
      if (Math.random() < 0.5) {
        const bodyParams = Vec2(xCoordinate, height / 2 - blockSize);
        // Start doing triangles!
        // And also introduce double healthblocks
        if (gameData.round > 5) {
          createBlock({
            world,
            hasDoubleHitpoints: Math.random() > 0.9,
            bodyParams,
            shape: getRandomBlockShape()
          });
        }
        // only blocks please
        else {
          createBlock({ world, bodyParams, shape: blockShapes[0] });
        }
      }
    }
  );
  // Iterate over each spot
  // Add new block
  // Add plus ball
  // Add laser
  // Iniital blocks
}

function createBlock({ world, bodyParams, hasDoubleHitpoints, shape }) {
  return createBody({
    world,
    bodyType: "block",
    bodyParams,
    userData: {
      hitPoints: hasDoubleHitpoints ? gameData.round * 2 : gameData.round
    }
  }).createFixture({
    shape,
    restitution: 1,
    friction: 0
  });
}

function createBall(world) {
  return createBody({
    world,
    bodyType: "ball",
    bodyParams: {
      type: "dynamic",
      position: ballPosition,
      bullet: true
    }
  }).createFixture({
    shape: Circle(ballRadius),
    restitution: 1,
    friction: 0,
    // All balls bust have this filter group because they don't collide with each other
    // All powerups must also have this filter group because they also don' collied
    filterGroupIndex: -1
  });
}

function createPowerup(world, bodyParams) {
  const powerup = createBody({
    world,
    bodyType: "powerup",
    bodyParams
  });

  powerup.createFixture({
    shape: Circle(ballRadius),
    restitution: 1,
    friction: 0
  });

  powerup.setUserData({
    ...powerup.getUserData(),
    powerup: "addBall"
  });

  return powerup;
}

function setupNextRound(world) {
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

function createBody({ world, bodyType, bodyParams, userData }): Body {
  const body = world.createBody(bodyParams);
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

function queueStepCallback(cb: () => noop) {
  stepCallbacks.push(cb);
}

function processStepCallbacks() {
  stepCallbacks.forEach(cb => cb());
  stepCallbacks = [];
}

function transformCanvasCoordinateToPhysical(event) {
  const { x, y } =
    event.constructor.name === "TouchEvent"
      ? {
          x: (first(event.touches) || first(event.changedTouches)).clientX,
          y: (first(event.touches) || first(event.changedTouches)).clientY
        }
      : event;
  return { x: x / zoom - width / 2, y: -y / zoom + height / 2 };
}

// Destroy all the balls
// Create all the new balls
// Create the next round of blocks

// Each round renders 3 - 6 more squares
// Sometimes squares are double value
// Sometimes there are +1 balls
// Sometimes there are blasters
export const Scene = () => {
  const canvasRef = React.useRef();
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    let ray = [];

    var world = new World(Vec2(0, 0));

    // Create walls, but we don't need to draw them on the canvas
    // Left wall
    createBody({ world, bodyType: "wall" }).createFixture({
      shape: Edge(Vec2(-width / 2, height / 2), Vec2(-width / 2, -height / 2)),
      restitution: 1,
      friction: 0
    });

    // Right wall
    createBody({ world, bodyType: "wall" }).createFixture({
      shape: Edge(Vec2(width / 2, -height / 2), Vec2(width / 2, height / 2)),
      restitution: 1,
      friction: 0
    });

    // Top wall
    createBody({ world, bodyType: "wall" }).createFixture({
      shape: Edge(Vec2(width / 2, height / 2), Vec2(-width / 2, height / 2)),
      restitution: 1,
      friction: 0
    });

    // Bottom wall
    createBody({
      world,
      bodyType: "wall",
      userData: { isBottomWall: true }
    }).createFixture({
      shape: Edge(Vec2(width / 2, -height / 2), Vec2(-width / 2, -height / 2)),
      restitution: 1,
      friction: 0
    });

    // Iniital blocks
    setupNextRound(world);

    function onClick(event) {
      event.preventDefault();
      ray = [];
      const { x, y } = transformCanvasCoordinateToPhysical(event);
      const trajectory = Vec2.sub(Vec2(x, y), ballPosition);
      trajectory.normalize();

      ballVelocityMap = {};

      reduce(
        values(indexedBodyData.ball),
        (acc, ballBody) => {
          return acc.then(() => {
            const velocity = Vec2.mul(trajectory, 50);
            ballBody.setLinearVelocity(velocity);
            updateBallVelocityMap(ballBody, velocity);
            return new Promise(resolve => {
              setTimeout(() => resolve(), 10);
            });
          });
        },
        Promise.resolve()
      );
    }

    function onMove(event) {
      event.preventDefault();
      const { x, y } = transformCanvasCoordinateToPhysical(event);
      const mousePosition = Vec2(x, y);
      const trajectory = Vec2.sub(mousePosition, ballPosition);
      trajectory.normalize();
      const rayLength = height * 0.75;

      const nextPosition = Vec2.add(
        ballPosition,
        Vec2.mul(trajectory, rayLength)
      );

      ray = [ballPosition, nextPosition];
      world.rayCast(ballPosition, nextPosition, function(
        fixture,
        point,
        normal,
        fraction
      ) {
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
          Vec2.mul(normal, 2 * Vec2.dot(trajectory, normal))
        );
        reflectionVector.normalize();
        const nextPoint = Vec2.add(
          point,
          Vec2.mul(reflectionVector, rayLength * (1 - fraction))
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
    world.on("begin-contact", contact => {
      const fixtureA = contact.getFixtureA();
      const fixtureB = contact.getFixtureB();

      const bodyA = fixtureA.getBody();
      const bodyB = fixtureB.getBody();

      // Find the fixture that is a block
      const bodyTypeA = bodyA.getUserData().bodyType;
      const bodyTypeB = bodyB.getUserData().bodyType;

      const wallBody =
        bodyTypeA === "wall" ? bodyA : bodyTypeB === "wall" ? bodyB : undefined;

      const ballBody =
        bodyTypeA === "ball" ? bodyA : bodyTypeB === "ball" ? bodyB : undefined;

      const powerupBody =
        bodyTypeA === "powerup"
          ? bodyA
          : bodyTypeB === "powerup"
          ? bodyB
          : undefined;

      const blockBody =
        bodyTypeA === "block"
          ? bodyA
          : bodyTypeB === "block"
          ? bodyB
          : undefined;

      if (ballBody) {
        const velocityAfterCollision = ballBody.getLinearVelocity();
        updateBallVelocityMap(ballBody, velocityAfterCollision);
        const { x, y } = velocityAfterCollision;
        if (powerupBody) {
            console.log("got powerup");
          const userData = powerupBody.getUserData();
          if (userData.powerup === "addBall") {
            queueStepCallback(() => {
              // Set velocity to previous value
              ballVelocityMap[ballBody.getUserData().id].pop();
              const previousVelocity = last(
                ballVelocityMap[ballBody.getUserData().id]
              );
              ballBody.setLinearVelocity(previousVelocity);
              destroyBody(powerupBody);
              gameData.balls++;
            });
          }
        } else if (wallBody) {
          if (wallBody.getUserData().isBottomWall) {
            // Track the posiition of the first ball that left
            if (size(indexedBodyData.ball) === gameData.ballsAtStartOfRound) {
              ballPosition.x = Math.max(
                Math.min(ballBody.getPosition().x, width / 2 - ballRadius * 2),
                -width / 2 + ballRadius * 2
              );
            }
            // Edge case handling for when the ball basically stops moving
            if (x && Math.abs(y) < Math.abs(0.01)) {
              console.log(y, "reset velocity", ballBody);
              ballBody.setLinearVelocity(Vec2(x, Math.random() * ballRadius));
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
        } else if (blockBody) {
          const existingData = blockBody.getUserData();
          const hitPoints = existingData.hitPoints;
          // Destroy the block
          if (hitPoints === 1) {
            queueStepCallback(() => destroyBody(blockBody));
          }
          // Decrement the counter
          else {
            blockBody.setUserData({
              ...existingData,
              hitPoints: hitPoints - 1
            });
          }
        }
      }
    });

    // rendering loop
    (function loop() {
      processStepCallbacks();

      world.step(1 / 60);

      render();

      // request a new frame
      window.requestAnimationFrame(loop);
    })();

    function render() {
      // Clear the canvas
      ctx.clearRect(0, 0, w, h);

      // Transform the canvas
      // Note that we need to flip the y axis since Canvas pixel coordinates
      // goes from top to bottom, while physics does the opposite.
      ctx.save();
      ctx.translate(w / 2, h / 2); // Translate to the center
      ctx.scale(zoom, -zoom); // Zoom in and flip y axis

      // Draw all bodies
      ctx.strokeStyle = "none";

      forEach(indexedBodyData.block, block => drawBody(block, "purple"));
      forEach(indexedBodyData.ball, ball => drawBody(ball, "green"));
      forEach(indexedBodyData.powerup, powerup => drawBody(powerup, "red"));
      drawRays(ray);

      ctx.restore();
    }

    function drawRays(ray: Vec2[]) {
      ctx.save();

      ray.forEach((vertex, idx) => {
        const { x, y } = vertex;
        if (idx === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.strokeStyle = "#ff0000";
      ctx.lineWidth = 0.1;
      ctx.stroke();
      ctx.closePath();
      ctx.restore();
    }

    function drawBody(body: Body, fillStyle = "black") {
      const x = body.getPosition().x;
      const y = body.getPosition().y;
      const fixtures = body.getFixtureList();
      if (fixtures) {
        const shape = fixtures.getShape();
        const vertices = shape.m_vertices;
        const shapeType = shape.getType();
        const rotation = body.getAngle();

        ctx.fillStyle = fillStyle;
        ctx.save();

        ctx.translate(x, y); // Translate to the position of the box
        ctx.rotate(rotation); // Rotate to the box body frame
        if (shapeType === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, shape.getRadius(), 0, Math.PI * 2);
          ctx.closePath();
        } else {
          ctx.beginPath();
          vertices.forEach((vertex, idx) => {
            const { x, y } = vertex;
            if (idx === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          });
          ctx.closePath();
        }
        ctx.fill();
        ctx.restore();
        // Add text for blocks
        if (body.getUserData().bodyType === "block") {
          ctx.save();
          ctx.fillStyle = "white";
          // TODO: Make this dynamic properly
          ctx.font = `${zoom * 0.01}px serif`;
          ctx.translate(x, y); // Translate to the position of the box
          ctx.rotate(-Math.PI); // Rotate to the box body frame

          ctx.textAlign = "center";
          ctx.scale(-1, 1); // Zoom in and flip y axis
          ctx.fillText(body.getUserData().hitPoints, 0, blockSize / 4);
          ctx.restore();
        }
      }
    }
  });

  return (
    <canvas
      style={{ border: "1px solid black" }}
      ref={canvasRef}
      width={width * zoom}
      height={height * zoom}
    />
  );
};
