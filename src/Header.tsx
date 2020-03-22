import React from 'react';
import { Link } from 'react-router-dom';

export const Header = (props: any) => (
    <div {...props}>
        <div>
            <Link to={{ pathname: '/game', state: { restoreFromState: false } }}>
                Start New Game
            </Link>
        </div>
        <div>
            <Link to={{ pathname: '/game', state: { restoreFromState: true } }}>Continue</Link>
        </div>
        <div>
            <Link to="/">To Homepage</Link>
        </div>
    </div>
);
