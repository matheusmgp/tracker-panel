# Resolução de Problemas de SSR (Server-Side Rendering)

## Problema: localStorage is not defined

### Causa

O erro `localStorage is not defined` ocorre quando o código tenta acessar o `localStorage` durante a renderização no servidor (SSR). O `localStorage` só está disponível no navegador, não no servidor.

### Solução Implementada

#### 1. StorageService (`src/app/services/storage.service.ts`)

Criamos um serviço centralizado para gerenciar o localStorage de forma segura:

```typescript
@Injectable({
  providedIn: "root",
})
export class StorageService {
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  getItem(key: string): string | null {
    if (!this.isBrowser) return null;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error("Erro ao acessar localStorage:", error);
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error("Erro ao salvar no localStorage:", error);
    }
  }

  removeItem(key: string): void {
    if (!this.isBrowser) return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error("Erro ao remover do localStorage:", error);
    }
  }
}
```

#### 2. Verificações de Segurança

Adicionamos verificações `typeof window === 'undefined'` em todos os lugares onde o localStorage era acessado diretamente.

#### 3. Guards de Rota Seguros

Os guards de rota agora verificam se estão no lado do cliente antes de executar:

```typescript
const authGuard: CanActivateFn = () => {
  // Verifica se está no lado do cliente
  if (typeof window === "undefined") {
    return true; // Permite acesso durante SSR
  }
  // ... resto da lógica
};
```

#### 4. Interceptor HTTP Seguro

O interceptor HTTP verifica se está no lado do cliente:

```typescript
export function authInterceptor(request: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> {
  // Verifica se está no lado do cliente
  if (typeof window === "undefined") {
    return next(request);
  }
  // ... resto da lógica
}
```

## Boas Práticas para SSR

### 1. Sempre Verificar o Ambiente

```typescript
// ✅ Correto
if (typeof window !== "undefined") {
  // código que usa APIs do navegador
}

// ❌ Incorreto
localStorage.getItem("key"); // Pode falhar no servidor
```

### 2. Usar isPlatformBrowser

```typescript
import { isPlatformBrowser } from '@angular/common';

constructor(@Inject(PLATFORM_ID) platformId: Object) {
  this.isBrowser = isPlatformBrowser(platformId);
}
```

### 3. Tratar Erros de Storage

```typescript
try {
  localStorage.setItem("key", "value");
} catch (error) {
  console.error("Erro ao acessar localStorage:", error);
  // Fallback ou tratamento alternativo
}
```

### 4. Serviços Centralizados

Crie serviços para gerenciar APIs do navegador de forma centralizada e segura.

## Arquivos Modificados

1. `src/app/services/storage.service.ts` - Novo serviço
2. `src/app/services/auth.service.ts` - Usa StorageService
3. `src/app/services/theme.service.ts` - Usa StorageService
4. `src/app/components/login/login.component.ts` - Usa StorageService
5. `src/app/components/positions/positions.component.ts` - Usa StorageService
6. `src/app/app.routes.ts` - Guards seguros
7. `src/app/services/auth.interceptor.ts` - Interceptor seguro
8. `src/app/app.ts` - Verificação de ambiente

## Testando a Solução

1. **Build de Produção**: Execute `ng build` para verificar se não há erros
2. **Teste de SSR**: Execute `ng serve` e verifique o console do navegador
3. **Teste de Funcionalidade**: Verifique se o login e autorização funcionam corretamente

## Monitoramento

- Verifique o console do navegador para erros relacionados ao localStorage
- Monitore logs do servidor para erros de SSR
- Teste em diferentes ambientes (desenvolvimento, produção, SSR)

## Próximos Passos

Se ainda houver problemas:

1. Verifique se todos os acessos ao localStorage foram migrados para o StorageService
2. Adicione logs para debug em ambiente de desenvolvimento
3. Considere usar cookies como fallback para SSR
4. Implemente estratégias de hidratação mais robustas
