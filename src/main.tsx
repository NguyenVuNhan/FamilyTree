import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';
import './styles/index.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/vietnamese-600.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/vietnamese-600.css';
import '@fontsource/charm/700.css';
import '@fontsource/charm/vietnamese-700.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/vietnamese-600.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/source-sans-3/vietnamese-600.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/vietnamese-500.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/vietnamese-500.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
