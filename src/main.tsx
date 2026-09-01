import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/comic-relief/400.css';
import '@fontsource/comic-relief/700.css';
import '@fontsource/bangers/400.css';
import App from './ui/App';
import './ui/styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
