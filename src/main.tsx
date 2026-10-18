import { createRoot } from 'react-dom/client';
import { AuthGate } from './app/AuthGate';
import './styles/globals.css';
import './app/glassScrollPerformance';

createRoot(document.getElementById('root')!).render(<AuthGate />);
