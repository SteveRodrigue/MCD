import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/comic-relief/400.css';
import '@fontsource/comic-relief/700.css';
import '@fontsource/bangers/400.css';
import App from './ui/App';
import './ui/styles/index.css';
import { bootContent } from './data/content/apply';
import { FetchDriver } from './data/content/drivers/fetch';

async function start(): Promise<void> {
  // Content (cards, supplemental data, decks, modular sets) is loaded at runtime before the first
  // render. A failure disables the pack; the Content screen shows it with the reason (ADR-0092).
  await bootContent(new FetchDriver('/__content'));

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void start();
