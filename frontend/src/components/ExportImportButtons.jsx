import React, { useRef } from 'react';
import axios from 'axios';

const BASE_URL = 'http://localhost:8000';

const ExportImportButtons = () => {
    const fileInputRef = useRef(null);
    const ocrInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    const handleExcelImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await uploadFile(file, 'excel');
    };

    const handleOCRImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await uploadFile(file, 'ocr');
    };

    const uploadFile = async (file, type) => {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const endpoint = type === 'excel' ? '/import/excel/' : '/import/ocr/';
            const response = await axios.post(`${BASE_URL}${endpoint}`, formData, {
                headers: { 'Content-Type': 'multipart/form-type' }
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
            >
                Export Excel
            </button>

            <button
                onClick={() => fileInputRef.current.click()}
                className="bg-blue-600 text-white px-3 py-1 rounded shadow hover:bg-blue-700 text-sm"
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
                accept="image/*, .pdf"
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
        </div>
    );
};

export default ExportImportButtons;
