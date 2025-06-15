import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { environment } from '../../environments/environment.prod';

@Injectable({
  providedIn: 'root',
})
export class PositionsApiService extends BaseApiService {
  constructor(http: HttpClient) {
    super(http, environment.positionsURL);
  }

  getPositions(): Observable<any> {
    return this.get<any>('positions');
  }
}
