import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private isDarkTheme = new BehaviorSubject<boolean>(false);
  isDarkTheme$ = this.isDarkTheme.asObservable();
  private isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private storageService: StorageService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      const savedTheme = this.storageService.getItem('theme');
      if (savedTheme) {
        this.isDarkTheme.next(savedTheme === 'dark');
        this.applyTheme(savedTheme === 'dark');
      }
    }
  }

  toggleTheme() {
    const newTheme = !this.isDarkTheme.value;
    this.isDarkTheme.next(newTheme);
    this.applyTheme(newTheme);

    if (this.isBrowser) {
      this.storageService.setItem('theme', newTheme ? 'dark' : 'light');
    }
  }

  private applyTheme(isDark: boolean) {
    if (this.isBrowser) {
      document.documentElement.classList.toggle('dark-theme', isDark);
    }
  }
}
