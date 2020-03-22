import { Body, Vec2, PolygonShape } from 'planck-js';
import * as PIXI from 'pixi.js';
import { flatMap } from 'lodash';
import { zoom, blockSize } from './state';

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

    const x = body.getPosition().x;
    const y = body.getPosition().y;
    const fixtures = body.getFixtureList();
    if (fixtures) {
        const shape = fixtures.getShape() as PolygonShape;
        const vertices = shape.m_vertices;
        const shapeType = shape.getType();

        if (shapeType === 'circle') {
            graphics.lineStyle(0);
            graphics.beginFill(0xffff0b, 0.5);
            graphics.drawCircle(0, 0, shape.getRadius());
            graphics.endFill();
            graphics.transform.position.set(x, y);
        } else {
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

