
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Login from './components/Login';
import CalendarView from './components/CalendarView';
import AgendaView from './components/AgendaView';
import EmployeeSettings from './components/EmployeeSettings';

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

  // if (!token) {
  //   return <Login onLogin={handleLogin} />;
  // }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm p-4 mb-4 flex justify-between items-center">
          <div className="font-bold text-xl text-blue-600">Scheduler App</div>
          <div className="flex items-center gap-6">
            <div className="space-x-4">
              <Link to="/" className="text-gray-600 hover:text-blue-500 font-medium">Calendar</Link>
              <Link to="/agenda" className="text-gray-600 hover:text-blue-500 font-medium">Agendas</Link>
              <Link to="/settings" className="text-gray-600 hover:text-blue-500 font-medium">Settings</Link>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-red-600 hover:text-red-800 border border-red-200 rounded hover:bg-red-50"
            >
              Logout
            </button>
          </div>
        </nav>

        <main className="h-[calc(100vh-5rem)]">
          <Routes>
            <Route path="/" element={<CalendarView />} />
            <Route path="/agenda" element={<AgendaView />} />
            <Route path="/settings" element={<EmployeeSettings />} />
            <Route path="/" element={<div>Home Page - Calendar Disabled</div>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

