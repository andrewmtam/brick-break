import { BodyDef, Vec2, Shape } from 'planck-js';
import * as PIXI from 'pixi.js';
import { gameData } from './state';

export interface GameData {
    round: number;
    balls: number;
    ballsCollected: number;
    ballsAtStartOfRound: number;
    ballPosition: Vec2;
}

export interface SavedData {
    gameData: GameData;
    bodyData: {
        userData: Partial<UserData>;
        bodyParams: BodyDef;
        shape?: Shape;
    }[];
}

export enum BodyType {
    Block = 'block',
    Ball = 'ball',
    Wall = 'wall',
    Powerup = 'powerup',
}

export enum Powerup {
    AddBall = 'addBall',
}

export interface UserData {
    id: string;
    bodyType: BodyType;
    hitPoints?: number;
    isBottomWall: boolean;
    powerup: Powerup;
    active: boolean;
    textGraphic: PIXI.Text;
}

declare module 'planck-js' {
    interface Body {
        getUserData(): UserData;
        setUserData(data: UserData): void;
    }
}
