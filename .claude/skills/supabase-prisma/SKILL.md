# Supabase + Prisma Integration Skill

## Contexto
ContentSpark usa Supabase como backend-as-a-service (PostgreSQL + Auth) y Prisma como ORM.

## Setup inicial

### Instalar dependencias
```bash
# En frontend/
npm install @supabase/supabase-js @prisma/client prisma
```

### Prisma schema location
El archivo `prisma/schema.prisma` va en la raíz del directorio `frontend/`.

### Conexión a Supabase DB
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```
- `DATABASE_URL`: Connection pooler de Supabase (con `?pgbouncer=true`).
- `DIRECT_URL`: Conexión directa (para migraciones).

## Patrones de Prisma

### Crear registros
```typescript
const chat = await prisma.chat.create({
  data: {
    userId: user.id,
    title: "Nuevo chat",
  },
});
```

### Queries con relaciones
```typescript
const chatWithMessages = await prisma.chat.findUnique({
  where: { id: chatId },
  include: { messages: { orderBy: { createdAt: "asc" } } },
});
```

### Filtrar por usuario (seguridad)
SIEMPRE filtrar por userId en TODAS las queries:
```typescript
const chats = await prisma.chat.findMany({
  where: { userId: currentUser.id },
  orderBy: { updatedAt: "desc" },
});
```

### Transacciones
Para operaciones que deben ser atómicas:
```typescript
const result = await prisma.$transaction([
  prisma.chat.create({ data: { ... } }),
  prisma.message.create({ data: { ... } }),
]);
```

## Patrones de Supabase Auth

### Frontend: Cliente
```typescript
// lib/supabase.ts
import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

### Frontend: Login
```typescript
// Email/password
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

// Google OAuth
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: `${window.location.origin}/auth/callback` },
});
```

### Frontend: Obtener sesión
```typescript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
// Enviar token al backend en cada request
```

### Frontend: Proteger rutas
```typescript
// middleware.ts (Next.js)
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function middleware(request) {
  const supabase = createServerClient(/* ... */);
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session && request.nextUrl.pathname.startsWith("/(app)")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}
```

### Backend: Verificar JWT (FastAPI)
```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            os.getenv("SUPABASE_JWT_SECRET"),
            algorithms=["HS256"],
            audience="authenticated"
        )
        return payload["sub"]  # user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
```

## Errores comunes

### "prepared statement already exists"
Causa: Prisma con connection pooler de Supabase.
Solución: Agregar `?pgbouncer=true&connection_limit=1` al DATABASE_URL.

### "relation does not exist"
Causa: No se ejecutó la migración.
Solución: `npx prisma migrate dev`

### "JWT expired"
Causa: El token de Supabase expiró (default 1 hora).
Solución: Implementar refresh del token en el frontend con `supabase.auth.onAuthStateChange()`.

## Reglas de seguridad

- NUNCA exponer `SUPABASE_SERVICE_ROLE_KEY` en el frontend.
- SIEMPRE filtrar queries por user_id del JWT verificado.
- SIEMPRE validar que el recurso pertenece al usuario antes de retornarlo.
- Usar RLS en Supabase como capa extra de seguridad.
