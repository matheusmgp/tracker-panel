package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
)

const (
	TCP_PORT = 5000
	WS_PORT  = 3001
	HOST     = "127.0.0.1"
)

type Message struct {
	Timestamp string `json:"timestamp"`
	Event     string `json:"event"`
	Data      string `json:"data"`
}

type Hub struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan []byte
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	HandshakeTimeout: 45 * time.Second,
}

func newHub() *Hub {
	return &Hub{
		clients:    make(map[*websocket.Conn]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			fmt.Printf("✅ Cliente WebSocket conectado. Total: %d\n", len(h.clients))

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
				fmt.Printf("❌ Cliente WebSocket desconectado. Total: %d\n", len(h.clients))
			}

		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case <-time.After(10 * time.Second):
					fmt.Println("⚠️ Timeout ao enviar mensagem para cliente")
					delete(h.clients, client)
					client.Close()
				default:
					client.SetWriteDeadline(time.Now().Add(10 * time.Second))
					err := client.WriteMessage(websocket.TextMessage, message)
					if err != nil {
						fmt.Printf("❌ Erro ao enviar mensagem: %v\n", err)
						delete(h.clients, client)
						client.Close()
					}
				}
			}
		}
	}
}

func (h *Hub) broadcastToWebSocket(data string) {
	fmt.Printf("📤 Enviando para WebSocket: %s\n", data)

	parts := strings.Split(data, ";")
	if len(parts) < 2 {
		fmt.Println("⚠️ Formato de dados inválido")
		return
	}

	event := parts[0]
	serial := parts[1]

	message := Message{
		Timestamp: time.Now().Format(time.RFC3339),
		Event:     fmt.Sprintf("SUNTECH - %s - %s", event, serial),
		Data:      data,
	}

	jsonData, err := json.Marshal(message)
	if err != nil {
		log.Printf("❌ Erro ao serializar JSON: %v", err)
		return
	}

	select {
	case h.broadcast <- jsonData:
		fmt.Println("✅ Mensagem enviada para broadcast")
	default:
		fmt.Println("⚠️ Canal de broadcast cheio, mensagem descartada")
	}
}

func (h *Hub) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	fmt.Printf("🔗 Nova tentativa de conexão WebSocket de: %s\n", r.RemoteAddr)

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("❌ Erro no upgrade WebSocket: %v", err)
		return
	}

	// Configurar timeouts iniciais
	conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	conn.SetWriteDeadline(time.Now().Add(10 * time.Second))

	// Configurar tamanho do buffer de leitura
	conn.SetReadLimit(512 * 1024) // 512KB

	h.register <- conn

	// Enviar mensagem de boas-vindas
	welcomeMsg := Message{
		Timestamp: time.Now().Format(time.RFC3339),
		Event:     "CONNECTION",
		Data:      "WebSocket conectado com sucesso",
	}
	welcomeJSON, _ := json.Marshal(welcomeMsg)
	conn.WriteMessage(websocket.TextMessage, welcomeJSON)

	// Goroutine para gerenciar a conexão
	go func() {
		defer func() {
			h.unregister <- conn
		}()

		// Configurar handler de pong
		conn.SetPongHandler(func(string) error {
			conn.SetReadDeadline(time.Now().Add(10 * time.Second))
			return nil
		})

		// Goroutine para ping periódico
		pingTicker := time.NewTicker(5 * time.Second)
		defer pingTicker.Stop()

		go func() {
			for {
				select {
				case <-pingTicker.C:
					conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
					if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
						return
					}
				}
			}
		}()

		// Loop principal de leitura
		for {
			conn.SetReadDeadline(time.Now().Add(10 * time.Second))
			_, _, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("❌ Erro no WebSocket: %v", err)
				} else {
					fmt.Println("🔌 Cliente desconectou normalmente")
				}
				break
			}
		}
	}()
}

func connectToTCPServer(hub *Hub) {
	fmt.Printf("🔌 Tentando conectar ao servidor TCP %s:%d...\n", HOST, TCP_PORT)

	conn, err := net.Dial("tcp", fmt.Sprintf("%s:%d", HOST, TCP_PORT))
	if err != nil {
		log.Printf("❌ Erro na conexão TCP: %v", err)
		return
	}

	fmt.Println("✅ Conectado ao servidor TCP. Aguardando mensagens...")

	conn.SetReadDeadline(time.Now().Add(10 * time.Second))

	buffer := make([]byte, 1024)

	for {
		conn.SetReadDeadline(time.Now().Add(10 * time.Second))
		n, err := conn.Read(buffer)
		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				continue
			}
			log.Printf("❌ Erro ao ler dados TCP: %v", err)
			break
		}

		dataStr := strings.TrimSpace(string(buffer[:n]))
		if dataStr != "" {
			fmt.Printf("📩 Dados recebidos do TCP: %s\n", dataStr)
			hub.broadcastToWebSocket(dataStr)
		}
	}

	conn.Close()
	fmt.Println("🔌 Conexão TCP encerrada.")
}

func main() {
	fmt.Println("🚀 Iniciando WebSocket Bridge...")

	hub := newHub()
	go hub.run()

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		hub.handleWebSocket(w, r)
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		response := map[string]interface{}{
			"status":     "ok",
			"timestamp":  time.Now().Format(time.RFC3339),
			"clients":    len(hub.clients),
			"tcp_port":   TCP_PORT,
			"ws_port":    WS_PORT,
		}
		json.NewEncoder(w).Encode(response)
	})

	go func() {
		fmt.Printf("🚀 Servidor WebSocket iniciado na porta %d\n", WS_PORT)
		fmt.Printf("🔗 WebSocket URL: ws://%s:%d\n", HOST, WS_PORT)
		fmt.Printf("🏥 Health check: http://%s:%d/health\n", HOST, WS_PORT)
		log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", WS_PORT), nil))
	}()

	go connectToTCPServer(hub)

	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	fmt.Println("✅ Servidor iniciado. Pressione Ctrl+C para parar.")
	<-c
	fmt.Println("\n⏹️ Parando o servidor...")
	os.Exit(0)
}