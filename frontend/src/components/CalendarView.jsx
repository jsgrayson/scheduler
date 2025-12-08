import React, { useEffect, useRef, useState } from 'react';
import Calendar from '@toast-ui/react-calendar';
import '@toast-ui/calendar/dist/toastui-calendar.min.css';
import axios from 'axios';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import CallSheetPrint from './CallSheetPrint';
import ShiftModal from './ShiftModal';
import ExportImportButtons from './ExportImportButtons';
import RosterView from './RosterView';
import PrintSchedule from './PrintSchedule';
import TemplateEditor from './TemplateEditor';
import EmployeeModal from './EmployeeModal';

const BASE_URL = 'http://localhost:8000';

const CalendarView = () => {
    const calendarRef = useRef(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isPrinting, setIsPrinting] = useState(false);

    const handlePrint = () => {
        setIsPrinting(true);
        setTimeout(() => {
            window.print();
            setIsPrinting(false);
        }, 500);
    };
    const [activeTab, setActiveTab] = useState('All');
    const [showCallSheet, setShowCallSheet] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [roles, setRoles] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [calendars, setCalendars] = useState([]);
    const [viewMode, setViewMode] = useState('roster'); // Default to Roster
    const [selectedLocation, setSelectedLocation] = useState('All');
    const [zoomLevel, setZoomLevel] = useState(0); // Fully zoomed out (00:00 start)

    // Build location tabs from shifts
    // Sort priority
    const LOC_PRIORITY = ['SUPERVISORS', 'OFFICE', 'MAINTENANCE', 'CONRAC', 'PLAZA', 'CUSTOMER LOTS', 'LOT 1', 'LOT 2', 'LOT 3', 'LOT 4', 'EMPLOYEE LOT'];

    // Build location tabs from shifts (Case Insensitive normalization)
    const normalizeLoc = (loc) => loc ? loc.toUpperCase().trim() : '';

    const allLocs = shifts.map(s => normalizeLoc(s.location)).filter(l => l && l !== 'GENERAL');
    const dynamicLocations = [...new Set(allLocs)];

    dynamicLocations.sort((a, b) => {
        const idxA = LOC_PRIORITY.indexOf(a);
        const idxB = LOC_PRIORITY.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });

    const locations = ['All', ...dynamicLocations];

    // Filter shifts by location (Case Insensitive) and Map for Calendar
    const filteredShifts = (selectedLocation === 'All'
        ? shifts
        : shifts.filter(s => normalizeLoc(s.location) === selectedLocation)
    ).map(s => ({
        ...s,
        isReadOnly: s.is_locked,
        category: 'time'
    }));

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
            const events = response.data.map(shift => {
                // Find employee name for tooltip
                const emp = employees.find(e => e.id === shift.employee_id);
                const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Open Shift';
                const role = roles.find(r => r.id === shift.role_id);
                const roleName = role ? role.name : 'Unknown Role';

                return {
                    id: shift.id.toString(),
                    calendarId: shift.employee_id ? shift.employee_id.toString() : 'OPEN',
                    title: empName,
                    body: `${roleName}${shift.location ? ' @ ' + shift.location : ''}${shift.notes ? '\n' + shift.notes : ''}`,
                    category: 'time',
                    start: shift.start_time,
                    end: shift.end_time,
                    location: shift.location,
                    booth_number: shift.booth_number,
                    backgroundColor: getRoleColor(shift.role_id),
                    roleId: shift.role_id,
                    color: '#fff',
                    is_locked: shift.is_locked,
                    isReadOnly: shift.is_locked
                };
            });
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

    // Employee modal state
    const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);

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

        // Handle both old (schedule) and new (event) Toast UI format
        const schedule = event.schedule || event.event || event;
        const shiftId = schedule.id;

        if (!shiftId) {
            console.error("No shift ID found in event:", event);
            return;
        }

        // Fetch the full shift data from API to get ALL fields
        try {
            const response = await axios.get(`${BASE_URL}/shifts/${shiftId}`);
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
                is_vacation: data.is_vacation || false,
                force_save: data.force_save || false
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
            const errorMsg = error.response?.data?.detail || error.message;
            alert("Save failed: " + errorMsg + "\n\nTip: Check 'Force Save' to override conflict detection.");
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

    const handleProjectSchedule = async () => {
        const weeks = prompt("Project Master Schedule for how many weeks?", "4");
        if (!weeks) return;

        const numWeeks = parseInt(weeks);
        if (isNaN(numWeeks) || numWeeks <= 0) {
            alert("Invalid number of weeks");
            return;
        }

        if (!confirm(`This will generate shifts from the MASTER TEMPLATES for the next ${numWeeks} weeks. \n\nNote: This will ADD new shifts. It will NOT delete existing locked shifts.`)) return;

        try {
            const startOfWeekDate = startOfWeek(currentDate, { weekStartsOn: 6 }); // Saturday start
            const payload = {
                start_date: format(startOfWeekDate, "yyyy-MM-dd'T'HH:mm:ss"),
                num_weeks: numWeeks
            };

            const response = await axios.post(`${BASE_URL}/shifts/apply-schedule/`, payload);
            alert(`Schedule Projected Successfully!\nCreated ${response.data.created_count} shifts from templates.`);
            fetchShifts();
        } catch (error) {
            console.error("Projection failed:", error);
            alert(`Projection failed: ${error.response?.data?.detail || error.message}`);
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
        <>
            <div className="h-full flex flex-col print:hidden">
                {/* Toolbar */}
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                        <div className="flex gap-1">
                            <button
                                onClick={() => handleViewChange('roster')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'roster' ? 'btn-primary' : 'btn-secondary'}`}
                            >
                                Roster
                            </button>
                            <button
                                onClick={() => handleViewChange('week')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'week' ? 'btn-primary' : 'btn-secondary'}`}
                            >
                                Week
                            </button>
                            <button
                                onClick={() => handleViewChange('master')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'master' ? 'btn-primary' : 'btn-secondary'}`}
                            >
                                Master Schedule
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex gap-2">
                            <button onClick={handleProjectSchedule} className="bg-purple-600 text-white px-3 py-1.5 rounded text-sm hover:bg-purple-700 font-medium">
                                🚀 Project Schedule
                            </button>
                            <ExportImportButtons onPrintCallSheet={() => setShowCallSheet(true)} />
                            <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
                                Print / PDF
                            </button>
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
                <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                    {locations.map(loc => (
                        <button key={loc} onClick={() => setSelectedLocation(loc)}
                            className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${selectedLocation === loc ? 'btn-primary' : 'btn-secondary'}`}>
                            {loc}
                        </button>
                    ))}
                </div>

                {/* Calendar / Roster View */}
                <div className="card flex-1 relative overflow-hidden">


                    {viewMode === 'master' ? (
                        <TemplateEditor selectedLocation={selectedLocation} />
                    ) : viewMode === 'roster' ? (
                        <RosterView
                            currentDate={currentDate}
                            employees={getFilteredEmployees()} // Only employees matching filters
                            shifts={shifts} // Pass ALL shifts so we can show "Other Location" shifts
                            selectedLocation={selectedLocation}
                            onShiftClick={(shift) => onClickSchedule({ schedule: shift })}
                            onEmptyCellClick={onEmptyCellClick}
                            onEmployeeClick={(emp) => {
                                setSelectedEmployee(emp);
                                setIsEmployeeModalOpen(true);
                            }}
                            onRefresh={fetchShifts}
                        />
                    ) : (
                        <div className="h-full flex flex-col">
                            {/* Zoom Controls */}
                            <div className="flex items-center gap-3 mb-2 px-2">
                                <span className="text-xs text-gray-500">Zoom:</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="8"
                                    value={zoomLevel}
                                    onChange={(e) => setZoomLevel(parseInt(e.target.value))}
                                    className="w-24 h-1 accent-blue-600"
                                />
                                <span className="text-xs text-gray-400">{zoomLevel}:00 - 24:00</span>
                            </div>
                            <div className="flex-1">
                                <Calendar
                                    ref={calendarRef}
                                    height="100%"
                                    view={viewMode}
                                    template={{
                                        time: function (schedule) {
                                            return `<span style="color: inherit;">${schedule.isReadOnly ? '<span class="hide-on-print" style="font-weight:bold; color:white;">*</span> ' : ''}${schedule.title}</span>`;
                                        }
                                    }}
                                    week={{
                                        startDayOfWeek: 6,
                                        taskView: false,
                                        eventView: ['time'],
                                        hourStart: zoomLevel,
                                        hourEnd: 24
                                    }}
                                    useCreationPopup={false}
                                    useDetailPopup={true}
                                    calendars={calendars}
                                    events={filteredShifts}
                                    onBeforeUpdateSchedule={onBeforeUpdateSchedule}
                                    onBeforeCreateSchedule={onBeforeCreateSchedule}
                                    onSelectDateTime={(e) => {
                                        // Create new shift on time selection
                                        setSelectedShift({
                                            start: new Date(e.start),
                                            end: new Date(e.end),
                                            title: ''
                                        });
                                        setIsModalOpen(true);
                                    }}
                                    onBeforeDeleteEvent={(e) => {
                                        // Handle Delete button from popup
                                        const shiftId = e.id;
                                        if (confirm("Delete this shift?")) {
                                            axios.delete(`${BASE_URL}/shifts/${shiftId}`)
                                                .then(() => fetchShifts())
                                                .catch(err => alert("Delete failed: " + err.message));
                                        }
                                    }}
                                    onBeforeUpdateEvent={(e) => {
                                        // Handle Edit button from popup - open our modal
                                        onClickSchedule({ event: e.event });
                                    }}
                                />
                            </div>
                        </div>
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

                <EmployeeModal
                    isOpen={isEmployeeModalOpen}
                    onClose={() => setIsEmployeeModalOpen(false)}
                    employee={selectedEmployee}
                    onSave={async (updatedData) => {
                        try {
                            await axios.put(`${BASE_URL}/employees/${updatedData.id}`, updatedData);
                            setIsEmployeeModalOpen(false);
                            // Refresh employees list
                            const res = await axios.get(`${BASE_URL}/employees/`);
                            setEmployees(res.data);
                        } catch (error) {
                            console.error("Error saving employee:", error);
                            alert(`Failed to save employee: ${error.response?.data?.detail || error.message}`);
                        }
                    }}
                />
            </div>
            {isPrinting && <PrintSchedule shifts={shifts} employees={employees} currentDate={currentDate} />}
        </>
    );
};

export default CalendarView;
