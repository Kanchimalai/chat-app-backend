

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


const DEFAULT_ALLOWED = 'http://localhost:3000,https://kaleidoscopic-melba-8190e5.netlify.app';

const rawAllowed = (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);


const ALLOWED_ORIGINS = rawAllowed
  .map(s => s.replace(/\/$/, ''))
  .filter(s => !/YOUR_FRONTEND_URL/i.test(s));


if (process.env.NODE_ENV !== 'production' && !ALLOWED_ORIGINS.includes('http://localhost:3000')) {
  ALLOWED_ORIGINS.unshift('http://localhost:3000');
}


app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); 
    const originNoSlash = origin.replace(/\/$/, '');
    if (ALLOWED_ORIGINS.includes(originNoSlash)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  }
})); 
app.use(express.json()); 

// HTTP logging middleware: log incoming Origin and outgoing Access-Control-Allow-Origin
app.use((req, res, next) => {
  const incomingOrigin = req.headers.origin || '(no origin)';
  console.log('HTTP Incoming Origin:', incomingOrigin, req.method, req.url);
  res.on('finish', () => {
    console.log('HTTP Sent Access-Control-Allow-Origin:', res.get('Access-Control-Allow-Origin'), req.method, req.url);
  });
  next();
});


connectDB(); 


const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"]
  },
  
});

// Socket.IO middleware to log handshake origin (useful when engine.io uses XHR polling)
io.use((socket, next) => {
  try {
    const hsOrigin = socket.handshake && socket.handshake.headers && socket.handshake.headers.origin;
    console.log('Socket handshake Origin:', hsOrigin || '(no origin)');
  } catch (err) {
    console.warn('Error reading socket handshake origin', err);
  }
  next();
});


app.get('/', (req, res) => {
  res.send('Chat Server Running');
});


app.get('/api/messages', async (req, res) => {
  try {

    const messages = await Message.find().sort({ timestamp: 1 }).limit(50);
    res.json(messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error: Failed to fetch messages');
  }
});


io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);


  socket.on('sendMessage', async (payload) => {
    
    
    try {
    
      const newMessage = new Message(payload);
      await newMessage.save();

      
      io.emit('receiveMessage', newMessage);
    } catch (err) {
      console.error('Error saving message:', err);
      
    }
  });

  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});


// Debug: print effective allowed origins to help diagnose CORS issues
console.log('Effective ALLOWED_ORIGINS:', ALLOWED_ORIGINS);

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));