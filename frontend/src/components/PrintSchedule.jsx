import React from 'react';
import RosterView from './RosterView';

const PrintSchedule = ({ shifts, employees, currentDate }) => {
    // 1. Get all unique locations from shifts
    const uniqueLocations = [...new Set(shifts.map(s => s.location).filter(l => l))];

    // 2. Define priority order
    const priorityOrder = [
        'Supervisors',
        'Office',
        'Maintenance',
        'Plaza',
        'Conrac',
        'Lot 1',
        'Lot 2',
        'Lot 3',
        'Lot 4'
    ];

    // 3. Sort locations: Strictly follow priority order and exist in shifts
    const sortedLocations = priorityOrder.filter(loc => uniqueLocations.includes(loc));

    // Helper to filter employees for a specific page
    const getPageEmployees = (location, allShifts, allEmployees) => {
        let relevantShifts = [];
        // Role IDs: 4=Maintenance, 5=Supervisor, 6=Office
        if (location === 'Supervisors') {
            relevantShifts = allShifts.filter(s => s.roleId === 5);
        } else if (location === 'Office') {
            relevantShifts = allShifts.filter(s => s.roleId === 6);
        } else if (location === 'Maintenance') {
            relevantShifts = allShifts.filter(s => s.roleId === 4);
        } else {
            // Default: Filter by location
            relevantShifts = allShifts.filter(s => s.location === location);
        }

        const empIds = new Set(relevantShifts.map(s => s.calendarId));
        return allEmployees.filter(e => empIds.has(e.id.toString()));
    };

    return (
        <div className="hidden print:block w-full">
            <style type="text/css" media="print">
                {`
                    @page { size: landscape; margin: 0.25in; }
                    body { 
                        -webkit-print-color-adjust: exact; 
                        background: white;
                    }
                    .print-page-break { 
                        break-after: page; 
                        page-break-after: always; 
                        display: block; 
                        width: 100%;
                    }
                    .print-page-break:last-child { break-after: auto; }

                    /* Headers */
                    thead th {
                        background-color: #f3f4f6 !important;
                        color: black !important;
                    }
                    /* Table Structure */
                    table {
                        width: 100% !important;
                        border-collapse: collapse;
                    }
                    /* Keep borders for readability but allow colors */
                    td, th {
                        border: 1px solid #ccc !important;
                        padding: 4px !important;
                    }
                `}
            </style>

            {sortedLocations.map(location => {
                const pageEmployees = getPageEmployees(location, shifts, employees);
                if (pageEmployees.length === 0) return null;

                return (
                    <div key={location} className="print-page-break p-4">
                        <div className="flex justify-between items-center mb-4 border-b border-black pb-2">
                            <h1 className="text-2xl font-bold uppercase text-black">{location} SCHEDULE</h1>
                            <span className="text-lg text-black font-semibold">
                                Week of {currentDate.toLocaleDateString()}
                            </span>
                        </div>

                        <div className="flex-1 w-full">
                            <RosterView
                                currentDate={currentDate}
                                employees={pageEmployees}
                                shifts={shifts}
                                selectedLocation={location}
                                readOnly={true}
                                onShiftClick={() => { }}
                                onEmptyCellClick={() => { }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default PrintSchedule;
