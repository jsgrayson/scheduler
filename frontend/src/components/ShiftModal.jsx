import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';

const BASE_URL = 'http://localhost:8000';

const ShiftModal = ({ isOpen, onClose, initialData, onSave, onDelete }) => {
    const [employeeId, setEmployeeId] = useState('');
    const [roleId, setRoleId] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [notes, setNotes] = useState('');
    const [location, setLocation] = useState('');
    const [isVacation, setIsVacation] = useState(false);
    const [createOpenShift, setCreateOpenShift] = useState(false);
    const [repeat, setRepeat] = useState('');
    const [employees, setEmployees] = useState([]);
    const [roles, setRoles] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [loadingRecs, setLoadingRecs] = useState(false);

    useEffect(() => {
        if (initialData) {
            setEmployeeId(initialData.employee_id || '');
            setRoleId(initialData.role_id || '');
            setStartTime(initialData.start ? format(new Date(initialData.start), "yyyy-MM-dd'T'HH:mm") : '');
            setEndTime(initialData.end ? format(new Date(initialData.end), "yyyy-MM-dd'T'HH:mm") : '');
            setNotes(initialData.title || '');
            setLocation(initialData.location || '');
            setIsVacation(initialData.is_vacation || false);
            setCreateOpenShift(false);
            setRepeat('');
        } else {
            setEmployeeId('');
            setRoleId('');
            setStartTime('');
            setEndTime('');
            setNotes('');
            setLocation('');
            setIsVacation(false);
            setCreateOpenShift(false);
            setRepeat('');
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
        const shiftData = {
            employee_id: employeeId ? parseInt(employeeId) : null,
            role_id: parseInt(roleId),
            start_time: new Date(startTime).toISOString(),
            end_time: new Date(endTime).toISOString(),
            notes: notes,
            location: location,
            is_vacation: isVacation,
            create_open_shift: createOpenShift,
            repeat: repeat || null,
            id: initialData?.id // Include ID for editing existing shifts
        };
        onSave(shiftData);
    };

    if (!isOpen) return null;

    const handleCopy = () => {
        const shiftData = {
            employee_id: employeeId,
            role_id: roleId,
            start_time: startTime,
            end_time: endTime,
            notes: notes,
            location: location,
            is_vacation: isVacation
        };
        localStorage.setItem('copiedShift', JSON.stringify(shiftData));
        alert("Shift copied to clipboard!");
    };

    const handlePaste = () => {
        const copiedData = localStorage.getItem('copiedShift');
        if (copiedData) {
            const data = JSON.parse(copiedData);
            setEmployeeId(data.employee_id || '');
            setRoleId(data.role_id || '');
            // Don't paste times, user should set them for new shift
            // setStartTime(data.start_time || '');
            // setEndTime(data.end_time || '');
            setNotes(data.notes || '');
            setLocation(data.location || '');
            setIsVacation(data.is_vacation || false);
            alert("Shift pasted! Please set the date and time.");
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div className="bg-white p-5 rounded-lg shadow-xl w-full max-w-2xl">
                <h2 className="text-xl font-bold mb-4">{initialData?.id ? 'Edit Shift' : 'Create Shift'}</h2>

                <div className="flex gap-6">
                    {/* Form */}
                    <form onSubmit={handleSubmit} className="flex-1">
                        {/* ... (existing form fields) ... */}

                        {/* ... (skipping unchanged parts) ... */}

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
            </div>
        </div>
    );
};

export default ShiftModal;
