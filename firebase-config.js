// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDummy-Key-For-Demo-Replace-With-Real",
    authDomain: "ose-demo.firebaseapp.com", 
    databaseURL: "https://ose-demo-default-rtdb.firebaseio.com",
    projectId: "ose-demo",
    storageBucket: "ose-demo.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};

// Simple Firebase Database API wrapper (no SDK needed)
class FirebaseDB {
    constructor() {
        this.baseUrl = 'https://ose-realtime-default-rtdb.firebaseio.com';
    }

    async saveRoom(roomId, roomData) {
        try {
            const response = await fetch(`${this.baseUrl}/rooms/${roomId}.json`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(roomData)
            });
            return response.ok;
        } catch (error) {
            console.log('Firebase save failed, using local only:', error);
            return false;
        }
    }

    async getRooms() {
        try {
            const response = await fetch(`${this.baseUrl}/rooms.json`);
            if (response.ok) {
                const data = await response.json();
                return data || {};
            }
            return {};
        } catch (error) {
            console.log('Firebase load failed, using local only:', error);
            return {};
        }
    }

    async deleteRoom(roomId) {
        try {
            const response = await fetch(`${this.baseUrl}/rooms/${roomId}.json`, {
                method: 'DELETE'
            });
            return response.ok;
        } catch (error) {
            console.log('Firebase delete failed:', error);
            return false;
        }
    }

    async updateRoomActivity(roomId, participants) {
        try {
            const response = await fetch(`${this.baseUrl}/rooms/${roomId}/lastActive.json`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(Date.now())
            });
            
            if (response.ok) {
                await fetch(`${this.baseUrl}/rooms/${roomId}/currentParticipants.json`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(participants)
                });
            }
            
            return response.ok;
        } catch (error) {
            console.log('Firebase update failed:', error);
            return false;
        }
    }
}

// Export for use in app.js
window.FirebaseDB = FirebaseDB;