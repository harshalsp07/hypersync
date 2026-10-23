package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"github.com/hypersync/server-go/pkg/room"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  16 * 1024,
	WriteBufferSize: 16 * 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all CORS in development / production with proxy
	},
}

func randomID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func parseUserFromToken(token string) (userID, username string) {
	// Dev token format: "token-{username}-{timestamp}" or "dev-token"
	if strings.HasPrefix(token, "token-") {
		parts := strings.Split(token, "-")
		if len(parts) >= 2 {
			return "user-" + parts[1], parts[1]
		}
	}
	if token == "dev-token" || token == "" {
		id := randomID()
		return "user-" + id[:6], "guest-" + id[:4]
	}

	// Default fallback
	id := randomID()
	return "user-" + id[:6], token
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	host := os.Getenv("HOST")
	if host == "" {
		host = "0.0.0.0"
	}
	corsOrigin := os.Getenv("CORS_ORIGIN")
	if corsOrigin == "" {
		corsOrigin = "*"
	}

	addr := fmt.Sprintf("%s:%s", host, port)
	manager := room.NewManager()

	mux := http.NewServeMux()

	// Health check endpoint
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", corsOrigin)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":      "ok",
			"engine":      "hypersync-go-core",
			"connections": manager.TotalConnections(),
			"timestamp":   time.Now().UnixMilli(),
		})
	})

	// WebSocket endpoint
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		token := r.URL.Query().Get("token")
		roomID := r.URL.Query().Get("room")

		userID, username := parseUserFromToken(token)

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("[WS Upgrade] Error: %v", err)
			return
		}

		connID := randomID()
		client := room.NewClient(connID, userID, username, conn, manager)
		manager.Register(client)

		log.Printf("[WS Connect] Client %s (%s, user=%s) connected", connID, username, userID)

		// Auto-join room if requested in query parameter
		if roomID != "" {
			manager.JoinRoom(client, roomID)
		}

		go client.WritePump()
		go client.ReadPump()
	})

	server := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("⚡ HyperSync High-Performance Go Core listening on http://%s", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server listen error: %v", err)
		}
	}()

	<-stop
	log.Println("Shutting down HyperSync Go Core...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}
	log.Println("HyperSync Go Core gracefully stopped.")
}
