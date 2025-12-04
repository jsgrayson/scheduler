import React, { useRef, useState } from 'react';
import axios from 'axios';
import OCRReviewModal from './OCRReviewModal';

const BASE_URL = 'http://localhost:8000';

const ExportImportButtons = () => {
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
                timeout: 300000, // 300 seconds (5 min) timeout for slower OCR
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

    return (
        <div className="flex space-x-2">
            <button
                onClick={handleExport}
                className="bg-green-600 text-white px-3 py-1 rounded shadow hover:bg-green-700 text-sm"
                disabled={isLoading}
            >
                Export Excel
            </button>

            <button
                onClick={() => fileInputRef.current.click()}
                className="bg-blue-600 text-white px-3 py-1 rounded shadow hover:bg-blue-700 text-sm"
                disabled={isLoading}
            >
                Import Excel
            </button>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleExcelImport}
                className="hidden"
                accept=".xlsx, .xls"
            />

            {isLoading ? (
                <button
                    onClick={handleCancel}
                    className="bg-red-600 text-white px-3 py-1 rounded shadow hover:bg-red-700 text-sm"
                >
                    Cancel
                </button>
            ) : (
                <>
                    <button
                        onClick={() => ocrInputRef.current.click()}
                        className="bg-purple-600 text-white px-3 py-1 rounded shadow hover:bg-purple-700 text-sm"
                    >
                        Upload Pic (OCR)
                    </button>
                    <input
                        type="file"
                        ref={ocrInputRef}
                        onChange={handleOCRImport}
                        className="hidden"
                        accept="image/*, .pdf, .heic, .heif"
                    />

                    <button
                        onClick={() => cameraInputRef.current.click()}
                        className="bg-indigo-600 text-white px-3 py-1 rounded shadow hover:bg-indigo-700 text-sm"
                    >
                        Scan (Camera)
                    </button>
                    <input
                        type="file"
                        ref={cameraInputRef}
                        onChange={handleOCRImport}
                        className="hidden"
                        accept="image/*"
                        capture="environment"
                    />
                </>
            )}

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
