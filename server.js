// server.js
import express from 'express';
import fetch from 'node-fetch';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();
const PORT = 3000;

const API_KEY = 'AIzaSyDePqN4yD0J_2zO8b68j0b2zF_Dqvdot4s';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;

app.use(cors());
app.use(bodyParser.json({ limit: '15mb' })); // Allow large images

app.post('/analyze', async (req, res) => {
    try {
        const payload = req.body;

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
