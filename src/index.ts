import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json()); // Add this to prevent request body issues
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"]
  }
});

interface GameRoom {
  players: string[];
  gameState: any;
}

const gameRooms = new Map<string, GameRoom>();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinMatchmaking', () => {
    let foundMatch = false;
    for (const [roomId, room] of gameRooms.entries()) {
      if (room.players.length === 1) {
        room.players.push(socket.id);
        socket.join(roomId);
        foundMatch = true;
        
        io.to(roomId).emit('matchFound', {
          matchId: roomId,
          player1: room.players[0],
          player2: room.players[1]
        });
        break;
      }
    }

    if (!foundMatch) {
      const roomId = Math.random().toString(36).substring(7);
      gameRooms.set(roomId, {
        players: [socket.id],
        gameState: {}
      });
      socket.join(roomId);
    }
  });

  socket.on('playerStateUpdate', ({ matchId, state }) => {
    socket.to(matchId).emit('opponentStateUpdate', state);
  });

  socket.on('playerHit', ({ matchId, damage, isPlayer1, attackerX }) => {
    socket.to(matchId).emit('playerHit', { damage, isPlayer1, attackerX });
  });

  socket.on('playerAction', ({ matchId, action, position }) => {
    socket.to(matchId).emit('opponentAction', { action, position });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    for (const [roomId, room] of gameRooms.entries()) {
      if (room.players.includes(socket.id)) {
        room.players = room.players.filter(player => player !== socket.id);

        if (room.players.length === 0) {
          gameRooms.delete(roomId);
        } else {
          io.to(roomId).emit('opponentDisconnected');
        }
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
