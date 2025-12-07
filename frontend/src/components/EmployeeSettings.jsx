import React, { useState, useEffect } from 'react';
import axios from 'axios';
import EmployeeModal from './EmployeeModal';

const BASE_URL = 'http://localhost:8000';

const EmployeeSettings = () => {
    const [employees, setEmployees] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [isBulkEditing, setIsBulkEditing] = useState(false);
    const [bulkEdits, setBulkEdits] = useState({}); // { id: { field: value } }
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const [empRes, roleRes] = await Promise.all([
                axios.get(`${BASE_URL}/employees/`),
                axios.get(`${BASE_URL}/roles/`)
            ]);
            setEmployees(empRes.data);
            setRoles(roleRes.data);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleFullTime = async (emp) => {
        try {
            const updatedEmp = {
                ...emp,
                is_full_time: !emp.is_full_time,
                willing_to_work_vacation_week: !emp.is_full_time ? false : emp.willing_to_work_vacation_week
            };
            await axios.put(`${BASE_URL}/employees/${emp.id}`, updatedEmp);
            setEmployees(employees.map(e => e.id === emp.id ? updatedEmp : e));
        } catch (error) {
            console.error("Error updating employee status:", error);
            alert("Failed to update employee status.");
        }
    };

    const handleToggleWillingness = async (emp) => {
        try {
            const updatedEmp = { ...emp, willing_to_work_vacation_week: !emp.willing_to_work_vacation_week };
            await axios.put(`${BASE_URL}/employees/${emp.id}`, updatedEmp);
            setEmployees(employees.map(e => e.id === emp.id ? updatedEmp : e));
        } catch (error) {
            console.error("Error updating employee:", error);
            alert("Failed to update employee settings.");
        }
    };

    const handleEditClick = (emp) => {
        setSelectedEmployee(emp);
        setIsModalOpen(true);
    };

    const handleSaveEmployee = async (updatedData) => {
        try {
            if (updatedData.id) {
                const res = await axios.put(`${BASE_URL}/employees/${updatedData.id}`, updatedData);
                setEmployees(employees.map(e => e.id === updatedData.id ? res.data : e));
            } else {
                const res = await axios.post(`${BASE_URL}/employees/`, updatedData);
                setEmployees([...employees, res.data]);
            }
            setIsModalOpen(false);
            setSelectedEmployee(null);
        } catch (error) {
            console.error("Error saving employee:", error);
            alert("Failed to save employee changes.");
        }
    };

    // Bulk Edit Handlers
    const handleBulkChange = (id, field, value) => {
        setBulkEdits(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                [field]: value
            }
        }));
    };

    const saveBulkEdits = async () => {
        try {
            const promises = Object.keys(bulkEdits).map(async (id) => {
                const updates = bulkEdits[id];
                // Merge with existing employee data to ensure completeness if needed, 
                // but PUT usually expects full object or PATCH for partial. 
                // Our backend PUT uses model_dump(exclude_unset=True) so partial is fine if we send only changed fields?
                // Actually backend expects EmployeeUpdate which has Optional fields.
                // So we can just send the updates.
                await axios.put(`${BASE_URL}/employees/${id}`, updates);
            });

            await Promise.all(promises);

            // Refresh data
            await fetchEmployees();
            setIsBulkEditing(false);
            setBulkEdits({});
            alert("Bulk updates saved successfully!");
        } catch (error) {
            console.error("Error saving bulk edits:", error);
            alert("Failed to save some updates.");
        }
    };

    const cancelBulkEdit = () => {
        setIsBulkEditing(false);
        setBulkEdits({});
    };

    if (loading) return <div className="p-4">Loading...</div>;

    return (
        <div className="p-4 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold">Employee Settings</h1>
                <div className="flex items-center gap-2 flex-1 justify-end">
                    <input
                        type="text"
                        placeholder="Search employees..."
                        className="border rounded px-3 py-2 text-sm w-64"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    {isBulkEditing ? (
                        <>
                            <button onClick={cancelBulkEdit} className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400">Cancel</button>
                            <button onClick={saveBulkEdits} className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">Save All</button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => { setSelectedEmployee(null); setIsModalOpen(true); }}
                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                            >
                                <span>+ New Hire</span>
                            </button>
                            <button onClick={() => setIsBulkEditing(true)} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Bulk Edit</button>
                        </>
                    )}
                </div>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden overflow-x-auto">
                {(() => {
                    // Filter employees first
                    const filteredList = employees.filter(emp =>
                        !searchTerm ||
                        `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
                    );

                    // Group by Role
                    const roledGroups = {};
                    filteredList.forEach(emp => {
                        const rId = emp.default_role_id;
                        if (!roledGroups[rId]) roledGroups[rId] = [];
                        roledGroups[rId].push(emp);
                    });

                    // Convert to Sections
                    let sections = Object.keys(roledGroups).map(rId => {
                        const role = roles.find(r => r.id === parseInt(rId));
                        return {
                            title: role ? role.name : "Other / Unknown",
                            roleId: parseInt(rId),
                            data: roledGroups[rId]
                        };
                    });

                    // Sort Sections (Priority: Supervisor, Office, Maintenance, others)
                    const priority = ["Supervisor", "Office", "Maintenance", "Cashier", "Lot"];
                    sections.sort((a, b) => {
                        const idxA = priority.findIndex(p => a.title.includes(p));
                        const idxB = priority.findIndex(p => b.title.includes(p));

                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                        if (idxA !== -1) return -1;
                        if (idxB !== -1) return 1;
                        return a.title.localeCompare(b.title);
                    });

                    return sections.map((section, idx) => (
                        <div key={idx} className="mb-8">
                            <h2 className="px-6 py-3 bg-gray-100 text-lg font-bold border-b border-gray-200">{section.title}</h2>
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                                        {isBulkEditing && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max Hours</th>}
                                        {isBulkEditing && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hire Date</th>}
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vacation Availability</th>
                                        {!isBulkEditing && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {section.data.map(emp => {
                                        const edits = bulkEdits[emp.id] || {};
                                        const displayFirstName = edits.first_name !== undefined ? edits.first_name : emp.first_name;
                                        const displayLastName = edits.last_name !== undefined ? edits.last_name : emp.last_name;
                                        const displayEmail = edits.email !== undefined ? edits.email : emp.email;
                                        const displayPhone = edits.phone !== undefined ? edits.phone : emp.phone;
                                        const displayMaxHours = edits.max_weekly_hours !== undefined ? edits.max_weekly_hours : emp.max_weekly_hours;
                                        const displayHireDate = edits.hire_date !== undefined ? edits.hire_date : (emp.hire_date ? emp.hire_date.split('T')[0] : '');

                                        return (
                                            <tr key={emp.id}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {isBulkEditing ? (
                                                        <div className="flex flex-col gap-1">
                                                            <input
                                                                className="border rounded px-1 text-sm"
                                                                value={displayFirstName}
                                                                onChange={e => handleBulkChange(emp.id, 'first_name', e.target.value)}
                                                                placeholder="First Name"
                                                            />
                                                            <input
                                                                className="border rounded px-1 text-sm"
                                                                value={displayLastName}
                                                                onChange={e => handleBulkChange(emp.id, 'last_name', e.target.value)}
                                                                placeholder="Last Name"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm font-medium text-gray-900">{emp.first_name} {emp.last_name}</div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {isBulkEditing ? (
                                                        <div className="flex flex-col gap-1">
                                                            <input
                                                                className="border rounded px-1 text-sm"
                                                                value={displayEmail || ''}
                                                                onChange={e => handleBulkChange(emp.id, 'email', e.target.value)}
                                                                placeholder="Email"
                                                            />
                                                            <input
                                                                className="border rounded px-1 text-sm"
                                                                value={displayPhone || ''}
                                                                onChange={e => handleBulkChange(emp.id, 'phone', e.target.value)}
                                                                placeholder="Phone"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm text-gray-500">{emp.email}</div>
                                                    )}
                                                </td>

                                                {isBulkEditing && (
                                                    <>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <input
                                                                type="number" step="0.5"
                                                                className="border rounded px-1 text-sm w-20"
                                                                value={displayMaxHours}
                                                                onChange={e => handleBulkChange(emp.id, 'max_weekly_hours', parseFloat(e.target.value))}
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <input
                                                                type="date"
                                                                className="border rounded px-1 text-sm"
                                                                value={displayHireDate}
                                                                onChange={e => handleBulkChange(emp.id, 'hire_date', e.target.value ? new Date(e.target.value).toISOString() : null)}
                                                            />
                                                        </td>
                                                    </>
                                                )}

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <button
                                                        onClick={() => handleToggleFullTime(emp)}
                                                        disabled={isBulkEditing}
                                                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer hover:opacity-80 ${emp.is_full_time ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'} ${isBulkEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        {emp.is_full_time ? 'Full-Time' : 'Part-Time'}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {emp.is_full_time ? (
                                                        <span className="text-gray-400 italic">Unavailable during vacation weeks</span>
                                                    ) : (
                                                        <label className="flex items-center cursor-pointer">
                                                            <div className="relative">
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only"
                                                                    checked={emp.willing_to_work_vacation_week}
                                                                    onChange={() => handleToggleWillingness(emp)}
                                                                    disabled={isBulkEditing}
                                                                />
                                                                <div className={`block w-10 h-6 rounded-full ${emp.willing_to_work_vacation_week ? 'bg-blue-600' : 'bg-gray-300'} ${isBulkEditing ? 'opacity-50' : ''}`}></div>
                                                                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition ${emp.willing_to_work_vacation_week ? 'transform translate-x-4' : ''}`}></div>
                                                            </div>
                                                            <div className="ml-3 text-gray-700">
                                                                {emp.willing_to_work_vacation_week ? 'Willing to work Vacation' : 'No Vacation'}
                                                            </div>
                                                        </label>
                                                    )}
                                                </td>
                                                {!isBulkEditing && (
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <button
                                                            onClick={() => handleEditClick(emp)}
                                                            className="text-indigo-600 hover:text-indigo-900"
                                                        >
                                                            Edit
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ));
                })()}
            </div>

            <EmployeeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                employee={selectedEmployee}
                onSave={handleSaveEmployee}
            />
        </div >
    );
};

export default EmployeeSettings;
