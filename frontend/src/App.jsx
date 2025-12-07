import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import Login from './components/Login';
import CalendarView from './components/CalendarView';
import AgendaView from './components/AgendaView';
import EmployeeSettings from './components/EmployeeSettings';
import Sidebar from './components/Sidebar';

// Page titles based on route
const pageTitles = {
  '/': 'Schedule',
  '/agenda': 'Agendas',
  '/settings': 'Settings',
};

// Header component that uses location
const AppHeader = ({ onLogout }) => {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Scheduler';

  return (
    <header className="app-header print:hidden">
      <h1 className="page-title">{title}</h1>
      <button
        onClick={onLogout}
        className="btn-secondary flex items-center gap-2"
        style={{
          color: 'var(--color-gray-600)',
          padding: '0.5rem 0.75rem',
          fontSize: '0.875rem'
        }}
      >
        <LogOut size={16} />
        <span>Logout</span>
      </button>
    </header>
  );
};

function AppContent({ onLogout }) {
  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <AppHeader onLogout={onLogout} />

        {/* Page Content */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<CalendarView />} />
            <Route path="/agenda" element={<AgendaView />} />
            <Route path="/settings" element={<EmployeeSettings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('scheduler_token'));

  const handleLogin = (newToken) => {
    localStorage.setItem('scheduler_token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('scheduler_token');
    setToken(null);
  };

  // Uncomment to enable login requirement:
  // if (!token) {
  //   return <Login onLogin={handleLogin} />;
  // }

  return (
    <Router>
      <AppContent onLogout={handleLogout} />
    </Router>
  );
}

export default App;
