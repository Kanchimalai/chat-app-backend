const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./db');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

/* ================================
   ALLOWED ORIGINS (IMPORTANT)
================================ */

const DEFAULT_ALLOWED =
  'http://localhost:3000,https://kaleidoscopic-melba-8190e5.netlify.app';

const rawAllowed = (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED)
  .split(',')
  .map(s => s.trim().replace(/\/$/, ''))
  .filter(Boolean)
  .filter(s => !/YOUR_FRONTEND_URL/i.test(s));

if (process.env.NODE_ENV !== 'production' && !rawAllowed.includes('http://localhost:3000')) {
  rawAllowed.unshift('http://localhost:3000');
}

const ALLOWED_ORIGINS = rawAllowed;

console.log('Effective ALLOWED_ORIGINS:', ALLOWED_ORIGINS);

/* ================================
   EXPRESS MIDDLEWARE
================================ */

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST']
}));

app.use(express.json());

/* Debug logging */
app.use((req, res, next) => {
  console.log('HTTP Origin:', req.headers.origin, req.method, req.url);
  next();
});

/* ================================
   DATABASE
================================ */

connectDB();

/* ================================
   SOCKET.IO (FIXED)
================================ */

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

/* Log socket origin */
io.use((socket, next) => {
  console.log('Socket Origin:', socket.handshake.headers.origin);
  next();
});

/* ================================
   ROUTES
================================ */

app.get('/', (req, res) => {
  res.send('Chat Server Running');
});

app.get('/api/messages', async (req, res) => {
  try {
    const messages = await Message.find()
      .sort({ timestamp: 1 })
      .limit(50);
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to fetch messages');
  }
});

/* ================================
   SOCKET EVENTS
================================ */

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('sendMessage', async (payload) => {
    try {
      const newMessage = new Message(payload);
      await newMessage.save();
      io.emit('receiveMessage', newMessage);
    } catch (err) {
      console.error('Message save error:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

/* ================================
   START SERVER
================================ */

server.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
