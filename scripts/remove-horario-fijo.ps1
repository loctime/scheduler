Write-Host "=== Eliminando lógica legacy de horario fijo ==="

$patterns = @(
    "horarioFijo",
    "horario_fijo",
    "isFixed",
    "fixedShift",
    "fixed_schedule",
    "horario fijo",
    "HORARIO_FIJO"
)

$paths = @(
    "apps\horarios",
    "components",
    "hooks",
    "lib"
)

foreach ($pattern in $patterns) {
    Write-Host ""
    Write-Host "--- Buscando patrón: $pattern ---"

    foreach ($path in $paths) {
        if (Test-Path $path) {

            Get-ChildItem -Path $path -Recurse -File -ErrorAction SilentlyContinue |
            ForEach-Object {
                Select-String -Path $_.FullName -Pattern $pattern -SimpleMatch -ErrorAction SilentlyContinue |
                ForEach-Object {
                    Write-Host "$($_.Path):$($_.LineNumber)"
                }
            }

        }
    }
}

Write-Host ""
Write-Host "PASO SIGUIENTE:"
Write-Host "Eliminar con Cursor:"
Write-Host "- flags de horario fijo"
Write-Host "- lógica de propagación entre semanas"
Write-Host "- candados persistentes"
Write-Host "- checks condicionales asociados"
