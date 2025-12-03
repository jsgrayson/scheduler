import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BASE_URL = 'http://localhost:8000';

const EmployeeSettings = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/employees/`);
            setEmployees(res.data);
        } catch (error) {
            console.error("Error fetching employees:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleFullTime = async (emp) => {
        try {
            const updatedEmp = { ...emp, is_full_time: !emp.is_full_time };
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
            // We need a PUT endpoint for employees. 
            // Assuming generic update or specific endpoint.
            // Wait, I don't have a PUT /employees/{id} endpoint yet!
            // I need to create one.
            // For now, I'll write the frontend code assuming it exists, then go fix backend.
            await axios.put(`${BASE_URL}/employees/${emp.id}`, updatedEmp);

            setEmployees(employees.map(e => e.id === emp.id ? updatedEmp : e));
        } catch (error) {
            console.error("Error updating employee:", error);
            alert("Failed to update employee settings.");
        }
    };

    if (loading) return <div className="p-4">Loading...</div>;

    return (
        <div className="p-4 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Employee Settings</h1>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vacation Availability</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {employees.map(emp => (
                            <tr key={emp.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{emp.first_name} {emp.last_name}</div>
                                    <div className="text-sm text-gray-500">{emp.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <button
                                        onClick={() => handleToggleFullTime(emp)}
                                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer hover:opacity-80 ${emp.is_full_time ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}
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
                                                />
                                                <div className={`block w-10 h-6 rounded-full ${emp.willing_to_work_vacation_week ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                                                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition ${emp.willing_to_work_vacation_week ? 'transform translate-x-4' : ''}`}></div>
                                            </div>
                                            <div className="ml-3 text-gray-700">
                                                {emp.willing_to_work_vacation_week ? 'Willing to work' : 'Do not call'}
                                            </div>
                                        </label>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default EmployeeSettings;
