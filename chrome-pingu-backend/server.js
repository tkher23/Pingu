const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const { spawnSync } = require('child_process');
const fs = require('fs');

// Initialize Express app
const app = express();
const port = 5000;

// Enable CORS for frontend-backend communication
app.use(cors());

// Configure multer for file uploads (in-memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// Endpoint to process uploaded spreadsheet
app.post('/api/process-spreadsheet', upload.single('file'), async (req, res) => {
    try {
        // Read file from buffer
        const fileBuffer = req.file.buffer;
        console.log("Uploaded File Buffer:", fileBuffer);
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet);

        // Prepare profiles from spreadsheet rows
        const profiles = rows.map((row) => ({
            linkedin: row["LinkedIn Raw Text"],
            bio_page: row["Bio Page Raw Text"],
            values_page: row["Values Page Raw Text"],
            internship_interest: row["Internship Interest"],
        }));

        // Call the Python script to process profiles
        const inputData = JSON.stringify({ profiles });
        console.log("Input Data to Python Script:", inputData); // Add here
        const pythonProcess = spawnSync('python', ['backend.py', inputData], { encoding: 'utf-8' });
        if (pythonProcess.stderr) {
            console.error("Python script stderr:", pythonProcess.stderr); // Add here
        }        

        if (pythonProcess.error) {
            console.error("Python script error:", pythonProcess.error);
            return res.status(500).json({ message: "Error running the Python script." });
        }

        // Parse the Python script output
        const pythonOutput = pythonProcess.stdout.trim();
        console.log("Output from Python Script:", pythonOutput);
        const processedProfiles = JSON.parse(pythonOutput);

        // Respond with the processed profiles and emails
        res.json({
            message: "File processed successfully!",
            data: processedProfiles,
        });
    } catch (error) {
        console.error("Error processing file:", error);
        res.status(500).json({ message: "An error occurred while processing the file." });
    }
});

// Start the backend server
app.listen(port, () => {
    console.log(`Backend server is running on http://localhost:${port}`);
});
