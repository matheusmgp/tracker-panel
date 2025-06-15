import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { SgiApiService } from '../../../services/sgi-api.service';

@Component({
  selector: 'app-socket-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './socket-panel.component.html',
  styleUrls: ['./socket-panel.component.css'],
})
export class SocketPanelComponent implements OnInit, OnDestroy {
  private socket: WebSocket | null = null;
  private connectionStatusSubject = new BehaviorSubject<ConnectionInfo>({
    status: false,
  });
  private messagesSubject = new BehaviorSubject<TrackerMessage[]>([]);
  public selectedTrackerInfo = new BehaviorSubject<TrackerInfo | null>(null);
  public inputValue: string = '';

  // Observables públicos
  public connectionStatus$ = this.connectionStatusSubject.asObservable();
  public messages$ = this.messagesSubject.asObservable();
  public activeTab: 'suntech' | 'obd' = 'suntech';
  public selectedTrackerInfo$ = this.selectedTrackerInfo.asObservable();

  // Observable para o termo de pesquisa
  private searchTermSubject = new BehaviorSubject<string>('');
  public searchTerm$ = this.searchTermSubject.asObservable();

  // Observables filtrados para cada aba com pesquisa
  public suntechMessages$ = combineLatest([
    this.messages$.pipe(
      map((messages) =>
        messages.filter((msg) => msg.event.startsWith('SUNTECH'))
      )
    ),
    this.searchTerm$,
  ]).pipe(
    map(([messages, searchTerm]) => {
      if (!searchTerm) return messages;
      const term = searchTerm.toLowerCase();
      return messages.filter(
        (msg) =>
          msg.event.toLowerCase().includes(term) ||
          msg.data.toLowerCase().includes(term) ||
          msg.timestamp.toLowerCase().includes(term)
      );
    })
  );

  public obdMessages$ = combineLatest([
    this.messages$.pipe(
      map((messages) => messages.filter((msg) => msg.event.startsWith('OBD')))
    ),
    this.searchTerm$,
  ]).pipe(
    map(([messages, searchTerm]) => {
      if (!searchTerm) return messages;
      const term = searchTerm.toLowerCase();
      return messages.filter(
        (msg) =>
          msg.event.toLowerCase().includes(term) ||
          msg.data.toLowerCase().includes(term) ||
          msg.timestamp.toLowerCase().includes(term)
      );
    })
  );

  private readonly wsUrl = 'ws://localhost:3001';

  constructor(private sgiApiService: SgiApiService) {}

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

  public clearMessages(): void {
    console.log('Limpando lista de mensagens...');
    this.messagesSubject.next([]);
  }

  async getTrackerInfo(serialNumber: string): Promise<void> {
    try {
      this.sgiApiService.getInfoBySerial(serialNumber).subscribe({
        next: (response) => {
          if (response) {
            this.selectedTrackerInfo.next(response.data as TrackerInfo);
          }
        },
        error: (error) => {
          console.error('Erro ao buscar informações do tracker:', error);
          this.selectedTrackerInfo.next(null);
        },
      });
    } catch (error) {
      console.error('Erro ao buscar informações do tracker:', error);
      this.selectedTrackerInfo.next(null);
    }
  }

  onClickSeeInfo(message: TrackerMessage): void {
    const serialNumber = message.data.split(';')[1];
    if (serialNumber) {
      this.getTrackerInfo(serialNumber);
    }
  }

  // Método para atualizar o termo de pesquisa
  onSearchChange(value: string): void {
    this.searchTermSubject.next(value);
  }
}
