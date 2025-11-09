# File: api/app/websocket_manager.py
from fastapi import WebSocket
from collections import defaultdict
import json
import uuid

class ConnectionManager:
    """
    Manages active WebSocket connections in "rooms" based on target_id.
    """
    def __init__(self):
        # active_connections maps:
        # target_id (str) -> List[WebSocket]
        self.active_connections: defaultdict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, websocket: WebSocket, target_id: str | uuid.UUID):
        """Accept a new WebSocket connection."""
        await websocket.accept()
        self.active_connections[str(target_id)].append(websocket)
        print(f"Client connected to room: {target_id}")

    def disconnect(self, websocket: WebSocket, target_id: str | uuid.UUID):
        """Disconnect a WebSocket."""
        try:
            self.active_connections[str(target_id)].remove(websocket)
            print(f"Client disconnected from room: {target_id}")
        except ValueError:
            # Client might already be gone
            pass

    async def broadcast(self, target_id: str | uuid.UUID, data: dict):
        """Broadcast a JSON message to all clients in a room."""
        str_target_id = str(target_id)
        
        # We'll send the raw dictionary, and FastAPI's send_json will dump it
        message = data
        
        # Iterate over a copy in case of disconnections
        for connection in list(self.active_connections[str_target_id]):
            try:
                await connection.send_json(message)
            except (RuntimeError, ConnectionError):
                # Client disconnected uncleanly
                self.disconnect(connection, str_target_id)

# Create a single, shared instance for the whole application
manager = ConnectionManager()