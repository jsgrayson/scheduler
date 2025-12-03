import React, { useEffect, useRef, useState } from 'react';
import Calendar from '@toast-ui/react-calendar';
import '@toast-ui/calendar/dist/toastui-calendar.min.css';
import axios from 'axios';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import CallSheetPrint from './CallSheetPrint';
import ShiftModal from './ShiftModal';
import ExportImportButtons from './ExportImportButtons';

const BASE_URL = 'http://localhost:8000';

const CalendarView = () => {
    const calendarRef = useRef(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [activeTab, setActiveTab] = useState('All');
    const [showCallSheet, setShowCallSheet] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [roles, setRoles] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [calendars, setCalendars] = useState([]);
    const [viewMode, setViewMode] = useState('week');

    const handleViewChange = (mode) => {
        setViewMode(mode);
        const calendarInstance = calendarRef.current.getInstance();
        calendarInstance.changeView(mode);
    };

    // Fetch initial data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [empRes, roleRes] = await Promise.all([
                    axios.get(`${BASE_URL}/employees/`),
                    axios.get(`${BASE_URL}/roles/`)
                ]);
                setEmployees(empRes.data);
                setRoles(roleRes.data);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, []);

    // Fetch shifts when date changes
    useEffect(() => {
        const fetchShifts = async () => {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            try {
                const response = await axios.get(`${BASE_URL}/shifts/`, {
                    params: { start_date: start.toISOString(), end_date: end.toISOString() }
                });

                // Map backend shifts to Toast UI events
                const events = response.data.map(shift => ({
                    id: shift.id.toString(),
                    calendarId: shift.employee_id ? shift.employee_id.toString() : 'OPEN',
                    title: shift.notes || 'Shift',
                    category: 'time',
                    start: shift.start_time,
                    end: shift.end_time,
                    backgroundColor: getRoleColor(shift.role_id),
                    color: '#fff'
                }));
                setShifts(events);
            } catch (error) {
                console.error("Error fetching shifts:", error);
            }
        };
        fetchShifts();
    }, [currentDate, roles]);

    // Update calendars (resources) based on active tab
    useEffect(() => {
        let filteredEmployees = employees;

        if (activeTab !== 'All') {
            // Find role ID for the tab name
            const role = roles.find(r => r.name === activeTab);
            if (role) {
                filteredEmployees = employees.filter(e => e.default_role_id === role.id);
            } else if (activeTab === 'Open') {
                // This case is for showing only the "Open Shifts" row,
                // so filteredEmployees should be empty for actual employees.
                filteredEmployees = [];
            }
        }

        const resources = filteredEmployees.map(emp => ({
            id: emp.id.toString(),
            name: `${emp.first_name} ${emp.last_name}`,
            color: '#000',
            bgColor: '#f5f5f5',
            borderColor: '#ddd'
        }));

        // Add "Open Shifts" row
        resources.unshift({
            id: 'OPEN',
            name: 'Open Shifts',
            color: '#fff',
            bgColor: '#ffcccc',
            borderColor: '#ff0000'
        });

        setCalendars(resources);

        // Update calendar instance
        const calendarInstance = calendarRef.current?.getInstance();
        if (calendarInstance) {
            // Toast UI doesn't have a direct "setCalendars" for resource view in React wrapper easily?
            // Actually it does via the `calendars` prop, but we might need to force refresh or use `setCalendars` API.
            // For now, passing `calendars` prop should work.
        }
    }, [employees, activeTab, roles]);

    const getRoleColor = (roleId) => {
        const role = roles.find(r => r.id === roleId);
        return role ? role.color_hex : '#999';
    };

    const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
    const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
    const handleToday = () => setCurrentDate(new Date());

    const onBeforeUpdateSchedule = async (event) => {
        const { schedule, changes } = event;
        // Optimistic update
        // Call API to update shift
        try {
            const updates = {};
            if (changes.start) updates.start_time = changes.start.toDate().toISOString();
            if (changes.end) updates.end_time = changes.end.toDate().toISOString();
            if (changes.calendarId) {
                updates.employee_id = changes.calendarId === 'OPEN' ? null : parseInt(changes.calendarId);
            }

            await axios.put(`${BASE_URL}/shifts/${schedule.id}`, updates);

            // Refresh shifts (or update local state)
            // For simplicity, just re-fetch or update local
            // Re-fetching is safer for validation logic on backend
            // But let's just update local for UI responsiveness
            calendarRef.current.getInstance().updateSchedule(schedule.id, schedule.calendarId, changes);

        } catch (error) {
            console.error("Update failed:", error);
            alert("Update failed: " + (error.response?.data?.detail || error.message));
        }
    };

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedShift, setSelectedShift] = useState(null);

    const onBeforeCreateSchedule = (event) => {
        setSelectedShift({
            start: event.start.toDate(),
            end: event.end.toDate(),
            title: ''
        });
        setIsModalOpen(true);
    };

    const onClickSchedule = (event) => {
        const { schedule } = event;
        setSelectedShift({
            id: schedule.id,
            employee_id: schedule.calendarId === 'OPEN' ? null : parseInt(schedule.calendarId),
            role_id: 1, // Ideally we get this from event data if stored, or fetch
            start: schedule.start.toDate(),
            end: schedule.end.toDate(),
            title: schedule.title
        });
        setIsModalOpen(true);
    };

    const handleSaveShift = async (data) => {
        try {
            const payload = {
                employee_id: data.employee_id,
                role_id: data.role_id,
                start_time: new Date(data.start_time).toISOString(),
                end_time: new Date(data.end_time).toISOString(),
                notes: data.notes
            };

            if (selectedShift?.id) {
                await axios.put(`${BASE_URL}/shifts/${selectedShift.id}`, payload);
            } else {
                await axios.post(`${BASE_URL}/shifts/`, payload);
            }
            setIsModalOpen(false);
            window.location.reload();
        } catch (error) {
            console.error("Save failed:", error);
            alert("Save failed: " + (error.response?.data?.detail || error.message));
        }
    };

    const handleDeleteShift = async () => {
        if (!selectedShift?.id) return;
        if (!confirm("Are you sure you want to delete this shift?")) return;
        try {
            await axios.delete(`${BASE_URL}/shifts/${selectedShift.id}`);
            setIsModalOpen(false);
            window.location.reload();
        } catch (error) {
            console.error("Delete failed:", error);
        }
    };

    return (
        <div className="h-screen flex flex-col p-4">
            {/* Toolbar */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold">Schedule</h1>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleViewChange('week')}
                            className={`px-3 py-1 rounded ${viewMode === 'week' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                        >
                            Week
                        </button>
                        <button
                            onClick={() => handleViewChange('month')}
                            className={`px-3 py-1 rounded ${viewMode === 'month' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                        >
                            Month
                        </button>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleToday} className="px-3 py-1 border rounded hover:bg-gray-100">Today</button>
                    <button onClick={handlePrevWeek} className="px-3 py-1 border rounded hover:bg-gray-100">&lt;</button>
                    <button onClick={handleNextWeek} className="px-3 py-1 border rounded hover:bg-gray-100">&gt;</button>
                    <span className="text-lg font-semibold ml-4">
                        {viewMode === 'week' ?
                            `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}` :
                            format(currentDate, 'MMMM yyyy')
                        }
                    </span>
                </div>

                {/* Tabs */}
                <div className="flex space-x-1 bg-gray-200 p-1 rounded">
                    {['All', 'Cashier', 'Elot', 'CLot'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-1 rounded ${activeTab === tab ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:bg-gray-300'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Calendar */}
            <div className="flex-1 border rounded shadow bg-white relative">
                <div className="absolute top-2 right-2 z-10 flex gap-2">
                    <ExportImportButtons />
                    <button
                        onClick={() => setShowCallSheet(true)}
                        className="bg-gray-800 text-white px-3 py-1 rounded shadow hover:bg-gray-700 text-sm"
                    >
                        Print Call Sheet
                    </button>
                </div>
                <Calendar
                    ref={calendarRef}
                    height="100%"
                    view={viewMode}
                    week={{
                        dayNames: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                        startDayOfWeek: 1,
                        taskView: false,
                        eventView: ['time'],
                        hourStart: 6,
                        hourEnd: 24
                    }}
                    useCreationPopup={false}
                    useDetailPopup={false}
                    calendars={calendars}
                    events={shifts}
                    onBeforeUpdateSchedule={onBeforeUpdateSchedule}
                    onBeforeCreateSchedule={onBeforeCreateSchedule}
                    onClickSchedule={onClickSchedule}
                />
            </div>

            {showCallSheet && <CallSheetPrint onClose={() => setShowCallSheet(false)} />}

            <ShiftModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                initialData={selectedShift}
                onSave={handleSaveShift}
                onDelete={handleDeleteShift}
            />
        </div>
    );
};

export default CalendarView;
