import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, startOfWeek } from 'date-fns';

const BASE_URL = 'http://localhost:8000';

const DAYS = [
    { name: 'Saturday', value: 5 },
    { name: 'Sunday', value: 6 },
    { name: 'Monday', value: 0 },
    { name: 'Tuesday', value: 1 },
    { name: 'Wednesday', value: 2 },
    { name: 'Thursday', value: 3 },
    { name: 'Friday', value: 4 }
];

const LOCATIONS = [
    "LOT 1", "LOT 2", "LOT 3", "LOT 4", "ELOT",
    "PLAZA", "CONRAC", "OFFICE", "MAINTENANCE",
    "SUPERVISORS", "CUSTOMER LOTS", "CASHIER"
];

const TemplateEditor = ({ selectedLocation }) => {
    const [employees, setEmployees] = useState([]);
    const [roles, setRoles] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [editingCell, setEditingCell] = useState(null); // { employeeId, dayValue }

    // Search State
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newShift, setNewShift] = useState({
        start_time: '09:00',
        end_time: '17:00',
        role_id: '',
        location: '',
        booth_number: ''
    });
    const [selectedDays, setSelectedDays] = useState([]); // Array of day values
    const [syncToLocked, setSyncToLocked] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [empRes, roleRes, tmplRes] = await Promise.all([
                axios.get(`${BASE_URL}/employees/`),
                axios.get(`${BASE_URL}/roles/`),
                axios.get(`${BASE_URL}/templates/`)
            ]);
            setEmployees(empRes.data);
            setRoles(roleRes.data);
            setTemplates(tmplRes.data);
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    };

    const getTemplatesForCell = (empId, dayValue) => {
        return templates.filter(t => t.employee_id === empId && t.day_of_week === dayValue);
    };

    const filteredEmployees = employees.filter(emp => {
        const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();

        // If searching, only check name match. Search overrides Location filter so you can find people to add.
        if (searchTerm) {
            return fullName.includes(searchTerm.toLowerCase());
        }

        // If not searching, apply location filter
        if (selectedLocation && selectedLocation !== 'All') {
            // Show if employee has ANY template in this location (Case Insensitive)
            return templates.some(t => t.employee_id === emp.id && (t.location || '').toUpperCase() === selectedLocation);
        }
        return true;
    });

    const handleCellClick = (empId, dayValue) => {
        setEditingCell({ employeeId: empId, dayValue });

        const emp = employees.find(e => e.id === empId);

        // Find existing template for this cell
        const existing = templates.find(t => t.employee_id === empId && t.day_of_week === dayValue);

        if (existing) {
            setNewShift({
                start_time: existing.start_time,
                end_time: existing.end_time,
                role_id: existing.role_id,
                location: existing.location || '',
                booth_number: existing.booth_number || ''
            });
        } else {
            const defaultRole = emp ? emp.default_role_id : (roles[0]?.id || '');
            setNewShift({
                start_time: '09:00',
                end_time: '17:00',
                role_id: defaultRole,
                location: selectedLocation !== 'All' ? selectedLocation : '',
                booth_number: ''
            });
        }

        setSelectedDays([dayValue]);
        setSyncToLocked(true);
        setIsModalOpen(true);
    };

    const handleSaveTemplate = async () => {
        if (!editingCell) return;
        if (!newShift.role_id) {
            alert("Please select a role.");
            return;
        }

        try {
            // Logic: For each selected day, check if exists -> delete -> create new
            // This prevents duplicates
            for (const day of selectedDays) {
                const existing = templates.find(t =>
                    t.employee_id === editingCell.employeeId &&
                    t.day_of_week === day
                );

                if (existing) {
                    await axios.delete(`${BASE_URL}/templates/${existing.id}`);
                }

                const payload = {
                    employee_id: editingCell.employeeId,
                    day_of_week: day,
                    role_id: parseInt(newShift.role_id),
                    start_time: newShift.start_time,
                    end_time: newShift.end_time,
                    location: newShift.location,
                    booth_number: newShift.booth_number,
                    sync_to_locked: syncToLocked
                };
                await axios.post(`${BASE_URL}/templates/`, payload);
            }

            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            console.error("Save Error:", error);
            alert("Error saving template.");
        }
    };

    const handleDeleteCurrent = async () => {
        if (!editingCell) return;
        if (!confirm("Are you sure you want to delete this permanent shift?")) return;

        const existing = templates.find(t => t.employee_id === editingCell.employeeId && t.day_of_week === editingCell.dayValue);
        if (existing) {
            try {
                await axios.delete(`${BASE_URL}/templates/${existing.id}`);
                setIsModalOpen(false);
                fetchData();
            } catch (e) {
                alert("Delete failed: " + e.message);
            }
        }
    };

    const handleDeleteTemplate = async (id) => {
        if (!confirm("Delete this permanent shift?")) return;
        try {
            await axios.delete(`${BASE_URL}/templates/${id}`);
            fetchData();
        } catch (error) {
            alert("Error deleting: " + error.message);
        }
    };

    const handleImportFromLocked = async () => {
        if (!confirm("This will create Permanent Templates from all LOCKED shifts in the current week (based on today's date). Continue?")) return;
        try {
            const startOfWeekDate = startOfWeek(new Date(), { weekStartsOn: 6 });
            const weekStr = format(startOfWeekDate, "yyyy-MM-dd'T'HH:mm:ss");

            const response = await axios.post(`${BASE_URL}/templates/import-from-locked/?week_start=${weekStr}`);
            alert(`Imported ${response.data.created} templates. Skipped ${response.data.skipped} existing.`);
            fetchData();
        } catch (error) {
            alert("Import failed: " + (error.response?.data?.detail || error.message));
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow h-full overflow-auto">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Master Schedule (Permanent Shifts)</h2>
                    <p className="text-gray-600">Click any cell to add a recurring shift for that employee.</p>
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Search Employees..."
                        className="border p-2 rounded"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <button
                        onClick={handleImportFromLocked}
                        className="bg-green-600 text-white px-3 py-2 rounded shadow hover:bg-green-700 text-sm font-medium"
                    >
                        📥 Import from Current Week's Locked Shifts
                    </button>
                </div>
            </div>

            <table className="w-full border-collapse border border-gray-300">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border p-2 w-48 text-left">Employee</th>
                        {DAYS.map(d => (
                            <th key={d.value} className="border p-2 text-center w-32">{d.name}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {filteredEmployees.map(emp => (
                        <tr key={emp.id} className="hover:bg-gray-50">
                            <td className="border p-2 font-medium">
                                {emp.first_name} {emp.last_name}
                                <div className="text-xs text-gray-500">{emp.role}</div>
                            </td>
                            {DAYS.map(d => {
                                const cellTemplates = getTemplatesForCell(emp.id, d.value);
                                return (
                                    <td
                                        key={d.value}
                                        className="border p-1 align-top bg-white hover:bg-blue-50 cursor-pointer transition-colors"
                                        onClick={() => handleCellClick(emp.id, d.value)}
                                    >
                                        <div className="min-h-[40px] flex flex-col gap-1">
                                            {cellTemplates.map(t => {
                                                const empRole = roles.find(r => r.id === t.role_id);
                                                return (
                                                    <div key={t.id} className="text-xs p-1 rounded border bg-blue-100 border-blue-200 relative group">
                                                        <div className="font-bold">{t.start_time} - {t.end_time}</div>
                                                        <div>{empRole?.name}</div>
                                                        {t.location && <div className="italic">{t.location}</div>}

                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }}
                                                            className="absolute top-0 right-0 bg-red-500 text-white w-4 h-4 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 -mt-1 -mr-1"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                            {cellTemplates.length === 0 && <span className="opacity-0 hover:opacity-100 text-gray-300 text-xs text-center block pt-2">+</span>}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded shadow-lg w-96">
                        <h3 className="text-xl font-bold mb-4">Add Permanent Shift</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700">Role</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={newShift.role_id}
                                    onChange={e => setNewShift({ ...newShift, role_id: e.target.value })}
                                >
                                    <option value="">Select Role</option>
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-bold text-gray-700">Days of Week</label>
                                    <div className="space-x-2 text-xs">
                                        <button
                                            onClick={() => setSelectedDays([0, 1, 2, 3, 4, 5, 6])}
                                            className="text-blue-600 hover:underline"
                                        >
                                            All Week
                                        </button>
                                        <button
                                            onClick={() => setSelectedDays([0, 1, 2, 3, 4])}
                                            className="text-blue-600 hover:underline"
                                        >
                                            Mon-Fri
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {DAYS.map(d => (
                                        <label key={d.value} className="flex items-center space-x-1 text-sm border px-2 py-1 rounded cursor-pointer hover:bg-gray-50">
                                            <input
                                                type="checkbox"
                                                checked={selectedDays.includes(d.value)}
                                                onChange={e => {
                                                    if (e.target.checked) setSelectedDays([...selectedDays, d.value]);
                                                    else setSelectedDays(selectedDays.filter(id => id !== d.value));
                                                }}
                                            />
                                            <span>{d.name.substring(0, 3)}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700">Start Time</label>
                                    <input
                                        type="time"
                                        className="w-full border p-2 rounded"
                                        value={newShift.start_time}
                                        onChange={e => setNewShift({ ...newShift, start_time: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700">End Time</label>
                                    <input
                                        type="time"
                                        className="w-full border p-2 rounded"
                                        value={newShift.end_time}
                                        onChange={e => setNewShift({ ...newShift, end_time: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700">Location</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={newShift.location}
                                    onChange={e => setNewShift({ ...newShift, location: e.target.value })}
                                >
                                    <option value="">(None)</option>
                                    {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                            <input
                                type="checkbox"
                                checked={syncToLocked}
                                onChange={e => setSyncToLocked(e.target.checked)}
                                id="syncLocked"
                            />
                            <label htmlFor="syncLocked" className="text-sm font-medium text-gray-700">
                                Update Active Schedule (Future Locked Shifts)
                            </label>
                        </div>

                        <div className="mt-6 flex justify-between items-center">
                            {templates.some(t => t.employee_id === editingCell?.employeeId && t.day_of_week === editingCell?.dayValue) ? (
                                <button onClick={handleDeleteCurrent} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded border border-red-200">Delete Permanently</button>
                            ) : <div></div>}
                            <div className="flex gap-2">
                                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                                <button onClick={handleSaveTemplate} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Template</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TemplateEditor;
