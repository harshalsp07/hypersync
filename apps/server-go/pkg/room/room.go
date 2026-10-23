package room

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/hypersync/server-go/pkg/protocol"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 16 * 1024 * 1024
	sendBufferSize = 256
)

// Client represents an active WebSocket connection
type Client struct {
	ID       string
	UserID   string
	Username string
	RoomID   string
	Conn     *websocket.Conn
	Send     chan []byte
	Manager  *Manager
	closed   bool
	mu       sync.Mutex
}

func NewClient(id, userId, username string, conn *websocket.Conn, manager *Manager) *Client {
	return &Client{
		ID:       id,
		UserID:   userId,
		Username: username,
		Conn:     conn,
		Send:     make(chan []byte, sendBufferSize),
		Manager:  manager,
	}
}

// ReadPump listens for incoming binary messages from the client
func (c *Client) ReadPump() {
	defer func() {
		c.Manager.Unregister(c)
		c.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		messageType, data, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[Client %s] Read error: %v", c.ID, err)
			}
			break
		}

		if messageType != websocket.BinaryMessage {
			continue
		}

		c.Manager.HandleMessage(c, data)
	}
}

// WritePump pumps messages from the send channel to the WebSocket connection
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.BinaryMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Drain any queued messages into the same write buffer for high throughput
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.closed {
		c.closed = true
		c.Conn.Close()
	}
}

// SafeSend drops messages if client buffer is saturated
func (c *Client) SafeSend(msg []byte) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return false
	}
	select {
	case c.Send <- msg:
		return true
	default:
		log.Printf("[Client %s] Send buffer full, dropping frame", c.ID)
		return false
	}
}

// Room represents a collaborative session
type Room struct {
	ID        string
	Clients   map[string]*Client
	Updates   [][]byte // CRDT update WAL in-memory
	mu        sync.RWMutex
	CreatedAt time.Time
}

func NewRoom(id string) *Room {
	return &Room{
		ID:        id,
		Clients:   make(map[string]*Client),
		Updates:   make([][]byte, 0),
		CreatedAt: time.Now(),
	}
}

func (r *Room) AddClient(c *Client) {
	r.mu.Lock()
	r.Clients[c.ID] = c
	c.RoomID = r.ID
	r.mu.Unlock()

	r.BroadcastMemberList()
	r.ReplayCRDT(c)
}

func (r *Room) RemoveClient(c *Client) {
	r.mu.Lock()
	delete(r.Clients, c.ID)
	c.RoomID = ""
	empty := len(r.Clients) == 0
	r.mu.Unlock()

	if !empty {
		r.BroadcastMemberList()
	}
}

func (r *Room) Broadcast(msg []byte, excludeClientID string) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for id, client := range r.Clients {
		if id != excludeClientID {
			client.SafeSend(msg)
		}
	}
}

func (r *Room) BroadcastMemberList() {
	r.mu.RLock()
	members := make([]map[string]string, 0, len(r.Clients))
	for _, client := range r.Clients {
		members = append(members, map[string]string{
			"id":       client.UserID,
			"username": client.Username,
		})
	}
	r.mu.RUnlock()

	data, err := json.Marshal(map[string]interface{}{"members": members})
	if err != nil {
		return
	}

	payload := append([]byte{protocol.RoomMemberList}, data...)
	frame := protocol.EncodeFrame(protocol.MsgRoomMgmt, 0, payload)

	r.Broadcast(frame, "")
}

func (r *Room) RecordCRDTUpdate(update []byte) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Updates = append(r.Updates, update)
}

func (r *Room) ReplayCRDT(c *Client) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, update := range r.Updates {
		payload := append([]byte{protocol.CRDTSyncStep2}, update...)
		frame := protocol.EncodeFrame(protocol.MsgCRDTSync, 0, payload)
		c.SafeSend(frame)
	}
}
