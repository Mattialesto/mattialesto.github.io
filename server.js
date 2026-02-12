const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Serve static files (index.html)
app.use(express.static('.'));

// API proxy endpoint to avoid CORS issues
app.get('/api/players', async (req, res) => {
    try {
        const response = await fetch('http://45.138.200.204:30120/players.json');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching players:', error);
        res.status(500).json({ 
            error: 'Failed to fetch players data',
            message: error.message 
        });
    }
});

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access dashboard at: http://localhost:${PORT}`);
});