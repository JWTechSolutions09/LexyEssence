# Abre SQL Server Configuration Manager (SQL Server 2025 / version 17)
$msc = "${env:Windir}\SysWOW64\SQLServerManager17.msc"
if (-not (Test-Path $msc)) {
  $msc = "${env:Windir}\System32\SQLServerManager17.msc"
}
if (-not (Test-Path $msc)) {
  Write-Error "No se encontro SQLServerManager17.msc. Instala las herramientas de SQL Server o usa habilitar-tcp-sql.ps1"
  exit 1
}
Write-Host "Abriendo: $msc"
Start-Process $msc
