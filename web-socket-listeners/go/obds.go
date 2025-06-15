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
	WS_PORT  = 3002
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
		return true // Permite conexões de qualquer origem
	},
}

func newHub() *Hub {
	return &Hub{
		clients:    make(map[*websocket.Conn]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			fmt.Println("✅ Cliente WebSocket conectado")

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
				fmt.Println("❌ Cliente WebSocket desconectado")
			}

		case message := <-h.broadcast:
			for client := range h.clients {
				err := client.WriteMessage(websocket.TextMessage, message)
				if err != nil {
					delete(h.clients, client)
					client.Close()
				}
			}
		}
	}
}

func (h *Hub) broadcastToWebSocket(data string) {
	fmt.Printf("📤 Enviando para WebSocket: %s\n", data)

	parts := strings.Split(data, ";")
	if len(parts) < 2 {
		return
	}

	event := parts[0]
	serial := parts[1]

	message := Message{
		Timestamp: time.Now().Format(time.RFC3339),
		Event:     fmt.Sprintf("OBDS - %s - %s", event, serial),
		Data:      data,
	}

	jsonData, err := json.Marshal(message)
	if err != nil {
		log.Printf("❌ Erro ao serializar JSON: %v", err)
		return
	}

	select {
	case h.broadcast <- jsonData:
	default:
		log.Println("❌ Canal de broadcast bloqueado")
	}
}

func (h *Hub) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("❌ Erro no upgrade WebSocket: %v", err)
		return
	}

	h.register <- conn

	// Goroutine para lidar com mensagens do cliente (se necessário)
	go func() {
		defer func() {
			h.unregister <- conn
		}()

		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("❌ Erro no WebSocket: %v", err)
				}
				break
			}
		}
	}()
}

func connectToTCPServer(hub *Hub) {
	for {
		fmt.Printf("🔌 Tentando conectar ao servidor TCP na porta %d...\n", TCP_PORT)

		conn, err := net.Dial("tcp", fmt.Sprintf("%s:%d", HOST, TCP_PORT))
		if err != nil {
			log.Printf("❌ Erro na conexão TCP: %v", err)
			fmt.Println("🔄 Tentando reconectar em 5 segundos...")
			time.Sleep(5 * time.Second)
			continue
		}

		fmt.Println("✅ Conectado ao servidor. Aguardando mensagem...")

		// Buffer para ler dados
		buffer := make([]byte, 1024)

		for {
			n, err := conn.Read(buffer)
			if err != nil {
				log.Printf("❌ Erro ao ler dados TCP: %v", err)
				break
			}

			dataStr := string(buffer[:n])
			fmt.Printf("📩 Resposta do servidor: %s\n", dataStr)
			hub.broadcastToWebSocket(dataStr)
		}

		conn.Close()
		fmt.Println("🔌 Conexão encerrada.")
		fmt.Println("🔄 Tentando reconectar em 5 segundos...")
		time.Sleep(5 * time.Second)
	}
}

func main() {
	hub := newHub()
	go hub.run()

	// Configurar rota WebSocket
	http.HandleFunc("/ws", hub.handleWebSocket)

	// Iniciar servidor WebSocket
	go func() {
		fmt.Printf("🚀 Servidor WebSocket iniciado na porta %d\n", WS_PORT)
		log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", WS_PORT), nil))
	}()

	// Conectar ao servidor TCP
	go connectToTCPServer(hub)

	// Aguardar sinal de interrupção
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	<-c
	fmt.Println("\n⏹️ Parando o servidor...")
	os.Exit(0)
}