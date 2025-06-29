import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NavbarComponent } from './components/navbar/navbar.component';
import { LoginComponent } from './components/login/login.component';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    NavbarComponent,
    FormsModule,
    ReactiveFormsModule,
    LoginComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected title = 'tracker-panel';
  navbarMinimized = false;

  constructor(private authService: AuthService) {}

  get isLoggedIn(): boolean {
    if (typeof window === 'undefined') return false;
    return this.authService.isLoggedIn();
  }
}
