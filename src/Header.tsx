import React from 'react';
import { Link } from 'react-router-dom';
import { getSavedData } from './Scene/saveHelpers';

export const Header = (props: any) => (
    <div {...props}>
        <div>
            <Link to={{ pathname: getSavedData() ? '/game/new/confirm' : '/game/new' }}>
                Start New Game
            </Link>
        </div>
        <div>
            <Link to={{ pathname: '/game/continue' }}>Continue</Link>
        </div>
        <div>
            <Link to="/">To Homepage</Link>
        </div>
    </div>
);
