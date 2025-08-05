// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDvwZ-NjJOOlEQcuQovNJkOL5JOTccxo9k",
    authDomain: "ose-language-exchange.firebaseapp.com",
    databaseURL: "https://ose-language-exchange-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ose-language-exchange",
    storageBucket: "ose-language-exchange.firebasestorage.app",
    messagingSenderId: "514447343512",
    appId: "1:514447343512:web:e6a08c68604df904adf5ed"
};

// Simple Firebase Database API wrapper (no SDK needed)
class FirebaseDB {
    constructor() {
        this.baseUrl = 'https://ose-language-exchange-default-rtdb.asia-southeast1.firebasedatabase.app';
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
            console.warn('Firebase response not OK:', response.status);
            return {};
        } catch (error) {
            console.warn('Firebase load failed, using local only:', error);
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