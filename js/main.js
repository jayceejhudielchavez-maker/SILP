import { App } from './App.js';

// Reaching this line means every module loaded without errors
window.__appStarted = true;
new App().start();
