import * as PIXI from 'pixi.js';

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
