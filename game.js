const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const modeScreen = document.getElementById('modeScreen');
const gameScreen = document.getElementById('gameScreen');
const lanScreen = document.getElementById('lanScreen');
const singlePlayerBtn = document.getElementById('singlePlayerBtn');
const multiPlayerLocalBtn = document.getElementById('multiPlayerLocalBtn');
const multiPlayerLANBtn = document.getElementById('multiPlayerLANBtn');
const createGameBtn = document.getElementById('createGameBtn');
const joinGameBtn = document.getElementById('joinGameBtn');
const gameCodeInput = document.getElementById('gameCodeInput');
const lanMessage = document.getElementById('lanMessage');
const backFromLanBtn = document.getElementById('backFromLanBtn');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const backBtn = document.getElementById('backBtn');
const scoreDisplay = document.getElementById('score');
const score2Display = document.getElementById('score2');
const highScoreDisplay = document.getElementById('highScore');
const player2Label = document.getElementById('player2Label');
const p2Controls = document.getElementById('p2Controls');
const controlsText = document.getElementById('controlsText');

// WebSocket for LAN play
let socket = null;

// Game variables
const gridSize = 20;
const tileCount = canvas.width / gridSize;
let snake1 = [{x: 5, y: 10}];
let snake2 = [{x: 15, y: 10}];
let direction1 = {x: 1, y: 0};
let nextDirection1 = {x: 1, y: 0};
let direction2 = {x: -1, y: 0};
let nextDirection2 = {x: -1, y: 0};
let food = {x: 10, y: 10};
let score1 = 0;
let score2 = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let gameRunning = false;
let gamePaused = false;
let gameLoop;
let isMultiplayer = false;
let isLAN = false;
let playerNumber = 0;
let gameId = null;

// Initialize high score display
highScoreDisplay.textContent = highScore;

// Event listeners
document.addEventListener('keydown', handleKeyPress);
singlePlayerBtn.addEventListener('click', () => startGameMode(false, false));
multiPlayerLocalBtn.addEventListener('click', () => startGameMode(true, false));
multiPlayerLANBtn.addEventListener('click', showLANScreen);
createGameBtn.addEventListener('click', createLANGame);
joinGameBtn.addEventListener('click', joinLANGame);
backFromLanBtn.addEventListener('click', () => {
    lanScreen.classList.add('hidden');
    modeScreen.classList.remove('hidden');
    lanMessage.textContent = '';
    gameCodeInput.value = '';
});
startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', togglePause);
resetBtn.addEventListener('click', resetGame);
backBtn.addEventListener('click', backToMenu);

function handleKeyPress(e) {
    const key = e.key.toLowerCase();
    
    // Player 1 controls (WASD)
    if (key === 'w') {
        if (direction1.y === 0) nextDirection1 = {x: 0, y: -1};
        e.preventDefault();
    } else if (key === 's') {
        if (direction1.y === 0) nextDirection1 = {x: 0, y: 1};
        e.preventDefault();
    } else if (key === 'a') {
        if (direction1.x === 0) nextDirection1 = {x: -1, y: 0};
        e.preventDefault();
    } else if (key === 'd') {
        if (direction1.x === 0) nextDirection1 = {x: 1, y: 0};
        e.preventDefault();
    }
    
    // Player 2 controls (Arrow keys) - only in local multiplayer
    if (isMultiplayer && !isLAN) {
        if (e.key === 'ArrowUp') {
            if (direction2.y === 0) nextDirection2 = {x: 0, y: -1};
            e.preventDefault();
        } else if (e.key === 'ArrowDown') {
            if (direction2.y === 0) nextDirection2 = {x: 0, y: 1};
            e.preventDefault();
        } else if (e.key === 'ArrowLeft') {
            if (direction2.x === 0) nextDirection2 = {x: -1, y: 0};
            e.preventDefault();
        } else if (e.key === 'ArrowRight') {
            if (direction2.x === 0) nextDirection2 = {x: 1, y: 0};
            e.preventDefault();
        }
    }
    
    // Send move to server in LAN mode
    if (isLAN && gameRunning && socket) {
        socket.emit('move', {
            game_id: gameId,
            direction: nextDirection1
        });
    }
}

function startGameMode(multiplayer, lan) {
    isMultiplayer = multiplayer;
    isLAN = lan;
    modeScreen.classList.add('hidden');
    
    if (!lan) {
        gameScreen.classList.remove('hidden');
        
        if (multiplayer) {
            player2Label.classList.remove('hidden');
            score2Display.classList.remove('hidden');
            p2Controls.classList.remove('hidden');
            controlsText.textContent = 'Controls (Player 1):';
        } else {
            player2Label.classList.add('hidden');
            score2Display.classList.add('hidden');
            p2Controls.classList.add('hidden');
            controlsText.textContent = 'Controls:';
        }
        
        resetGame();
    }
}

function showLANScreen() {
    modeScreen.classList.add('hidden');
    lanScreen.classList.remove('hidden');
    initializeWebSocket();
}

function initializeWebSocket() {
    if (socket) return;
    
    // Detect the server address (use current host)
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const serverUrl = `${protocol}://${window.location.hostname}:5000`;
    
    socket = io(serverUrl);
    
    socket.on('connect', () => {
        lanMessage.textContent = 'Connected to server ✓';
    });
    
    socket.on('game_created', (data) => {
        gameId = data.game_id;
        playerNumber = data.player_number;
        lanMessage.textContent = `Game created! Code: ${data.game_id.toUpperCase()}\nWaiting for opponent...`;
        createGameBtn.disabled = true;
    });
    
    socket.on('game_joined', (data) => {
        gameId = data.game_id;
        playerNumber = data.player_number;
        lanMessage.textContent = `Connected to opponent! Starting game...`;
        setTimeout(() => {
            startLANGame();
        }, 2000);
    });
    
    socket.on('game_started', (data) => {
        startLANGame();
    });
    
    socket.on('move_update', (data) => {
        const dir = data.direction;
        if (playerNumber === 2) {
            // We are player 2, update player 1's direction
            if (direction1.y === 0 && (dir.y === -1 || dir.y === 1)) {
                direction1 = dir;
            } else if (direction1.x === 0 && (dir.x === -1 || dir.x === 1)) {
                direction1 = dir;
            }
        }
    });
    
    socket.on('error', (data) => {
        lanMessage.textContent = `Error: ${data.message}`;
        createGameBtn.disabled = false;
    });
    
    socket.on('disconnect', () => {
        lanMessage.textContent = 'Disconnected from server';
        createGameBtn.disabled = false;
    });
}

function createLANGame() {
    if (!socket || !socket.connected) {
        lanMessage.textContent = 'Connecting to server...';
        return;
    }
    socket.emit('create_game');
}

function joinLANGame() {
    const code = gameCodeInput.value.trim().toUpperCase();
    if (!code) {
        lanMessage.textContent = 'Please enter a game code';
        return;
    }
    
    if (!socket || !socket.connected) {
        lanMessage.textContent = 'Connecting to server...';
        return;
    }
    
    socket.emit('join_game', {game_id: code});
}

function startLANGame() {
    isMultiplayer = true;
    lanScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    player2Label.classList.remove('hidden');
    score2Display.classList.remove('hidden');
    controlsText.textContent = playerNumber === 1 ? 'Your Controls:' : 'Opponent is Player 1';
    p2Controls.classList.add('hidden');
    
    resetGame();
    
    // Notify server we're ready
    socket.emit('start_game', {game_id: gameId});
}

function backToMenu() {
    clearInterval(gameLoop);
    gameRunning = false;
    gamePaused = false;
    
    if (isLAN && socket) {
        socket.disconnect();
        socket = null;
    }
    
    modeScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
    lanScreen.classList.add('hidden');
    pauseBtn.disabled = true;
}

function startGame() {
    if (!gameRunning) {
        gameRunning = true;
        gamePaused = false;
        startBtn.textContent = 'Restart';
        pauseBtn.textContent = 'Pause';
        pauseBtn.disabled = false;
        
        if (gameLoop) clearInterval(gameLoop);
        gameLoop = setInterval(update, 100);
    }
}

function togglePause() {
    if (!gameRunning) return;
    
    gamePaused = !gamePaused;
    pauseBtn.textContent = gamePaused ? 'Resume' : 'Pause';
    
    if (!gamePaused) {
        gameLoop = setInterval(update, 100);
    } else {
        clearInterval(gameLoop);
    }
}

function resetGame() {
    clearInterval(gameLoop);
    snake1 = [{x: 5, y: 10}];
    snake2 = [{x: 15, y: 10}];
    direction1 = {x: 1, y: 0};
    nextDirection1 = {x: 1, y: 0};
    direction2 = {x: -1, y: 0};
    nextDirection2 = {x: -1, y: 0};
    score1 = 0;
    score2 = 0;
    gameRunning = false;
    gamePaused = false;
    scoreDisplay.textContent = score1;
    score2Display.textContent = score2;
    startBtn.textContent = 'Start Game';
    pauseBtn.textContent = 'Pause';
    pauseBtn.disabled = true;
    spawnFood();
    draw();
}

function spawnFood() {
    let newFood;
    let foodOnSnake = true;
    
    while (foodOnSnake) {
        newFood = {
            x: Math.floor(Math.random() * tileCount),
            y: Math.floor(Math.random() * tileCount)
        };
        
        foodOnSnake = snake1.some(segment => 
            segment.x === newFood.x && segment.y === newFood.y
        ) || (isMultiplayer && snake2.some(segment => 
            segment.x === newFood.x && segment.y === newFood.y
        ));
    }
    
    food = newFood;
}

function update() {
    // Update directions
    direction1 = nextDirection1;
    if (isMultiplayer) {
        direction2 = nextDirection2;
    }
    
    // Calculate new head positions
    const head1 = {
        x: snake1[0].x + direction1.x,
        y: snake1[0].y + direction1.y
    };
    
    let head2 = null;
    if (isMultiplayer) {
        head2 = {
            x: snake2[0].x + direction2.x,
            y: snake2[0].y + direction2.y
        };
    }
    
    // Check Player 1 collisions
    let player1Dead = false;
    
    // Wall collision
    if (head1.x < 0 || head1.x >= tileCount || head1.y < 0 || head1.y >= tileCount) {
        player1Dead = true;
    }
    
    // Self collision
    if (snake1.some(segment => segment.x === head1.x && segment.y === head1.y)) {
        player1Dead = true;
    }
    
    // Check Player 2 collisions (if multiplayer)
    let player2Dead = false;
    if (isMultiplayer) {
        // Wall collision
        if (head2.x < 0 || head2.x >= tileCount || head2.y < 0 || head2.y >= tileCount) {
            player2Dead = true;
        }
        
        // Self collision
        if (snake2.some(segment => segment.x === head2.x && segment.y === head2.y)) {
            player2Dead = true;
        }
        
        // Collision with each other
        if (head1.x === head2.x && head1.y === head2.y) {
            player1Dead = true;
            player2Dead = true;
        }
        
        // Player 1 hits Player 2's body
        if (snake2.some(segment => segment.x === head1.x && segment.y === head1.y)) {
            player1Dead = true;
        }
        
        // Player 2 hits Player 1's body
        if (snake1.some(segment => segment.x === head2.x && segment.y === head2.y)) {
            player2Dead = true;
        }
    }
    
    // Handle deaths
    if (player1Dead || player2Dead) {
        endGame(player1Dead, player2Dead);
        return;
    }
    
    // Move Player 1
    snake1.unshift(head1);
    if (head1.x === food.x && head1.y === food.y) {
        score1 += 10;
        scoreDisplay.textContent = score1;
        spawnFood();
    } else {
        snake1.pop();
    }
    
    // Move Player 2 (if multiplayer)
    if (isMultiplayer) {
        snake2.unshift(head2);
        if (head2.x === food.x && head2.y === food.y) {
            score2 += 10;
            score2Display.textContent = score2;
            spawnFood();
        } else {
            snake2.pop();
        }
    }
    
    draw();
}

function endGame(player1Dead, player2Dead) {
    clearInterval(gameLoop);
    gameRunning = false;
    gamePaused = false;
    pauseBtn.disabled = true;
    
    // Update high score (use Player 1's score in single player, or highest in multiplayer)
    const maxScore = isMultiplayer ? Math.max(score1, score2) : score1;
    if (maxScore > highScore) {
        highScore = maxScore;
        localStorage.setItem('snakeHighScore', highScore);
        highScoreDisplay.textContent = highScore;
    }
    
    let gameOverMsg = '';
    if (isMultiplayer) {
        if (player1Dead && player2Dead) {
            gameOverMsg = `It's a Draw! Both collided!\nP1 Score: ${score1}\nP2 Score: ${score2}`;
        } else if (player1Dead) {
            gameOverMsg = `Player 2 Wins!\nP1 Score: ${score1}\nP2 Score: ${score2}`;
        } else {
            gameOverMsg = `Player 1 Wins!\nP1 Score: ${score1}\nP2 Score: ${score2}`;
        }
    } else {
        gameOverMsg = `Game Over! Your score: ${score1}`;
    }
    
    alert(gameOverMsg);
    resetGame();
}

function draw() {
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= tileCount; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridSize, 0);
        ctx.lineTo(i * gridSize, canvas.height);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, i * gridSize);
        ctx.lineTo(canvas.width, i * gridSize);
        ctx.stroke();
    }
    
    // Draw Player 1 snake (green)
    snake1.forEach((segment, index) => {
        if (index === 0) {
            ctx.fillStyle = '#00ff00';
        } else {
            ctx.fillStyle = '#00cc00';
        }
        ctx.fillRect(
            segment.x * gridSize + 1,
            segment.y * gridSize + 1,
            gridSize - 2,
            gridSize - 2
        );
    });
    
    // Draw Player 2 snake (cyan) - only in multiplayer
    if (isMultiplayer) {
        snake2.forEach((segment, index) => {
            if (index === 0) {
                ctx.fillStyle = '#00ffff';
            } else {
                ctx.fillStyle = '#00aaff';
            }
            ctx.fillRect(
                segment.x * gridSize + 1,
                segment.y * gridSize + 1,
                gridSize - 2,
                gridSize - 2
            );
        });
    }
    
    // Draw food (red)
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(
        food.x * gridSize + 1,
        food.y * gridSize + 1,
        gridSize - 2,
        gridSize - 2
    );
}

// Initial draw
highScoreDisplay.textContent = highScore;
