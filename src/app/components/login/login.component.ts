import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  standalone: true,
  imports: [ReactiveFormsModule],
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      login: ['', Validators.required],
      password: ['', Validators.required],
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) return;
    this.loading = true;
    this.error = null;
    const { login, password } = this.loginForm.value;
    this.authService.login(login, password).subscribe({
      next: (res) => {
        if (res.success && res.data?.token) {
          localStorage.setItem('token', res.data.token);
          this.router.navigate(['/']);
        } else {
          this.error = 'Login ou senha inválidos.';
        }
        this.loading = false;
      },
      error: () => {
        this.error = 'Erro ao conectar com o servidor.';
        this.loading = false;
      },
    });
  }
}
