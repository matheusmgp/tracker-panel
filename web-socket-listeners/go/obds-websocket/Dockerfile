# Estágio de build
FROM golang:1.24.4-alpine as builder

WORKDIR /app

# Instalar dependências do sistema necessárias
RUN apk add --no-cache git ca-certificates

# Copiar arquivos de dependências
COPY go.mod go.sum ./

# Instalar dependências
RUN go mod download

# Copiar o código fonte
COPY . .

# Definir variáveis de ambiente para compilação Linux
ENV GOOS=linux
ENV GOARCH=amd64
ENV CGO_ENABLED=0

# Compilar o serviço (assumindo que o arquivo principal é o paste.txt)
# Renomeie conforme necessário
RUN go build -ldflags="-w -s" -o websocket-bridge obds.go

# Estágio de produção
FROM alpine:latest

# Instalar certificados CA para conexões HTTPS (caso necessário)
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Copiar o binário compilado
COPY --from=builder /app/websocket-bridge /app/

# Dar permissões adequadas
RUN chown -R appuser:appgroup /app && \
    chmod +x /app/websocket-bridge

# Expor as portas necessárias
EXPOSE 3003 5000

# Variáveis de ambiente padrão (matching your Go code)
ENV HOST=0.0.0.0
ENV TCP_PORT=5000
ENV WS_PORT=3003

# Trocar para usuário não-root
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3003/health || exit 1

# Comando para iniciar o serviço
CMD ["/app/websocket-bridge"]