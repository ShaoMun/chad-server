# Fighting Game Server

WebSocket server for the multiplayer fighting game.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file:
```env
PORT=3001
FRONTEND_URL=https://your-frontend-url.vercel.app
```

3. Development:
```bash
npm run dev
```

4. Production build:
```bash
npm run build
npm start
```

## Docker Deployment

1. Build the image:
```bash
docker build -t fighting-game-server .
```

2. Run the container:
```bash
docker run -p 3001:3001 --env-file .env fighting-game-server
```

## Environment Variables

- `PORT`: Server port (default: 3001)
- `FRONTEND_URL`: Frontend URL for CORS (required in production)

## API Documentation

WebSocket Events:
- `joinMatchmaking`: Join matchmaking queue
- `playerStateUpdate`: Update player state
- `playerHit`: Register a hit
- `playerAction`: Register a player action
- `disconnect`: Handle player disconnection 