// server.js
import express from 'express';
import fetch from 'node-fetch';
import bodyParser from 'body-parser';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = 3000;
const API_KEY = 'AIzaSyDePqN4yD0J_2zO8b68j0b2zF_Dqvdot4s';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;

// Training data storage file
const TRAINING_DATA_FILE = './training-data.json';

app.use(cors());
app.use(bodyParser.json({ limit: '15mb' }));
app.use(express.static('.')); // Serve static files from current directory

// Initialize training data file if it doesn't exist
async function initTrainingData() {
    try {
        await fs.access(TRAINING_DATA_FILE);
    } catch {
        await fs.writeFile(TRAINING_DATA_FILE, JSON.stringify([]));
    }
}

// Load training data
async function loadTrainingData() {
    try {
        const data = await fs.readFile(TRAINING_DATA_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

// Save training data
async function saveTrainingData(data) {
    await fs.writeFile(TRAINING_DATA_FILE, JSON.stringify(data, null, 2));
}

// Analysis endpoint
app.post('/analyze', async (req, res) => {
    try {
        const payload = req.body;
        
        // Load training data to enhance prompt
        const trainingData = await loadTrainingData();
        
        // Build enhanced system prompt with training examples
        let enhancedSystemPrompt = "You are an expert smart meter quality control inspector. Provide clear, concise assessments of installation quality. Start your response with either 'Good' or 'Bad', then explain your reasoning.";
        
        if (trainingData.length > 0) {
            enhancedSystemPrompt += "\n\nYou have been trained on the following examples:\n";
            
            // Add recent training examples (limit to last 10)
            const recentExamples = trainingData.slice(0, 10);
            recentExamples.forEach((example, idx) => {
                if (example.classification && example.notes) {
                    enhancedSystemPrompt += `\nExample ${idx + 1}: ${example.classification.toUpperCase()} - ${example.notes}`;
                    if (example.annotations && example.annotations.length > 0) {
                        enhancedSystemPrompt += ` (${example.annotations.length} issues marked)`;
                    }
                }
            });
            
            enhancedSystemPrompt += "\n\nUse these examples to inform your analysis and look for similar patterns.";
        }
        
        // Update the system instruction
        payload.systemInstruction = {
            parts: [{ text: enhancedSystemPrompt }]
        };
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('Analysis error:', err);
        res.status(500).json({ error: 'Server error during analysis' });
    }
});

// Training data submission endpoint
app.post('/training', async (req, res) => {
    try {
        const trainingEntry = req.body;
        
        // Validate required fields
        if (!trainingEntry.image || !trainingEntry.classification) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Load existing data
        const trainingData = await loadTrainingData();
        
        // Add new entry
        trainingData.unshift({
            id: Date.now().toString(),
            image: trainingEntry.image,
            mimeType: trainingEntry.mimeType,
            classification: trainingEntry.classification,
            notes: trainingEntry.notes || '',
            annotations: trainingEntry.annotations || [],
            timestamp: trainingEntry.timestamp || new Date().toISOString()
        });
        
        // Keep only last 100 entries to prevent file from growing too large
        const limitedData = trainingData.slice(0, 100);
        
        // Save updated data
        await saveTrainingData(limitedData);
        
        console.log(`New training data added: ${trainingEntry.classification} - ${trainingEntry.notes}`);
        
        res.json({ 
            success: true, 
            message: 'Training data saved successfully',
            totalEntries: limitedData.length
        });
    } catch (err) {
        console.error('Training submission error:', err);
        res.status(500).json({ error: 'Server error during training submission' });
    }
});

// Get training history endpoint
app.get('/training-history', async (req, res) => {
    try {
        const trainingData = await loadTrainingData();
        
        // Return data without the full base64 images for performance
        const summary = trainingData.map(entry => ({
            id: entry.id,
            image: entry.image, // Keep for thumbnail display
            mimeType: entry.mimeType,
            classification: entry.classification,
            notes: entry.notes,
            annotations: entry.annotations,
            timestamp: entry.timestamp
        }));
        
        res.json(summary);
    } catch (err) {
        console.error('Training history error:', err);
        res.status(500).json({ error: 'Server error fetching training history' });
    }
});

// Delete training entry endpoint (optional)
app.delete('/training/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const trainingData = await loadTrainingData();
        
        const filteredData = trainingData.filter(entry => entry.id !== id);
        await saveTrainingData(filteredData);
        
        res.json({ 
            success: true, 
            message: 'Training entry deleted',
            totalEntries: filteredData.length
        });
    } catch (err) {
        console.error('Training deletion error:', err);
        res.status(500).json({ error: 'Server error during deletion' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        endpoints: {
            analyze: 'POST /analyze',
            training: 'POST /training',
            trainingHistory: 'GET /training-history',
            deleteTraining: 'DELETE /training/:id'
        }
    });
});

// Initialize and start server
initTrainingData().then(() => {
    app.listen(PORT, () => {
        console.log(`╔════════════════════════════════════════╗`);
        console.log(`║  Smart Meter QC Server                 ║`);
        console.log(`║  Running on http://localhost:${PORT}    ║`);
        console.log(`╚════════════════════════════════════════╝`);
        console.log(`\nEndpoints:`);
        console.log(`  → POST   /analyze           - Analyze smart meter image`);
        console.log(`  → POST   /training          - Submit training data`);
        console.log(`  → GET    /training-history  - Get training history`);
        console.log(`  → DELETE /training/:id      - Delete training entry`);
        console.log(`  → GET    /health            - Server health check`);
        console.log(`\nPress Ctrl+C to stop the server\n`);
    });
});
