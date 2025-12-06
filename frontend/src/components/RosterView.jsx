import React, { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, isSameDay, parseISO, differenceInMinutes } from 'date-fns';
import axios from 'axios';

const BASE_URL = 'http://localhost:8000';

const RosterView = ({ currentDate, employees, shifts, onShiftClick, onEmptyCellClick, onEmployeeClick, onRefresh, selectedLocation, readOnly = false }) => {
    const start = startOfWeek(currentDate, { weekStartsOn: 6 }); // Saturday
    const days = Array.from({ length: 7 }).map((_, i) => addDays(start, i));

    // Bulk edit state
    const [bulkEditMode, setBulkEditMode] = useState(false);
    const [selectedShiftIds, setSelectedShiftIds] = useState(new Set());
    const [bulkRole, setBulkRole] = useState('');
    const [bulkLocation, setBulkLocation] = useState('');
    const [bulkBooth, setBulkBooth] = useState('');
    const [roles, setRoles] = useState([]);

    // Fetch roles for bulk edit
    useEffect(() => {
        const fetchRoles = async () => {
            try {
                const res = await axios.get(`${BASE_URL}/roles/`);
                setRoles(res.data);
            } catch (error) {
                console.error("Failed to fetch roles", error);
            }
        };
        fetchRoles();
    }, []);

    // Location filtering handled by parent CalendarView
    const filteredShifts = shifts;
    const filteredEmployees = employees;

    const calculateTotalHours = (employeeId) => {
        let totalMinutes = 0;

        // Find shifts for this employee within the current week
        const employeeShifts = filteredShifts.filter(shift => {
            const shiftEmpId = shift.calendarId === 'OPEN' ? 'OPEN' : parseInt(shift.calendarId);
            if (shiftEmpId !== employeeId) return false;

            // Check if shift falls in the displayed week
            const shiftStart = typeof shift.start === 'string' ? parseISO(shift.start) : shift.start;
            return days.some(day => isSameDay(shiftStart, day));
        });

        employeeShifts.forEach(shift => {
            const start = typeof shift.start === 'string' ? parseISO(shift.start) : shift.start;
            const end = typeof shift.end === 'string' ? parseISO(shift.end) : shift.end;
            let durationMinutes = differenceInMinutes(end, start);

            // Lunch Deduction Logic
            // If duration > 5 hours AND role is NOT Cashier -> Deduct 30 mins
            if (durationMinutes > 300) { // 5 hours
                let roleId = parseInt(shift.role_id || shift.roleId);

                // Fallback: If no role on shift, use employee's default role
                if (!roleId || isNaN(roleId)) {
                    const emp = employees.find(e => e.id === employeeId);
                    if (emp) roleId = emp.default_role_id;
                }

                const role = roles.find(r => r.id === roleId);
                const roleName = role ? role.name.toLowerCase() : '';

                // Exempt Cashier IDs: 3 (Cashier), 7 (PT Cashier), 8 (FT Cashier)
                const isCashierId = [3, 7, 8].includes(roleId);

                if (isCashierId || roleName.includes('cashier')) {
                    // Exempt from deduction
                } else {
                    // Deduct lunch
                    durationMinutes -= 30;
                }
            }
            totalMinutes += durationMinutes;
        });

        return (totalMinutes / 60).toFixed(1);
    };

    const getShiftsForCell = (employeeId, day) => {
        return filteredShifts.filter(shift => {
            if (!shift.start) return false;
            const shiftStart = typeof shift.start === 'string' ? parseISO(shift.start) : shift.start;
            const shiftEmpId = shift.calendarId === 'OPEN' ? 'OPEN' : parseInt(shift.calendarId);
            if (employeeId === 'OPEN') {
                if (shiftEmpId !== 'OPEN') return false;
                // Strict location filtering for Open Shifts row
                if (selectedLocation !== 'All' && shift.location !== selectedLocation) return false;
            } else {
                if (shiftEmpId !== employeeId) return false;
            }
            return isSameDay(shiftStart, day);
        });
    };

    const toggleShiftSelection = (shiftId) => {
        const newSelection = new Set(selectedShiftIds);
        if (newSelection.has(shiftId)) {
            newSelection.delete(shiftId);
        } else {
            newSelection.add(shiftId);
        }
        setSelectedShiftIds(newSelection);
    };

    const handleBulkUpdate = async () => {
        if (selectedShiftIds.size === 0) {
            alert('No shifts selected');
            return;
        }
        if (!bulkRole && !bulkLocation && !bulkBooth) {
            alert('Select at least one field to update');
            return;
        }

        try {
            const payload = {
                shift_ids: Array.from(selectedShiftIds).map(id => parseInt(id)),
                role_id: bulkRole ? parseInt(bulkRole) : null,
                location: bulkLocation || null,
                booth_number: bulkBooth || null
            };
            console.log('Bulk update payload:', payload);
            const response = await axios.post(`${BASE_URL}/shifts/bulk-update/`, payload);
            console.log('Bulk update response:', response.data);
            alert(`Updated ${selectedShiftIds.size} shifts`);
            setSelectedShiftIds(new Set());
            setBulkRole('');
            setBulkLocation('');
            setBulkBooth('');
            setBulkEditMode(false);
            if (onRefresh) onRefresh(); // Refresh without page reload
        } catch (error) {
            console.error('Bulk update failed:', error);
            console.error('Error response:', error.response?.data);
            alert(`Bulk update failed: ${error.response?.data?.detail || error.message}`);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedShiftIds.size === 0) {
            alert('No shifts selected');
            return;
        }
        if (!confirm(`Delete ${selectedShiftIds.size} shifts? This cannot be undone.`)) {
            return;
        }
        try {
            const payload = { shift_ids: Array.from(selectedShiftIds).map(id => parseInt(id)) };
            await axios.post(`${BASE_URL}/shifts/bulk-delete/`, payload);
            alert(`Deleted ${selectedShiftIds.size} shifts`);
            setSelectedShiftIds(new Set());
            setBulkEditMode(false);
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error('Bulk delete failed:', error);
            alert(`Bulk delete failed: ${error.response?.data?.detail || error.message}`);
        }
    };

    return (
        <div className={`flex flex-col gap-2 ${readOnly ? '' : 'h-full'}`}>
            {/* Bulk Edit Toggle and Bar */}
            <div className={`flex items-center gap-2 ${readOnly ? 'hidden' : ''}`}>
                <button
                    onClick={() => {
                        setBulkEditMode(!bulkEditMode);
                        if (bulkEditMode) {
                            // Exiting bulk edit - reset
                            setSelectedShiftIds(new Set());
                            setBulkRole('');
                            setBulkLocation('');
                            setBulkBooth('');
                        } else {
                            // Entering bulk edit - default location to current tab
                            if (selectedLocation && selectedLocation !== 'All') {
                                setBulkLocation(selectedLocation);
                            }
                        }
                    }}
                    className={`px-4 py-2 rounded font-medium ${bulkEditMode ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                    {bulkEditMode ? '✓ Bulk Edit Mode' : 'Bulk Edit'}
                </button>

                {bulkEditMode && selectedShiftIds.size > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 flex items-center gap-4">
                        <span className="font-semibold text-blue-900">{selectedShiftIds.size} shifts selected</span>
                        <select value={bulkRole} onChange={(e) => setBulkRole(e.target.value)} className="border rounded px-2 py-1 text-sm">
                            <option value="">Change Role...</option>
                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        <select value={bulkLocation} onChange={(e) => setBulkLocation(e.target.value)} className="border rounded px-2 py-1 text-sm">
                            <option value="">Change Location...</option>
                            <option value="Office">Office</option>
                            <option value="Plaza">Plaza</option>
                            <option value="Conrac">Conrac</option>
                            <option value="Customer Lots">Customer Lots</option>
                            <option value="Lot 1">Lot 1</option>
                            <option value="Lot 2">Lot 2</option>
                            <option value="Lot 3">Lot 3</option>
                            <option value="Lot 4">Lot 4</option>
                        </select>
                        {bulkLocation === 'Plaza' && (
                            <select value={bulkBooth} onChange={(e) => setBulkBooth(e.target.value)} className="border rounded px-2 py-1 text-sm">
                                <option value="">Booth...</option>
                                <option value="5">Booth 5</option>
                                <option value="6">Booth 6</option>
                            </select>
                        )}
                        <button onClick={handleBulkUpdate} className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700 text-sm font-medium">
                            Apply Changes
                        </button>
                        <button onClick={handleBulkDelete} className="bg-red-600 text-white px-4 py-1 rounded hover:bg-red-700 text-sm font-medium">
                            Delete
                        </button>
                        <button onClick={() => setSelectedShiftIds(new Set())} className="text-gray-600 hover:text-gray-800 text-sm">
                            Clear Selection
                        </button>
                    </div>
                )}
            </div>



            <div className={`border rounded shadow bg-white flex flex-col ${readOnly ? '' : 'overflow-x-auto h-full'}`}>
                <table className="min-w-full divide-y divide-gray-200 h-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 border-r w-48">
                                Employee
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r w-20">
                                Hours
                            </th>
                            {days.map(day => (
                                <th key={day.toString()} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r min-w-[120px]">
                                    {format(day, 'EEE d')}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {/* Open Shifts Row */}
                        <tr className="bg-red-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600 sticky left-0 bg-red-50 border-r z-10">
                                Open Shifts
                            </td>
                            <td className="border-r bg-red-50"></td>
                            {days.map(day => {
                                const cellShifts = getShiftsForCell('OPEN', day);
                                return (
                                    <td
                                        key={day.toString()}
                                        className={`px-2 py-2 border-r align-top ${bulkEditMode ? '' : 'hover:bg-red-100 cursor-pointer'} transition-colors`}
                                        {...(!bulkEditMode && { onClick: () => onEmptyCellClick(day, 'OPEN') })}
                                    >
                                        <div className="flex flex-col gap-1">
                                            {cellShifts.map(shift => (
                                                <div key={shift.id} className="flex items-start gap-1">
                                                    {bulkEditMode && (
                                                        <input type="checkbox" checked={selectedShiftIds.has(shift.id)}
                                                            onChange={(e) => { e.stopPropagation(); toggleShiftSelection(shift.id); }}
                                                            className="mt-1 cursor-pointer" />
                                                    )}
                                                    <div onClick={(e) => {
                                                        console.log('Shift clicked, bulkEditMode:', bulkEditMode);
                                                        if (!bulkEditMode) {
                                                            e.stopPropagation();
                                                            onShiftClick(shift);
                                                        } else {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                        }
                                                    }}
                                                        className={`text-xs p-1 rounded border shadow-sm ${bulkEditMode ? 'cursor-default' : 'cursor-pointer'} bg-white border-red-200 text-red-800 truncate flex-1`}
                                                        title={`${format(new Date(shift.start), 'h:mm a')} - ${format(new Date(shift.end), 'h:mm a')}${shift.notes ? `\n${shift.notes}` : ''} `}>
                                                        {format(new Date(shift.start), 'h:mm a')} - {format(new Date(shift.end), 'h:mm a')}
                                                        {shift.booth_number && <div className="text-[10px] font-semibold text-red-900 mt-0.5">Booth {shift.booth_number}</div>}
                                                        {shift.notes && <div className="text-[10px] font-mono truncate bg-red-50 px-1 rounded mt-0.5">{shift.notes}</div>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>

                        {/* Employee Rows */}
                        {filteredEmployees.map(emp => {
                            const empRole = roles.find(r => r.id === emp.default_role_id);
                            return (
                                <tr key={emp.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white border-r z-10 cursor-pointer hover:bg-blue-50 transition-colors"
                                        onClick={() => onEmployeeClick?.(emp)}>
                                        <div className="hover:underline font-semibold" style={{ color: empRole?.color_hex }}>
                                            {emp.first_name} {emp.last_name}
                                        </div>
                                        <div className="text-xs text-gray-500 font-normal">{empRole?.name}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r text-center">
                                        {calculateTotalHours(emp.id)}
                                    </td>
                                    {days.map(day => {
                                        const cellShifts = getShiftsForCell(emp.id, day);
                                        return (
                                            <td
                                                key={day.toString()}
                                                className={`px-2 py-2 border-r align-top ${bulkEditMode ? '' : 'hover:bg-blue-50 cursor-pointer'} transition-colors`}
                                                {...(!bulkEditMode && { onClick: () => onEmptyCellClick(day, emp.id) })}
                                            >
                                                <div className="flex flex-col gap-1">
                                                    {cellShifts.map(shift => (
                                                        <div key={shift.id} className="flex items-start gap-1">
                                                            {bulkEditMode && (
                                                                <input type="checkbox" checked={selectedShiftIds.has(shift.id)}
                                                                    onChange={(e) => { e.stopPropagation(); toggleShiftSelection(shift.id); }}
                                                                    className="mt-1 cursor-pointer" />
                                                            )}
                                                            <div onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (!bulkEditMode) {
                                                                    onShiftClick(shift);
                                                                } else {
                                                                    e.preventDefault();
                                                                }
                                                            }}
                                                                className={`shift-card text-xs p-1 rounded text-white shadow-sm ${bulkEditMode ? 'cursor-default' : 'cursor-pointer'} truncate flex-1`}
                                                                style={{ backgroundColor: shift.backgroundColor || '#3b82f6', opacity: (selectedLocation !== 'All' && shift.location !== selectedLocation) ? 0.6 : 1 }}
                                                                title={`${format(new Date(shift.start), 'h:mm a')} - ${format(new Date(shift.end), 'h:mm a')} \n${shift.title} `}>
                                                                {(selectedLocation !== 'All' && shift.location !== selectedLocation) ? (
                                                                    <div className="font-bold text-center">{shift.location}</div>
                                                                ) : (
                                                                    <>
                                                                        {format(new Date(shift.start), 'h:mm a')} - {format(new Date(shift.end), 'h:mm a')}
                                                                        {shift.booth_number && <div className="text-[10px] font-semibold mt-0.5">Booth {shift.booth_number}</div>}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RosterView;
