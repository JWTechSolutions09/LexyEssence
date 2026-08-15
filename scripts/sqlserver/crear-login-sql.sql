-- Ejecutar en SSMS conectado a localhost\SQLEXPRESS (Windows Auth)
-- Crea usuario SQL para Lexy (modo mixto requerido en el servidor)

USE [master];
GO

-- Modo mixto: en SSMS -> Propiedades del servidor -> Seguridad -> SQL y Windows
-- Luego reinicia SQL Server (SQLEXPRESS)

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'lexy_app')
BEGIN
  CREATE LOGIN [lexy_app] WITH PASSWORD = N'LexyLocal2026!',
    CHECK_POLICY = OFF,
    CHECK_EXPIRATION = OFF;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'LexyLocal')
BEGIN
  CREATE DATABASE LexyLocal;
END
GO

USE [LexyLocal];
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'lexy_app')
BEGIN
  CREATE USER [lexy_app] FOR LOGIN [lexy_app];
  ALTER ROLE db_owner ADD MEMBER [lexy_app];
END
GO

PRINT 'Listo: login lexy_app creado. En .env usa MSSQL_USER=lexy_app y MSSQL_PASSWORD=LexyLocal2026!';
GO
