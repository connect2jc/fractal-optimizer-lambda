// Import Express
const express = require('express');

const user = require('./user');
const customEmailSender = require('./customEmailSender');
// Create an Express application
const app = express();


// Define a port
const PORT = 3000;

// Define a route
app.get('/', (req, res) => {
  res.send('Hello, World! Welcome to your Express server!');
});

// Define another route
app.get('/about', (req, res) => {
  res.send('This is the About page!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});