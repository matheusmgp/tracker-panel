import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit {
  isDarkTheme$: Observable<boolean>;
  isMenuOpen = false;
  logoPath = 'assets/logo_gota.png';
  logoTop = 'assets/logoverde.png';
  isMinimized = true;
  hasAdminAccess = false;
  @Output() minimizedChange = new EventEmitter<boolean>();

  constructor(
    private themeService: ThemeService,
    private router: Router,
    private authService: AuthService
  ) {
    this.isDarkTheme$ = this.themeService.isDarkTheme$;
  }

  ngOnInit(): void {
    this.hasAdminAccess = this.authService.hasAdminAccess();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  toggleMinimize(): void {
    this.isMinimized = true;
    this.minimizedChange.emit(this.isMinimized);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
