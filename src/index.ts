import { Server } from 'socket.io';
import { NextApiRequest } from 'next';
import { Server as NetServer } from 'http';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors({
  origin: ['https://the-unchained.xyz', "https://www.the-unchained.xyz",'http://localhost:3000'],
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://the-unchained.xyz';

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['https://the-unchained.xyz', "https://www.the-unchained.xyz",'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Add a simple health check endpoint
app.get('/', (req, res) => {
  res.send('Socket server is running');
});

interface PlayerState {
  position: { x: number; y: number };
  health: number;
  animation?: string;
  facing?: number;
}

interface Match {
  players: string[];
  player1Character: string | null;
  player2Character: string | null;
  player1State?: PlayerState;
  player2State?: PlayerState;
}

export const config = {
  api: {
    bodyParser: false
  }
};

const waitingPlayers = new Set<string>();
const matches = new Map<string, Match>();

const ioHandler = (req: NextApiRequest, res: any) => {
  if (!res.socket.server.io) {
    const httpServer: NetServer = res.socket.server as any;
    const io = new Server(httpServer, {
      path: '/api/socket',
      addTrailingSlash: false
    });

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('findMatch', () => {
        console.log('Find match request from:', socket.id);
        
        if (waitingPlayers.size > 0) {
          const player1 = [...waitingPlayers][0];
          waitingPlayers.delete(player1);
          const player2 = socket.id;
          
          const matchId = `${player1}-${player2}`;
          console.log('Created match:', matchId, { player1, player2 });

          matches.set(matchId, {
            players: [player1, player2],
            player1Character: null,
            player2Character: null
          });

          // Notify both players
          io.to(player1).emit('matchFound', { matchId, isPlayer1: true });
          io.to(player2).emit('matchFound', { matchId, isPlayer1: false });
        } else {
          waitingPlayers.add(socket.id);
        }
      });

      socket.on('characterSelected', ({ matchId, character, isPlayer1 }) => {
        console.log('Character selected:', { matchId, character, isPlayer1, socketId: socket.id });
        
        const foundMatch = matches.get(matchId);

        if (!foundMatch) {
          console.error('No match found for matchId:', matchId);
          return;
        }

        // Use the isPlayer1 flag to determine which character to set
        if (isPlayer1) {
          foundMatch.player1Character = character;
        } else {
          foundMatch.player2Character = character;
        }

        console.log('Updated match state:', {
          matchId,
          players: foundMatch.players,
          player1Char: foundMatch.player1Character,
          player2Char: foundMatch.player2Character
        });

        // Notify both players of the selection
        foundMatch.players.forEach(pid => {
          io.to(pid).emit('characterUpdate', {
            player1Character: foundMatch.player1Character,
            player2Character: foundMatch.player2Character
          });
        });

        // If both players have selected, start the fight
        if (foundMatch.player1Character && foundMatch.player2Character) {
          foundMatch.players.forEach(pid => {
            io.to(pid).emit('startFight', {
              player1Character: foundMatch.player1Character,
              player2Character: foundMatch.player2Character
            });
          });
        }
      });

      socket.on('playerStateUpdate', ({ matchId, state, isPlayer1 }) => {
        const match = matches.get(matchId);
        if (!match) return;

        // Update the player state
        if (isPlayer1) {
          match.player1State = state;
        } else {
          match.player2State = state;
        }

        // Broadcast the state to the opponent
        const opponent = match.players.find(id => id !== socket.id);
        if (opponent) {
          io.to(opponent).emit('opponentStateUpdate', state);
        }
      });

      socket.on('playerHit', ({ matchId, damage, isPlayer1, attackerX }) => {
        const match = matches.get(matchId);
        if (!match) return;

        // Broadcast the hit to both players
        match.players.forEach(pid => {
          io.to(pid).emit('playerHit', { 
            damage, 
            isPlayer1,
            attackerX 
          });
        });

        // Update the state in the match
        if (isPlayer1 && match.player1State) {
          match.player1State.health = Math.max(0, (match.player1State.health || 100) - damage);
        } else if (!isPlayer1 && match.player2State) {
          match.player2State.health = Math.max(0, (match.player2State.health || 100) - damage);
        }
      });

      socket.on('healthUpdate', ({ matchId, health, isPlayer1, position }) => {
        const match = matches.get(matchId);
        if (!match) return;

        // Update the player state
        if (isPlayer1) {
          match.player1State = {
            ...match.player1State,
            health,
            position
          };
        } else {
          match.player2State = {
            ...match.player2State,
            health,
            position
          };
        }

        // Broadcast the health update to both players
        match.players.forEach(pid => {
          io.to(pid).emit('healthUpdate', { health, isPlayer1, position });
        });
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        waitingPlayers.delete(socket.id);
        
        // Clean up matches
        for (const [matchId, match] of matches.entries()) {
          if (match.players.includes(socket.id)) {
            const opponent = match.players.find(id => id !== socket.id);
            if (opponent) {
              io.to(opponent).emit('opponentDisconnected');
            }
            matches.delete(matchId);
          }
        }
      });
    });

    res.socket.server.io = io;
  }
  res.end();
};

export default ioHandler; 