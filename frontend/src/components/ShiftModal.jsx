import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import ShiftCallSheet from './ShiftCallSheet';

const BASE_URL = 'http://localhost:8000';

const ShiftModal = ({ isOpen, onClose, initialData, onSave, onDelete }) => {
    const [employeeId, setEmployeeId] = useState('');
    const [roleId, setRoleId] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [notes, setNotes] = useState('');
    const [location, setLocation] = useState('');
    const [boothNumber, setBoothNumber] = useState('');
    const [isVacation, setIsVacation] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [createOpenShift, setCreateOpenShift] = useState(false);
    const [repeat, setRepeat] = useState('');
    const [forceSave, setForceSave] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [roles, setRoles] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [loadingRecs, setLoadingRecs] = useState(false);
    const [showCallSheet, setShowCallSheet] = useState(false);
    const [saveError, setSaveError] = useState(null);

    const isNewShift = !initialData?.id;

    useEffect(() => {
        console.log("ShiftModal initialData:", initialData);
        if (initialData) {
            setEmployeeId(initialData.employee_id || '');
            setRoleId(initialData.role_id || '');
            setStartTime(initialData.start ? format(new Date(initialData.start), "yyyy-MM-dd'T'HH:mm") : '');
            setEndTime(initialData.end ? format(new Date(initialData.end), "yyyy-MM-dd'T'HH:mm") : '');
            setNotes(initialData.title || '');
            setLocation(initialData.location || '');
            setBoothNumber(initialData.booth_number || '');
            setIsVacation(initialData.is_vacation || false);
            setIsLocked(initialData.is_locked || false);
            setCreateOpenShift(false);
            setRepeat('');
            setForceSave(false);
            setSaveError(null);
        } else {
            setEmployeeId('');
            setRoleId('');
            setStartTime('');
            setEndTime('');
            setNotes('');
            setLocation('');
            setBoothNumber('');
            setIsVacation(false);
            setIsLocked(false);
            setCreateOpenShift(false);
            setRepeat('');
            setForceSave(false);
            setSaveError(null);
        }
        fetchDropdowns();
    }, [initialData]);

    const fetchDropdowns = async () => {
        try {
            const [empRes, roleRes] = await Promise.all([
                axios.get(`${BASE_URL}/employees/`),
                axios.get(`${BASE_URL}/roles/`)
            ]);
            setEmployees(empRes.data);
            setRoles(roleRes.data);
        } catch (error) {
            console.error("Error fetching dropdowns:", error);
        }
    };

    // Auto-set role when employee changes - only if role not already set
    useEffect(() => {
        if (employeeId && employees.length > 0 && !roleId) {
            const selectedEmployee = employees.find(emp => emp.id === parseInt(employeeId));
            if (selectedEmployee && selectedEmployee.default_role_id) {
                setRoleId(selectedEmployee.default_role_id);
            }
        }
    }, [employeeId, employees]);

    const fetchRecommendations = async () => {
        if (!startTime || !endTime) return;
        setLoadingRecs(true);
        try {
            const response = await axios.get(`${BASE_URL}/recommendations/`, {
                params: {
                    start_time: new Date(startTime).toISOString(),
                    end_time: new Date(endTime).toISOString(),
                    role_id: roleId || undefined
                }
            });
            setRecommendations(response.data);
        } catch (error) {
            console.error("Error fetching recommendations:", error);
        } finally {
            setLoadingRecs(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Validate required fields
        if (!roleId) {
            alert('Please select a role');
            return;
        }

        // Validate end time is after start time
        if (startTime && endTime && new Date(endTime) <= new Date(startTime)) {
            alert('End time must be after start time');
            return;
        }

        // Convert datetime-local to ISO without timezone shift
        // datetime-local format: "2025-12-10T09:00"
        // We want to keep this exact time, not convert to UTC
        const startISO = startTime ? startTime + ':00' : null;
        const endISO = endTime ? endTime + ':00' : null;

        const shiftData = {
            employee_id: employeeId ? parseInt(employeeId) : null,
            role_id: parseInt(roleId),
            start_time: startISO,
            end_time: endISO,
            notes: notes,
            location: location || null,
            booth_number: location === 'Plaza' ? boothNumber : null,
            is_vacation: isVacation,
            is_locked: isLocked,
            create_open_shift: createOpenShift,
            repeat: repeat || null,
            force_save: forceSave,
            id: initialData?.id // Include ID for editing existing shifts
        };
        console.log('ShiftModal submitting:', shiftData);
        setSaveError(null);
        onSave(shiftData);
    };

    if (!isOpen) return null;

    if (showCallSheet && initialData?.id) {
        return <ShiftCallSheet shiftId={initialData.id} shift={initialData} onClose={() => setShowCallSheet(false)} />;
    }

    const handleCopy = () => {
        // Parse the datetime-local string directly to avoid timezone issues
        // Format is "2025-12-10T09:00"
        const [startDateStr, startTimeStr] = startTime.split('T');
        const [endDateStr, endTimeStr] = endTime.split('T');

        const [startHours, startMinutes] = startTimeStr.split(':').map(Number);
        const [endHours, endMinutes] = endTimeStr.split(':').map(Number);

        const shiftData = {
            employee_id: employeeId,
            role_id: roleId,
            start_hours: startHours,
            start_minutes: startMinutes,
            end_hours: endHours,
            end_minutes: endMinutes,
            notes: notes,
            location: location,
            booth_number: boothNumber,
            is_vacation: isVacation
        };
        console.log('Copying shift data:', shiftData);
        localStorage.setItem('copiedShift', JSON.stringify(shiftData));
        alert("Shift copied to clipboard!");
    };

    const handlePaste = () => {
        const copiedData = localStorage.getItem('copiedShift');
        console.log('Raw copied data:', copiedData);
        if (copiedData) {
            const data = JSON.parse(copiedData);
            console.log('Parsed shift data:', data);
            console.log('Setting role_id to:', data.role_id);
            setEmployeeId(data.employee_id ? parseInt(data.employee_id) : '');
            setRoleId(data.role_id ? parseInt(data.role_id) : '');

            // Use stored hours/minutes with the target date from clicked cell
            if (data.start_hours !== undefined && initialData?.start) {
                const targetDate = new Date(initialData.start);

                // Create new date/times: use target date but copied times
                const newStart = new Date(targetDate);
                newStart.setHours(data.start_hours, data.start_minutes, 0, 0);

                const newEnd = new Date(targetDate);
                newEnd.setHours(data.end_hours, data.end_minutes, 0, 0);

                // Handle overnight shifts (end time before start time)
                if (data.end_hours < data.start_hours || (data.end_hours === data.start_hours && data.end_minutes < data.start_minutes)) {
                    newEnd.setDate(newEnd.getDate() + 1);
                }

                console.log('Setting times - Start:', format(newStart, "yyyy-MM-dd'T'HH:mm"), 'End:', format(newEnd, "yyyy-MM-dd'T'HH:mm"));
                setStartTime(format(newStart, "yyyy-MM-dd'T'HH:mm"));
                setEndTime(format(newEnd, "yyyy-MM-dd'T'HH:mm"));
            }

            setNotes(data.notes || '');
            setLocation(data.location || '');
            setBoothNumber(data.booth_number || '');
            setIsVacation(data.is_vacation || false);
            alert("Shift pasted with original time!");
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div className="bg-white p-5 rounded-lg shadow-xl w-full max-w-2xl">
                <h2 className="text-xl font-bold mb-4">{initialData?.id ? 'Edit Shift' : 'Create Shift'}</h2>

                <div className="flex gap-6">
                    {/* Form */}
                    <form onSubmit={handleSubmit} className="flex-1">
                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2">Employee</label>
                            <select
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                disabled={createOpenShift}
                            >
                                <option value="">Select Employee</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2">Role</label>
                            <select
                                value={roleId}
                                onChange={(e) => setRoleId(e.target.value)}
                                className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                required
                            >
                                <option value="">Select Role</option>
                                {roles.map(role => (
                                    <option key={role.id} value={role.id}>{role.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-4 mb-4">
                            <div className="w-1/2">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Start Time</label>
                                <input
                                    type="datetime-local"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    required
                                />
                            </div>
                            <div className="w-1/2">
                                <label className="block text-gray-700 text-sm font-bold mb-2">End Time</label>
                                <input
                                    type="datetime-local"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    required
                                />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2">Location</label>
                            <select
                                value={location}
                                onChange={(e) => {
                                    setLocation(e.target.value);
                                    if (e.target.value !== 'Plaza') setBoothNumber('');
                                }}
                                className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            >
                                <option value="">Select Location</option>
                                <option value="OFFICE">Office</option>
                                <option value="SUPERVISORS">Supervisors</option>
                                <option value="MAINTENANCE">Maintenance</option>
                                <option value="PLAZA">Plaza</option>
                                <option value="CONRAC">Conrac</option>
                                <option value="CUSTOMER LOTS">Customer Lots</option>
                                <option value="LOT 1">Lot 1</option>
                                <option value="LOT 2">Lot 2</option>
                                <option value="LOT 3">Lot 3</option>
                                <option value="LOT 4">Lot 4</option>
                            </select>
                            {location === 'Plaza' && (
                                <div className="mt-2">
                                    <label className="block text-gray-700 text-sm font-bold mb-1">Booth Number</label>
                                    <select
                                        value={boothNumber}
                                        onChange={(e) => setBoothNumber(e.target.value)}
                                        className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    >
                                        <option value="">Select Booth</option>
                                        <option value="5">Booth 5</option>
                                        <option value="6">Booth 6</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2">Notes</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                rows="3"
                            />
                        </div>

                        <div className="flex items-center gap-4 mb-4">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={isVacation}
                                    onChange={(e) => setIsVacation(e.target.checked)}
                                    className="mr-2 leading-tight"
                                />
                                <label className="text-sm text-gray-700 font-bold">Vacation/Time Off</label>
                            </div>
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={createOpenShift}
                                    onChange={(e) => {
                                        setCreateOpenShift(e.target.checked);
                                        if (e.target.checked) setEmployeeId('');
                                    }}
                                    className="mr-2 leading-tight"
                                />
                                <label className="text-sm text-gray-700 font-bold">Open Shift</label>
                            </div>
                        </div>



                        <div className="mb-4 flex items-center gap-6">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={forceSave}
                                    onChange={(e) => setForceSave(e.target.checked)}
                                    className="mr-2 leading-tight"
                                />
                                <label className="text-sm text-orange-600 font-bold">Force Save</label>
                            </div>
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={isLocked}
                                    onChange={(e) => setIsLocked(e.target.checked)}
                                    className="mr-2 leading-tight"
                                />
                                <label className="text-sm text-blue-600 font-bold">🔒 Lock Shift</label>
                            </div>
                        </div>

                        <div className="flex justify-between items-center mt-6 pt-4 border-t">
                            <div className="flex gap-2">
                                {initialData?.id && (
                                    <button
                                        type="button"
                                        onClick={handleCopy}
                                        className="bg-gray-100 text-gray-700 px-3 py-2 rounded hover:bg-gray-200 text-sm border"
                                    >
                                        Copy
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handlePaste}
                                    className="bg-gray-100 text-gray-700 px-3 py-2 rounded hover:bg-gray-200 text-sm border"
                                    title="Pastes role, employee, notes, location (not time)"
                                >
                                    Paste
                                </button>
                            </div>

                            <div className="flex gap-2">
                                {initialData?.id && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (window.confirm("Are you sure you want to delete this shift?")) {
                                                    onDelete();
                                                }
                                            }}
                                            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                                        >
                                            Delete
                                        </button>
                                        {!isNewShift && initialData?.id && [3, 4, 7, 8].includes(parseInt(roleId)) && (
                                            <button
                                                type="button"
                                                onClick={() => setShowCallSheet(true)}
                                                className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
                                            >
                                                Call Sheet
                                            </button>
                                        )}
                                    </>
                                )}
                                <button type="button" onClick={onClose} className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400">Cancel</button>
                                <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Save</button>
                            </div>
                        </div>
                    </form>

                    {/* Recommendations Panel */}
                    <div className="w-1/3 border-l pl-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-sm">Smart Recommendations</h3>
                            <button
                                type="button"
                                onClick={fetchRecommendations}
                                className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200"
                            >
                                Refresh
                            </button>
                        </div>

                        {loadingRecs ? (
                            <p className="text-sm text-gray-500">Loading...</p>
                        ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {recommendations.length > 0 ? recommendations.map((rec, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-2 rounded border text-sm cursor-pointer hover:bg-blue-50 ${rec.score < 50 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}
                                        onClick={() => setEmployeeId(rec.employee.id)}
                                    >
                                        <div className="font-semibold flex justify-between">
                                            <span>{rec.employee.first_name} {rec.employee.last_name}</span>
                                            <span className={rec.score >= 80 ? 'text-green-600' : 'text-red-600'}>{rec.score}%</span>
                                        </div>
                                        <ul className="text-xs text-gray-600 list-disc list-inside mt-1">
                                            {rec.reasons.map((r, i) => <li key={i}>{r}</li>)}
                                        </ul>
                                    </div>
                                )) : (
                                    <p className="text-xs text-gray-400 italic">Click Refresh to see recommendations based on time.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div >
        </div >
    );
};

export default ShiftModal;
