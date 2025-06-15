import { Routes } from '@angular/router';
import { SocketPanelComponent } from './components/socket-panel/socket-panel.component';

export const routes: Routes = [
  {
    path: 'painel',
    component: SocketPanelComponent,
  },
  {
    path: '',
    redirectTo: 'painel',
    pathMatch: 'full',
  },
];
