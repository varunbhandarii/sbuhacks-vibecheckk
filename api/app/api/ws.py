# File: api/app/api/ws.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Path
import uuid

from app.websocket_manager import manager

router = APIRouter()

@router.websocket("/vibe/{target_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    target_id: uuid.UUID = Path(..., description="The event or space ID to subscribe to")
):
    """
    WebSocket endpoint for real-time vibe updates.
    
    Clients connect to this endpoint, e.g.,
    /ws/vibe/a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890
    
    When a new vibe is POSTed for this target_id,
    the server will broadcast a VibeSummary JSON to this client.
    """
    str_target_id = str(target_id)
    await manager.connect(websocket, str_target_id)
    
    try:
        # Keep the connection alive, listening for disconnections
        while True:
            # We are only broadcasting, not receiving,
            # but this await keeps the connection open.
            await websocket.receive_text() 
            # You could add logic here, e.g., client pings
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, str_target_id)
    except Exception as e:
        print(f"Error in WebSocket for {str_target_id}: {e}")
        manager.disconnect(websocket, str_target_id)

@router.websocket("/chat/{channel}")
async def websocket_chat_endpoint(
    websocket: WebSocket,
    channel: str = Path(..., description="The chat channel to subscribe to (e.g., 'global' or 'event:uuid')")
):
    """
    WebSocket endpoint for real-time CHAT messages.
    """
    await manager.connect(websocket, channel)
    
    try:
        # Keep the connection alive, listening for disconnections
        while True:
            # We are only broadcasting, not receiving
            await websocket.receive_text()
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)
    except Exception as e:
        print(f"Error in Chat WebSocket for {channel}: {e}")
        manager.disconnect(websocket, channel)