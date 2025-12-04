import React, { useState } from 'react';
import axios from 'axios';

const BASE_URL = 'http://localhost:8000';

const OCRReviewModal = ({ isOpen, onClose, parsedShifts, unmatchedLines, onConfirm }) => {
    const [shifts, setShifts] = useState(parsedShifts);
    const [unmatched, setUnmatched] = useState(unmatchedLines || []);
    const [employees, setEmployees] = useState([]);
    const [roles, setRoles] = useState([]);

    // Track role selection and checkbox state for each unmatched employee
    const [employeeSelections, setEmployeeSelections] = useState({});

    React.useEffect(() => {
        setShifts(parsedShifts);
        setUnmatched(unmatchedLines || []);
        fetchEmployees();
        fetchRoles();

        // Initialize selections for unmatched employees
        const initialSelections = {};
        (unmatchedLines || []).forEach((emp, idx) => {
            initialSelections[idx] = { roleId: '', checked: false };
        });
        setEmployeeSelections(initialSelections);
    }, [parsedShifts, unmatchedLines]);

    const fetchEmployees = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/employees/`);
            setEmployees(res.data);
        } catch (error) {
            console.error("Error fetching employees:", error);
        }
    };

    const fetchRoles = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/roles/`);
            setRoles(res.data);
        } catch (error) {
            console.error("Error fetching roles:", error);
        }
    };

    const handleRoleChange = (idx, roleId) => {
        setEmployeeSelections(prev => ({
            ...prev,
            [idx]: { ...prev[idx], roleId }
        }));
    };

    const handleCheckChange = (idx, checked) => {
        setEmployeeSelections(prev => ({
            ...prev,
            [idx]: { ...prev[idx], checked }
        }));
    };

    const handleBulkApprove = async () => {
        const selectedEmployees = Object.entries(employeeSelections)
            .filter(([idx, selection]) => selection.checked && selection.roleId)
            .map(([idx]) => ({ emp: unmatched[idx], selection: employeeSelections[idx] }));

        if (selectedEmployees.length === 0) {
            alert("Please select at least one employee with a role assigned.");
            return;
        }

        const newShifts = [];
        const createdEmployeeIds = [];

        for (const { emp, selection } of selectedEmployees) {
            try {
                // Extract name from employee object
                const empName = emp.name || "Unknown";
                const empShifts = emp.shifts || [];

                // Auto-extract first/last name
                const nameParts = empName.split(' ').filter(p => p.length > 0);
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(' ') || '.';

                // Create Employee
                const res = await axios.post(`${BASE_URL}/employees/`, {
                    first_name: firstName,
                    last_name: lastName,
                    default_role_id: parseInt(selection.roleId),
                    is_full_time: false
                });

                const createdEmp = res.data;
                createdEmployeeIds.push(createdEmp.id);

                // Create shifts for this employee
                empShifts.forEach(shift => {
                    newShifts.push({
                        employee_id: createdEmp.id,
                        employee_name: `${createdEmp.first_name} ${createdEmp.last_name}`,
                        role_id: createdEmp.default_role_id,
                        start_time: shift.start_time,
                        end_time: shift.end_time,
                        location: shift.location || "General",
                        notes: shift.notes || "OCR Import",
                        is_vacation: false
                    });
                });

            } catch (error) {
                console.error(`Error creating employee:`, error);
                alert(`Failed to create employee. Check console.`);
                return;
            }
        }

        // Add new shifts to existing shifts
        setShifts([...shifts, ...newShifts]);

        // Remove approved employees from unmatched list
        const remainingUnmatched = unmatched.filter((_, idx) => !employeeSelections[idx]?.checked);
        setUnmatched(remainingUnmatched);

        // Re-initialize selections for remaining employees
        const newSelections = {};
        remainingUnmatched.forEach((emp, idx) => {
            newSelections[idx] = { roleId: '', checked: false };
        });
        setEmployeeSelections(newSelections);

        // Refresh employee list
        await fetchEmployees();

        alert(`Successfully created ${selectedEmployees.length} employee(s) and ${newShifts.length} shift(s)!`);
    };

    const handleConfirm = () => {
        onConfirm(shifts);
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
            onClick={onClose}
        >
            <div
                className="bg-white p-5 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold mb-4">Review OCR Data</h2>

                {/* Unmatched Employees Section */}
                {unmatched.length > 0 && (
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
                        <h3 className="font-bold text-yellow-800 mb-3">New Employees Found ({unmatched.length})</h3>
                        <p className="text-sm text-yellow-700 mb-3">Select roles and check employees to approve, then click "Create Selected Employees" below.</p>

                        {/* Bulk Actions */}
                        <div className="mb-3 p-3 bg-white border rounded flex items-center gap-3">
                            <span className="text-sm font-medium">Bulk Actions:</span>
                            <select
                                className="border rounded px-2 py-1"
                                id="bulkRoleSelect"
                            >
                                <option value="">Select a role...</option>
                                {roles.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => {
                                    const bulkRoleId = document.getElementById('bulkRoleSelect').value;
                                    if (!bulkRoleId) {
                                        alert('Please select a role first');
                                        return;
                                    }
                                    const newSelections = { ...employeeSelections };
                                    Object.keys(newSelections).forEach(idx => {
                                        if (newSelections[idx].checked) {
                                            newSelections[idx].roleId = bulkRoleId;
                                        }
                                    });
                                    setEmployeeSelections(newSelections);
                                }}
                                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
                            >
                                Apply to Checked
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full border">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-3 py-2 border text-left text-xs font-semibold">
                                            <input
                                                type="checkbox"
                                                onChange={(e) => {
                                                    const newSelections = {};
                                                    unmatched.forEach((emp, idx) => {
                                                        newSelections[idx] = {
                                                            ...employeeSelections[idx],
                                                            checked: e.target.checked
                                                        };
                                                    });
                                                    setEmployeeSelections(newSelections);
                                                }}
                                            />
                                        </th>
                                        <th className="px-3 py-2 border text-left text-xs font-semibold">Employee Name</th>
                                        <th className="px-3 py-2 border text-left text-xs font-semibold">Shifts Detected</th>
                                        <th className="px-3 py-2 border text-left text-xs font-semibold">Assign Role</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {unmatched.map((unmatchedEmp, idx) => {
                                        const empName = unmatchedEmp.name || "Unknown";
                                        const shifts = unmatchedEmp.shifts || [];

                                        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                        const shiftSummary = shifts.map(s => {
                                            const start = new Date(s.start_time);
                                            const end = new Date(s.end_time);
                                            const day = dayNames[start.getDay()];
                                            const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                                            const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                                            return `${day} ${startTime}-${endTime}`;
                                        }).join(', ');

                                        return (
                                            <tr key={idx} className={`${employeeSelections[idx]?.checked ? 'bg-blue-50' : 'bg-white'} hover:bg-gray-50`}>
                                                <td className="px-3 py-2 border">
                                                    <input
                                                        type="checkbox"
                                                        checked={employeeSelections[idx]?.checked || false}
                                                        onChange={(e) => handleCheckChange(idx, e.target.checked)}
                                                    />
                                                </td>
                                                <td className="px-3 py-2 border font-semibold">{empName}</td>
                                                <td className="px-3 py-2 border text-xs font-mono">{shiftSummary || 'No shifts'}</td>
                                                <td className="px-3 py-2 border">
                                                    <select
                                                        className="border rounded px-2 py-1 w-full"
                                                        value={employeeSelections[idx]?.roleId || ''}
                                                        onChange={(e) => handleRoleChange(idx, e.target.value)}
                                                    >
                                                        <option value="">Select Role...</option>
                                                        {roles.map(r => (
                                                            <option key={r.id} value={r.id}>{r.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-3 flex justify-end">
                            <button
                                onClick={handleBulkApprove}
                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold"
                            >
                                Create Selected Employees ({Object.values(employeeSelections).filter(s => s.checked).length})
                            </button>
                        </div>
                    </div>
                )}

                <p className="mb-4 text-sm text-gray-600">Review shifts to be imported:</p>

                <div className="flex-1 overflow-y-auto mb-4 border rounded">
                    <table className="min-w-full">
                        <thead className="bg-gray-100 sticky top-0">
                            <tr>
                                <th className="px-3 py-2 border text-left text-xs font-semibold">Employee</th>
                                <th className="px-3 py-2 border text-left text-xs font-semibold">Shifts</th>
                                <th className="px-3 py-2 border text-left text-xs font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                const groupedShifts = {};
                                shifts.forEach((shift, idx) => {
                                    const empName = shift.employee_name || 'Unknown';
                                    if (!groupedShifts[empName]) {
                                        groupedShifts[empName] = [];
                                    }
                                    groupedShifts[empName].push({ ...shift, originalIndex: idx });
                                });

                                return Object.entries(groupedShifts).map(([empName, empShifts]) => {
                                    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                    const shiftSummary = empShifts.map(s => {
                                        const start = new Date(s.start_time);
                                        const end = new Date(s.end_time);
                                        const day = dayNames[start.getDay()];
                                        const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                                        const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                                        return `${day} ${startTime}-${endTime}`;
                                    }).join(', ');

                                    return (
                                        <tr key={empName}>
                                            <td className="px-3 py-2 border text-sm font-medium">{empName}</td>
                                            <td className="px-3 py-2 border text-xs font-mono">{shiftSummary}</td>
                                            <td className="px-3 py-2 border text-sm">
                                                <button
                                                    onClick={() => {
                                                        const indicesToRemove = empShifts.map(s => s.originalIndex).sort((a, b) => b - a);
                                                        let newShifts = [...shifts];
                                                        indicesToRemove.forEach(idx => newShifts.splice(idx, 1));
                                                        setShifts(newShifts);
                                                    }}
                                                    className="text-red-600 hover:text-red-900 text-sm"
                                                >
                                                    Remove
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                });
                            })()}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-semibold"
                    >
                        Import All Shifts ({shifts.length})
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OCRReviewModal;
