import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';

const BASE_URL = 'http://localhost:8000';

const CallSheetPrint = ({ onClose }) => {
    const [rotation, setRotation] = useState({ full_time: [], part_time: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRotation = async () => {
            try {
                // Fetch for all roles or specific? Let's fetch all for now or default to Server
                // Ideally we select a role. Let's assume "Server" (id=2) for MVP or fetch all.
                // Let's fetch all employees sorted by rotation logic if backend supports it without role_id
                // Backend supports optional role_id.
                const response = await axios.get(`${BASE_URL}/callsheet/rotation/`);
                setRotation(response.data);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching rotation:", error);
                setLoading(false);
            }
        };
        fetchRotation();
    }, []);

    const handleCalled = async (empId) => {
        try {
            await axios.post(`${BASE_URL}/employees/${empId}/called/`);
            // Refresh
            const response = await axios.get(`${BASE_URL}/callsheet/rotation/`);
            setRotation(response.data);
        } catch (error) {
            console.error("Error updating call time:", error);
        }
    };

    if (loading) return <div className="p-4">Loading Call Sheet...</div>;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-3/4 shadow-lg rounded-md bg-white">
                <div className="flex justify-between items-center mb-4 print:hidden">
                    <h2 className="text-2xl font-bold">Call Sheet Rotation</h2>
                    <div>
                        <button onClick={() => window.print()} className="mr-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Print</button>
                        <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Close</button>
                    </div>
                </div>

                <div className="print:block">
                    <h1 className="text-3xl font-bold mb-2 text-center hidden print:block">Daily Call Sheet</h1>
                    <p className="text-center mb-6 text-gray-600 hidden print:block">{format(new Date(), 'EEEE, MMMM do, yyyy')}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Full Time */}
                        <div>
                            <h3 className="text-xl font-bold border-b-2 border-gray-800 mb-4 pb-2">Full Time (Rotation)</h3>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="p-2 border">Name</th>
                                        <th className="p-2 border">Last Called</th>
                                        <th className="p-2 border print:hidden">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rotation.full_time.map((emp, idx) => (
                                        <tr key={emp.id} className={idx === 0 ? "bg-yellow-50 font-semibold" : ""}>
                                            <td className="p-2 border">{emp.first_name} {emp.last_name}</td>
                                            <td className="p-2 border">
                                                {emp.last_call_time ? format(new Date(emp.last_call_time), 'MMM d, h:mm a') : 'Never'}
                                            </td>
                                            <td className="p-2 border print:hidden">
                                                <button
                                                    onClick={() => handleCalled(emp.id)}
                                                    className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                                                >
                                                    Mark Called
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <p className="text-sm text-gray-500 mt-2 italic">* Top person is next in rotation.</p>
                        </div>

                        {/* Part Time */}
                        <div>
                            <h3 className="text-xl font-bold border-b-2 border-gray-800 mb-4 pb-2">Part Time</h3>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="p-2 border">Name</th>
                                        <th className="p-2 border">Last Called</th>
                                        <th className="p-2 border print:hidden">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rotation.part_time.map((emp) => (
                                        <tr key={emp.id}>
                                            <td className="p-2 border">{emp.first_name} {emp.last_name}</td>
                                            <td className="p-2 border">
                                                {emp.last_call_time ? format(new Date(emp.last_call_time), 'MMM d, h:mm a') : 'Never'}
                                            </td>
                                            <td className="p-2 border print:hidden">
                                                <button
                                                    onClick={() => handleCalled(emp.id)}
                                                    className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                                                >
                                                    Mark Called
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CallSheetPrint;
