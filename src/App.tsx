import React from 'react';
import styled from 'styled-components';
import { createGlobalStyle } from 'styled-components';
import { Scene } from './Scene';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';

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
`;

function App() {
    return (
        <Router>
            <GlobalStyle />
            <Header />
            <StyledContent>
                <Switch>
                    <Route path="/game">
                        <Scene />
                    </Route>
                    <Route path="/">This is hte main content</Route>
                </Switch>
            </StyledContent>
            <Footer />
        </Router>
    );
}

export default App;
