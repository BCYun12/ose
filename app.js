class OSEApp {
    constructor() {
        this.peer = null;
        this.connections = new Map();
        this.localStream = null;
        this.currentRoom = null;
        this.userName = '';
        this.isHost = false;
        this.roomData = {};
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showMainMenu();
    }

    setupEventListeners() {
        // Create Room Form
        document.getElementById('createRoomForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createRoom();
        });

        // Join Room Form
        document.getElementById('joinRoomForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.joinRoom();
        });
    }

    // Screen Navigation
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        document.getElementById(screenId).classList.remove('hidden');
    }

    showMainMenu() {
        this.showScreen('mainMenu');
    }

    showCreateRoom() {
        this.showScreen('createRoom');
    }

    showJoinRoom() {
        this.showScreen('joinRoom');
    }

    showRoomList() {
        this.showScreen('roomList');
        this.loadRoomList();
    }

    showLoadingScreen() {
        this.showScreen('loadingScreen');
    }

    showChatRoom() {
        this.showScreen('chatRoom');
    }

    // Room Management
    async createRoom() {
        const hostName = document.getElementById('hostName').value.trim();
        const roomTitle = document.getElementById('roomTitle').value.trim();
        const roomLanguage = document.getElementById('roomLanguage').value;
        const roomLevel = document.getElementById('roomLevel').value;
        const maxParticipants = parseInt(document.getElementById('maxParticipants').value);

        if (!hostName || !roomTitle || !roomLanguage || !roomLevel) {
            alert('Please fill in all required fields');
            return;
        }

        this.userName = hostName;
        this.isHost = true;
        
        this.roomData = {
            title: roomTitle,
            language: roomLanguage,
            level: roomLevel,
            maxParticipants: maxParticipants,
            host: hostName,
            participants: new Map()
        };

        this.showLoadingScreen();
        
        // Set connection timeout
        const connectionTimeout = setTimeout(() => {
            if (this.peer && !this.currentRoom) {
                this.peer.destroy();
                alert('Connection timeout. Please check your internet connection and try again.');
                this.showMainMenu();
            }
        }, 15000); // 15 second timeout
        
        try {
            // Initialize PeerJS with default cloud server
            this.peer = new Peer({
                debug: 2
            });

            this.peer.on('open', (id) => {
                clearTimeout(connectionTimeout); // Clear timeout on successful connection
                this.currentRoom = id;
                this.roomData.participants.set(id, {
                    name: hostName,
                    isHost: true
                });
                
                // Save room to localStorage for room list
                this.saveRoomToStorage();
                
                this.setupRoomUI();
                this.showChatRoom();
                this.startActivityUpdater();
                const shortCode = this.roomData.shortCode || id.substring(0, 8);
                this.addSystemMessage(`Room created! Room Code: ${shortCode}`);
            });

            this.peer.on('connection', (conn) => {
                this.handleNewConnection(conn);
            });

            this.peer.on('call', (call) => {
                this.handleIncomingCall(call);
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                let errorMessage = 'Failed to create room. ';
                
                if (err.type === 'network') {
                    errorMessage += 'Network connection failed. Please check your internet connection.';
                } else if (err.type === 'peer-unavailable') {
                    errorMessage += 'Peer connection unavailable.';
                } else if (err.type === 'browser-incompatible') {
                    errorMessage += 'Your browser does not support WebRTC.';
                } else {
                    errorMessage += 'Please try again or use a different browser.';
                }
                
                alert(errorMessage);
                this.showMainMenu();
            });

        } catch (error) {
            console.error('Error creating room:', error);
            alert('Failed to create room. Please try again.');
            this.showMainMenu();
        }
    }

    async joinRoom() {
        const guestName = document.getElementById('guestName').value.trim();
        const roomId = document.getElementById('roomId').value.trim();

        if (!guestName || !roomId) {
            alert('Please fill in all fields');
            return;
        }

        this.userName = guestName;
        this.isHost = false;
        this.currentRoom = roomId;

        this.showLoadingScreen();

        try {
            // Initialize PeerJS with default cloud server
            this.peer = new Peer({
                debug: 2
            });

            this.peer.on('open', (id) => {
                // Connect to the host
                const conn = this.peer.connect(roomId);
                
                conn.on('open', () => {
                    this.handleNewConnection(conn);
                    
                    // Send join request
                    conn.send({
                        type: 'join_request',
                        name: guestName,
                        peerId: id
                    });
                });

                conn.on('error', (err) => {
                    console.error('Connection error:', err);
                    alert('Failed to join room. Please check the Room ID.');
                    this.showMainMenu();
                });
            });

            this.peer.on('call', (call) => {
                this.handleIncomingCall(call);
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                alert('Failed to join room. Please try again.');
                this.showMainMenu();
            });

        } catch (error) {
            console.error('Error joining room:', error);
            alert('Failed to join room. Please try again.');
            this.showMainMenu();
        }
    }

    handleNewConnection(conn) {
        this.connections.set(conn.peer, conn);

        conn.on('data', (data) => {
            this.handleMessage(data, conn);
        });

        conn.on('close', () => {
            this.connections.delete(conn.peer);
            this.updateParticipantList();
            this.addSystemMessage(`${this.getParticipantName(conn.peer)} left the room`);
        });
    }

    handleMessage(data, conn) {
        switch (data.type) {
            case 'join_request':
                if (this.isHost) {
                    // Add participant
                    this.roomData.participants.set(data.peerId, {
                        name: data.name,
                        isHost: false
                    });

                    // Send room data to new participant
                    conn.send({
                        type: 'room_data',
                        roomData: {
                            title: this.roomData.title,
                            language: this.roomData.language,
                            level: this.roomData.level,
                            host: this.roomData.host,
                            participants: Array.from(this.roomData.participants.entries())
                        }
                    });

                    // Notify all participants
                    this.broadcastToAll({
                        type: 'participant_joined',
                        participant: { name: data.name, peerId: data.peerId, isHost: false }
                    });

                    this.updateParticipantList();
                    this.addSystemMessage(`${data.name} joined the room`);
                }
                break;

            case 'room_data':
                // Received room data as a guest
                this.roomData = {
                    title: data.roomData.title,
                    language: data.roomData.language,
                    level: data.roomData.level,
                    host: data.roomData.host,
                    participants: new Map(data.roomData.participants)
                };
                
                this.setupRoomUI();
                this.showChatRoom();
                this.addSystemMessage(`Joined room: ${this.roomData.title}`);
                break;

            case 'participant_joined':
                if (!this.isHost) {
                    this.roomData.participants.set(data.participant.peerId, {
                        name: data.participant.name,
                        isHost: data.participant.isHost
                    });
                    this.updateParticipantList();
                    this.addSystemMessage(`${data.participant.name} joined the room`);
                }
                break;

            case 'chat_message':
                this.displayMessage(data.message, data.sender, false);
                break;

            case 'system_message':
                this.addSystemMessage(data.message);
                break;
        }
    }

    setupRoomUI() {
        document.getElementById('currentRoomTitle').textContent = this.roomData.title;
        document.getElementById('currentRoomDetails').innerHTML = 
            `${this.capitalizeFirst(this.roomData.language)} • ${this.capitalizeFirst(this.roomData.level)} • Room ID: <span id="displayRoomId">${this.currentRoom}</span>`;
        
        this.updateParticipantList();
    }

    updateParticipantList() {
        const participantList = document.getElementById('participantList');
        const participantCount = document.getElementById('participantCount');
        
        participantList.innerHTML = '';
        participantCount.textContent = this.roomData.participants.size;

        this.roomData.participants.forEach((participant, peerId) => {
            const participantElement = document.createElement('div');
            participantElement.className = `participant ${participant.isHost ? 'host' : ''}`;
            participantElement.textContent = participant.name + (participant.isHost ? ' (Host)' : '');
            participantList.appendChild(participantElement);
        });
    }

    // Chat Functions
    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();

        if (!message) return;

        // Display own message
        this.displayMessage(message, this.userName, true);

        // Send to all connections
        this.broadcastToAll({
            type: 'chat_message',
            message: message,
            sender: this.userName
        });

        messageInput.value = '';
    }

    displayMessage(message, sender, isOwn) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isOwn ? 'own' : 'other'}`;

        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageElement.innerHTML = `
            <div class="sender">${sender}</div>
            <div class="text">${this.escapeHtml(message)}</div>
            <div class="time">${timeString}</div>
        `;

        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    addSystemMessage(message) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageElement = document.createElement('div');
        messageElement.className = 'system-message';
        messageElement.textContent = message;

        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Voice Chat Functions
    async toggleMic() {
        const micBtn = document.getElementById('micBtn');
        const micIcon = document.getElementById('micIcon');

        try {
            if (!this.localStream) {
                // Start microphone
                this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                micIcon.textContent = '🎤';
                micBtn.classList.remove('muted');
                
                // Call all connections
                this.connections.forEach((conn, peerId) => {
                    const call = this.peer.call(peerId, this.localStream);
                    if (call) {
                        call.on('stream', (remoteStream) => {
                            this.playRemoteStream(remoteStream, peerId);
                        });
                    }
                });
                
                this.addSystemMessage('Microphone enabled');
            } else {
                // Stop microphone
                this.localStream.getTracks().forEach(track => track.stop());
                this.localStream = null;
                micIcon.textContent = '🎤';
                micBtn.classList.add('muted');
                this.addSystemMessage('Microphone disabled');
            }
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access microphone. Please check permissions.');
        }
    }

    toggleSpeaker() {
        const speakerBtn = document.getElementById('speakerBtn');
        const speakerIcon = document.getElementById('speakerIcon');
        
        // This is a visual toggle - actual muting would be handled per audio element
        if (speakerBtn.classList.contains('muted')) {
            speakerBtn.classList.remove('muted');
            speakerIcon.textContent = '🔊';
            this.addSystemMessage('Speaker enabled');
        } else {
            speakerBtn.classList.add('muted');
            speakerIcon.textContent = '🔇';
            this.addSystemMessage('Speaker muted');
        }
    }

    handleIncomingCall(call) {
        if (this.localStream) {
            call.answer(this.localStream);
        } else {
            call.answer();
        }

        call.on('stream', (remoteStream) => {
            this.playRemoteStream(remoteStream, call.peer);
        });
    }

    playRemoteStream(stream, peerId) {
        const existingAudio = document.getElementById(`audio-${peerId}`);
        if (existingAudio) {
            existingAudio.remove();
        }

        const audio = document.createElement('audio');
        audio.id = `audio-${peerId}`;
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.style.display = 'none';
        document.body.appendChild(audio);
    }

    // Room List Functions
    generateShortCode() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }

    saveRoomToStorage() {
        const rooms = this.getRoomsFromStorage();
        const shortCode = this.generateShortCode();
        
        const roomInfo = {
            id: this.currentRoom,
            shortCode: shortCode,
            title: this.roomData.title,
            language: this.roomData.language,
            level: this.roomData.level,
            host: this.roomData.host,
            maxParticipants: this.roomData.maxParticipants,
            currentParticipants: this.roomData.participants.size,
            createdAt: Date.now(),
            lastActive: Date.now()
        };
        
        rooms[this.currentRoom] = roomInfo;
        localStorage.setItem('ose_rooms', JSON.stringify(rooms));
        
        this.roomData.shortCode = shortCode;
        return shortCode;
    }

    getRoomsFromStorage() {
        try {
            const stored = localStorage.getItem('ose_rooms');
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            return {};
        }
    }

    updateRoomActivity() {
        if (this.currentRoom && this.isHost) {
            const rooms = this.getRoomsFromStorage();
            if (rooms[this.currentRoom]) {
                rooms[this.currentRoom].lastActive = Date.now();
                rooms[this.currentRoom].currentParticipants = this.roomData.participants.size;
                localStorage.setItem('ose_rooms', JSON.stringify(rooms));
            }
        }
    }

    loadRoomList() {
        const rooms = this.getRoomsFromStorage();
        const activeRoomsContainer = document.getElementById('activeRooms');
        const roomCountElement = document.getElementById('roomCount');
        
        // Clean up old rooms (older than 1 hour)
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        Object.keys(rooms).forEach(roomId => {
            if (rooms[roomId].lastActive < oneHourAgo) {
                delete rooms[roomId];
            }
        });
        localStorage.setItem('ose_rooms', JSON.stringify(rooms));
        
        const roomList = Object.values(rooms);
        roomCountElement.textContent = `${roomList.length} active rooms`;
        
        if (roomList.length === 0) {
            activeRoomsContainer.innerHTML = `
                <div class="empty-rooms">
                    <p>No active rooms found.</p>
                    <p>Be the first to create one!</p>
                </div>
            `;
            return;
        }
        
        // Sort by most recent activity
        roomList.sort((a, b) => b.lastActive - a.lastActive);
        
        activeRoomsContainer.innerHTML = roomList.map(room => {
            const isRecent = (Date.now() - room.lastActive) < (5 * 60 * 1000); // 5 minutes
            const timeAgo = this.formatTimeAgo(room.lastActive);
            const displayCode = room.shortCode || room.id.substring(0, 8);
            
            return `
                <div class="room-card ${isRecent ? 'online' : 'offline'}" onclick="joinRoomFromList('${room.id}')">
                    <div class="room-header">
                        <h3 class="room-title">${this.escapeHtml(room.title)}</h3>
                        <span class="room-status ${isRecent ? 'online' : 'offline'}">
                            ${isRecent ? 'ONLINE' : 'OFFLINE'}
                        </span>
                    </div>
                    <div class="room-details">
                        ${this.capitalizeFirst(room.language)} • ${this.capitalizeFirst(room.level)} • Host: ${this.escapeHtml(room.host)}
                    </div>
                    <div class="room-meta">
                        <span class="room-participants">
                            ${room.currentParticipants}/${room.maxParticipants} participants
                        </span>
                        <span class="room-code">Code: ${displayCode}</span>
                        <span class="room-time">Last active: ${timeAgo}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    formatTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) return 'just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    }

    async joinRoomFromList(roomId) {
        const guestName = prompt('Enter your name:');
        if (!guestName || !guestName.trim()) return;
        
        this.userName = guestName.trim();
        this.isHost = false;
        this.currentRoom = roomId;
        
        this.showLoadingScreen();
        
        try {
            // Initialize PeerJS with default cloud server
            this.peer = new Peer({
                debug: 2
            });

            this.peer.on('open', (id) => {
                // Connect to the host
                const conn = this.peer.connect(roomId);
                
                conn.on('open', () => {
                    this.handleNewConnection(conn);
                    
                    // Send join request
                    conn.send({
                        type: 'join_request',
                        name: guestName,
                        peerId: id
                    });
                });

                conn.on('error', (err) => {
                    console.error('Connection error:', err);
                    alert('Failed to join room. The room might be offline.');
                    this.showRoomList();
                });
            });

            this.peer.on('call', (call) => {
                this.handleIncomingCall(call);
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                alert('Failed to join room. Please try again.');
                this.showRoomList();
            });

        } catch (error) {
            console.error('Error joining room:', error);
            alert('Failed to join room. Please try again.');
            this.showRoomList();
        }
    }

    // Utility Functions
    broadcastToAll(data) {
        this.connections.forEach((conn) => {
            if (conn.open) {
                conn.send(data);
            }
        });
    }

    getParticipantName(peerId) {
        const participant = this.roomData.participants.get(peerId);
        return participant ? participant.name : 'Unknown';
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    leaveRoom() {
        if (confirm('Are you sure you want to leave the room?')) {
            this.cleanup();
            this.showMainMenu();
        }
    }

    cleanup() {
        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // Close all connections
        this.connections.forEach((conn) => {
            conn.close();
        });
        this.connections.clear();

        // Close peer
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }

        // Remove audio elements
        document.querySelectorAll('audio[id^="audio-"]').forEach(audio => {
            audio.remove();
        });

        // Remove from localStorage if host
        if (this.isHost && this.currentRoom) {
            const rooms = this.getRoomsFromStorage();
            delete rooms[this.currentRoom];
            localStorage.setItem('ose_rooms', JSON.stringify(rooms));
        }

        // Reset state
        this.currentRoom = null;
        this.roomData = {};
        this.userName = '';
        this.isHost = false;

        // Clear activity updater
        if (this.activityUpdater) {
            clearInterval(this.activityUpdater);
            this.activityUpdater = null;
        }

        // Clear UI
        document.getElementById('chatMessages').innerHTML = '';
        document.getElementById('participantList').innerHTML = '';
    }

    startActivityUpdater() {
        // Update room activity every 30 seconds
        this.activityUpdater = setInterval(() => {
            this.updateRoomActivity();
        }, 30000);
    }
}

// Global Functions (called from HTML)
let app;

function showMainMenu() {
    app.showMainMenu();
}

function showCreateRoom() {
    app.showCreateRoom();
}

function showJoinRoom() {
    app.showJoinRoom();
}

function showRoomList() {
    app.showRoomList();
}

function refreshRoomList() {
    app.loadRoomList();
}

function joinRoomFromList(roomId) {
    app.joinRoomFromList(roomId);
}

function joinManualRoom() {
    const roomId = document.getElementById('manualRoomId').value.trim();
    if (roomId) {
        app.joinRoomFromList(roomId);
    } else {
        alert('Please enter a Room ID');
    }
}

function sendMessage() {
    app.sendMessage();
}

function toggleMic() {
    app.toggleMic();
}

function toggleSpeaker() {
    app.toggleSpeaker();
}

function leaveRoom() {
    app.leaveRoom();
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    app = new OSEApp();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (app) {
        app.cleanup();
    }
});