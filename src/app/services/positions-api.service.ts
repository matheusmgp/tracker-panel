import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
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
    const params = new HttpParams()
      .set('current_page', '1')
      .set('per_page', '9999');

    let headers = new HttpHeaders().set('companyid', '1');

    return this.http.get<any>(`${environment.positionsURL}positions`, {
      headers,
      params,
    });
  }
}
