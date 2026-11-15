import { createRoot } from 'react-dom/client';
import { initializeReminderEntry } from './app/reminder-entry';
import { AuthGate } from './app/AuthGate';
import './styles/globals.css';

initializeReminderEntry();
createRoot(document.getElementById('root')!).render(<AuthGate />);
