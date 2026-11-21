import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './styles.css';
import { watchViewport } from './viewport.ts';

watchViewport();

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
