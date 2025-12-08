import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
        const originalTitle = document.title;
        const roleName = shiftData?.role_id === 4 ? 'Maintenance' : 'Cashier';
        const dateStr = shiftData?.start ? format(new Date(shiftData.start), 'MMddyyyy_HHmm') : 'CallSheet';
        document.title = `${dateStr}_${roleName}CallSheet`;
        window.print();
        setTimeout(() => {
            document.title = originalTitle;
        }, 1000);
    };

    // Prepare pages data for Cashier view
    const p1_data = candidates.filter(c => c.section.startsWith("Page 1"));
    const p2_data = candidates.filter(c => c.section.startsWith("Page 2"));
    const p3_data = candidates.filter(c => c.section.startsWith("Page 3"));

    const pages = [
        { title: "Part Time", data: p1_data },
        { title: "Page 2: Full Time (OT)", data: p2_data },
        { title: "PT for OT", data: p3_data }
    ];

    const CallSheetContent = ({ isPreview = false }) => {
        const HeaderBlock = () => (
            <>
                <h1 className="text-xl print:text-base font-bold text-center mb-1 uppercase border-b border-black pb-1 text-black">
                    {shiftData?.role_id === 4 ? 'Maintenance Call Sheet' : 'Cashier Call Sheet'}
                </h1>
                <div className="flex justify-between mb-1 text-black print:text-[9px]">
                    <div>
                        <span className="font-bold">Date:</span> {shiftData?.start ? format(new Date(shiftData.start), 'MM/dd/yyyy') : ''}
                    </div>
                    <div>
                        <span className="font-bold">Loc:</span> {shiftData?.location || 'N/A'}
                    </div>
                    <div>
                        <span className="font-bold">Shift:</span> {shiftData?.start && shiftData?.end ?
                            `${format(new Date(shiftData.start), 'h:mm a')} - ${format(new Date(shiftData.end), 'h:mm a')}` : ''}
                    </div>
                </div>
            </>
        );

        const SignatureBlock = () => (
            <div className="flex justify-between mt-2 border border-black p-1 text-black print:text-[9px] page-break-inside-avoid">
                <div className="flex-1">
                    <span className="font-bold">Signature:</span>
                    <span className="border-b border-black inline-block ml-2" style={{ width: '150px' }}>&nbsp;</span>
                </div>
                <div>
                    <span className="font-bold">Date/Time:</span>
                    <span className="border-b border-black inline-block ml-2" style={{ width: '100px' }}>&nbsp;</span>
                </div>
            </div>
        );

        return (
            <div className={`print-content ${isPreview ? 'preview-mode text-black' : 'print-black'} text-xs`}>

                {/* Header moved inside sections for Print, but we might want it once for Preview? 
                    Actually, Preview mimics Print, so duplicating it there is correct behavior. 
                    However, "shiftData" presence check is implied. */}

                <div className="space-y-4 print:space-y-0 print:block">
                    {shiftData?.role_id === 4 ? (
                        // Maintenance simple table
                        <div>
                            <HeaderBlock />
                            <h2 className="text-base font-bold mb-1 uppercase border-b border-black text-black">Active Maintenance Staff</h2>
                            <table className="w-full border-collapse border border-black mb-1 print-black text-black text-[13px]">
                                <thead>
                                    <tr className="bg-gray-200 print:bg-white print:text-black">
                                        <th className="border border-black p-1.5 w-6">#</th>
                                        <th className="border border-black p-1.5 w-1/4">Name</th>
                                        <th className="border border-black p-1.5 w-20">Phone</th>
                                        <th className="border border-black p-1.5 w-16">Hired</th>
                                        <th className="border border-black p-1.5">Status / Answer</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {candidates.map((c, idx) => (
                                        <tr key={c.emp.id} className="bg-white">
                                            <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                                            <td className="border border-black p-1.5 font-bold">{c.emp.first_name} {c.emp.last_name}</td>
                                            <td className="border border-black p-1.5 text-xs">{c.emp.phone}</td>
                                            <td className="border border-black p-1.5 text-xs">{c.emp.hire_date ? format(new Date(c.emp.hire_date), 'MM/dd/yy') : '-'}</td>
                                            <td className="border border-black p-1.5 text-xs">
                                                {c.details ? (
                                                    <span className={c.status === 'Available' ? 'text-green-600 print:text-black font-bold' : 'text-red-600 print:text-black font-bold'}>
                                                        {c.details}
                                                    </span>
                                                ) : (
                                                    <span>&nbsp;</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <SignatureBlock />
                        </div>
                    ) : (
                        <div>
                            {/* Cashier Pages Loop */}
                            {pages.map((page, pIdx) => {
                                // Dynamic Sizing Logic:
                                // If < 15 rows, use "comfortable" sizing. If > 15, use "compact".
                                const isComfortable = page.data.length <= 15;
                                const tableClass = isComfortable ? 'text-[13px]' : 'text-[9px]';
                                const paddingClass = isComfortable ? 'p-1.5' : 'p-0.5';

                                return (
                                    <div key={pIdx} className="sheet-section mb-4 print:mb-0">
                                        <HeaderBlock />
                                        <h2 className="text-sm print:text-xs font-bold mb-0.5 uppercase border-b border-black text-black">{page.title}</h2>
                                        <table className={`w-full border-collapse border border-black mb-1 print-black text-black ${tableClass}`}>
                                            <thead>
                                                <tr className="bg-gray-200 print:bg-white print:text-black">
                                                    <th className={`border border-black ${paddingClass} w-6`}>#</th>
                                                    <th className={`border border-black ${paddingClass} w-1/4`}>Name</th>
                                                    <th className={`border border-black ${paddingClass} w-20`}>Phone</th>
                                                    <th className={`border border-black ${paddingClass} w-16`}>Hired</th>
                                                    <th className={`border border-black ${paddingClass} w-16`}>Status</th>
                                                    <th className={`border border-black ${paddingClass} w-1/3`}>Notes</th>
                                                    <th className={`border border-black ${paddingClass} w-16`}>Time</th>
                                                    <th className={`border border-black ${paddingClass} w-16`}>Spoke</th>
                                                    <th className={`border border-black ${paddingClass} w-16`}>Ans</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {page.data.length > 0 ? page.data.map((emp, index) => {
                                                    const showHeader = index === 0 || emp.section !== page.data[index - 1].section;
                                                    return (
                                                        <React.Fragment key={emp.id}>
                                                            {showHeader && (
                                                                <tr className="bg-gray-800 text-white font-bold print:bg-white print:text-black">
                                                                    <td colSpan="9" className={`${paddingClass} border border-black uppercase tracking-wider text-center bg-gray-100 print:bg-gray-100 font-bold text-[9px]`}>
                                                                        {emp.section}
                                                                    </td>
                                                                </tr>
                                                            )}
                                                            <tr className="bg-white">
                                                                <td className={`border border-black ${paddingClass} text-center`}>{emp.rank}</td>
                                                                <td className={`border border-black ${paddingClass} font-bold relative`}>
                                                                    {emp.name}
                                                                    {emp.section.includes("Full Time") && (
                                                                        <button
                                                                            onClick={() => handleMarkLastCalled(emp.id, emp.section)}
                                                                            className="ml-2 text-[10px] bg-gray-200 hover:bg-gray-300 text-black px-1 rounded opacity-0 group-hover:opacity-100 print:hidden transition-opacity absolute right-1 top-1/2 transform -translate-y-1/2"
                                                                            title="Set as Last Called"
                                                                        >
                                                                            Set Start
                                                                        </button>
                                                                    )}
                                                                </td>
                                                                <td className={`border border-black ${paddingClass}`}>{emp.phone}</td>
                                                                <td className={`border border-black ${paddingClass} text-center`}>{emp.hire_date ? format(new Date(emp.hire_date), 'MM/dd/yy') : '-'}</td>
                                                                <td className={`border border-black ${paddingClass} font-bold text-center print:text-black`}>
                                                                    {emp.status}
                                                                </td>
                                                                <td className={`border border-black ${paddingClass}`}>
                                                                    <div className={isComfortable ? 'text-[10px]' : 'text-[9px]'}>{emp.details}</div>
                                                                    {emp.notes && <div className={`${isComfortable ? 'text-[10px]' : 'text-[9px]'} italic text-gray-600 print:text-black mt-0`}>Note: {emp.notes}</div>}
                                                                </td>
                                                                <td className={`border border-black ${paddingClass}`}></td>
                                                                <td className={`border border-black ${paddingClass}`}></td>
                                                                <td className={`border border-black ${paddingClass} text-center font-bold text-red-600 print:text-black`}>{emp.answer}</td>
                                                            </tr>
                                                        </React.Fragment>
                                                    );
                                                }) : (
                                                    <tr>
                                                        <td colSpan="9" className="p-2 text-center italic text-gray-500 print:text-black text-black">No candidates.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                        <SignatureBlock />
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="mt-1 border-t border-black pt-1 page-break-inside-avoid text-black print:text-[8px] flex justify-between items-center">
                        <div className="font-bold">Legend:</div>
                        <ul className="list-none inline-flex gap-3">
                            <li><span className="text-green-600 print:text-black font-bold">Available</span>: OK</li>
                            <li><span className="text-red-600 print:text-black font-bold">Working</span>: Busy</li>
                            <li><span className="text-orange-600 print:text-black font-bold">OT</span>: Overtime</li>
                        </ul>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            {/* Print-only content - Portal to Body to escape root constraints */}
            {/* Print Styles */}
            <style>{`
                @page { 
                    size: landscape; 
                    margin: 0.15in; 
                }
                @media print {
                    html, body {
                        height: auto !important;
                        overflow: visible !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        width: 100% !important;
                    }
                     /* Hide everything in body */
                    body > * { display: none !important; }
                    
                    /* Show only our portal content */
                    body > .call-sheet-print { 
                        display: block !important; 
                        visibility: visible !important;
                        position: relative !important; /* Changed from absolute to flow correctly */
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        background: white !important;
                        z-index: 99999 !important;
                    }

                    .no-print { display: none !important; }
                    .print-black { color: black !important; border-color: black !important; }
                    
                    /* Page Break Utilities */
                    .sheet-section {
                        page-break-after: always !important;
                        break-after: page !important;
                        display: block !important;
                        position: relative !important;
                        width: 100% !important;
                        clear: both !important;
                        margin: 0 !important;
                        padding-top: 5px !important; /* Small top pad for new page */
                    }
                    .sheet-section:last-child {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }

                    tr, td, th {
                        page-break-inside: avoid !important;
                        background-color: transparent !important;
                        color: black !important;
                    }
                    
                    /* Compact Table Logic */
                    table { font-size: 9px !important; width: 100% !important; }
                    th, td { padding: 1px 2px !important; }
                    
                    /* Hide unnecessary print elements if needed */
                    .print-hidden { display: none !important; }
                }
            `}</style>

            {/* Modal Overlay (Screen Only) with PREVIEW */}
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 p-4 no-print flex items-center justify-center">
                <div className="relative mx-auto p-0 border w-full max-w-6xl shadow-2xl rounded-md bg-gray-100 flex flex-col max-h-[90vh]">
                    <div className="flex justify-between items-center p-4 bg-white border-b sticky top-0 z-10 rounded-t-md">
                        <h3 className="text-xl font-bold">Call Sheet Preview</h3>
                        <div className="flex gap-2">
                            <button onClick={handlePrint} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-md transition-colors flex items-center gap-2">
                                <span>🖨️</span> Print Call Sheet
                            </button>
                            <button onClick={onClose} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors">
                                Close
                            </button>
                        </div>
                    </div>

                    <div className="p-8 overflow-y-auto bg-gray-500">
                        <div className="bg-white shadow-xl mx-auto p-8 max-w-[1100px] min-h-[500px]">
                            <CallSheetContent isPreview={true} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Content via Portal */}
            {createPortal(
                <div className="call-sheet-print hidden">
                    <div className="relative mx-auto p-0 w-full bg-white print:p-0 print:border-none">
                        <CallSheetContent isPreview={false} />
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default ShiftCallSheet;
