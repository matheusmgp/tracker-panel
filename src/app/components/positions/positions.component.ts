import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PositionsApiService } from '../../services/positions-api.service';
import { SafePipe } from './safe.pipe';
import { interval, Subscription, timer } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { ApiResponse, PositionData } from './interfaces/positions.interfaces';

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

  constructor(private positionsApiService: PositionsApiService) {}

  ngOnInit(): void {
    this.startPolling();
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
      this.mapUrl = `https://maps.google.com/maps?q=${lat},${lon}&z=15&output=embed`;
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
}
