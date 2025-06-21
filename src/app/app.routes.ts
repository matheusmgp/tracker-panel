import { Routes } from '@angular/router';
import { SocketPanelComponent } from './components/socket-panel/socket-panel.component';
import { PositionsComponent } from './components/positions/positions.component';

export const routes: Routes = [
  {
    path: 'painel',
    component: SocketPanelComponent,
  },
  {
    path: 'posicoes',
    component: PositionsComponent,
  },
  {
    path: '',
    redirectTo: 'painel',
    pathMatch: 'full',
  },
];
