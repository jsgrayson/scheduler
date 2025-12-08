import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';

const BASE_URL = 'http://localhost:8000';

const ShiftCallSheet = ({ shiftId, shift, onClose }) => {
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [shiftData, setShiftData] = useState(shift || {});
    const [calledOutName, setCalledOutName] = useState('');

    useEffect(() => {
        const fetchCallSheet = async () => {
            try {
                // Fetch the call sheet candidates
                const response = await axios.get(`${BASE_URL}/shifts/${shiftId}/call-sheet`);
                setCandidates(response.data);

                // Fetch the shift details to get employee info
                const shiftRes = await axios.get(`${BASE_URL}/shifts/${shiftId}`);
                const fullShift = shiftRes.data;
                setShiftData({
                    ...shift,
                    ...fullShift,
                    start: fullShift.start_time,
                    end: fullShift.end_time
                });

                // If shift has an employee, fetch their name
                if (fullShift.employee_id) {
                    const empRes = await axios.get(`${BASE_URL}/employees/`);
                    const emp = empRes.data.find(e => e.id === fullShift.employee_id);
                    if (emp) {
                        setCalledOutName(`${emp.first_name} ${emp.last_name}`);
                    }
                }

                setLoading(false);
            } catch (err) {
                console.error("Error fetching call sheet:", err);
                const msg = err.response?.data?.detail || "Failed to load call sheet.";
                setError(msg);
                setLoading(false);
            }
        };
        fetchCallSheet();
    }, [shiftId]);

    if (loading) return <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">Loading Call Sheet...</div>;
    if (error) return <div className="fixed inset-0 bg-white z-50 flex items-center justify-center text-red-600">{error} <button onClick={onClose} className="ml-4 underline">Close</button></div>;


    const handleMarkLastCalled = async (employeeId, section) => {
        try {
            let contextKey = "";
            if (section.includes("Maintenance")) {
                contextKey = "maint_ft";
            } else if (section.includes("Full Time Cashiers")) {
                contextKey = "cashier_ft";
            } else {
                return; // Should not happen for other sections
            }

            await axios.post('http://localhost:8000/rotations/', {
                context_key: contextKey,
                last_employee_id: employeeId
            });
            alert("Updated Rotation Start Point!");
            // Ideally refresh the list, but for now just confirmation is enough as per plan
        } catch (error) {
            console.error("Error updating rotation:", error);
            alert("Failed to update rotation.");
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 p-4 print:p-0 print:bg-white print:static">
            <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white print:shadow-none print:border-none print:w-full print:max-w-none print:top-0">
                <div className="flex justify-between items-center mb-4 print:hidden">
                    <h3 className="text-xl font-bold">Call Sheet</h3>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="bg-blue-500 text-white px-4 py-2 rounded">
                            Print Call Sheet
                        </button>
                        <button onClick={onClose} className="bg-gray-500 text-white px-4 py-2 rounded">
                            Close
                        </button>
                    </div>
                </div>

                <div className="print-content text-sm">
                    <h1 className="text-2xl font-bold text-center mb-2 uppercase border-b-2 border-black pb-2">Employee Call Sheet</h1>
                    <div className="flex justify-between mb-4">
                        <div>
                            <span className="font-bold">Date:</span> {shiftData?.start ? format(new Date(shiftData.start), 'MM/dd/yyyy') : ''}
                        </div>
                        <div>
                            <span className="font-bold">Shift:</span> {shiftData?.start && shiftData?.end ?
                                `${format(new Date(shiftData.start), 'h:mm a')} - ${format(new Date(shiftData.end), 'h:mm a')}` : ''}
                        </div>
                        <div>
                            <span className="font-bold">Role:</span> {shiftData?.role_id === 4 ? 'Maintenance' : 'Cashier'}
                        </div>
                    </div>
                    {/* Signature and Date Line */}
                    <div className="flex justify-between mb-4 border border-black p-2">
                        <div className="flex-1">
                            <span className="font-bold">Signature:</span>
                            <span className="border-b border-black inline-block ml-2" style={{ width: '200px' }}>&nbsp;</span>
                        </div>
                        <div>
                            <span className="font-bold">Date/Time:</span>
                            <span className="border-b border-black inline-block ml-2" style={{ width: '150px' }}>&nbsp;</span>
                        </div>
                    </div>

                    {/* Logic: If Cashier (Role 3,7,8), enable pagination. Else (Maint), keep single list. */}
                    {(shiftData?.role_id === 4) ? (
                        <table className="w-full border-collapse border border-black">
                            {/* ... Existing Logic for Maint (Single Table) ... */}
                            <thead>
                                <tr className="bg-gray-200">
                                    <th className="border border-black p-1 w-8">#</th>
                                    <th className="border border-black p-1 w-1/4">Employee</th>
                                    <th className="border border-black p-1 w-24">Phone</th>
                                    <th className="border border-black p-1 w-20">Hire Date</th>
                                    <th className="border border-black p-1 w-20">Status</th>
                                    <th className="border border-black p-1 w-1/3">Details / Notes</th>
                                    <th className="border border-black p-1 w-20">Time Called</th>
                                    <th className="border border-black p-1 w-20">Spoke With</th>
                                    <th className="border border-black p-1 w-20">Answer</th>
                                </tr>
                            </thead>
                            <tbody>
                                {candidates.map((emp, index) => {
                                    const showHeader = index === 0 || emp.section !== candidates[index - 1].section;
                                    const isFullTimeSection = emp.section.includes("Full Time");
                                    return (
                                        <React.Fragment key={emp.id}>
                                            {showHeader && (
                                                <tr className="bg-gray-800 text-white font-bold">
                                                    <td colSpan="9" className="p-1 border border-black uppercase tracking-wider text-center">
                                                        {emp.section}
                                                    </td>
                                                </tr>
                                            )}
                                            <tr className={`group ${emp.status === 'Available' ? '' : 'text-gray-500 bg-gray-50'}`}>
                                                <td className="border border-black p-2 text-center">{emp.rank}</td>
                                                <td className="border border-black p-2 font-bold relative">
                                                    {emp.name}
                                                    {isFullTimeSection && (
                                                        <button
                                                            onClick={() => handleMarkLastCalled(emp.id, emp.section)}
                                                            className="ml-2 text-[10px] bg-gray-200 hover:bg-gray-300 text-black px-1 rounded opacity-0 group-hover:opacity-100 print:hidden transition-opacity absolute right-1 top-1/2 transform -translate-y-1/2"
                                                            title="Set as Last Called (Start next sheet after this person)"
                                                        >
                                                            Set Start
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="border border-black p-2">{emp.phone}</td>
                                                <td className="border border-black p-2 text-center">{emp.hire_date ? format(new Date(emp.hire_date), 'MM/dd/yy') : '-'}</td>
                                                <td className={`border border-black p-2 font-bold text-center ${emp.status === 'Available' ? 'text-green-600' :
                                                    emp.status === 'OT' ? 'text-orange-600' : 'text-red-600'
                                                    }`}>
                                                    {emp.status}
                                                </td>
                                                <td className="border border-black p-2">
                                                    <div className="text-xs">{emp.details}</div>
                                                    {emp.notes && <div className="text-xs italic text-gray-600 mt-1">Note: {emp.notes}</div>}
                                                </td>
                                                <td className="border border-black p-2"></td>
                                                <td className="border border-black p-2"></td>
                                                <td className="border border-black p-2 text-center font-bold text-red-600">{emp.answer}</td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div>
                            {/* Cashier Pagination Logic */}
                            {(() => {
                                // 3-page structure:
                                // Page 1: PT + FT under 40h (no OT)
                                const p1_data = candidates.filter(c =>
                                    c.section.startsWith("Page 1")
                                );

                                // Page 2: FT with OT (scheduled + shift >= 40)
                                const p2_data = candidates.filter(c =>
                                    c.section.startsWith("Page 2")
                                );

                                // Page 3: PT for OT (same as Page 1 but for OT situations)
                                const p3_data = candidates.filter(c =>
                                    c.section.startsWith("Page 3")
                                );

                                const pages = [
                                    { title: "Page 1: Part Time + FT Under 40h", data: p1_data },
                                    { title: "Page 2: Full Time (OT)", data: p2_data },
                                    { title: "Page 3: FOR OT (Part Time + FT Under 40h)", data: p3_data }
                                ];

                                return pages.map((page, pIdx) => (
                                    <div key={pIdx} className={pIdx < pages.length - 1 ? "mb-8 break-after-page" : ""}>
                                        <h2 className="text-lg font-bold mb-2 uppercase border-b border-black">{page.title}</h2>
                                        <table className="w-full border-collapse border border-black mb-4">
                                            <thead>
                                                <tr className="bg-gray-200">
                                                    <th className="border border-black p-1 w-8">#</th>
                                                    <th className="border border-black p-1 w-1/4">Employee</th>
                                                    <th className="border border-black p-1 w-24">Phone</th>
                                                    <th className="border border-black p-1 w-20">Hire Date</th>
                                                    <th className="border border-black p-1 w-20">Status</th>
                                                    <th className="border border-black p-1 w-1/3">Details / Notes</th>
                                                    <th className="border border-black p-1 w-20">Time Called</th>
                                                    <th className="border border-black p-1 w-20">Spoke With</th>
                                                    <th className="border border-black p-1 w-20">Answer</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {page.data.length > 0 ? page.data.map((emp, index) => {
                                                    const showHeader = index === 0 || emp.section !== page.data[index - 1].section;
                                                    const isFullTimeSection = emp.section.includes("Full Time");
                                                    return (
                                                        <React.Fragment key={emp.id}>
                                                            {showHeader && (
                                                                <tr className="bg-gray-800 text-white font-bold">
                                                                    <td colSpan="9" className="p-1 border border-black uppercase tracking-wider text-center">
                                                                        {emp.section}
                                                                    </td>
                                                                </tr>
                                                            )}
                                                            <tr className={`group ${emp.status === 'Available' ? '' : 'text-gray-500 bg-gray-50'}`}>
                                                                <td className="border border-black p-2 text-center">{emp.rank}</td>
                                                                <td className="border border-black p-2 font-bold relative">
                                                                    {emp.name}
                                                                    {isFullTimeSection && (
                                                                        <button
                                                                            onClick={() => handleMarkLastCalled(emp.id, emp.section)}
                                                                            className="ml-2 text-[10px] bg-gray-200 hover:bg-gray-300 text-black px-1 rounded opacity-0 group-hover:opacity-100 print:hidden transition-opacity absolute right-1 top-1/2 transform -translate-y-1/2"
                                                                            title="Set as Last Called (Start next sheet after this person)"
                                                                        >
                                                                            Set Start
                                                                        </button>
                                                                    )}
                                                                </td>
                                                                <td className="border border-black p-2">{emp.phone}</td>
                                                                <td className="border border-black p-2 text-center">{emp.hire_date ? format(new Date(emp.hire_date), 'MM/dd/yy') : '-'}</td>
                                                                <td className={`border border-black p-2 font-bold text-center ${emp.status === 'Available' ? 'text-green-600' :
                                                                    emp.status === 'OT' ? 'text-orange-600' : 'text-red-600'
                                                                    }`}>
                                                                    {emp.status}
                                                                </td>
                                                                <td className="border border-black p-2">
                                                                    <div className="text-xs">{emp.details}</div>
                                                                    {emp.notes && <div className="text-xs italic text-gray-600 mt-1">Note: {emp.notes}</div>}
                                                                </td>
                                                                <td className="border border-black p-2"></td>
                                                                <td className="border border-black p-2"></td>
                                                                <td className="border border-black p-2 text-center font-bold text-red-600">{emp.answer}</td>
                                                            </tr>
                                                        </React.Fragment>
                                                    );
                                                }) : (
                                                    <tr>
                                                        <td colSpan="9" className="p-4 text-center italic text-gray-500">No candidates in this section.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                ));
                            })()}
                        </div>
                    )
                    }

                    <div className="mt-8 border-t border-black pt-4">
                        <p className="font-bold">Legend:</p>
                        <ul className="text-sm list-disc list-inside">
                            <li><span className="text-green-600 font-bold">Available</span>: No conflicts found.</li>
                            <li><span className="text-red-600 font-bold">Working</span>: Has overlapping shift or working today.</li>
                            <li><span className="text-orange-600 font-bold">OT</span>: Would exceed 40 hours/week or 8 hours/day with this shift.</li>
                        </ul>
                    </div>
                </div>

                <style jsx>{`
                @media print {
                    @page { size: landscape; margin: 0.5in; }
                    body { -webkit-print-color-adjust: exact; }
                    .print\\:hidden { display: none !important; }
                    .fixed { position: static !important; overflow: visible !important; }
                }
            `}</style>
            </div>
        </div>
    );
};

export default ShiftCallSheet;
