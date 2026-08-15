# Conexion SQL Server local (LexyLocal)

## No aparece "SQL Server Configuration Manager" en el menu

En SQL Server 2025 el archivo existe pero no siempre esta en Inicio. Abrelo asi:

**Opcion A — Ejecutar (Win + R):**
```
C:\Windows\SysWOW64\SQLServerManager17.msc
```

**Opcion B — PowerShell en la carpeta del proyecto:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\sqlserver\abrir-config-sql.ps1
```

**Opcion C — Sin interfaz grafica (como Administrador):**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\sqlserver\habilitar-tcp-sql.ps1
```

Luego en Configuration Manager: **Protocolos para SQLEXPRESS** → **TCP/IP** → Habilitar → **IPAll** → **Puertos dinámicos TCP** = `0` (deja **Puerto TCP** vacío) → Reiniciar SQL Server.

Lexy **no necesita** `MSSQL_PORT` en `.env`: lee el puerto dinámico del registro cada vez que arranca.
Si reinicias SQL y falla la conexión, ejecuta `node scripts/test-mssql.mjs` para ver el puerto actual.

## Probar conexion

```bash
node scripts/test-mssql.mjs
```

Si dice `OK`, agrega en `.env` la linea que te muestra (ej. `MSSQL_PORT=56566`).

## Requisitos

1. **SQL Server (SQLEXPRESS)** en ejecucion (`services.msc`)
2. **TCP/IP** habilitado en SQL Server Configuration Manager
3. Puerto TCP en `.env` — el script lo detecta del registro, o ponlo manual:

```env
MSSQL_SERVER=127.0.0.1
MSSQL_DATABASE=LexyLocal
# Sin MSSQL_PORT — puerto dinamico auto-detectado
MSSQL_TRUSTED_CONNECTION=true
```

> El puerto dinámico puede cambiar si reinicias SQL Server. Sin `MSSQL_PORT` en `.env`, Lexy lo lee del registro al arrancar. Si falla: `node scripts/test-mssql.mjs`.

## Si falla el login (`usuario ''` o login failed)

### Opcion A — Dar permiso a tu usuario Windows

1. Abre **SSMS** → conecta a `localhost\SQLEXPRESS` con Windows Auth
2. Abre y ejecuta: `scripts/sqlserver/crear-login-windows.sql`
3. Vuelve a ejecutar: `node scripts/test-mssql.mjs`

### Opcion B — Usuario y contrasena SQL

1. En SSMS: clic derecho en el servidor → **Propiedades** → **Seguridad** → **Modo de autenticacion de SQL Server y Windows** (mixto)
2. Reinicia **SQL Server (SQLEXPRESS)**
3. **Seguridad** → **Inicios de sesion** → **sa** → define contrasena y habilita
4. En `.env`:

```env
MSSQL_USER=sa
MSSQL_PASSWORD=tu_contrasena
MSSQL_TRUSTED_CONNECTION=false
MSSQL_PORT=56566
```

## Reiniciar Lexy

```bash
npm run build
scripts\Iniciar-Lexy.bat
```

Debes ver:

```
[db] Modo configurado: dual
[local] Conectando SQL Server: host=localhost port=56566 db=LexyLocal
[local] SQL Server (LexyLocal @ localhost) conectado: ...
```
