class OSEApp {
    constructor() {
        this.peer = null;
        this.connections = new Map();
        this.localStream = null;
        this.currentRoom = null;
        this.userName = '';
        this.isHost = false;
        this.roomData = {};
        this.firebaseDB = new FirebaseDB();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.registerServiceWorker();
        this.handleUrlParams();
        this.setupPWAInstall();
        this.checkForUpdates();
    }

    async checkForUpdates() {
        try {
            const response = await fetch('/version.json?t=' + Date.now());
            const versionInfo = await response.json();
            const currentVersion = localStorage.getItem('app_version');
            
            if (currentVersion && currentVersion !== versionInfo.version) {
                console.log(`🔄 New version available: ${versionInfo.version} (current: ${currentVersion})`);
                
                // Show update notification (optional)
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    const updateAvailable = confirm('New version available! Refresh to get the latest features?');
                    if (updateAvailable) {
                        window.location.reload(true);
                    }
                }
            }
            
            localStorage.setItem('app_version', versionInfo.version);
        } catch (error) {
            console.log('Version check failed:', error);
        }
    }

    // PWA Functions
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/ose/sw.js')
                    .then((registration) => {
                        console.log('SW registered: ', registration);
                    })
                    .catch((registrationError) => {
                        console.log('SW registration failed: ', registrationError);
                        // Try alternative path for GitHub Pages
                        navigator.serviceWorker.register('./sw.js')
                            .then((registration) => {
                                console.log('SW registered with alternative path: ', registration);
                            })
                            .catch((error) => {
                                console.log('Both SW registration attempts failed: ', error);
                            });
                    });
            });
        }
    }

    handleUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const joinCode = urlParams.get('join');
        const action = urlParams.get('action');
        
        if (joinCode) {
            // Auto-fill join form and show join screen
            setTimeout(() => {
                document.getElementById('roomId').value = joinCode;
                this.showJoinRoom();
            }, 100);
        } else if (action === 'create') {
            this.showCreateRoom();
        } else if (action === 'join') {
            this.showJoinRoom();
        } else {
            this.showMainMenu();
        }
    }

    setupPWAInstall() {
        this.deferredPrompt = null;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });

        window.addEventListener('appinstalled', () => {
            console.log('PWA was installed');
            this.hideInstallButton();
        });

        // Show manual install instructions for iOS Safari
        if (this.isIOSSafari()) {
            this.showIOSInstallInstructions();
        }
    }

    isIOSSafari() {
        const ua = window.navigator.userAgent;
        const iOS = !!ua.match(/iPad|iPhone|iPod/);
        const webkit = !!ua.match(/WebKit/);
        const safari = !ua.match(/CriOS|Chrome/);
        return iOS && webkit && safari;
    }

    showIOSInstallInstructions() {
        const iosBtn = document.createElement('button');
        iosBtn.id = 'iosInstallBtn';
        iosBtn.className = 'btn secondary install-btn';
        iosBtn.innerHTML = '📱 Add to Home Screen';
        iosBtn.onclick = () => {
            alert('To install:\n1. Tap Share button (⬆️)\n2. Tap "Add to Home Screen"\n3. Tap "Add"');
        };
        
        document.querySelector('header').appendChild(iosBtn);
    }

    showInstallButton() {
        const installBtn = document.createElement('button');
        installBtn.id = 'installBtn';
        installBtn.className = 'btn secondary install-btn';
        installBtn.innerHTML = '📱 Install App';
        installBtn.onclick = () => this.installPWA();
        
        document.querySelector('header').appendChild(installBtn);
    }

    hideInstallButton() {
        const installBtn = document.getElementById('installBtn');
        if (installBtn) {
            installBtn.remove();
        }
    }

    async installPWA() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            this.deferredPrompt = null;
            this.hideInstallButton();
        }
    }

    addShareButton(shareUrl) {
        const chatHeader = document.querySelector('.chat-header');
        let shareBtn = document.getElementById('shareBtn');
        
        if (!shareBtn) {
            shareBtn = document.createElement('button');
            shareBtn.id = 'shareBtn';
            shareBtn.className = 'btn secondary';
            shareBtn.innerHTML = '🔗 Share Room';
            shareBtn.onclick = () => this.shareRoom(shareUrl);
            chatHeader.appendChild(shareBtn);
        }
    }

    async shareRoom(shareUrl) {
        try {
            if (navigator.share) {
                // Use native share API
                await navigator.share({
                    title: 'Join my English practice room!',
                    text: 'Come practice English with me on OSE',
                    url: shareUrl
                });
            } else if (navigator.clipboard) {
                // Copy to clipboard
                await navigator.clipboard.writeText(shareUrl);
                alert('Room link copied to clipboard!');
            } else {
                // Fallback - show link for manual copy
                prompt('Copy this link to share:', shareUrl);
            }
        } catch (error) {
            console.log('Error sharing:', error);
            // Fallback
            prompt('Copy this link to share:', shareUrl);
        }
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

    async showRoomList() {
        this.showScreen('roomList');
        await this.loadRoomList();
    }

    showLoadingScreen(message = 'Connecting to room...', step = 'Initializing connection...') {
        this.showScreen('loadingScreen');
        document.getElementById('loadingMessage').textContent = message;
        document.getElementById('loadingStep').textContent = step;
    }

    updateLoadingStep(step) {
        const stepElement = document.getElementById('loadingStep');
        if (stepElement) {
            stepElement.textContent = step;
        }
    }

    showChatRoom() {
        this.showScreen('chatRoom');
    }

    // Room Management
    async createRoom(retryCount = 0) {
        const hostName = document.getElementById('hostName').value.trim();
        const roomTitle = document.getElementById('roomTitle').value.trim();
        const roomLanguage = document.getElementById('roomLanguage').value;
        const roomLevel = document.getElementById('roomLevel').value;
        const maxParticipants = parseInt(document.getElementById('maxParticipants').value);

        if (!hostName || !roomTitle || !roomLanguage || !roomLevel) {
            alert('Please fill in all required fields');
            return;
        }

        console.log(`=== CREATE ROOM ATTEMPT ${retryCount + 1} ===`);

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

        const retryText = retryCount > 0 ? ` (Retry ${retryCount})` : '';
        this.showLoadingScreen(`Creating room...${retryText}`, 'Setting up peer connection...');
        
        // Set connection timeout (15 seconds)
        const connectionTimeout = setTimeout(() => {
            if (this.peer && !this.currentRoom) {
                console.error('Room creation timeout');
                this.peer.destroy();
                
                if (retryCount < 2) {
                    console.log('Retrying due to timeout...');
                    setTimeout(() => {
                        this.createRoom(retryCount + 1);
                    }, 1000);
                } else {
                    alert('Room creation timed out. Please check your internet connection and try again.');
                    this.showMainMenu();
                }
            }
        }, 15000);
        
        try {
            // Initialize PeerJS with mobile-friendly configuration
            this.peer = new Peer({
                debug: 1, // Enable debug for troubleshooting
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ],
                    iceCandidatePoolSize: 10,
                    bundlePolicy: 'max-bundle',
                    rtcpMuxPolicy: 'require'
                },
                serialization: 'json',
                pingInterval: 5000
            });

            this.peer.on('open', async (id) => {
                clearTimeout(connectionTimeout); // Clear timeout on successful connection
                this.currentRoom = id;
                this.roomData.participants.set(id, {
                    name: hostName,
                    isHost: true
                });
                
                // Save room to localStorage for room list
                await this.saveRoomToStorage();
                
                this.setupRoomUI();
                this.showChatRoom();
                this.startActivityUpdater();
                const shortCode = this.roomData.shortCode || id.substring(0, 8);
                const shareUrl = `${window.location.origin}${window.location.pathname}?join=${shortCode}`;
                
                this.addSystemMessage(`Room created! Room Code: ${shortCode}`);
                this.addSystemMessage(`Share: ${shareUrl}`);
                this.addShareButton(shareUrl);
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
            
            if (retryCount < 2) {
                console.log(`Retrying room creation (${retryCount + 1}/2)...`);
                setTimeout(() => {
                    this.createRoom(retryCount + 1);
                }, 2000);
            } else {
                alert('Failed to create room after multiple attempts. Please check your internet connection and try again.');
                this.showMainMenu();
            }
        }
    }

    async joinRoom() {
        const guestName = document.getElementById('guestName').value.trim();
        const roomId = document.getElementById('roomId').value.trim();
        const fromList = document.getElementById('roomId').getAttribute('data-from-list') === 'true';

        if (!guestName || !roomId) {
            alert('Please fill in all fields');
            return;
        }

        // Clear the flag
        document.getElementById('roomId').removeAttribute('data-from-list');

        // Show loading screen
        this.showLoadingScreen('Joining room...', 'Preparing to connect...');
        
        let actualRoomId = roomId;
        
        // Only check room existence if NOT coming from room list
        if (!fromList) {
            this.updateLoadingStep('Checking if room is available...');
            console.log('Checking if room exists:', roomId);
            const roomCheck = await this.checkRoomExists(roomId);
            
            if (!roomCheck.exists) {
                alert('Room not found or is no longer active. Please check the room ID or try a different room.');
                this.showJoinRoom();
                return;
            }
            
            actualRoomId = roomCheck.roomId;
            console.log('Room exists, connecting to:', actualRoomId);
        } else {
            console.log('Joining from room list, skipping existence check');
        }
        
        this.updateLoadingStep('Establishing connection...');
        await this.connectToRoom(actualRoomId, guestName);
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

    async saveRoomToStorage() {
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
        
        // Save locally
        rooms[this.currentRoom] = roomInfo;
        localStorage.setItem('ose_rooms', JSON.stringify(rooms));
        
        // Save to Firebase for cross-device sharing
        await this.firebaseDB.saveRoom(this.currentRoom, roomInfo);
        
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

    async updateRoomActivity() {
        if (this.currentRoom && this.isHost) {
            const rooms = this.getRoomsFromStorage();
            if (rooms[this.currentRoom]) {
                rooms[this.currentRoom].lastActive = Date.now();
                rooms[this.currentRoom].currentParticipants = this.roomData.participants.size;
                localStorage.setItem('ose_rooms', JSON.stringify(rooms));
                
                // Also update Firebase for cross-device sync
                await this.firebaseDB.updateRoomActivity(this.currentRoom, this.roomData.participants.size);
            }
        }
    }

    async loadRoomList() {
        const localRooms = this.getRoomsFromStorage();
        const firebaseRooms = await this.firebaseDB.getRooms();
        
        // Merge local and Firebase rooms
        const allRooms = { ...localRooms };
        
        // Safely process Firebase rooms
        if (firebaseRooms && typeof firebaseRooms === 'object') {
            const now = Date.now();
            const maxAge = 30 * 60 * 1000; // 30 minutes
            
            Object.keys(firebaseRooms).forEach(roomId => {
                try {
                    const roomData = firebaseRooms[roomId];
                    
                    // Check if room is too old
                    const lastActive = roomData.lastActive || roomData.created || 0;
                    if (now - lastActive > maxAge) {
                        console.log('Skipping old room:', roomId, 'Age:', (now - lastActive) / 1000 / 60, 'minutes');
                        return;
                    }
                    
                    // Ensure Firebase room has proper structure
                    const firebaseRoom = { 
                        ...roomData, 
                        id: roomId,
                        // Ensure all required fields exist with safe defaults
                        title: roomData.title || 'Untitled Room',
                        host: roomData.host || 'Unknown Host',
                        language: roomData.language || 'english',
                        level: roomData.level || 'intermediate',
                        lastActive: firebaseRooms[roomId].lastActive || Date.now(),
                        currentParticipants: firebaseRooms[roomId].currentParticipants || 0,
                        maxParticipants: firebaseRooms[roomId].maxParticipants || 4
                    };
                    
                    // Use Firebase data if it's newer or doesn't exist locally
                    if (!allRooms[roomId] || firebaseRoom.lastActive > (allRooms[roomId].lastActive || 0)) {
                        allRooms[roomId] = firebaseRoom;
                    }
                } catch (error) {
                    console.error(`Error processing Firebase room ${roomId}:`, error);
                }
            });
        }
        
        const activeRoomsContainer = document.getElementById('activeRooms');
        const roomCountElement = document.getElementById('roomCount');
        
        // Clean up old rooms (older than 1 hour)
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        Object.keys(allRooms).forEach(roomId => {
            if (allRooms[roomId].lastActive < oneHourAgo) {
                delete allRooms[roomId];
                // Also delete from Firebase
                this.firebaseDB.deleteRoom(roomId);
            }
        });
        
        // Update localStorage with merged data
        localStorage.setItem('ose_rooms', JSON.stringify(allRooms));
        
        const roomList = Object.values(allRooms);
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
            
            // Safe code display - ensure we have valid strings for substring
            let displayCode = 'Unknown';
            if (room.shortCode && typeof room.shortCode === 'string') {
                displayCode = room.shortCode;
            } else if (room.id && typeof room.id === 'string' && room.id.length >= 8) {
                displayCode = room.id.substring(0, 8);
            } else if (room.id && typeof room.id === 'string') {
                displayCode = room.id;
            }
            
            // Safe room ID for onclick - ensure we have a valid ID
            const roomId = room.id || Object.keys(allRooms).find(key => allRooms[key] === room) || 'unknown';
            
            return `
                <div class="room-card ${isRecent ? 'online' : 'offline'}" onclick="joinRoomFromList('${roomId}')">
                    <div class="room-header">
                        <h3 class="room-title">${this.escapeHtml(room.title || 'Untitled Room')}</h3>
                        <span class="room-status ${isRecent ? 'online' : 'offline'}">
                            ${isRecent ? 'ONLINE' : 'OFFLINE'}
                        </span>
                    </div>
                    <div class="room-details">
                        ${this.capitalizeFirst(room.language || 'Unknown')} • ${this.capitalizeFirst(room.level || 'Unknown')} • Host: ${this.escapeHtml(room.host || 'Unknown')}
                    </div>
                    <div class="room-meta">
                        <span class="room-participants">
                            ${room.currentParticipants || 0}/${room.maxParticipants || 4} participants
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
        // For rooms from the list, we skip the existence check since they're already verified
        // Show join room screen with pre-filled room ID
        document.getElementById('roomId').value = roomId;
        
        // Add a flag to indicate this came from room list
        document.getElementById('roomId').setAttribute('data-from-list', 'true');
        this.showJoinRoom();
    }

    // Check if a room is actually active before trying to connect
    async checkRoomExists(roomId) {
        try {
            // First check if this is a shortCode, if so, convert to full room ID
            const rooms = this.getRoomsFromStorage();
            const firebaseRooms = await this.firebaseDB.getRooms();
            const allRooms = { ...rooms };
            
            // Merge Firebase rooms
            if (firebaseRooms && typeof firebaseRooms === 'object') {
                Object.keys(firebaseRooms).forEach(id => {
                    const firebaseRoom = { ...firebaseRooms[id], id };
                    allRooms[id] = firebaseRoom;
                });
            }
            
            // Look for room by ID or shortCode
            let actualRoomId = roomId;
            const roomEntry = Object.values(allRooms).find(room => 
                room.id === roomId || room.shortCode === roomId
            );
            
            if (roomEntry) {
                actualRoomId = roomEntry.id;
                console.log(`Found room: ${roomId} -> ${actualRoomId}`);
            } else {
                console.log(`Room not found in storage: ${roomId}`);
                return { exists: false, roomId: null };
            }
            
            // Create a temporary peer to test connection
            const testPeer = new Peer();
            
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    testPeer.destroy();
                    resolve({ exists: false, roomId: actualRoomId });
                }, 4000); // Increased timeout for room creation

                testPeer.on('open', () => {
                    const testConn = testPeer.connect(actualRoomId);
                    
                    const connTimeout = setTimeout(() => {
                        testConn.close();
                        testPeer.destroy();
                        clearTimeout(timeout);
                        resolve({ exists: false, roomId: actualRoomId });
                    }, 3000); // Increased timeout

                    testConn.on('open', () => {
                        clearTimeout(connTimeout);
                        clearTimeout(timeout);
                        testConn.close();
                        testPeer.destroy();
                        resolve({ exists: true, roomId: actualRoomId });
                    });

                    testConn.on('error', () => {
                        clearTimeout(connTimeout);
                        clearTimeout(timeout);
                        testPeer.destroy();
                        resolve({ exists: false, roomId: actualRoomId });
                    });
                });

                testPeer.on('error', () => {
                    clearTimeout(timeout);
                    resolve({ exists: false, roomId: actualRoomId });
                });
            });
        } catch (error) {
            console.error('Error checking room existence:', error);
            return { exists: false, roomId };
        }
    }

    async connectToRoom(roomId, guestName, retryCount = 0) {
        console.log(`=== connectToRoom started (Attempt ${retryCount + 1}) ===`);
        console.log('Room ID:', roomId);
        console.log('Guest Name:', guestName);
        console.log('User Agent:', navigator.userAgent);
        console.log('Is Mobile:', /Mobi|Android/i.test(navigator.userAgent));
        
        this.userName = guestName.trim();
        this.isHost = false;
        this.currentRoom = roomId;
        
        this.updateLoadingStep('Initializing peer connection...');
        console.log('Loading step updated to: Initializing peer connection...');
        
        // Set overall connection timeout (20 seconds for mobile)
        const overallTimeout = setTimeout(() => {
            console.error('=== OVERALL TIMEOUT TRIGGERED ===');
            if (this.peer) {
                console.log('Destroying peer due to timeout');
                this.peer.destroy();
            }
            alert('Connection timeout. This might be due to network issues. Please try again.');
            this.showRoomList();
        }, 20000);
        
        console.log('Overall timeout set for 20 seconds');
        
        try {
            console.log('Creating PeerJS instance...');
            // Initialize PeerJS with more robust configuration
            this.peer = new Peer({
                debug: 1, // Enable debug for troubleshooting
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ],
                    iceCandidatePoolSize: 10,
                    bundlePolicy: 'max-bundle',
                    rtcpMuxPolicy: 'require'
                },
                serialization: 'json',
                pingInterval: 5000
            });
            console.log('PeerJS instance created successfully');

            // Peer open timeout (10 seconds for mobile)
            const peerOpenTimeout = setTimeout(() => {
                console.error('Peer failed to open within 10 seconds');
                if (this.peer) {
                    this.peer.destroy();
                }
                clearTimeout(overallTimeout);
                alert('Failed to initialize connection. Mobile networks can be slow - please try again.');
                this.showRoomList();
            }, 10000);

            this.peer.on('open', (id) => {
                console.log('=== PEER OPENED EVENT ===');
                clearTimeout(peerOpenTimeout);
                console.log('Peer opened with ID:', id);
                console.log('Attempting to connect to room:', roomId);
                this.updateLoadingStep('Connecting to room...');
                
                // Connect to the host with timeout
                console.log('Creating connection to room...');
                const conn = this.peer.connect(roomId);
                console.log('Connection object created:', conn);
                console.log('Waiting for connection open event...');
                
                // Connection timeout (8 seconds for mobile)
                const connTimeout = setTimeout(() => {
                    console.error('Connection to room failed within 8 seconds');
                    conn.close();
                    clearTimeout(overallTimeout);
                    alert('Failed to connect to room. The host might be offline or on a different network.');
                    this.showRoomList();
                }, 8000);
                
                conn.on('open', () => {
                    console.log('=== CONNECTION OPENED EVENT ===');
                    clearTimeout(connTimeout);
                    clearTimeout(overallTimeout);
                    console.log('Connected to room:', roomId);
                    console.log('Connection state:', conn.open);
                    this.updateLoadingStep('Joining room...');
                    
                    this.handleNewConnection(conn);
                    
                    // Send join request
                    console.log('Sending join request...');
                    conn.send({
                        type: 'join_request',
                        name: guestName,
                        peerId: id
                    });
                    console.log('Join request sent');
                });

                conn.on('error', (err) => {
                    clearTimeout(connTimeout);
                    clearTimeout(overallTimeout);
                    console.error('Connection error:', err);
                    console.log('Error details:', err.type, err.message);
                    alert(`Failed to join room: ${err.type || 'network error'}. This is common on mobile networks. Please try again.`);
                    this.showRoomList();
                });

                conn.on('close', () => {
                    console.log('Connection closed unexpectedly');
                    if (this.currentRoom) {
                        alert('Connection to room was lost.');
                        this.showRoomList();
                    }
                });
            });

            this.peer.on('call', (call) => {
                this.handleIncomingCall(call);
            });

            this.peer.on('error', (err) => {
                clearTimeout(overallTimeout);
                console.error('Peer error:', err);
                
                let errorMessage = 'Failed to join room. ';
                if (err.message && err.message.includes('Could not connect to peer')) {
                    if (retryCount < 2) {
                        console.log(`Retrying connection (${retryCount + 1}/2) due to peer connection failure...`);
                        setTimeout(() => {
                            this.connectToRoom(roomId, guestName, retryCount + 1);
                        }, 3000);
                        return;
                    }
                    errorMessage += 'The host has left or the room is no longer active. Please try a different room.';
                } else if (err.type === 'network') {
                    if (retryCount < 1) {
                        console.log(`Retrying connection due to network error...`);
                        setTimeout(() => {
                            this.connectToRoom(roomId, guestName, retryCount + 1);
                        }, 2000);
                        return;
                    }
                    errorMessage += 'Network connection failed. Please check your internet connection.';
                } else if (err.type === 'peer-unavailable') {
                    errorMessage += 'The room is not available or has ended.';
                } else if (err.type === 'browser-incompatible') {
                    errorMessage += 'Your browser does not support WebRTC. Please try a different browser.';
                } else {
                    errorMessage += `Error: ${err.type || 'connection failed'}. Please try again or use a different network.`;
                }
                
                alert(errorMessage);
                this.showRoomList();
            });

            this.peer.on('disconnected', () => {
                console.log('Peer disconnected');
                if (this.currentRoom) {
                    alert('Lost connection to the room.');
                    this.showRoomList();
                }
            });

        } catch (error) {
            clearTimeout(overallTimeout);
            console.error('Error joining room:', error);
            alert('Failed to join room. Please check your internet connection and try again.');
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

        // Remove from localStorage and Firebase if host
        if (this.isHost && this.currentRoom) {
            const rooms = this.getRoomsFromStorage();
            delete rooms[this.currentRoom];
            localStorage.setItem('ose_rooms', JSON.stringify(rooms));
            
            // Also remove from Firebase
            this.firebaseDB.deleteRoom(this.currentRoom);
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

async function showRoomList() {
    await app.showRoomList();
}

async function refreshRoomList() {
    await app.loadRoomList();
}

async function testFirebase() {
    console.log('=== Firebase 테스트 시작 ===');
    const firebaseDB = new FirebaseDB();
    
    try {
        const rooms = await firebaseDB.getRooms();
        alert('Firebase 테스트 결과: ' + JSON.stringify(rooms, null, 2));
        console.log('Firebase 테스트 성공:', rooms);
    } catch (error) {
        alert('Firebase 테스트 실패: ' + error.message);
        console.error('Firebase 테스트 실패:', error);
    }
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