import { Body, Vec2, PolygonShape } from 'planck-js';
import * as PIXI from 'pixi.js';
import { flatMap, forEach } from 'lodash';
import { BodyType } from './types';
import {
    zoom,
    blockSize,
    physicalWidth,
    physicalHeight,
    retinaScale,
    rayHelper,
    indexedBodyData,
    bodyData,
    graphicsMap,
    ballPosition,
} from './state';

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
            graphics.lineStyle(2 / zoom, 0xffcccb, 1, 0, false);
            graphics.beginFill(0xffff0b, 0.5);
            graphics.drawCircle(0, 0, shape.getRadius());
            graphics.endFill();
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

export function renderToCanvas(ctx: CanvasRenderingContext2D) {
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
}

// TODO:raygraphic shouldn't be here
export function renderToPixi(app: PIXI.Application, rayGraphic: PIXI.Graphics) {
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
            textGraphic.text = hitPoints + '';
            textGraphic.position.set(
                bodyPosition.x - textGraphic.width / 2,
                bodyPosition.y + textGraphic.height / 2,
            );
        }
    });
    // Also draw the rays
    rayGraphic.clear();
    forEach(rayHelper.getRay(), (point, idx) => {
        if (idx === 0) {
            rayGraphic.lineStyle(2 / zoom, 0xffffff).moveTo(ballPosition.x, ballPosition.y);
        } else {
            rayGraphic.lineTo(point.x, point.y);
        }
    });
}

/*
function renderText(graphic: PIXI.Graphics, text: string) {
    const style = new PIXI.TextStyle({
        align: 'center',
        textBaseline: 'middle',
        fontFamily: 'Arial',
        fontSize: 24,
        fontWeight: 'bold',
        fill: ['#ffffff', '#00ff99'], // gradient
        stroke: '#4a1850',
        strokeThickness: 1,
        wordWrap: true,
        wordWrapWidth: 440,
    });

    const richText = new PIXI.Text(text, style);
    richText.x = 0;
    richText.y = 0;

    richText.scale.set(1 / zoom, -1 / zoom);
    app.stage.addChild(richText);
}
     */
