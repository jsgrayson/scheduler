import React, { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';

const RosterView = ({ currentDate, employees, shifts, onShiftClick, onEmptyCellClick }) => {
    const start = startOfWeek(currentDate, { weekStartsOn: 6 }); // Saturday
    const days = Array.from({ length: 7 }).map((_, i) => addDays(start, i));

    // --- Location Filtering Logic ---
    const [selectedLocation, setSelectedLocation] = useState("All");

    // Extract unique locations from shifts
    const locations = ["All", ...new Set(shifts.map(s => s.location).filter(l => l && l !== "General"))];

    // Filter shifts based on selected location
    const filteredShifts = selectedLocation === "All"
        ? shifts
        : shifts.filter(s => s.location === selectedLocation);

    // Filter employees: Only show employees who have at least one shift in the selected location (or show all if "All")
    // If "All", show all employees.
    // If specific location, show only employees with shifts in that location.
    const filteredEmployees = selectedLocation === "All"
        ? employees
        : employees.filter(emp => filteredShifts.some(s => {
            const shiftEmpId = s.calendarId === 'OPEN' ? 'OPEN' : parseInt(s.calendarId);
            return shiftEmpId === emp.id;
        }));

    // Helper to find shifts for a specific employee and day (using filtered shifts)
    const getShiftsForCell = (employeeId, day) => {
        return filteredShifts.filter(shift => {
            if (!shift.start) return false;
            const shiftStart = typeof shift.start === 'string' ? parseISO(shift.start) : shift.start;
            const shiftEmpId = shift.calendarId === 'OPEN' ? 'OPEN' : parseInt(shift.calendarId);

            if (employeeId === 'OPEN') {
                if (shiftEmpId !== 'OPEN') return false;
            } else {
                if (shiftEmpId !== employeeId) return false;
            }

            return isSameDay(shiftStart, day);
        });
    };

    return (
        <div className="flex flex-col h-full gap-2">
            {/* Location Tabs */}
            {locations.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {locations.map(loc => (
                        <button
                            key={loc}
                            onClick={() => setSelectedLocation(loc)}
                            className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${selectedLocation === loc
                                ? 'bg-blue-600 text-white shadow'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border'
                                }`}
                        >
                            {loc}
                        </button>
                    ))}
                </div>
            )}

            <div className="overflow-x-auto border rounded shadow bg-white h-full flex flex-col">
                <table className="min-w-full divide-y divide-gray-200 h-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 border-r w-48">
                                Employee
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
                            {days.map(day => {
                                const cellShifts = getShiftsForCell('OPEN', day);
                                return (
                                    <td
                                        key={day.toString()}
                                        className="px-2 py-2 border-r align-top hover:bg-red-100 cursor-pointer transition-colors"
                                        onClick={() => onEmptyCellClick(day, 'OPEN')}
                                    >
                                        <div className="flex flex-col gap-1">
                                            {cellShifts.map(shift => (
                                                <div
                                                    key={shift.id}
                                                    onClick={(e) => { e.stopPropagation(); onShiftClick(shift); }}
                                                    className="text-xs p-1 rounded border shadow-sm cursor-pointer bg-white border-red-200 text-red-800 truncate"
                                                    title={`${format(new Date(shift.start), 'h:mm a')} - ${format(new Date(shift.end), 'h:mm a')}${shift.notes ? `\n${shift.notes}` : ''}`}
                                                >
                                                    {format(new Date(shift.start), 'h:mm a')} - {format(new Date(shift.end), 'h:mm a')}
                                                    {shift.notes && (
                                                        <div className="text-[10px] font-mono truncate bg-red-50 px-1 rounded mt-0.5">
                                                            {shift.notes}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>

                        {/* Employee Rows */}
                        {filteredEmployees.map(emp => (
                            <tr key={emp.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white border-r z-10">
                                    {emp.first_name} {emp.last_name}
                                    <div className="text-xs text-gray-500 font-normal">{emp.role?.name}</div>
                                </td>
                                {days.map(day => {
                                    const cellShifts = getShiftsForCell(emp.id, day);
                                    return (
                                        <td
                                            key={day.toString()}
                                            className="px-2 py-2 border-r align-top hover:bg-blue-50 cursor-pointer transition-colors"
                                            onClick={() => onEmptyCellClick(day, emp.id)}
                                        >
                                            <div className="flex flex-col gap-1">
                                                {cellShifts.map(shift => (
                                                    <div
                                                        key={shift.id}
                                                        onClick={(e) => { e.stopPropagation(); onShiftClick(shift); }}
                                                        className="text-xs p-1 rounded text-white shadow-sm cursor-pointer truncate"
                                                        style={{ backgroundColor: shift.backgroundColor || '#3b82f6' }}
                                                        title={`${format(new Date(shift.start), 'h:mm a')} - ${format(new Date(shift.end), 'h:mm a')}\n${shift.title}`}
                                                    >
                                                        {format(new Date(shift.start), 'h:mm a')} - {format(new Date(shift.end), 'h:mm a')}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RosterView;
