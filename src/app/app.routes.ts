import { Routes, CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { SocketPanelComponent } from './components/socket-panel/socket-panel.component';
import { PositionsComponent } from './components/positions/positions.component';
import { LoginComponent } from './components/login/login.component';

const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const isLoggedIn =
    typeof window !== 'undefined' && !!localStorage.getItem('token');
  if (!isLoggedIn) {
    router.navigate(['/login']);
    return false;
  }
  return true;
};

export const routes: Routes = [
  {
    path: 'painel',
    component: SocketPanelComponent,
    canActivate: [authGuard],
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
