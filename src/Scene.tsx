// @ts-nocheck

import React from "react";
import { range, map, forEach, first, values } from "lodash";
import planck, { Block, Box, Vec2, World, Body, Polygon } from "planck-js";
import { v4 as uuidv4 } from "uuid";

// computed values
const zoom = 35;
const width = 300 / zoom;
const height = 600 / zoom;
const blockSize = width / 10;
const ballRadius = blockSize / 2 / 3;

// This changes based on where we last exited
const ballPosition = Vec2(0, -height / 2 + ballRadius * 2);

let bodyData = {};
let indexedBodyData: {
  block: { [key: string]: Body };
  ball: { [key: string]: Body };
  wall: { [key: string]: Body };
} = {};

let stepCallbacks = [];

const gameData = {
  round: 1
};

function fillRow(world) {
  const xCoordinates = range(-width / 2 + blockSize, width / 2, blockSize);

  forEach(xCoordinates, xCoordinate => {
    // New block appears 50% of the time
    if (Math.random() < 0.5) {
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

      createBody({
        world,
        bodyType: "block",
        bodyParams: Vec2(xCoordinate, height / 2 - blockSize),
        userData: { hitsLeft: gameData.round }
      }).createFixture({
        shape: blockShapes[4],
        restitution: 1,
        friction: 0
      });
    }
  });
  // Iterate over each spot
  // Add new block
  // Add plus ball
  // Add laser
  // Iniital blocks
}

function getRound(gameData) {
  return gameData.round;
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

function tagBodyWithId({
  body,
  additionalUserData,
  bodyType
}: {
  body: Body;
  bodyType: string;
}) {
  const id = uuidv4();
  const userData = body.getUserData();
  body.setUserData({ ...userData, ...additionalUserData, id, bodyType });
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
  const { x, y } = event;
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

    const pl = planck;
    var world = new pl.World(Vec2(0, 0));

    function createBall() {
      return createBody({
        world,
        bodyType: "ball",
        bodyParams: {
          type: "dynamic",
          position: ballPosition,
          bullet: true
        }
      }).createFixture({
        shape: pl.Circle(ballRadius),
        restitution: 1,
        friction: 0,
        // All balls bust have this filter group because they don't collide with each other
        filterGroupIndex: -1
      });
    }

    // Create walls, but we don't need to draw them on the canvas
    // Left wall
    createBody({ world, bodyType: "wall" }).createFixture({
      shape: pl.Edge(
        Vec2(-width / 2, height / 2),
        Vec2(-width / 2, -height / 2)
      ),
      restitution: 1,
      friction: 0
    });

    // Right wall
    createBody({ world, bodyType: "wall" }).createFixture({
      shape: pl.Edge(Vec2(width / 2, -height / 2), Vec2(width / 2, height / 2)),
      restitution: 1,
      friction: 0
    });

    // Top wall
    createBody({ world, bodyType: "wall" }).createFixture({
      shape: pl.Edge(Vec2(width / 2, height / 2), Vec2(-width / 2, height / 2)),
      restitution: 1,
      friction: 0
    });

    // Iniital blocks
    fillRow(world);

    // Initial ball
    createBall();

    canvas.onclick = function(event) {
      const { x, y } = transformCanvasCoordinateToPhysical(event);
      const trajectory = Vec2.sub(Vec2(x, y), ballPosition);
      trajectory.normalize();

      forEach(values(indexedBodyData.ball), (ballBody, idx) => {
        ballBody.setPosition(Vec2.sub(ballPosition, Vec2.mul(trajectory, idx)));
        ballBody.setLinearVelocity(Vec2.mul(trajectory, 50));
      });
    };

    world.on("end-contact", contact => {
      const fixtureA = contact.getFixtureA();
      const fixtureB = contact.getFixtureB();

      const bodyA = fixtureA.getBody();
      const bodyB = fixtureB.getBody();

      // Find the fixture that is a block
      const bodyTypeA = bodyA.getUserData().bodyType;
      const bodyTypeB = bodyB.getUserData().bodyType;

      const blockBody =
        bodyTypeA === "block"
          ? bodyA
          : bodyTypeB === "block"
          ? bodyB
          : undefined;
      if (blockBody) {
        const existingData = blockBody.getUserData();
        const hitsLeft = existingData.hitsLeft;
        // Destroy the block
        if (hitsLeft === 1) {
          queueStepCallback(() => destroyBody(blockBody));
        }
        // Decrement the counter
        else {
          blockBody.setUserData({ ...existingData, hitsLeft: hitsLeft - 1 });
        }
      }
    });

    function setupNextRound() {
      // Reset the ball
      const { x } = first(values(indexedBodyData.ball)).getPosition();
      ballPosition.x = x;
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

      // Add a new row of blocks
      // and other stuffs
      fillRow(world);

      // Increment the ball count?
      createBall();
    }

    // rendering loop
    (function loop() {
      processStepCallbacks();

      world.step(1 / 60);
      postStep();

      render();

      // iterate over bodies and fixtures
      for (var body = world.getBodyList(); body; body = body.getNext()) {
        for (
          var fixture = body.getFixtureList();
          fixture;
          fixture = fixture.getNext()
        ) {
          // draw or update fixture
        }
      }
      // request a new frame
      window.requestAnimationFrame(loop);
    })();

    function postStep() {
      // TODO: This is broken
      const { x, y } = first(values(indexedBodyData.ball)).getPosition();
      if (
        x - ballRadius > width / 2 ||
        x + ballRadius < -width / 2 ||
        y - ballRadius > height / 2 ||
        y + ballRadius < -height / 2
      ) {
        setupNextRound();
      }
    }

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

      ctx.restore();
    }

    function drawBody(body: planck.Body, fillStyle = "black") {
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
          ctx.fillText(body.getUserData().hitsLeft, 0, blockSize / 4);
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