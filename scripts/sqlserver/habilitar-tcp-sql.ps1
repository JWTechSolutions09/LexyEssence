# Ejecutar como Administrador: clic derecho -> Ejecutar con PowerShell (como administrador)
# Habilita TCP/IP en SQLEXPRESS con PUERTO DINAMICO (SQL asigna el puerto al reiniciar).

$ErrorActionPreference = "Stop"
$tcpKey = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL17.SQLEXPRESS\MSSQLServer\SuperSocketNetLib\Tcp"
$ipAllKey = "$tcpKey\IPAll"

if (-not (Test-Path $tcpKey)) {
  Write-Error "No se encontro la instancia SQLEXPRESS (MSSQL17). Ajusta la ruta del registro si usas otra version."
}

Write-Host "Habilitando TCP/IP en SQLEXPRESS con puerto dinamico ..."

New-ItemProperty -Path $tcpKey -Name "Enabled" -Value 1 -PropertyType DWord -Force | Out-Null
New-ItemProperty -Path $ipAllKey -Name "TcpPort" -Value "" -PropertyType String -Force | Out-Null
New-ItemProperty -Path $ipAllKey -Name "TcpDynamicPorts" -Value "0" -PropertyType String -Force | Out-Null

Write-Host "Reiniciando SQL Server (SQLEXPRESS) ..."
Restart-Service "MSSQL`$SQLEXPRESS" -Force

Start-Sleep -Seconds 5

$ipAll = Get-ItemProperty -Path $ipAllKey
$dynamicPort = [string]$ipAll.TcpDynamicPorts
$staticPort = [string]$ipAll.TcpPort

$port = $null
if ($dynamicPort -and $dynamicPort -ne "0") {
  $port = $dynamicPort
} elseif ($staticPort) {
  $port = $staticPort
}

if ($port) {
  Write-Host ('OK - Puerto dinamico asignado: ' + $port)
  Write-Host ""
  Write-Host "Lexy lo detecta solo si NO pones MSSQL_PORT en .env."
  Write-Host "Si reinicias SQL y el puerto cambia, ejecuta: node scripts/test-mssql.mjs"
  Write-Host ('  Opcional en .env: MSSQL_PORT=' + $port)
  Write-Host ""
  Write-Host "Prueba: node scripts/test-mssql.mjs"
} else {
  Write-Host "TCP habilitado pero aun no hay puerto en el registro."
  Write-Host "Espera unos segundos y ejecuta: node scripts/test-mssql.mjs"
}
