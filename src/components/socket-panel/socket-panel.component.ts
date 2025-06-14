import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface TrackerMessage {
  timestamp: string;
  event: string;
  data: string;
}

interface ConnectionInfo {
  status: boolean;
  connectedAt?: string;
  disconnectedAt?: string;
}

@Component({
  selector: 'app-socket-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './socket-panel.component.html',
  styleUrls: ['./socket-panel.component.css'],
})
export class SocketPanelComponent implements OnInit, OnDestroy {
  private socket: WebSocket | null = null;
  private connectionStatusSubject = new BehaviorSubject<ConnectionInfo>({
    status: false,
  });
  private messagesSubject = new BehaviorSubject<TrackerMessage[]>([]);

  // Observables públicos
  public connectionStatus$ = this.connectionStatusSubject.asObservable();
  public messages$ = this.messagesSubject.asObservable();
  public activeTab: 'suntech' | 'obd' = 'suntech';

  // Observables filtrados para cada aba
  public suntechMessages$ = this.messages$.pipe(
    map((messages) => messages.filter((msg) => msg.event.startsWith('SUNTECH')))
  );

  public obdMessages$ = this.messages$.pipe(
    map((messages) => messages.filter((msg) => msg.event.startsWith('OBD')))
  );

  private readonly wsUrl = 'ws://localhost:3001';

  constructor() {}

  ngOnInit() {
    console.log('Iniciando componente SocketPanel...');
    this.connectWebSocket();
  }

  ngOnDestroy() {
    console.log('Destruindo componente SocketPanel...');
    this.disconnectWebSocket();
  }

  connectWebSocket(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('WebSocket já está conectado');
      return;
    }

    try {
      console.log('Tentando conectar ao WebSocket em:', this.wsUrl);
      this.socket = new WebSocket(this.wsUrl);

      this.socket.onopen = () => {
        console.log('✅ WebSocket conectado com sucesso');
        this.connectionStatusSubject.next({
          status: true,
          connectedAt: new Date().toISOString(),
          disconnectedAt: undefined,
        });
      };

      this.socket.onmessage = (event) => {
        try {
          console.log('📩 Dados brutos recebidos:', event.data);
          const data = JSON.parse(event.data);
          console.log('📩 Dados processados:', data);

          const currentMessages = this.messagesSubject.value;
          const newMessage: TrackerMessage = {
            timestamp: data.timestamp,
            event: data.event,
            data: data.data,
          };

          console.log('📝 Nova mensagem:', newMessage);
          this.messagesSubject.next([newMessage, ...currentMessages]);
        } catch (error) {
          console.error('❌ Erro ao processar dados do WebSocket:', error);
        }
      };

      this.socket.onclose = (event) => {
        console.log(
          '🔌 WebSocket desconectado. Código:',
          event.code,
          'Motivo:',
          event.reason
        );
        const currentStatus = this.connectionStatusSubject.value;
        if (!currentStatus.disconnectedAt) {
          this.connectionStatusSubject.next({
            status: false,
            connectedAt: currentStatus.connectedAt,
            disconnectedAt: new Date().toISOString(),
          });
        } else {
          this.connectionStatusSubject.next({
            status: false,
            connectedAt: currentStatus.connectedAt,
            disconnectedAt: currentStatus.disconnectedAt,
          });
        }

        setTimeout(() => {
          console.log('🔄 Tentando reconectar...');
          this.connectWebSocket();
        }, 3000);
      };

      this.socket.onerror = (error) => {
        console.error('❌ Erro no WebSocket:', error);
        const currentStatus = this.connectionStatusSubject.value;
        if (!currentStatus.disconnectedAt) {
          this.connectionStatusSubject.next({
            status: false,
            connectedAt: currentStatus.connectedAt,
            disconnectedAt: new Date().toISOString(),
          });
        } else {
          this.connectionStatusSubject.next({
            status: false,
            connectedAt: currentStatus.connectedAt,
            disconnectedAt: currentStatus.disconnectedAt,
          });
        }
      };
    } catch (error) {
      console.error('❌ Erro ao criar WebSocket:', error);
      const currentStatus = this.connectionStatusSubject.value;
      if (!currentStatus.disconnectedAt) {
        this.connectionStatusSubject.next({
          status: false,
          connectedAt: currentStatus.connectedAt,
          disconnectedAt: new Date().toISOString(),
        });
      } else {
        this.connectionStatusSubject.next({
          status: false,
          connectedAt: currentStatus.connectedAt,
          disconnectedAt: currentStatus.disconnectedAt,
        });
      }
    }
  }

  disconnectWebSocket(): void {
    if (this.socket) {
      console.log('Desconectando WebSocket...');
      this.socket.close();
      this.socket = null;
      const currentStatus = this.connectionStatusSubject.value;
      if (!currentStatus.disconnectedAt) {
        this.connectionStatusSubject.next({
          status: false,
          connectedAt: currentStatus.connectedAt,
          disconnectedAt: new Date().toISOString(),
        });
      } else {
        this.connectionStatusSubject.next({
          status: false,
          connectedAt: currentStatus.connectedAt,
          disconnectedAt: currentStatus.disconnectedAt,
        });
      }
    }
  }

  reloadPage(): void {
    window.location.reload();
  }
}
