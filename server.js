// chat-backend/server.js

const express = require('express');
const http = require('http');
// Import Server from socket.io for the WebSocket functionality
const { Server } = require('socket.io'); 
const cors = require('cors');
require('dotenv').config();

// Custom imports
const connectDB = require('./db'); // Mongoose connection
const Message = require('./models/Message'); // Mongoose model

const app = express();
const server = http.createServer(app);

// --- Configuration ---
// The hosting platform (e.g., Render/Heroku) will set the PORT environment variable
const PORT = process.env.PORT || 5000; 

// Allowed origins: configurable via environment variable for flexibility in dev/prod
// Default includes localhost and the Netlify URL used in your frontend
const DEFAULT_ALLOWED = 'http://localhost:3000,https://kaleidoscopic-melba-8190e5.netlify.app';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED)
  .split(',')
  .map(s => s.trim().replace(/\/$/, ''));

// Use Express middleware with explicit CORS handling so the backend accepts
// requests from the deployed Netlify origin as well as local dev.
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser tools or same-origin requests
    const originNoSlash = origin.replace(/\/$/, '');
    if (ALLOWED_ORIGINS.includes(originNoSlash)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  }
})); // Explicit CORS setup for Express routes
app.use(express.json()); // Optional: allows handling of JSON payloads (not strictly needed for this chat app's simple routes)

// Connect to MongoDB Atlas
connectDB(); 

// --- Socket.IO Implementation (Persistent Connection) ---
// Initialize Socket.IO server with the same allowed origins
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"]
  },
  // Optimization: Optionally configure settings for robustness
  // pingInterval: 25000, 
  // pingTimeout: 60000,
});

// Simple GET endpoint to check if the server is running
app.get('/', (req, res) => {
  res.send('Chat Server Running');
});

// Route to fetch message history from MongoDB
app.get('/api/messages', async (req, res) => {
  try {
    // Optimization: Limit the number of messages for initial load
    const messages = await Message.find().sort({ timestamp: 1 }).limit(50);
    res.json(messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error: Failed to fetch messages');
  }
});

// Handle Socket.IO connection events
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // 1. Listen for 'sendMessage' event from client
  socket.on('sendMessage', async (payload) => {
    // payload is expected to be { user: String, text: String }
    
    try {
      // 2. Store message in Atlas
      const newMessage = new Message(payload);
      await newMessage.save();

      // 3. Broadcast 'receiveMessage' to ALL connected clients (including sender)
      // This is the core real-time mechanism
      io.emit('receiveMessage', newMessage);
    } catch (err) {
      console.error('Error saving message:', err);
      // Optional: Emit an error back to the specific client
      // socket.emit('messageError', 'Failed to save message.');
    }
  });

  // Handle client disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start the HTTP/WebSocket server, listening on the assigned PORT
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));