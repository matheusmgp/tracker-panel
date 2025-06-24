package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
)

const (
	TCP_PORT = 5000
	WS_PORT  = 3001
	HOST     = "0.0.0.0"

	// Configurações de reconexão
	MAX_RECONNECT_ATTEMPTS = 5
	INITIAL_RECONNECT_DELAY = 5 * time.Second
	MAX_RECONNECT_DELAY     = 60 * time.Second
	CONNECTION_TIMEOUT      = 30 * time.Second
	READ_TIMEOUT           = 300000 * time.Second
	WRITE_TIMEOUT          = 10 * time.Second
	PING_INTERVAL          = 30 * time.Second
)

type Message struct {
	Timestamp string `json:"timestamp"`
	Event     string `json:"event"`
	Data      string `json:"data"`
	Status    string `json:"status,omitempty"`
}

type Hub struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan []byte
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	mu         sync.RWMutex
	tcpConnected bool
}

type TCPClient struct {
	hub           *Hub
	conn          net.Conn
	reconnectAttempts int
	ctx           context.Context
	cancel        context.CancelFunc
	mu            sync.Mutex
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	HandshakeTimeout: 45 * time.Second,
	ReadBufferSize:   1024,
	WriteBufferSize:  1024,
}

func newHub() *Hub {
	return &Hub{
		clients:    make(map[*websocket.Conn]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
		tcpConnected: false,
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			clientCount := len(h.clients)
			h.mu.Unlock()

			fmt.Printf("✅ Cliente WebSocket conectado. Total: %d\n", clientCount)

			// Enviar status de conexão TCP para o novo cliente
			h.sendConnectionStatus(client)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
			}
			clientCount := len(h.clients)
			h.mu.Unlock()

			fmt.Printf("❌ Cliente WebSocket desconectado. Total: %d\n", clientCount)

		case message := <-h.broadcast:
			h.mu.RLock()
			clients := make([]*websocket.Conn, 0, len(h.clients))
			for client := range h.clients {
				clients = append(clients, client)
			}
			h.mu.RUnlock()

			// Enviar mensagem para todos os clientes
			for _, client := range clients {
				go h.sendToClient(client, message)
			}
		}
	}
}

func (h *Hub) sendToClient(client *websocket.Conn, message []byte) {
	client.SetWriteDeadline(time.Now().Add(WRITE_TIMEOUT))
	err := client.WriteMessage(websocket.TextMessage, message)
	if err != nil {
		fmt.Printf("❌ Erro ao enviar mensagem para cliente: %v\n", err)
		h.unregister <- client
	}
}

func (h *Hub) sendConnectionStatus(client *websocket.Conn) {
	h.mu.RLock()
	connected := h.tcpConnected
	h.mu.RUnlock()

	status := "disconnected"
	if connected {
		status = "connected"
	}

	message := Message{
		Timestamp: time.Now().Format(time.RFC3339),
		Event:     "tcp_status",
		Data:      fmt.Sprintf("TCP connection status: %s", status),
		Status:    status,
	}

	jsonData, _ := json.Marshal(message)
	go h.sendToClient(client, jsonData)
}

func (h *Hub) broadcastConnectionStatus(connected bool) {
	h.mu.Lock()
	h.tcpConnected = connected
	h.mu.Unlock()

	status := "disconnected"
	if connected {
		status = "connected"
	}

	message := Message{
		Timestamp: time.Now().Format(time.RFC3339),
		Event:     "tcp_status",
		Data:      fmt.Sprintf("TCP connection status: %s", status),
		Status:    status,
	}

	jsonData, _ := json.Marshal(message)

	select {
	case h.broadcast <- jsonData:
	default:
		fmt.Println("⚠️ Canal de broadcast cheio para status de conexão")
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
		Event:     fmt.Sprintf("%s - %s", event, serial),
		Data:      data,
		Status:    "data",
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

	conn.SetReadLimit(512 * 1024)
	h.register <- conn

	go func() {
		defer func() {
			h.unregister <- conn
		}()

		conn.SetPongHandler(func(string) error {
			conn.SetReadDeadline(time.Now().Add(READ_TIMEOUT))
			return nil
		})

		// Ping periódico
		pingTicker := time.NewTicker(PING_INTERVAL)
		defer pingTicker.Stop()

		go func() {
			for {
				select {
				case <-pingTicker.C:
					conn.SetWriteDeadline(time.Now().Add(WRITE_TIMEOUT))
					if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
						return
					}
				}
			}
		}()

		// Loop de leitura
		for {
			conn.SetReadDeadline(time.Now().Add(READ_TIMEOUT))
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

func newTCPClient(hub *Hub) *TCPClient {
	ctx, cancel := context.WithCancel(context.Background())
	return &TCPClient{
		hub:    hub,
		ctx:    ctx,
		cancel: cancel,
	}
}

func (tc *TCPClient) connect() error {
	tc.mu.Lock()
	defer tc.mu.Unlock()

	tcpHost := os.Getenv("HOST")
	if tcpHost == "" {
		tcpHost = HOST
	}

	address := fmt.Sprintf("%s:%d", tcpHost, TCP_PORT)
	fmt.Printf("🔌 Tentando conectar ao servidor TCP %s...\n", address)

	// Criar conexão com timeout
	dialer := &net.Dialer{
		Timeout: CONNECTION_TIMEOUT,
	}

	conn, err := dialer.DialContext(tc.ctx, "tcp", address)
	if err != nil {
		return fmt.Errorf("erro na conexão TCP: %v", err)
	}

	tc.conn = conn
	tc.reconnectAttempts = 0
	fmt.Println("✅ Conectado ao servidor TCP")

  _, err = conn.Write([]byte("PANEL\n"))
	if err != nil {
		log.Printf("❌ Erro ao enviar identificação PANEL: %v", err)
		tc.conn.Close()
		tc.conn = nil
		return fmt.Errorf("erro ao identificar como painel: %v", err)
	}
	fmt.Println("✅ Identificado como PANEL com sucesso")

	// Notificar clientes WebSocket sobre a conexão
	tc.hub.broadcastConnectionStatus(true)

	return nil
}

func (tc *TCPClient) disconnect() {
	tc.mu.Lock()
	defer tc.mu.Unlock()

	if tc.conn != nil {
		tc.conn.Close()
		tc.conn = nil
		fmt.Println("🔌 Desconectado do servidor TCP")
		tc.hub.broadcastConnectionStatus(false)
	}
}

func (tc *TCPClient) readLoop() {
	buffer := make([]byte, 1024)

	for {
		select {
		case <-tc.ctx.Done():
			return
		default:
		}

		tc.mu.Lock()
		conn := tc.conn
		tc.mu.Unlock()

		if conn == nil {
			return
		}

		conn.SetReadDeadline(time.Now().Add(READ_TIMEOUT))
		n, err := conn.Read(buffer)
		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				continue
			}
			log.Printf("❌ Erro ao ler dados TCP: %v", err)
			return
		}

		dataStr := string(buffer[:n])
    lines := strings.Split(dataStr, "\n")

    for _, line := range lines {
      line = strings.TrimSpace(line)
      if line == "" {
        continue
      }
      log.Printf("📩 Mensagem recebida do TCP: %s", line)
      tc.hub.broadcastToWebSocket(line)
    }
	}
}

func (tc *TCPClient) runWithReconnect() {
	for {
		select {
		case <-tc.ctx.Done():
			return
		default:
		}

		// Tentar conectar
		err := tc.connect()
		if err != nil {
			log.Printf("❌ %v", err)
			tc.handleReconnect()
			continue
		}

		// Executar loop de leitura
		tc.readLoop()

		// Desconectar e tentar reconectar
		tc.disconnect()
		tc.handleReconnect()
	}
}

func (tc *TCPClient) handleReconnect() {
	tc.reconnectAttempts++

	if tc.reconnectAttempts > MAX_RECONNECT_ATTEMPTS {
		fmt.Printf("❌ Máximo de tentativas de reconexão atingido (%d). Resetando contador.\n", MAX_RECONNECT_ATTEMPTS)
		tc.reconnectAttempts = 0
	}

	// Calcular delay exponencial
	delay := INITIAL_RECONNECT_DELAY * time.Duration(tc.reconnectAttempts)
	if delay > MAX_RECONNECT_DELAY {
		delay = MAX_RECONNECT_DELAY
	}

	fmt.Printf("🔄 Tentativa de reconexão %d em %v...\n", tc.reconnectAttempts, delay)

	select {
	case <-time.After(delay):
	case <-tc.ctx.Done():
		return
	}
}

func (tc *TCPClient) stop() {
	tc.cancel()
	tc.disconnect()
}

func main() {
	fmt.Println("🚀 Iniciando WebSocket Bridge...")

	hub := newHub()
	go hub.run()

	// Cliente TCP com reconexão automática
	tcpClient := newTCPClient(hub)
	go tcpClient.runWithReconnect()

	// Configurar rotas HTTP
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

	// Health check endpoint
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		hub.mu.RLock()
		clientCount := len(hub.clients)
		tcpConnected := hub.tcpConnected
		hub.mu.RUnlock()

		response := map[string]interface{}{
			"status":       "ok",
			"timestamp":    time.Now().Format(time.RFC3339),
			"clients":      clientCount,
			"tcp_port":     TCP_PORT,
			"ws_port":      WS_PORT,
			"tcp_connected": tcpConnected,
		}
		json.NewEncoder(w).Encode(response)
	})

	// Status endpoint detalhado
	http.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		hub.mu.RLock()
		clientCount := len(hub.clients)
		tcpConnected := hub.tcpConnected
		hub.mu.RUnlock()

		response := map[string]interface{}{
			"service":      "WebSocket Bridge",
			"version":      "2.0",
			"status":       "running",
			"timestamp":    time.Now().Format(time.RFC3339),
			"websocket": map[string]interface{}{
				"port":    WS_PORT,
				"clients": clientCount,
				"url":     fmt.Sprintf("ws://%s:%d", HOST, WS_PORT),
			},
			"tcp": map[string]interface{}{
				"host":      HOST,
				"port":      TCP_PORT,
				"connected": tcpConnected,
			},
		}
		json.NewEncoder(w).Encode(response)
	})

	// Iniciar servidor WebSocket
	go func() {
		fmt.Printf("🚀 Servidor WebSocket iniciado na porta %d\n", WS_PORT)
		fmt.Printf("🔗 WebSocket URL: ws://%s:%d\n", HOST, WS_PORT)
		fmt.Printf("🏥 Health check: http://%s:%d/health\n", HOST, WS_PORT)
		fmt.Printf("📊 Status: http://%s:%d/status\n", HOST, WS_PORT)
		log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", WS_PORT), nil))
	}()

	// Aguardar sinal de interrupção
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	fmt.Println("✅ Servidor iniciado. Pressione Ctrl+C para parar.")
	<-c
	fmt.Println("\n⏹️ Parando o servidor...")

	// Cleanup
	tcpClient.stop()

	os.Exit(0)
}
