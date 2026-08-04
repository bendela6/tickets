import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { readTheme, applyTheme } from './theme';

applyTheme(readTheme());

const root = document.getElementById('root');
if (!root) throw new Error('index.html is missing its #root element');
createRoot(root).render(<App />);
