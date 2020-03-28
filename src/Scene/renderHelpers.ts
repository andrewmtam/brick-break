import { Body, Vec2, PolygonShape } from 'planck-js';
import * as PIXI from 'pixi.js';
import { flatMap, forEach } from 'lodash';
import { BodyType } from './types';
import { gameData, zoom, blockSize, rayHelper, bodyData, graphicsMap, ballRadius } from './state';

function transformPhysicsCoordinateToCanvasCoordinate(value: number) {
    return value * zoom;
}

export function drawRays(ctx: CanvasRenderingContext2D, ray: Vec2[]) {
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

export function drawBody(ctx: CanvasRenderingContext2D, body: Body, fillStyle = 'black') {
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

export function createGraphicFromBody(body: Body) {
    const graphics = new PIXI.Graphics();
    const userData = body.getUserData();

    const x = body.getPosition().x;
    const y = body.getPosition().y;
    const fixtures = body.getFixtureList();
    if (fixtures) {
        const shape = fixtures.getShape() as PolygonShape;
        const vertices = shape.m_vertices;
        const shapeType = shape.getType();

        if (shapeType === 'circle') {
            // NOTE - must draw at original size and then scale it down
            // in order for a smooth circle
            graphics.lineStyle(2 / zoom, 0xffcccb, 1, 0, false);
            graphics.beginFill(0xffff0b, 0.5);
            graphics.drawCircle(0, 0, shape.getRadius() * zoom);
            graphics.endFill();
            graphics.scale.set(1 / zoom, 1 / zoom);
            graphics.transform.position.set(x, y);
        } else {
            if (userData.bodyType === BodyType.Block) {
                graphics.lineStyle(2 / zoom, 0xffcccb, 1, 0, false);
            }
            graphics.beginFill(0xde3249);
            const points = flatMap(vertices, vertex => {
                const xVertex = vertex.x;
                const yVertex = vertex.y;
                return [xVertex, yVertex];
            });
            graphics.drawPolygon(points);
            graphics.transform.position.set(x, y);
            graphics.endFill();
        }
    }
    return graphics;
}

// TODO:raygraphic shouldn't be here
export function renderToPixi(
    app: PIXI.Application,
    rayGraphic: PIXI.Graphics,
    ballText: PIXI.Text,
) {
    // PIXI stuffs
    forEach(bodyData, (body, id) => {
        const { bodyType, textGraphic, hitPoints } = body.getUserData();
        if (bodyType === BodyType.Wall) {
            return;
        }
        const graphic = graphicsMap[id];
        const bodyPosition = body.getPosition();
        if (graphic) {
            graphic.position.set(bodyPosition.x, bodyPosition.y);
            //graphic.x = bodyPosition.x;
            //graphic.y = bodyPosition.y;
        }
        if (textGraphic && bodyType === BodyType.Block) {
            const fixtureList = body.getFixtureList();
            if (fixtureList) {
                textGraphic.text = hitPoints + '';
                const shape = fixtureList.getShape() as PolygonShape;
                const centerX = bodyPosition.x - textGraphic.width / 2;
                const centerY = bodyPosition.y + textGraphic.height / 2;
                // It is a square
                if (shape.m_vertices.length === 4) {
                    textGraphic.position.set(centerX, centerY);
                }
                // It is a triangle
                else {
                    const centroid = shape.m_centroid;
                    const offset = blockSize / 4;
                    if (centroid.x > 0 && centroid.y > 0) {
                        textGraphic.position.set(centerX + offset, centerY + offset);
                    } else if (centroid.x > 0 && centroid.y < 0) {
                        textGraphic.position.set(centerX + offset, centerY - offset);
                    } else if (centroid.x < 0 && centroid.y > 0) {
                        textGraphic.position.set(centerX - offset, centerY + offset);
                    } else {
                        textGraphic.position.set(centerX - offset, centerY - offset);
                    }
                }
            }
        }
    });
    // Also draw the rays
    rayGraphic.clear();
    forEach(rayHelper.getRay(), (point, idx) => {
        if (idx === 0) {
            rayGraphic
                .lineStyle(2 / zoom, 0xffffff)
                .moveTo(gameData.ballPosition.x, gameData.ballPosition.y);
        } else {
            rayGraphic.lineTo(point.x, point.y);
        }
    });

    ballText.text = gameData.balls.toString();
    ballText.position.set(
        gameData.ballPosition.x - ballText.width / 2,
        gameData.ballPosition.y + ballRadius * 3 + ballText.height / 2,
    );
}
