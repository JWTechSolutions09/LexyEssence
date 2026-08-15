-- Ejecutar en SSMS (conectar con Autenticacion de Windows a localhost\SQLEXPRESS)
-- Usuario de esta PC: DESKTOP-5M7J1GF\Administrador

USE [master];
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'DESKTOP-5M7J1GF\Administrador')
BEGIN
  CREATE LOGIN [DESKTOP-5M7J1GF\Administrador] FROM WINDOWS;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'LexyLocal')
BEGIN
  CREATE DATABASE LexyLocal;
END
GO

USE [LexyLocal];
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'DESKTOP-5M7J1GF\Administrador')
BEGIN
  CREATE USER [DESKTOP-5M7J1GF\Administrador] FOR LOGIN [DESKTOP-5M7J1GF\Administrador];
  ALTER ROLE db_owner ADD MEMBER [DESKTOP-5M7J1GF\Administrador];
END
GO

PRINT 'Listo: DESKTOP-5M7J1GF\Administrador puede usar LexyLocal.';
GO
