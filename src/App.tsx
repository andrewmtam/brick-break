import React from 'react';
import styled from 'styled-components';
import { createGlobalStyle } from 'styled-components';
import { Scene } from './Scene';
import { BrowserRouter as Router, Route, Switch, Link } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { getSavedData } from './Scene/saveHelpers';

const GlobalStyle = createGlobalStyle`
    html, body {
        width: 100%;
        height: 100%;
    }

    #root {
        display: flex;
        width: 100%;
        height: 100%;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        overflow: hidden;
    }
`;

const StyledContent = styled.div`
    overflow: auto;
    width: 100%;
    flex: 1;
`;

function App() {
    return (
        <Router>
            <GlobalStyle />
            <Header />
            <StyledContent>
                <Switch>
                    <Route
                        path="/game/new/confirm"
                        render={() => {
                            const savedGameData = getSavedData();
                            return savedGameData ? (
                                <div>
                                    Starting a new game will destroy your saved data. Are you sure
                                    you want to do this?
                                    <div>
                                        <div>
                                            <Link to="/game/new">Start new game</Link>
                                        </div>
                                        <div>
                                            <Link to="/game/continue">Continue existing game</Link>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <Scene restoreFromState={false} />
                            );
                        }}
                    />
                    <Route path="/game/new" render={() => <Scene restoreFromState={false} />} />
                    <Route path="/game/continue" render={() => <Scene restoreFromState={true} />} />
                    <Route path="/">This is hte main content</Route>
                </Switch>
            </StyledContent>
            <Footer />
        </Router>
    );
}

export default App;
