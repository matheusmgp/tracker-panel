import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { environment } from '../../environments/environment.prod';

@Injectable({ providedIn: 'root' })
export class AuthService extends BaseApiService {
  constructor(http: HttpClient) {
    super(http, environment.sgiURL);
  }

  login(login: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}authentication/sgi/login`, {
      login,
      password,
    });
  }
}
