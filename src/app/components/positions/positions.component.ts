import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PositionsApiService } from '../../services/positions-api.service';
import { SafePipe } from './safe.pipe';
import { interval, Subscription } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

interface PositionData {
  id: number;
  vehicleId: number;
  companyId: number;
  sectorId: number | null;
  clientId: number | null;
  jsonData: {
    gps: string;
    mode: string;
    type: string;
    curse: string;
    speed: string;
    address: string;
    voltage: string;
    datetime: string;
    latitude: string;
    odometer: string;
    sectorId: number;
    hourmeter: string;
    longitude: string;
    messagenum: string;
    satellites: string;
    voltagebkp: string;
    messagetype: string;
    trackercode: number;
    trackerdata: {
      code: number;
      equipament: string;
    };
    vehiclecode: number;
    vehicledata: {
      id: number;
      board: string;
      color: string;
      chassis: string;
      renavam: string;
      modelYear: string;
      clientData: {
        companyid: number;
        clientcode: number;
        clientfantasy: string;
      };
      description: string;
      vehicleType: string;
    };
    inputsoutputs: string;
    localizationcode: string;
  };
  createdAt: string;
  updatedAt: string;
  quantity: number;
}

interface ApiResponse {
  success: boolean;
  statusCode: number;
  data: {
    count: number;
    pages: number;
    current_page: number;
    list: PositionData[];
    quantity: number;
  };
  timestamp: string;
  method: string;
}

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
  private subscription: Subscription = new Subscription();

  private intervalTime: number = 10000;

  constructor(private positionsApiService: PositionsApiService) {}

  ngOnInit(): void {
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private startPolling(): void {
    // Carregar dados imediatamente
    this.loadPositions();

    // Configurar polling a cada 5 segundos
    this.subscription = interval(this.intervalTime)
      .pipe(switchMap(() => this.positionsApiService.getPositions(1)))
      .subscribe({
        next: (response: ApiResponse) => {
          this.handleSuccess(response);
        },
        error: (error) => {
          this.handleError(error);
        },
      });
  }

  loadPositions(): void {
    this.loading = true;
    this.error = null;

    this.positionsApiService.getPositions(1).subscribe({
      next: (response: ApiResponse) => {
        this.handleSuccess(response);
      },
      error: (error) => {
        this.handleError(error);
      },
    });
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

  getSpeedInKmh(speed: string): string {
    const speedValue = parseFloat(speed);
    return isNaN(speedValue) ? '0' : speedValue.toFixed(1);
  }

  getFormattedDateTime(dateTime: string): string {
    return new Date(dateTime).toLocaleString('pt-BR');
  }

  getStatusColor(speed: string): string {
    const speedValue = parseFloat(speed);
    if (isNaN(speedValue)) return 'gray';
    if (speedValue === 0) return 'red';
    if (speedValue < 20) return 'orange';
    return 'green';
  }

  onSearchChange(): void {
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

  clearSearch(): void {
    this.searchTerm = '';
    this.positions = [...this.latestPositions];
    this.filteredPositions = [...this.latestPositions];
  }

  openMapModal(position: PositionData): void {
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

  closeMapModal(): void {
    this.showMapModal = false;
    this.selectedPosition = null;
    this.mapUrl = null;
  }
}
