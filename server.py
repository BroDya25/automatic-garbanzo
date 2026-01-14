from flask import Flask, render_template
from flask_socketio import SocketIO, emit, join_room, leave_room
import json
import uuid

app = Flask(__name__)
app.config['SECRET_KEY'] = 'snake-game-secret'
socketio = SocketIO(app, cors_allowed_origins="*")

# Store active game sessions
games = {}
players_waiting = {}

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')
    emit('connection_response', {'data': 'Connected to server'})

@socketio.on('disconnect')
def handle_disconnect():
    from flask import request
    sid = request.sid
    print(f'Client disconnected: {sid}')
    
    # Clean up waiting players
    if sid in players_waiting:
        del players_waiting[sid]
    
    # End game if player was in one
    for game_id, game in list(games.items()):
        if sid in game['players']:
            emit('game_ended', {'message': 'Other player disconnected'}, room=game_id)
            del games[game_id]
            break

@socketio.on('create_game')
def handle_create_game():
    from flask import request
    game_id = str(uuid.uuid4())[:8]
    sid = request.sid
    
    games[game_id] = {
        'id': game_id,
        'players': {sid: {'number': 1, 'ready': False}},
        'state': 'waiting'
    }
    
    join_room(game_id)
    emit('game_created', {
        'game_id': game_id,
        'player_number': 1,
        'message': f'Game created! Share code: {game_id}'
    })
    print(f'Game created: {game_id} by {sid}')

@socketio.on('join_game')
def handle_join_game(data):
    from flask import request
    game_id = data['game_id'].upper()
    sid = request.sid
    
    if game_id not in games:
        emit('error', {'message': 'Game not found'})
        return
    
    game = games[game_id]
    
    if len(game['players']) >= 2:
        emit('error', {'message': 'Game is full'})
        return
    
    game['players'][sid] = {'number': 2, 'ready': False}
    game['state'] = 'ready'
    join_room(game_id)
    
    # Notify both players
    emit('game_joined', {
        'game_id': game_id,
        'player_number': 2,
        'message': 'Connected to opponent!'
    }, room=game_id)
    
    print(f'Player 2 joined game: {game_id}')

@socketio.on('start_game')
def handle_start_game(data):
    from flask import request
    game_id = data['game_id']
    sid = request.sid
    
    if game_id not in games:
        return
    
    game = games[game_id]
    game['players'][sid]['ready'] = True
    
    # Check if both players are ready
    all_ready = all(p['ready'] for p in game['players'].values())
    
    if all_ready and len(game['players']) == 2:
        game['state'] = 'playing'
        emit('game_started', {
            'message': 'Game started!',
            'players': list(game['players'].keys())
        }, room=game_id)
        print(f'Game started: {game_id}')

@socketio.on('move')
def handle_move(data):
    from flask import request
    game_id = data['game_id']
    sid = request.sid
    
    if game_id not in games:
        return
    
    # Broadcast move to all players in the game
    emit('move_update', {
        'player_sid': sid,
        'direction': data['direction']
    }, room=game_id)

@socketio.on('game_state')
def handle_game_state(data):
    from flask import request
    game_id = data['game_id']
    
    if game_id not in games:
        return
    
    # Broadcast game state to all players
    emit('state_update', {
        'snakes': data['snakes'],
        'food': data['food'],
        'scores': data['scores']
    }, room=game_id, skip_sid=request.sid)

@socketio.on('player_died')
def handle_player_died(data):
    from flask import request
    game_id = data['game_id']
    sid = request.sid
    
    if game_id not in games:
        return
    
    emit('opponent_died', {
        'player_number': games[game_id]['players'][sid]['number']
    }, room=game_id)
    
    print(f'Player died in game: {game_id}')

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
