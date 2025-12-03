import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';

const BASE_URL = 'http://localhost:8000';

const AgendaView = () => {
    const [employees, setEmployees] = useState([]);
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
    const [agendas, setAgendas] = useState({}); // { empId: [shifts] }
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/employees/`);
            setEmployees(res.data);
        } catch (error) {
            console.error("Error fetching employees:", error);
        }
    };

    const handleSelectEmployee = (id) => {
        setSelectedEmployeeIds(prev => {
            if (prev.includes(id)) return prev.filter(e => e !== id);
            return [...prev, id];
        });
    };

    const handleSelectAll = () => {
        if (selectedEmployeeIds.length === employees.length) {
            setSelectedEmployeeIds([]);
        } else {
            setSelectedEmployeeIds(employees.map(e => e.id));
        }
    };

    const fetchAgendas = async () => {
        setLoading(true);
        const newAgendas = {};
        try {
            await Promise.all(selectedEmployeeIds.map(async (id) => {
                const res = await axios.get(`${BASE_URL}/shifts/agenda/${id}`);
                newAgendas[id] = res.data;
            }));
            setAgendas(newAgendas);
        } catch (error) {
            console.error("Error fetching agendas:", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="p-4">
            {/* Controls - Hidden on Print */}
            <div className="print:hidden mb-6 bg-white p-4 rounded shadow">
                <h1 className="text-2xl font-bold mb-4">Employee Agendas</h1>

                <div className="mb-4">
                    <h3 className="font-bold mb-2">Select Employees:</h3>
                    <div className="flex flex-wrap gap-2 mb-2">
                        <button
                            onClick={handleSelectAll}
                            className="px-3 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
                        >
                            {selectedEmployeeIds.length === employees.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto border p-2 rounded">
                        {employees.map(emp => (
                            <label key={emp.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                <input
                                    type="checkbox"
                                    checked={selectedEmployeeIds.includes(emp.id)}
                                    onChange={() => handleSelectEmployee(emp.id)}
                                />
                                <span>{emp.first_name} {emp.last_name}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={fetchAgendas}
                        disabled={selectedEmployeeIds.length === 0 || loading}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
                    >
                        {loading ? 'Loading...' : 'Generate Agendas'}
                    </button>
                    {Object.keys(agendas).length > 0 && (
                        <button
                            onClick={handlePrint}
                            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                        >
                            Print / Save as PDF
                        </button>
                    )}
                </div>
            </div>

            {/* Agendas Display */}
            <div className="space-y-8 print:space-y-0">
                {selectedEmployeeIds.map(empId => {
                    const emp = employees.find(e => e.id === empId);
                    const empShifts = agendas[empId] || [];

                    if (!emp || !agendas[empId]) return null;

                    return (
                        <div key={empId} className="bg-white p-6 rounded shadow print:shadow-none print:break-after-page print:h-screen">
                            <div className="border-b pb-4 mb-4">
                                <h2 className="text-2xl font-bold">{emp.first_name} {emp.last_name}</h2>
                                <p className="text-gray-600">Upcoming Schedule</p>
                            </div>

                            {empShifts.length === 0 ? (
                                <p className="text-gray-500 italic">No upcoming shifts scheduled.</p>
                            ) : (
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="py-2">Date</th>
                                            <th className="py-2">Time</th>
                                            <th className="py-2">Role</th>
                                            <th className="py-2">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {empShifts.map(shift => {
                                            const start = new Date(shift.start_time);
                                            const end = new Date(shift.end_time);
                                            return (
                                                <tr key={shift.id} className="border-b hover:bg-gray-50">
                                                    <td className="py-2 font-medium">
                                                        {format(start, 'EEE, MMM d')}
                                                    </td>
                                                    <td className="py-2">
                                                        {format(start, 'h:mm a')} - {format(end, 'h:mm a')}
                                                    </td>
                                                    <td className="py-2">
                                                        {/* Role name would need to be fetched or mapped, using ID for now or passing roles prop */}
                                                        Role {shift.role_id}
                                                    </td>
                                                    <td className="py-2 text-gray-600 text-sm">
                                                        {shift.is_vacation ? <span className="text-purple-600 font-bold">VACATION</span> : shift.notes}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}

                            <div className="mt-8 pt-4 border-t text-xs text-gray-400 text-center print:fixed print:bottom-4 print:w-full">
                                Generated on {format(new Date(), 'MMM d, yyyy h:mm a')}
                            </div>
                        </div>
                    );
                })}
            </div>

            <style>{`
                @media print {
                    @page { margin: 0.5in; }
                    body { -webkit-print-color-adjust: exact; }
                    .print\\:break-after-page { page-break-after: always; }
                    .print\\:hidden { display: none !important; }
                    .print\\:shadow-none { box-shadow: none !important; }
                    .print\\:h-screen { height: auto !important; min-height: 90vh; }
                }
            `}</style>
        </div>
    );
};

export default AgendaView;
