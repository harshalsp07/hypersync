package protocol

const (
	ProtocolVersion = 1

	// MessageType defines top-level message categories
	MsgCRDTSync    byte = 0x00
	MsgAwareness   byte = 0x01
	MsgVideoSync   byte = 0x02
	MsgWhiteboard  byte = 0x03
	MsgWebRTCSignal byte = 0x04
	MsgRoomMgmt    byte = 0x05
	MsgE2EEBlob    byte = 0x06
	MsgTimeTravel  byte = 0x07
	MsgControl     byte = 0xff

	// Flags
	FlagNone       byte = 0
	FlagEncrypted  byte = 1 << 0
	FlagCompressed byte = 1 << 1
	FlagFragmented byte = 1 << 2

	// CRDT SubTypes
	CRDTSyncStep1 byte = 0x00
	CRDTSyncStep2 byte = 0x01
	CRDTUpdate    byte = 0x02

	// Room SubTypes
	RoomJoin       byte = 0x00
	RoomLeave      byte = 0x01
	RoomMemberList byte = 0x02
	RoomPermissions byte = 0x03

	// Control SubTypes
	ControlPing        byte = 0x00
	ControlPong        byte = 0x01
	ControlError       byte = 0x02
	ControlRateLimited byte = 0x03
)

// EncodeFrame wraps payload in HyperSync binary envelope [type, flags, payload...]
func EncodeFrame(msgType byte, flags byte, payload []byte) []byte {
	frame := make([]byte, 2+len(payload))
	frame[0] = msgType
	frame[1] = flags
	copy(frame[2:], payload)
	return frame
}

// DecodeFrame unwraps a HyperSync binary envelope
func DecodeFrame(data []byte) (msgType byte, flags byte, payload []byte, ok bool) {
	if len(data) < 2 {
		return 0, 0, nil, false
	}
	return data[0], data[1], data[2:], true
}
