import React from 'react';
import { NavLink } from 'react-router-dom';
import { Calendar, ClipboardList, Settings, Users, LayoutDashboard } from 'lucide-react';

const navItems = [
    { to: '/', icon: Calendar, label: 'Calendar' },
    { to: '/agenda', icon: ClipboardList, label: 'Agendas' },
    { to: '/settings', icon: Settings, label: 'Settings' },
];

const Sidebar = () => {
    return (
        <nav className="sidebar print:hidden">
            {/* Logo / Brand */}
            <div className="mb-6">
                <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                >
                    S
                </div>
            </div>

            {/* Navigation Links */}
            <div className="flex flex-col gap-1">
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        title={label}
                        className={({ isActive }) =>
                            `sidebar-link ${isActive ? 'active' : ''}`
                        }
                    >
                        <Icon size={22} strokeWidth={1.75} />
                    </NavLink>
                ))}
            </div>
        </nav>
    );
};

export default Sidebar;
