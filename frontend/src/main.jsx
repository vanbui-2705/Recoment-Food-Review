import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import EatwiseDashboard from './features/dashboard/EatwiseDashboard.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <EatwiseDashboard />
  </React.StrictMode>,
);
