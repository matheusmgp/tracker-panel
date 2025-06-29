import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseApiService } from './base-api.service';
import { environment } from '../../environments/environment.prod';
import { StorageService } from './storage.service';

interface JwtPayload {
  data: {
    adminAccess: boolean;
    username: string;
    codeId: number;
    companyId: number;
  };
  iat: number;
  exp: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService extends BaseApiService {
  constructor(http: HttpClient, private storageService: StorageService) {
    super(http, environment.sgiURL);
  }

  login(login: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}authentication/sgi/login`, {
      login,
      password,
    });
  }

  getToken(): string | null {
    return this.storageService.getItem('token');
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const payload = this.decodeToken(token);
      return !!(payload && payload.exp * 1000 > Date.now());
    } catch {
      return false;
    }
  }

  decodeToken(token: string): JwtPayload | null {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Erro ao decodificar token:', error);
      return null;
    }
  }

  hasAdminAccess(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const payload = this.decodeToken(token);
      return payload?.data?.adminAccess === true;
    } catch {
      return false;
    }
  }

  logout(): void {
    this.storageService.removeItem('token');
  }

  getAuthHeader(): { [key: string]: string } | null {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : null;
  }
}
