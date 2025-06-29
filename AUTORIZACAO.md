# Sistema de Autorização - Tracker Panel

## Visão Geral

O sistema de autorização foi implementado para controlar o acesso às rotas baseado no token JWT retornado pelo login. O token contém informações sobre as permissões do usuário, incluindo a propriedade `adminAccess`.

## Estrutura do Token JWT

O token JWT contém a seguinte estrutura:

```json
{
  "data": {
    "adminAccess": true,
    "username": "MATHEUS GUSTAVO",
    "codeId": 93,
    "companyId": 1
    // ... outras propriedades
  },
  "iat": 1751223250,
  "exp": 1751224150
}
```

## Regras de Acesso

### Usuários com `adminAccess: true`

- **Acesso total**: Podem acessar todas as rotas da aplicação
- **Rotas disponíveis**:
  - `/painel` - Painel principal dos rastreadores
  - `/posicoes` - Visualização de posições

### Usuários com `adminAccess: false`

- **Acesso limitado**: Podem acessar apenas a rota de posições
- **Rotas disponíveis**:
  - `/posicoes` - Visualização de posições

## Implementação Técnica

### 1. AuthService (`src/app/services/auth.service.ts`)

O serviço de autenticação foi expandido com os seguintes métodos:

- `getToken()`: Retorna o token armazenado no localStorage
- `isLoggedIn()`: Verifica se o usuário está logado e se o token não expirou
- `decodeToken()`: Decodifica o token JWT para extrair as informações
- `hasAdminAccess()`: Verifica se o usuário tem permissão de administrador
- `logout()`: Remove o token e faz logout do usuário

### 2. Guards de Rota (`src/app/app.routes.ts`)

Foram criados dois guards:

- **authGuard**: Verifica apenas se o usuário está logado
- **adminGuard**: Verifica se o usuário está logado E tem acesso de administrador

### 3. Interceptor HTTP (`src/app/services/auth.interceptor.ts`)

O interceptor adiciona automaticamente o token JWT no header `Authorization` de todas as requisições HTTP e trata erros 401 (não autorizado) redirecionando para o login.

### 4. Interface do Usuário

#### Navbar (`src/app/components/navbar/navbar.component.ts`)

- O link para `/painel` só é exibido para usuários com `adminAccess: true`
- O link para `/posicoes` é exibido para todos os usuários logados

#### Login (`src/app/components/login/login.component.ts`)

- Após o login bem-sucedido, o usuário é redirecionado baseado em suas permissões:
  - Se `adminAccess: true` → redireciona para `/painel`
  - Se `adminAccess: false` → redireciona para `/posicoes`

## Fluxo de Autenticação

1. **Login**: Usuário faz login e recebe o token JWT
2. **Armazenamento**: Token é salvo no localStorage
3. **Decodificação**: Token é decodificado para extrair permissões
4. **Redirecionamento**: Usuário é redirecionado baseado em suas permissões
5. **Navegação**: Interface mostra apenas os links permitidos
6. **Proteção**: Guards impedem acesso não autorizado às rotas

## Segurança

- **Validação de Token**: O sistema verifica se o token não expirou
- **Interceptação de Erros**: Erros 401 são tratados automaticamente
- **Logout Automático**: Token expirado ou inválido força logout
- **Proteção de Rotas**: Guards impedem acesso direto via URL

## Como Testar

1. Faça login com um usuário que tenha `adminAccess: true`

   - Deve conseguir acessar `/painel` e `/posicoes`
   - Deve ver ambos os links no navbar

2. Faça login com um usuário que tenha `adminAccess: false`
   - Deve ser redirecionado para `/posicoes`
   - Deve ver apenas o link de posições no navbar
   - Tentativa de acessar `/painel` deve redirecionar para `/posicoes`
