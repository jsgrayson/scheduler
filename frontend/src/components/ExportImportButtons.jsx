import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import OCRReviewModal from './OCRReviewModal';

const BASE_URL = 'http://localhost:8000';

const ExportImportButtons = ({ onPrintCallSheet }) => {
    const fileInputRef = useRef(null);
    const ocrInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [parsedShifts, setParsedShifts] = useState([]);
    const [unmatchedLines, setUnmatchedLines] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const abortControllerRef = useRef(null);

    const handleExcelImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await uploadFile(file, 'excel');
    };

    const handleCancel = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setIsLoading(false);
    };

    const handleOCRImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Reset input
        e.target.value = null;

        setIsLoading(true);

        // Create new AbortController
        abortControllerRef.current = new AbortController();

        // OCR Upload with dry_run=true
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post(`${BASE_URL}/import/ocr/?dry_run=true`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                signal: abortControllerRef.current.signal,
                timeout: 600000, // 600 seconds (10 min) timeout for slower OCR
            });

            if ((response.data.parsed_shifts && response.data.parsed_shifts.length > 0) ||
                (response.data.unmatched_employees && response.data.unmatched_employees.length > 0)) {

                setParsedShifts(response.data.parsed_shifts || []);
                setUnmatchedLines(response.data.unmatched_employees || []);
                setReviewModalOpen(true);
            } else {
                alert("OCR processed but no shifts were found. \nPreview: " + response.data.raw_text_preview);
            }

        } catch (error) {
            if (axios.isCancel(error)) {
                console.log('Request canceled');
            } else {
                console.error("OCR Import failed:", error);
                alert("OCR Import failed: " + (error.response?.data?.detail || error.message));
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    const handleConfirmImport = async (confirmedShifts) => {
        try {
            const response = await axios.post(`${BASE_URL}/shifts/bulk/`, confirmedShifts);
            alert(response.data.message);
            setReviewModalOpen(false);
            window.location.reload();
        } catch (error) {
            console.error("Bulk import failed:", error);
            alert("Import failed: " + (error.response?.data?.detail || error.message));
        }
    };

    const uploadFile = async (file, type) => {
        const formData = new FormData();
        formData.append('file', file);

        try {
            // This function is now only for Excel imports
            const endpoint = '/import/excel/';
            const response = await axios.post(`${BASE_URL}${endpoint}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert(response.data.message + (response.data.errors?.length ? `\nErrors:\n${response.data.errors.join('\n')}` : ''));
            window.location.reload();
        } catch (error) {
            console.error("Import failed:", error);
            alert("Import failed: " + (error.response?.data?.detail || error.message));
        }
    };

    const handleExport = async () => {
        try {
            const response = await axios.get(`${BASE_URL}/export/excel/`, {
                responseType: 'blob', // Important for binary data
            });

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'schedule_export.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error("Export failed:", error);
            alert("Export failed");
        }
    };

    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            {isLoading ? (
                <button
                    onClick={handleCancel}
                    className="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 text-sm font-medium flex items-center gap-2"
                >
                    <span className="animate-spin">↻</span> Cancel OCR
                </button>
            ) : (
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="bg-gray-800 text-white px-4 py-2 rounded shadow hover:bg-gray-700 text-sm font-medium flex items-center gap-2"
                >
                    Actions ▾
                </button>
            )}

            {isOpen && !isLoading && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 border ring-1 ring-black ring-opacity-5">
                    <div className="py-1">
                        <button
                            onClick={() => { handleExport(); setIsOpen(false); }}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                            Export Excel
                        </button>
                        <button
                            onClick={() => { fileInputRef.current.click(); setIsOpen(false); }}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                            Import Excel
                        </button>
                        <div className="border-t border-gray-100 my-1"></div>
                        <button
                            onClick={() => { ocrInputRef.current.click(); setIsOpen(false); }}
                            className="block w-full text-left px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 font-medium"
                        >
                            Upload Pic (OCR)
                        </button>
                        <button
                            onClick={() => { cameraInputRef.current.click(); setIsOpen(false); }}
                            className="block w-full text-left px-4 py-2 text-sm text-indigo-700 hover:bg-indigo-50 font-medium"
                        >
                            Scan (Camera)
                        </button>
                        <div className="border-t border-gray-100 my-1"></div>
                        <button
                            onClick={() => { onPrintCallSheet && onPrintCallSheet(); setIsOpen(false); }}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                            Print Call Sheet
                        </button>
                    </div>
                </div>
            )}

            {/* Hidden Inputs */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleExcelImport}
                className="hidden"
                accept=".xlsx, .xls"
            />
            <input
                type="file"
                ref={ocrInputRef}
                onChange={handleOCRImport}
                className="hidden"
                accept="image/*, .pdf, .heic, .heif"
            />
            <input
                type="file"
                ref={cameraInputRef}
                onChange={handleOCRImport}
                className="hidden"
                accept="image/*"
                capture="environment"
            />

            <OCRReviewModal
                isOpen={reviewModalOpen}
                onClose={() => {
                    setReviewModalOpen(false);
                    setParsedShifts([]);
                    setUnmatchedLines([]);
                }}
                parsedShifts={parsedShifts}
                unmatchedLines={unmatchedLines}
                onConfirm={handleConfirmImport}
            />
        </div>
    );
};

export default ExportImportButtons;
