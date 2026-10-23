package room

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/hypersync/server-go/pkg/protocol"
)

type SignalingMessage struct {
	Type string      `json:"type"`
	From string      `json:"from"`
	To   string      `json:"to"`
	Data interface{} `json:"data"`
}

type Manager struct {
	rooms   map[string]*Room
	clients map[string]*Client
	mu      sync.RWMutex
}

func NewManager() *Manager {
	return &Manager{
		rooms:   make(map[string]*Room),
		clients: make(map[string]*Client),
	}
}

func (m *Manager) Register(c *Client) {
	m.mu.Lock()
	m.clients[c.ID] = c
	m.mu.Unlock()
}

func (m *Manager) Unregister(c *Client) {
	m.mu.Lock()
	delete(m.clients, c.ID)
	rID := c.RoomID
	m.mu.Unlock()

	if rID != "" {
		m.LeaveRoom(c, rID)
	}
}

func (m *Manager) GetOrCreateRoom(roomID string) *Room {
	m.mu.Lock()
	defer m.mu.Unlock()

	r, exists := m.rooms[roomID]
	if !exists {
		r = NewRoom(roomID)
		m.rooms[roomID] = r
		log.Printf("[Manager] Created room: %s", roomID)
	}
	return r
}

func (m *Manager) JoinRoom(c *Client, roomID string) {
	r := m.GetOrCreateRoom(roomID)
	r.AddClient(c)
	log.Printf("[Manager] Client %s (%s) joined room %s", c.ID, c.Username, roomID)
}

func (m *Manager) LeaveRoom(c *Client, roomID string) {
	m.mu.Lock()
	r, exists := m.rooms[roomID]
	m.mu.Unlock()

	if exists {
		r.RemoveClient(c)
		log.Printf("[Manager] Client %s left room %s", c.ID, roomID)
	}
}

func (m *Manager) HandleMessage(c *Client, data []byte) {
	msgType, flags, payload, ok := protocol.DecodeFrame(data)
	if !ok {
		return
	}

	switch msgType {
	case protocol.MsgCRDTSync:
		m.handleCRDT(c, payload, flags)

	case protocol.MsgAwareness:
		m.handleAwareness(c, payload)

	case protocol.MsgVideoSync:
		m.handleVideoSync(c, payload)

	case protocol.MsgWebRTCSignal:
		m.handleWebRTCSignal(c, payload)

	case protocol.MsgWhiteboard:
		m.handleWhiteboard(c, payload)

	case protocol.MsgRoomMgmt:
		m.handleRoomMgmt(c, payload)

	case protocol.MsgControl:
		m.handleControl(c, payload)

	default:
		log.Printf("[Manager] Unknown message type: 0x%02x", msgType)
	}
}

func (m *Manager) handleCRDT(c *Client, payload []byte, flags byte) {
	if len(payload) < 1 || c.RoomID == "" {
		return
	}
	subType := payload[0]
	data := payload[1:]

	m.mu.RLock()
	r, exists := m.rooms[c.RoomID]
	m.mu.RUnlock()
	if !exists {
		return
	}

	frame := protocol.EncodeFrame(protocol.MsgCRDTSync, flags, payload)

	switch subType {
	case protocol.CRDTSyncStep1:
		// Client requested sync step 1
		r.ReplayCRDT(c)
	case protocol.CRDTSyncStep2, protocol.CRDTUpdate:
		r.RecordCRDTUpdate(data)
		r.Broadcast(frame, c.ID)
	}
}

func (m *Manager) handleAwareness(c *Client, payload []byte) {
	if c.RoomID == "" {
		return
	}
	m.mu.RLock()
	r, exists := m.rooms[c.RoomID]
	m.mu.RUnlock()
	if !exists {
		return
	}

	frame := protocol.EncodeFrame(protocol.MsgAwareness, 0, payload)
	r.Broadcast(frame, c.ID)
}

func (m *Manager) handleVideoSync(c *Client, payload []byte) {
	if c.RoomID == "" {
		return
	}
	m.mu.RLock()
	r, exists := m.rooms[c.RoomID]
	m.mu.RUnlock()
	if !exists {
		return
	}

	frame := protocol.EncodeFrame(protocol.MsgVideoSync, 0, payload)
	r.Broadcast(frame, c.ID)
}

func (m *Manager) handleWhiteboard(c *Client, payload []byte) {
	if c.RoomID == "" {
		return
	}
	m.mu.RLock()
	r, exists := m.rooms[c.RoomID]
	m.mu.RUnlock()
	if !exists {
		return
	}

	frame := protocol.EncodeFrame(protocol.MsgWhiteboard, 0, payload)
	r.Broadcast(frame, c.ID)
}

func (m *Manager) handleWebRTCSignal(c *Client, payload []byte) {
	if c.RoomID == "" {
		return
	}

	var sig SignalingMessage
	if err := json.Unmarshal(payload, &sig); err != nil {
		log.Printf("[Signaling] JSON parse error: %v", err)
		return
	}

	sig.From = c.UserID

	m.mu.RLock()
	r, exists := m.rooms[c.RoomID]
	m.mu.RUnlock()
	if !exists {
		return
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	encoded, err := json.Marshal(sig)
	if err != nil {
		return
	}
	frame := protocol.EncodeFrame(protocol.MsgWebRTCSignal, 0, encoded)

	// Route to specific target peer
	for _, peer := range r.Clients {
		if peer.UserID == sig.To {
			peer.SafeSend(frame)
			return
		}
	}
}

func (m *Manager) handleRoomMgmt(c *Client, payload []byte) {
	if len(payload) < 1 {
		return
	}
	subType := payload[0]
	data := payload[1:]

	switch subType {
	case protocol.RoomJoin:
		roomID := string(data)
		m.JoinRoom(c, roomID)
	case protocol.RoomLeave:
		if c.RoomID != "" {
			m.LeaveRoom(c, c.RoomID)
		}
	}
}

func (m *Manager) handleControl(c *Client, payload []byte) {
	if len(payload) < 1 {
		return
	}
	if payload[0] == protocol.ControlPing {
		pongFrame := protocol.EncodeFrame(protocol.MsgControl, 0, []byte{protocol.ControlPong})
		c.SafeSend(pongFrame)
	}
}

func (m *Manager) TotalConnections() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.clients)
}
