import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BASE_URL = 'http://localhost:8000';

const EmployeeModal = ({ isOpen, onClose, employee, onSave }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [defaultRoleId, setDefaultRoleId] = useState('');
    const [selectedRoleIds, setSelectedRoleIds] = useState([]);
    const [isFullTime, setIsFullTime] = useState(false);
    const [willingToWorkVacation, setWillingToWorkVacation] = useState(false);
    const [maxWeeklyHours, setMaxWeeklyHours] = useState(40);
    const [hireDate, setHireDate] = useState('');

    const [roles, setRoles] = useState([]);

    useEffect(() => {
        if (employee) {
            setFirstName(employee.first_name || '');
            setLastName(employee.last_name || '');
            setEmail(employee.email || '');
            setPhone(employee.phone || '');
            setDefaultRoleId(employee.default_role_id || '');
            // Initialize selected roles from employee.roles if available, or default role
            const empRoles = employee.roles ? employee.roles.map(r => r.id) : [];
            if (empRoles.length === 0 && employee.default_role_id) {
                empRoles.push(employee.default_role_id);
            }
            setSelectedRoleIds(empRoles);

            setIsFullTime(employee.is_full_time || false);
            setWillingToWorkVacation(employee.willing_to_work_vacation_week || false);
            setMaxWeeklyHours(employee.max_weekly_hours || 40);
            setHireDate(employee.hire_date ? employee.hire_date.split('T')[0] : '');
        } else {
            // Reset or defaults if creating new (though we are only editing for now)
            setFirstName('');
            setLastName('');
            setEmail('');
            setPhone('');
            setDefaultRoleId('');
            setSelectedRoleIds([]);
            setIsFullTime(false);
            setWillingToWorkVacation(false);
            setMaxWeeklyHours(40);
            setHireDate('');
        }
        fetchRoles();
    }, [employee]);

    const fetchRoles = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/roles/`);
            setRoles(res.data);
        } catch (error) {
            console.error("Error fetching roles:", error);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Ensure default role is in selected roles
        let finalRoleIds = [...selectedRoleIds];
        if (defaultRoleId && !finalRoleIds.includes(parseInt(defaultRoleId))) {
            finalRoleIds.push(parseInt(defaultRoleId));
        }

        const updatedData = {
            ...employee,
            first_name: firstName,
            last_name: lastName,
            email: email,
            phone: phone,
            default_role_id: defaultRoleId ? parseInt(defaultRoleId) : null,
            role_ids: finalRoleIds,
            is_full_time: isFullTime,
            willing_to_work_vacation_week: isFullTime ? false : willingToWorkVacation,
            max_weekly_hours: parseFloat(maxWeeklyHours),
            hire_date: hireDate ? new Date(hireDate).toISOString() : null
        };
        onSave(updatedData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div className="bg-white p-5 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-xl font-bold mb-4">Edit Employee</h2>

                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-bold mb-2">First Name</label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="w-full border p-2 rounded"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2">Last Name</label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="w-full border p-2 rounded"
                                required
                            />
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-bold mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full border p-2 rounded"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-bold mb-2">Phone</label>
                        <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full border p-2 rounded"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-bold mb-2">Roles</label>
                        <div className="border p-2 rounded max-h-32 overflow-y-auto">
                            {roles.map(r => (
                                <div key={r.id} className="flex items-center mb-1">
                                    <input
                                        type="checkbox"
                                        id={`role-${r.id}`}
                                        checked={selectedRoleIds.includes(r.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedRoleIds([...selectedRoleIds, r.id]);
                                            } else {
                                                setSelectedRoleIds(selectedRoleIds.filter(id => id !== r.id));
                                            }
                                        }}
                                        className="mr-2"
                                    />
                                    <label htmlFor={`role-${r.id}`} className="text-sm">{r.name}</label>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Select all applicable roles. The first selected role will be default.</p>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-bold mb-2">Default Role (Primary)</label>
                        <select
                            value={defaultRoleId}
                            onChange={(e) => setDefaultRoleId(e.target.value)}
                            className="w-full border p-2 rounded"
                        >
                            <option value="">Select Primary Role</option>
                            {roles.filter(r => selectedRoleIds.includes(r.id)).map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-bold mb-2">Max Weekly Hours</label>
                        <input
                            type="number"
                            step="0.5"
                            value={maxWeeklyHours}
                            onChange={(e) => setMaxWeeklyHours(e.target.value)}
                            className="w-full border p-2 rounded"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-bold mb-2">Hire Date</label>
                        <input
                            type="date"
                            value={hireDate}
                            onChange={(e) => setHireDate(e.target.value)}
                            className="w-full border p-2 rounded"
                        />
                    </div>

                    <div className="mb-4 border-t pt-4">
                        <div className="flex items-center mb-2">
                            <input
                                type="checkbox"
                                id="isFullTime"
                                className="mr-2"
                                checked={isFullTime}
                                onChange={(e) => setIsFullTime(e.target.checked)}
                            />
                            <label htmlFor="isFullTime" className="text-sm text-gray-700 font-bold">Full Time Employee</label>
                        </div>

                        {!isFullTime && (
                            <div className="flex items-center mb-2 ml-6">
                                <input
                                    type="checkbox"
                                    id="willingVacation"
                                    className="mr-2"
                                    checked={willingToWorkVacation}
                                    onChange={(e) => setWillingToWorkVacation(e.target.checked)}
                                />
                                <label htmlFor="willingVacation" className="text-sm text-gray-700">Willing to work vacation weeks</label>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <button type="button" onClick={onClose} className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400">Cancel</button>
                        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EmployeeModal;
