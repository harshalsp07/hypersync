export type UserRole = "owner" | "admin" | "editor" | "viewer";

export interface User {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface Room {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdBy: string;
  roomType: "workspace" | "video-room" | "whiteboard" | "code-lab";
  maxParticipants: number;
  isEncrypted: boolean;
  isArchived: boolean;
  settings: RoomSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomSettings {
  allowAnonymous: boolean;
  defaultRole: UserRole;
  autoGarbageCollect: boolean;
  snapshotIntervalOps: number;
  snapshotIntervalSecs: number;
  maxHistoryDays: number;
}

export interface RoomMember {
  roomId: string;
  userId: string;
  role: UserRole;
  invitedBy?: string;
  joinedAt: Date;
  lastSeen?: Date;
}
