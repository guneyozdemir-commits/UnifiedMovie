const express = require('express');
const path = require('path');
const { handler } = require('./api/server');

const app = express();
const port = 3000;

// Serve static files
app.use(express.static(path.join(__dirname)));

// Serve movies.js with correct MIME type
app.get('/movies.js', (req, res) => {
    res.type('application/javascript');
    res.sendFile(path.join(__dirname, 'movies.js'));
});

// API endpoint
app.get('/api/movie/:title', async (req, res) => {
    const event = {
        httpMethod: 'GET',
        path: `/api/movie/${req.params.title}`
    };
    
    const response = await handler(event);
    
    res.status(response.statusCode)
       .set(response.headers)
       .send(response.body);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});