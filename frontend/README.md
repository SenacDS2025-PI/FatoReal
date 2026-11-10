# Frontend (Angular)

Responsável: Luiz.

Para criar o projeto Angular dentro desta pasta:

```bash
npx @angular/cli@latest new fato-real-web --directory . --routing --style=scss
```

A URL da API fica em `src/environments/environment.ts` (ex.: `apiUrl: 'http://localhost:3000/api'`).
No Angular só pode ir a chave **pública** (`anon`) do Supabase — nunca a `service_role`.
