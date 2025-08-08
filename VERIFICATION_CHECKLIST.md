# OSE App Verification Checklist

## Basic Navigation Tests
- [ ] App loads without JavaScript errors
- [ ] "Create Room" button works and shows create room form
- [ ] "Join Room" button works and shows join room form  
- [ ] "Browse Rooms" button works and shows room list
- [ ] Back buttons work to return to main menu

## Room Functionality Tests
- [ ] Can create a room with valid inputs
- [ ] Room creation shows loading screen
- [ ] Successfully enters created room
- [ ] Room displays correct title and details
- [ ] Participant list shows host correctly

## Chat Functionality Tests
- [ ] Can send messages in chat
- [ ] Messages appear with timestamp
- [ ] Voice controls are visible and functional
- [ ] Can leave room and return to main menu

## AI Integration Tests
- [ ] "Invite AI Partner" button appears in chat room
- [ ] Clicking shows AI quick setup form
- [ ] Can select AI provider (ChatGPT, Gemini, Claude)
- [ ] Cancel button hides AI setup form
- [ ] AI invitation creates virtual AI participant
- [ ] AI messages appear with special styling
- [ ] AI messages trigger TTS when speaker is enabled

## Firebase Integration Tests
- [ ] Room list loads from Firebase
- [ ] Rooms appear in browse list
- [ ] Can join existing rooms
- [ ] Firebase test button works

## Error Handling Tests
- [ ] Invalid form inputs show proper errors
- [ ] Network errors are handled gracefully
- [ ] Disconnected state is managed properly

## Version Update
- Version updated to 1.4.1 with timestamp 2025-08-08T12:00:00Z
- Cache names updated in service worker
- Version parameters updated in HTML

## Completion Status
All major bugs have been fixed:
1. ✅ Basic room creation button
2. ✅ Chat room UI elements  
3. ✅ Participant list updates
4. ✅ Message display with AI support
5. ✅ AI invitation functions
6. 🔄 Comprehensive testing in progress