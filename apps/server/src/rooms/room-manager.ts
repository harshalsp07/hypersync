import { createChildLogger } from "../utils/logger.js";
import { Room } from "./room.js";
import type { Connection } from "../transport/connection.js";

const log = createChildLogger("room-manager");

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  getOrCreateRoom(roomId: string): Room {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new Room(roomId);
      this.rooms.set(roomId, room);
    }
    return room;
  }

  joinRoom(conn: Connection, roomId: string) {
    if (conn.roomId) {
      this.leaveRoom(conn);
    }

    const room = this.getOrCreateRoom(roomId);
    const added = room.addMember(conn);

    if (!added) {
      conn.sendError("Room is full");
      return;
    }

    conn.roomId = roomId;
  }

  leaveRoom(conn: Connection) {
    if (!conn.roomId) return;

    const room = this.rooms.get(conn.roomId);
    if (room) {
      room.removeMember(conn);

      if (room.isEmpty()) {
        room.destroy();
        this.rooms.delete(conn.roomId);
        log.info({ roomId: conn.roomId }, "Room destroyed (empty)");
      }
    }

    conn.roomId = null;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getRoomCount(): number {
    return this.rooms.size;
  }
}
