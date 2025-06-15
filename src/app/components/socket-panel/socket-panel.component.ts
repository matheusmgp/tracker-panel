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
  private suntechSocket: WebSocket | null = null;
  private obdSocket: WebSocket | null = null;
  private suntechConnectionStatusSubject = new BehaviorSubject<ConnectionInfo>({
    status: false,
  });
  private obdConnectionStatusSubject = new BehaviorSubject<ConnectionInfo>({
    status: false,
  });
  private messagesSubject = new BehaviorSubject<TrackerMessage[]>([]);
  public selectedTrackerInfo = new BehaviorSubject<TrackerInfo | null>(null);
  public inputValue: string = '';

  // Observables públicos
  public suntechConnectionStatus$ =
    this.suntechConnectionStatusSubject.asObservable();
  public obdConnectionStatus$ = this.obdConnectionStatusSubject.asObservable();
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

  public readonly suntechWsUrl = 'ws://localhost:3001';
  public readonly obdWsUrl = 'ws://localhost:3002';

  private selectedWebSocketInfoSubject = new BehaviorSubject<{
    type: 'suntech' | 'obd';
    status: boolean;
    connectedAt?: string;
    disconnectedAt?: string;
  } | null>(null);

  selectedWebSocketInfo$ = this.selectedWebSocketInfoSubject.asObservable();

  constructor(private sgiApiService: SgiApiService) {}

  ngOnInit() {
    console.log('Iniciando componente SocketPanel...');
    this.connectWebSockets();
  }

  ngOnDestroy() {
    console.log('Destruindo componente SocketPanel...');
    this.disconnectWebSockets();
  }

  connectWebSockets(): void {
    this.connectSuntechWebSocket();
    this.connectObdWebSocket();
  }

  connectSuntechWebSocket(): void {
    if (
      this.suntechSocket &&
      this.suntechSocket.readyState === WebSocket.OPEN
    ) {
      console.log('WebSocket Suntech já está conectado');
      return;
    }

    try {
      console.log(
        'Tentando conectar ao WebSocket Suntech em:',
        this.suntechWsUrl
      );
      this.suntechSocket = new WebSocket(this.suntechWsUrl);

      this.suntechSocket.onopen = () => {
        console.log('✅ WebSocket Suntech conectado com sucesso');
        this.updateSuntechConnectionStatus(true);
      };

      this.suntechSocket.onmessage = (event) =>
        this.handleWebSocketMessage(event, 'SUNTECH');

      this.suntechSocket.onclose = (event) => {
        console.log(
          '🔌 WebSocket Suntech desconectado. Código:',
          event.code,
          'Motivo:',
          event.reason
        );
        this.updateSuntechConnectionStatus(false);
        setTimeout(() => this.connectSuntechWebSocket(), 3000);
      };

      this.suntechSocket.onerror = (error) => {
        console.error('❌ Erro no WebSocket Suntech:', error);
        this.updateSuntechConnectionStatus(false);
      };
    } catch (error) {
      console.error('❌ Erro ao criar WebSocket Suntech:', error);
      this.updateSuntechConnectionStatus(false);
    }
  }

  connectObdWebSocket(): void {
    if (this.obdSocket && this.obdSocket.readyState === WebSocket.OPEN) {
      console.log('WebSocket OBD já está conectado');
      return;
    }

    try {
      console.log('Tentando conectar ao WebSocket OBD em:', this.obdWsUrl);
      this.obdSocket = new WebSocket(this.obdWsUrl);

      this.obdSocket.onopen = () => {
        console.log('✅ WebSocket OBD conectado com sucesso');
        this.updateObdConnectionStatus(true);
      };

      this.obdSocket.onmessage = (event) =>
        this.handleWebSocketMessage(event, 'OBD');

      this.obdSocket.onclose = (event) => {
        console.log(
          '🔌 WebSocket OBD desconectado. Código:',
          event.code,
          'Motivo:',
          event.reason
        );
        this.updateObdConnectionStatus(false);
        setTimeout(() => this.connectObdWebSocket(), 3000);
      };

      this.obdSocket.onerror = (error) => {
        console.error('❌ Erro no WebSocket OBD:', error);
        this.updateObdConnectionStatus(false);
      };
    } catch (error) {
      console.error('❌ Erro ao criar WebSocket OBD:', error);
      this.updateObdConnectionStatus(false);
    }
  }

  private handleWebSocketMessage(event: MessageEvent, prefix: string): void {
    try {
      console.log(`📩 Dados brutos recebidos (${prefix}):`, event.data);
      const data = JSON.parse(event.data);
      console.log(`📩 Dados processados (${prefix}):`, data);

      const currentMessages = this.messagesSubject.value;
      const newMessage: TrackerMessage = {
        timestamp: data.timestamp,
        event: `${prefix}_${data.event}`,
        data: data.data,
      };

      console.log('📝 Nova mensagem:', newMessage);
      this.messagesSubject.next([newMessage, ...currentMessages]);
    } catch (error) {
      console.error(
        `❌ Erro ao processar dados do WebSocket ${prefix}:`,
        error
      );
    }
  }

  private updateSuntechConnectionStatus(isConnected: boolean): void {
    const currentStatus = this.suntechConnectionStatusSubject.value;
    this.suntechConnectionStatusSubject.next({
      status: isConnected,
      connectedAt: isConnected
        ? new Date().toISOString()
        : currentStatus.connectedAt,
      disconnectedAt: isConnected ? undefined : new Date().toISOString(),
    });
  }

  private updateObdConnectionStatus(isConnected: boolean): void {
    const currentStatus = this.obdConnectionStatusSubject.value;
    this.obdConnectionStatusSubject.next({
      status: isConnected,
      connectedAt: isConnected
        ? new Date().toISOString()
        : currentStatus.connectedAt,
      disconnectedAt: isConnected ? undefined : new Date().toISOString(),
    });
  }

  disconnectWebSockets(): void {
    if (this.suntechSocket) {
      console.log('Desconectando WebSocket Suntech...');
      this.suntechSocket.close();
      this.suntechSocket = null;
      this.updateSuntechConnectionStatus(false);
    }

    if (this.obdSocket) {
      console.log('Desconectando WebSocket OBD...');
      this.obdSocket.close();
      this.obdSocket = null;
      this.updateObdConnectionStatus(false);
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

  clearSearch(): void {
    this.inputValue = '';
    this.searchTermSubject.next('');
  }

  showWebSocketInfo(type: 'suntech' | 'obd'): void {
    const status =
      type === 'suntech'
        ? this.suntechConnectionStatusSubject.value
        : this.obdConnectionStatusSubject.value;

    this.selectedWebSocketInfoSubject.next({
      type,
      status: status.status,
      connectedAt: status.connectedAt,
      disconnectedAt: status.disconnectedAt,
    });
  }

  closeWebSocketInfo(): void {
    this.selectedWebSocketInfoSubject.next(null);
  }
}
