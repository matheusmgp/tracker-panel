const WebSocket = require("ws");
const net = require("net");

const TCP_PORT = 5000;
const WS_PORT = 3002;

// Criar servidor WebSocket
const wss = new WebSocket.Server({ port: WS_PORT });

wss.on("connection", (ws) => {
  console.log("✅ Cliente WebSocket conectado");

  ws.on("close", () => {
    console.log("❌ Cliente WebSocket desconectado");
  });

  ws.on("error", (error) => {
    console.error("❌ Erro no WebSocket:", error);
  });
});

// Função para broadcast para todos os clientes WebSocket conectados
const broadcastToWebSocket = (data) => {
  console.log("📤 Enviando para WebSocket:", data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      const serial = data.split(";")[1];
      const event = data.split(";")[0];
      client.send(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          event: `OBD - ${event} - ${serial}`,
          data: data,
        })
      );
      setTimeout(() => {
        client.send(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            event: `OBD - ${event} - ${serial}`,
            data: data,
          })
        );
      }, 5); // 10ms de delay
    }
  });
};

// Configuração do servidor que você quer conectar
const HOST = "127.0.0.1";
const PORT = 5000;

const client = new net.Socket();

client.connect(PORT, HOST, () => {
  console.log("✅ Conectado ao servidor. Aguardando mensagem...");
});

client.on("data", (data) => {
  const dataStr = data.toString();
  console.log("📩 Resposta do servidor:", dataStr);
  broadcastToWebSocket(dataStr);
});

client.on("close", () => {
  console.log("🔌 Conexão encerrada.");
});

client.on("error", (err) => {
  console.error("❌ Erro na conexão TCP:", err);
});

process.on("SIGINT", () => {
  console.log("\n⏹️ Parando o envio...");
  isConnected = false;
  client.destroy();
  process.exit();
});

console.log(`🚀 Servidor WebSocket iniciado na porta ${WS_PORT}`);
console.log(`🔌 Tentando conectar ao servidor TCP na porta ${PORT}...`);
