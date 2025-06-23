import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
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
  isMinimized = false;
  @Output() minimizedChange = new EventEmitter<boolean>();

  constructor(private themeService: ThemeService, private router: Router) {
    this.isDarkTheme$ = this.themeService.isDarkTheme$;
  }

  ngOnInit(): void {}

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  toggleMinimize(): void {
    this.isMinimized = !this.isMinimized;
    this.minimizedChange.emit(this.isMinimized);
  }

  logout(): void {
    localStorage.removeItem('token');
    this.router.navigate(['/']);
  }
}
