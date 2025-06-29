import { Routes, CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { SocketPanelComponent } from './components/socket-panel/socket-panel.component';
import { PositionsComponent } from './components/positions/positions.component';
import { LoginComponent } from './components/login/login.component';
import { AuthService } from './services/auth.service';

const authGuard: CanActivateFn = () => {
  // Verifica se está no lado do cliente
  if (typeof window === 'undefined') {
    return true; // Permite acesso durante SSR
  }

  const router = inject(Router);
  const authService = inject(AuthService);

  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }
  return true;
};

const adminGuard: CanActivateFn = () => {
  // Verifica se está no lado do cliente
  if (typeof window === 'undefined') {
    return true; // Permite acesso durante SSR
  }

  const router = inject(Router);
  const authService = inject(AuthService);

  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  if (!authService.hasAdminAccess()) {
    router.navigate(['/posicoes']);
    return false;
  }

  return true;
};

export const routes: Routes = [
  {
    path: 'painel',
    component: SocketPanelComponent,
    canActivate: [adminGuard],
  },
  {
    path: 'posicoes',
    component: PositionsComponent,
    canActivate: [authGuard],
  },
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: '',
    redirectTo: 'painel',
    pathMatch: 'full',
  },
];
