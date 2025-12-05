import React, { useEffect, useRef, useState } from 'react';
import Calendar from '@toast-ui/react-calendar';
import '@toast-ui/calendar/dist/toastui-calendar.min.css';
import axios from 'axios';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import CallSheetPrint from './CallSheetPrint';
import ShiftModal from './ShiftModal';
import ExportImportButtons from './ExportImportButtons';
import RosterView from './RosterView';

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
    const [viewMode, setViewMode] = useState('roster'); // Default to Roster as requested
    const [selectedLocation, setSelectedLocation] = useState('All');

    // Build location tabs from shifts
    const dynamicLocations = [...new Set(shifts.map(s => s.location).filter(l => l && l !== 'General'))];
    const locations = ['All', ...dynamicLocations.filter(l => l !== 'Employee Lot'), 'Employee Lot'];

    // Filter shifts by location
    const filteredShifts = selectedLocation === 'All' ? shifts : shifts.filter(s => s.location === selectedLocation);

    const handleViewChange = (mode) => {
        setViewMode(mode);
        if (mode !== 'roster' && calendarRef.current) {
            const calendarInstance = calendarRef.current.getInstance();
            calendarInstance.changeView(mode);
        }
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
    const fetchShifts = async () => {
        const start = startOfWeek(currentDate, { weekStartsOn: 6 }); // Saturday
        const end = endOfWeek(currentDate, { weekStartsOn: 6 });
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
                location: shift.location,
                booth_number: shift.booth_number,
                backgroundColor: getRoleColor(shift.role_id),
                color: '#fff'
            }));
            setShifts(events);
        } catch (error) {
            console.error("Error fetching shifts:", error);
        }
    };

    useEffect(() => {
        fetchShifts();
        // Sync Calendar view date
        if (calendarRef.current) {
            calendarRef.current.getInstance().setDate(currentDate);
        }
    }, [currentDate, roles]);

    // Helper to filter employees based on active tab (Location)
    const getEmployeesForTab = () => {
        if (selectedLocation === 'All') return employees;

        // Find shifts matching the active location
        const locationShifts = shifts.filter(s => s.location === selectedLocation);
        const employeeIds = new Set(locationShifts.map(s => s.calendarId));

        // Note: fetchShifts mapped events to { id, calendarId, ... }. 
        // But we store raw shifts in state? No, setShifts(events).
        // Events have `calendarId` as string.

        return employees.filter(e => employeeIds.has(e.id.toString()));
    };

    // Update calendars (resources) based on active tab
    useEffect(() => {
        const filteredEmployees = getEmployeesForTab();

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
    }, [employees, activeTab, roles]);

    // Filter employees for RosterView based on activeTab
    const getFilteredEmployees = () => {
        return getEmployeesForTab();
    };

    const getRoleColor = (roleId) => {
        const role = roles.find(r => r.id === roleId);
        return role ? role.color_hex : '#999';
    };

    const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
    const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
    const handleToday = () => setCurrentDate(new Date());

    const onBeforeUpdateSchedule = async (event) => {
        const { schedule, changes } = event;
        try {
            const updates = {};
            if (changes.start) updates.start_time = changes.start.toDate().toISOString();
            if (changes.end) updates.end_time = changes.end.toDate().toISOString();
            if (changes.calendarId) {
                updates.employee_id = changes.calendarId === 'OPEN' ? null : parseInt(changes.calendarId);
            }

            await axios.put(`${BASE_URL}/shifts/${schedule.id}`, updates);
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

    const onClickSchedule = async (event) => {
        console.log("onClickSchedule event:", event);
        const { schedule } = event;

        // Fetch the full shift data from API to get ALL fields
        try {
            const response = await axios.get(`${BASE_URL}/shifts/${schedule.id}`);
            const fullShift = response.data;

            setSelectedShift({
                id: fullShift.id,
                employee_id: fullShift.employee_id,
                role_id: fullShift.role_id,
                start: new Date(fullShift.start_time),
                end: new Date(fullShift.end_time),
                title: fullShift.notes || '',
                location: fullShift.location,
                booth_number: fullShift.booth_number,
                notes: fullShift.notes,
                is_vacation: fullShift.is_vacation
            });
            setIsModalOpen(true);
        } catch (error) {
            console.error("Error fetching shift:", error);
            alert("Failed to load shift data");
        }
    };

    const handleSaveShift = async (data) => {
        try {
            console.log('Saving shift data:', data);

            // Use times as-is - they already have seconds from ShiftModal
            const payload = {
                employee_id: data.employee_id,
                role_id: data.role_id,
                start_time: data.start_time,
                end_time: data.end_time,
                notes: data.notes || null,
                location: data.location || null,
                booth_number: data.booth_number || null,
                is_vacation: data.is_vacation || false
            };

            console.log('Sending payload:', payload);

            if (selectedShift?.id) {
                // Update existing shift
                await axios.put(`${BASE_URL}/shifts/${selectedShift.id}`, payload);
            } else {
                // Create new shift (include additional fields)
                payload.create_open_shift = data.create_open_shift || false;
                payload.repeat = data.repeat || null;
                await axios.post(`${BASE_URL}/shifts/`, payload);
            }
            setIsModalOpen(false);
            fetchShifts(); // Refresh shifts without reloading page
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
            fetchShifts(); // Refresh shifts without reloading page
        } catch (error) {
            console.error("Delete failed:", error);
        }
    };



    const onEmptyCellClick = (date, employeeId) => {
        // Open modal for creating new shift
        const start = new Date(date);
        start.setHours(9, 0, 0, 0); // Default 9 AM
        const end = new Date(date);
        end.setHours(17, 0, 0, 0); // Default 5 PM

        setSelectedShift({
            start,
            end,
            employee_id: employeeId === 'OPEN' ? null : employeeId,
            title: ''
        });
        setIsModalOpen(true);
    };

    return (
        <div className="h-screen flex flex-col p-4">
            {/* Toolbar */}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold">Schedule</h1>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleViewChange('roster')}
                            className={`px-3 py-1 rounded ${viewMode === 'roster' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                        >
                            Roster
                        </button>
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
                {/* ... (Date nav remains same) ... */}
                <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                        <ExportImportButtons onPrintCallSheet={() => setShowCallSheet(true)} />
                    </div>
                    <div className="flex gap-2 items-center">
                        <button onClick={handleToday} className="px-3 py-1 border rounded hover:bg-gray-100">Today</button>
                        <button onClick={handlePrevWeek} className="px-3 py-1 border rounded hover:bg-gray-100">&lt;</button>
                        <button onClick={handleNextWeek} className="px-3 py-1 border rounded hover:bg-gray-100">&gt;</button>
                        <span className="text-lg font-semibold ml-4">
                            {viewMode === 'month' ?
                                format(currentDate, 'MMMM yyyy') :
                                `${format(startOfWeek(currentDate, { weekStartsOn: 6 }), 'MMM d')} - ${format(endOfWeek(currentDate, { weekStartsOn: 6 }), 'MMM d, yyyy')}`
                            }
                        </span>
                    </div>
                </div>
            </div>

            {/* Color Legend */}
            <div className="bg-gray-50 border rounded p-2 mb-2">
                <div className="text-xs font-semibold text-gray-600 mb-1">Role Colors:</div>
                <div className="flex flex-wrap gap-2">
                    {roles.map(role => (
                        <div key={role.id} className="flex items-center gap-1">
                            <div
                                className="w-4 h-4 rounded border border-gray-300"
                                style={{ backgroundColor: role.color_hex }}
                            ></div>
                            <span className="text-xs text-gray-700">{role.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Location Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
                {locations.map(loc => (
                    <button key={loc} onClick={() => setSelectedLocation(loc)}
                        className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${selectedLocation === loc ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-700 hover:bg-gray-100 border'}`}>
                        {loc}
                    </button>
                ))}
            </div>

            {/* Calendar / Roster View */}
            <div className="flex-1 border rounded shadow bg-white relative overflow-hidden">


                {viewMode === 'roster' ? (
                    <RosterView
                        currentDate={currentDate}
                        employees={getFilteredEmployees()}
                        shifts={filteredShifts}
                        onShiftClick={(shift) => onClickSchedule({ schedule: shift })}
                        onEmptyCellClick={onEmptyCellClick}
                        onEmployeeClick={(emp) => {
                            setSelectedShift({
                                employee_id: emp.id,
                                role_id: emp.default_role_id,
                                start: new Date(),
                                end: new Date(),
                                title: `${emp.first_name} ${emp.last_name}`
                            });
                            setIsModalOpen(true);
                        }}
                        onRefresh={fetchShifts}
                    />
                ) : (
                    <Calendar
                        ref={calendarRef}
                        height="100%"
                        view={viewMode}
                        week={{
                            startDayOfWeek: 6,
                            taskView: false,
                            eventView: ['time'],
                            hourStart: 6,
                            hourEnd: 24
                        }}
                        useCreationPopup={false}
                        useDetailPopup={false}
                        calendars={calendars}
                        events={filteredShifts}
                        onBeforeUpdateSchedule={onBeforeUpdateSchedule}
                        onBeforeCreateSchedule={onBeforeCreateSchedule}
                        onClickSchedule={onClickSchedule}
                    />
                )}
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
