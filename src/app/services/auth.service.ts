import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private baseUrl = 'http://sv1.flexgrupo.com:9001';

  constructor(private http: HttpClient) {}

  login(login: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/authentication/sgi/login`, {
      login,
      password,
    });
  }
}
