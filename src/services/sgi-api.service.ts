import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { BaseApiService } from './base-api.service';

@Injectable({
  providedIn: 'root',
})
export class SgiApiService extends BaseApiService {
  constructor(http: HttpClient) {
    super(http, environment.sgiURL);
  }

  getInfoBySerial(serial: string): Observable<any> {
    return this.get<any>(`trackers/${serial}`);
  }
}
