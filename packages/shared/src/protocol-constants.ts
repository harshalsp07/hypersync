export const PROTOCOL_VERSION = 1;

export enum MessageType {
  CRDT_SYNC = 0x00,
  AWARENESS = 0x01,
  VIDEO_SYNC = 0x02,
  WHITEBOARD = 0x03,
  WEBRTC_SIGNAL = 0x04,
  ROOM_MGMT = 0x05,
  E2EE_BLOB = 0x06,
  TIME_TRAVEL = 0x07,
  CONTROL = 0xff,
}

export enum MessageFlags {
  NONE = 0,
  ENCRYPTED = 1 << 0,
  COMPRESSED = 1 << 1,
  FRAGMENTED = 1 << 2,
}

export enum CRDTSubType {
  SYNC_STEP_1 = 0x00,
  SYNC_STEP_2 = 0x01,
  UPDATE = 0x02,
}

export enum ControlSubType {
  HEARTBEAT_PING = 0x00,
  HEARTBEAT_PONG = 0x01,
  ERROR = 0x02,
  RATE_LIMITED = 0x03,
}

export enum RoomSubType {
  JOIN = 0x00,
  LEAVE = 0x01,
  MEMBER_LIST = 0x02,
  PERMISSIONS = 0x03,
}
