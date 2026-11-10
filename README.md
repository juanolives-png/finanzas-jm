# Finanzas JM

Tu CFO automático: cada cliente se registra, conecta su Colppy y el tablero se arma y se actualiza solo.

## Cómo está armado
- **Un solo sistema, muchos clientes.** Cada registro crea un *tenant*. Un tenant tiene usuarios y empresas conectadas.
- **Datos separados por empresa.** Todo dato contable cuelga de una `Company`; toda consulta pasa por `getCompany()`,
  que verifica que la empresa sea del tenant de la sesión.
- **Colppy:** las credenciales de *desarrollador* son de Finanzas JM (variables de entorno). Cada cliente solo pone
  su usuario y contraseña de Colppy, que se guardan encriptados (AES-256-GCM). Solo lectura.
- **Sync:** plan de cuentas + libro diario, mes por mes, partiendo los períodos cuando Colppy corta la respuesta
  (heredado de Infocampo). Primera vez: 18 meses. Después: los últimos 3.
- **Categorías:** cada cuenta recibe una categoría propuesta por regla (código + nombre). Próximo: la IA propone y el cliente confirma.

## Qué viene de dónde
| Pieza | Origen |
|---|---|
| Cliente de la API de Colppy, sync del diario sin perder renglones | Infocampo admanager |
| Paleta, tipografía, convención de signo del P&L, lecciones de Colppy (idObjetoContacto, 9876, mayúsculas) | Huerta dashboard |

## Correr en tu Mac
```bash
cp .env.example .env      # y completar
npm install
npx prisma db push        # crea las tablas
npm run dev               # http://localhost:3000
```

## Railway
1. Repo nuevo en GitHub → New Project en Railway desde el repo + agregar Postgres.
2. Variables: las de `.env.example` (DATABASE_URL la da Railway).
3. Cron diario: un servicio Cron que haga `curl -X POST $APP_URL/api/sync -H "x-cron-secret: $CRON_SECRET"`.

## Próximos pasos
1. Pantalla para revisar y confirmar las categorías de las cuentas (con propuesta de IA).
2. Cashflow y P&L detallado (desde PageCashflowProy / PagePYL de Huerta).
3. Reporte semanal a socios (desde weekly.report de Infocampo, genérico).
4. Facturas de venta y compra → deuda de clientes y proveedores, cobranzas.
5. Mercado Pago, extractos bancarios, ARCA.
