# Copilot Instructions for Snake Game

## Project Overview
This is a **multiplayer Snake game** with three modes: single-player, local co-op, and LAN multiplayer. The frontend is vanilla JS + Canvas; the backend uses Flask + Socket.IO for real-time game synchronization.

### Architecture
- **Frontend** ([game.js](../game.js), [index.html](../index.html), [style.css](../style.css)): Canvas-based rendering with game state management and three UI screens (mode selection, LAN screen, game screen)
- **Backend** ([server.py](../server.py)): Flask app with Socket.IO for managing game sessions, player connections, and move broadcasts

### Data Flow
1. User selects mode → UI transitions (mode screen → game screen or LAN screen)
2. **Local multiplayer**: Both snakes updated client-side with 100ms game tick
3. **LAN multiplayer**: Player moves sent via Socket.IO → server broadcasts to opponent → opponent updates local state

## Key Code Patterns

### Game State Variables
- `snake1`, `snake2`: Array of `{x, y}` segments (head first)
- `direction1`, `nextDirection1`: Current and queued directions (prevents reversal bugs)
- `food`: Single `{x, y}` position; respawned to avoid snake segments
- `score1`, `score2`: Points (10 per food); high score stored in localStorage

### Collision Detection ([game.js](../game.js#L265-L305))
Check in order: walls → self → opponent head → opponent body. Both players can die simultaneously (draw condition).

### LAN Mode Workflow
1. Create game → server generates 8-char code → Player 1 waits
2. Player 2 joins with code → both clients shown "Connected" → auto-start after 2s
3. Both players send their moves to server via `socket.emit('move', {game_id, player_number, direction})`
4. Server broadcasts each move via `move_update` event to both clients
5. Each client updates the opponent's snake direction based on received moves
6. Both snakes updated locally each tick (100ms) with full game logic running on both clients

### Canvas Rendering
- 20px grid; 400×400px canvas = 20×20 tiles
- Player 1 (green), Player 2 (cyan), food (red); grid drawn at 0.5px width
- Segments offset by 1px to avoid grid overlap

## Developer Workflows

### Running Locally
```bash
python server.py  # Starts Flask + Socket.IO on localhost:5000
# Open http://localhost:5000 in browser
```

### Testing Game Modes
- **Single-player**: Test wall/self collision, high score persistence
- **Local multiplayer**: Test Player 2 controls (arrow keys), collision between snakes
- **LAN mode**: Test game code generation, join error handling, disconnection cleanup

### Common Modifications
- **Game speed**: Adjust `gameLoop = setInterval(update, 100)` (100ms = 10 ticks/sec)
- **Grid/canvas size**: Change `gridSize` (20) and canvas width/height; update tileCount
- **Food spawn**: Modify `spawnFood()` logic (currently avoids all snake segments)
- **Scoring**: Change 10-point increment in `update()` when snake eats food

## Integration Points

### Socket.IO Events
**Client → Server:**
- `create_game`: Start new LAN session → Server emits `game_created` with 8-char code
- `join_game({game_id})`: Join existing game
- `start_game({game_id})`: Notify ready → Server broadcasts `game_started` when both ready
- `move({game_id, direction})`: Send Player 1's move (Player 2 doesn't send moves)

**Server → Client:**
- `game_created`, `game_joined`, `game_started`: UI transitions + state setup
- `move_update({direction})`: Player 2 receives opponent's direction
- `error`: Game not found or full

### localStorage
- Key: `snakeHighScore` (string number); persists across sessions

## Project Conventions

- **UI state**: Screen visibility managed via `.hidden` class (display: none in CSS)
- **Event handling**: All keyboard input routed through `handleKeyPress()`; prevents arrow key defaults to avoid page scroll
- **Direction validation**: Prevent 180° reversals (e.g., if moving right, can't queue left until next tick)
- **Player labels**: P1 controls always WASD; P2 uses arrow keys (local mode only). In LAN, only P1 plays and sees "Your Controls"
- **Disable states**: Buttons disabled during connection attempts (e.g., `createGameBtn.disabled = true`)
