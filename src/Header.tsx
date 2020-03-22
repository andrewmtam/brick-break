import React from 'react';
import { Link } from 'react-router-dom';
import { gameData } from './Scene/state';

export const Header = (props: any) => (
    <div {...props}>
        <div>
            <Link
                onClick={() => {
                    gameData.balls = 1;
                    gameData.round = 0;
                    gameData.ballsCollected = 0;
                    gameData.ballsAtStartOfRound = 1;
                }}
                to="/game"
            >
                Start New Game
            </Link>
        </div>
        <div>
            <Link to="/game">Continue</Link>
        </div>
        <div>
            <Link to="/">To Homepage</Link>
        </div>
    </div>
);
