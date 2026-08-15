-- LexyLocal (SQL Server Express) — esquema base para modo dual
-- Ejecutar en SSMS sobre la base LexyLocal si prefieres crear tablas manualmente.
-- La app tambien crea/actualiza tablas automaticamente al iniciar.

USE LexyLocal;
GO

IF OBJECT_ID('dbo.wholesale_clients', 'U') IS NULL
CREATE TABLE dbo.wholesale_clients (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  cedula NVARCHAR(32) NOT NULL UNIQUE,
  salon NVARCHAR(200) NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

IF OBJECT_ID('dbo.users', 'U') IS NULL
CREATE TABLE dbo.users (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  username NVARCHAR(80) NOT NULL UNIQUE,
  password NVARCHAR(200) NOT NULL,
  password_hash NVARCHAR(200) NOT NULL,
  display_name NVARCHAR(120) NOT NULL,
  role NVARCHAR(20) NOT NULL,
  active BIT NOT NULL DEFAULT 1
);

IF OBJECT_ID('dbo.products', 'U') IS NULL
CREATE TABLE dbo.products (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  nombre NVARCHAR(200) NOT NULL,
  marca NVARCHAR(120) NOT NULL,
  descripcion NVARCHAR(MAX) NOT NULL DEFAULT '',
  categoria NVARCHAR(80) NOT NULL,
  costo DECIMAL(12,2) NOT NULL DEFAULT 0,
  precio DECIMAL(12,2) NOT NULL DEFAULT 0,
  precio_mayorista DECIMAL(12,2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  stock_minimo INT NOT NULL DEFAULT 0,
  es_ampolla BIT NOT NULL DEFAULT 0,
  unidades_por_caja INT NOT NULL DEFAULT 1,
  costo_caja DECIMAL(12,2) NULL,
  costo_unidad DECIMAL(12,2) NULL,
  precio_caja DECIMAL(12,2) NULL,
  precio_unidad DECIMAL(12,2) NULL,
  codigo_barra_caja NVARCHAR(64) NULL
);

IF OBJECT_ID('dbo.transactions', 'U') IS NULL
CREATE TABLE dbo.transactions (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  cliente NVARCHAR(200) NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  metodo NVARCHAR(40) NOT NULL,
  estado NVARCHAR(40) NOT NULL,
  sold_at DATETIME2 NULL,
  items_json NVARCHAR(MAX) NULL,
  sale_details_json NVARCHAR(MAX) NULL
);

IF OBJECT_ID('dbo.appointments', 'U') IS NULL
CREATE TABLE dbo.appointments (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  date NVARCHAR(20) NOT NULL,
  hora NVARCHAR(20) NOT NULL,
  cliente NVARCHAR(200) NOT NULL,
  servicios_json NVARCHAR(MAX) NOT NULL,
  total DECIMAL(12,2) NOT NULL
);

IF OBJECT_ID('dbo.stock_movements', 'U') IS NULL
CREATE TABLE dbo.stock_movements (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  tipo NVARCHAR(40) NOT NULL,
  product_id NVARCHAR(64) NOT NULL,
  nombre NVARCHAR(200) NOT NULL,
  cantidad INT NOT NULL,
  motivo NVARCHAR(300) NOT NULL,
  fecha DATETIME2 NOT NULL,
  referencia NVARCHAR(120) NULL
);

IF OBJECT_ID('dbo.cash_sessions', 'U') IS NULL
CREATE TABLE dbo.cash_sessions (
  id NVARCHAR(64) NOT NULL PRIMARY KEY,
  opened_at DATETIME2 NOT NULL,
  closed_at DATETIME2 NULL,
  opening_amount DECIMAL(12,2) NOT NULL,
  close_summary_json NVARCHAR(MAX) NULL,
  is_current BIT NOT NULL DEFAULT 0
);
GO
