import { createRoot } from 'react-dom/client';
import './base.css';
import './app.css';
import App from './App';
createRoot(document.getElementById('root')!).render(<App />);
if ('serviceWorker' in navigator && location.hostname !== 'localhost') navigator.serviceWorker.register('/sw.js');
