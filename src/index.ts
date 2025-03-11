import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
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
    // Matchmaking logic
    let foundMatch = false;
    for (const [roomId, room] of gameRooms.entries()) {
      if (room.players.length === 1) {
        room.players.push(socket.id);
        socket.join(roomId);
        foundMatch = true;
        
        // Notify both players that match is ready
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

  socket.on('playerStateUpdate', ({ matchId, state, isPlayer1 }) => {
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
    // Clean up game rooms
    for (const [roomId, room] of gameRooms.entries()) {
      if (room.players.includes(socket.id)) {
        io.to(roomId).emit('opponentDisconnected');
        gameRooms.delete(roomId);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 