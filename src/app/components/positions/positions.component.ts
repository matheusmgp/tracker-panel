import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PositionsApiService } from '../../services/positions-api.service';
import { SafePipe } from './safe.pipe';
import { interval, Subscription, timer } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { ApiResponse, PositionData } from './interfaces/positions.interfaces';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-positions',
  standalone: true,
  imports: [CommonModule, FormsModule, SafePipe],
  templateUrl: './positions.component.html',
  styleUrl: './positions.component.css',
})
export class PositionsComponent implements OnInit, OnDestroy {
  positions: PositionData[] = [];
  filteredPositions: PositionData[] = [];
  latestPositions: PositionData[] = [];
  searchTerm: string = '';
  loading = false;
  error: string | null = null;
  lastUpdate: string | null = null;
  showMapModal = false;
  selectedPosition: PositionData | null = null;
  mapUrl: string | null = null;
  quantity: number = 0;
  countdown: number = 0;
  private subscription: Subscription = new Subscription();
  private countdownSubscription: Subscription = new Subscription();

  private intervalTime: number = 10000;
  public isBrowser: boolean;
  public intervalTimeSeconds: number = 10;

  public statusOpen: { [id: number]: boolean } = {};
  public trackerOpen: { [id: number]: boolean } = {};

  constructor(
    private positionsApiService: PositionsApiService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.intervalTimeSeconds = this.intervalTime / 1000;
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      const savedInterval = localStorage.getItem('positions-interval-seconds');
      if (savedInterval) {
        this.intervalTimeSeconds = Number(savedInterval);
        this.intervalTime = this.intervalTimeSeconds * 1000;
      }
      this.startPolling();
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.countdownSubscription.unsubscribe();
  }

  private startPolling(): void {
    this.subscription.unsubscribe();
    this.countdownSubscription.unsubscribe();

    this.subscription = timer(0, this.intervalTime)
      .pipe(
        switchMap(() => {
          this.loading = true;
          return this.positionsApiService.getPositions();
        }),
        catchError((error) => {
          this.handleError(error);
          return of(null);
        })
      )
      .subscribe((response: ApiResponse | null) => {
        if (response) {
          this.handleSuccess(response);
        }
        this.resetCountdown();
      });
  }

  private resetCountdown(): void {
    this.countdownSubscription.unsubscribe();
    this.countdown = this.intervalTime / 1000;
    this.countdownSubscription = interval(1000).subscribe(() => {
      if (this.countdown > 0) {
        this.countdown--;
      }
    });
  }

  public loadPositions(): void {
    this.startPolling();
  }

  private handleSuccess(response: ApiResponse): void {
    this.loading = false;
    this.error = null;
    this.latestPositions = response.data.list;
    this.quantity = response.data.quantity || 0;
    if (!this.searchTerm.trim()) {
      this.positions = [...this.latestPositions];
      this.filteredPositions = [...this.latestPositions];
    }
    this.lastUpdate = new Date().toLocaleTimeString('pt-BR');
  }

  private handleError(error: any): void {
    this.loading = false;
    this.error = 'Erro ao carregar posições. Tente novamente.';
    console.error('Erro ao carregar posições:', error);
  }

  public getSpeedInKmh(speed: string): string {
    const speedValue = parseFloat(speed);
    return isNaN(speedValue) ? '0' : speedValue.toFixed(1);
  }

  public getFormattedDateTime(dateTime: string): string {
    return new Date(dateTime).toLocaleString('pt-BR');
  }

  public onSearchChange(): void {
    if (!this.searchTerm.trim()) {
      // Se o campo de pesquisa foi limpo, sincroniza com os dados mais recentes
      this.positions = [...this.latestPositions];
      this.filteredPositions = [...this.latestPositions];
    } else {
      // Enquanto estiver pesquisando, filtra sobre o array exibido atualmente
      const searchLower = this.searchTerm.toLowerCase().trim();
      this.filteredPositions = this.positions.filter((position) => {
        const board = position.jsonData.vehicledata.board?.toLowerCase() || '';
        const description =
          position.jsonData.vehicledata.description?.toLowerCase() || '';
        const clientName =
          position.jsonData.vehicledata.clientData.clientfantasy?.toLowerCase() ||
          '';
        const address = position.jsonData.address?.toLowerCase() || '';
        const trackerCode = position.jsonData.trackercode?.toString() || '';
        const equipment =
          position.jsonData.trackerdata.equipament?.toLowerCase() || '';

        return (
          board.includes(searchLower) ||
          description.includes(searchLower) ||
          clientName.includes(searchLower) ||
          address.includes(searchLower) ||
          trackerCode.includes(searchLower) ||
          equipment.includes(searchLower)
        );
      });
    }
  }

  public clearSearch(): void {
    this.searchTerm = '';
    this.positions = [...this.latestPositions];
    this.filteredPositions = [...this.latestPositions];
  }

  public openMapModal(position: PositionData): void {
    const lat = position?.jsonData?.latitude;
    const lon = position?.jsonData?.longitude;

    if (lat && lon) {
      this.selectedPosition = position;
      this.mapUrl = `https://maps.google.com/maps?q=${lat},${lon}&z=16&t=h&layer=t&hl=pt-BR&region=BR&output=embed`;
      this.showMapModal = true;
    } else {
      console.error('Latitude ou Longitude inválida para a posição:', position);
    }
  }

  public closeMapModal(): void {
    this.showMapModal = false;
    this.selectedPosition = null;
    this.mapUrl = null;
  }

  public onIntervalChange(): void {
    if (this.intervalTimeSeconds < 2) {
      this.intervalTimeSeconds = 2;
    }

    localStorage.setItem(
      'positions-interval-seconds',
      String(this.intervalTimeSeconds)
    );
    this.intervalTime = this.intervalTimeSeconds * 1000;
    this.startPolling();
  }

  // Métodos para interpretar inputsoutputs
  public getIgnitionStatus(inputsoutputs: string): {
    status: string;
    icon: string;
    class: string;
  } {
    if (!inputsoutputs || inputsoutputs.length < 1) {
      return {
        status: 'Desconhecido',
        icon: 'fas fa-question',
        class: 'unknown',
      };
    }

    const ignitionBit = inputsoutputs[0];

    if (ignitionBit === '1') {
      return { status: 'Ligada', icon: 'fas fa-power-off', class: 'on' };
    } else if (ignitionBit === '0') {
      return { status: 'Desligada', icon: 'fas fa-power-off', class: 'off' };
    } else {
      return {
        status: 'Desconhecido',
        icon: 'fas fa-question',
        class: 'unknown',
      };
    }
  }

  public getBlockStatus(inputsoutputs: string): {
    status: string;
    icon: string;
    class: string;
  } {
    if (!inputsoutputs || inputsoutputs.length < 5) {
      return {
        status: 'Desconhecido',
        icon: 'fas fa-question',
        class: 'unknown',
      };
    }

    const blockBit = inputsoutputs[4];

    if (blockBit === '1') {
      return { status: 'Bloqueado', icon: 'fas fa-lock', class: 'blocked' };
    } else if (blockBit === '0') {
      return {
        status: 'Desbloqueado',
        icon: 'fas fa-unlock',
        class: 'unblocked',
      };
    } else {
      return {
        status: 'Desconhecido',
        icon: 'fas fa-question',
        class: 'unknown',
      };
    }
  }

  public toggleStatus(id: number) {
    this.statusOpen[id] = !this.statusOpen[id];
  }

  public toggleTracker(id: number) {
    this.trackerOpen[id] = !this.trackerOpen[id];
  }
}
