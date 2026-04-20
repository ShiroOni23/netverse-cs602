param(
  [Parameter(Mandatory=$false)] [string]$Target = "1.1.1.1",
  [Parameter(Mandatory=$false)] [string]$Prefix = "1.1.1.0/24"
)

Write-Host "=== CS602 NetLab Real-World Diagnostics ===" -ForegroundColor Magenta

Write-Host "\n[1] Latency + reachability" -ForegroundColor Cyan
Test-Connection -ComputerName $Target -Count 4 | Select-Object Address,ResponseTime,Status | Format-Table -AutoSize

Write-Host "\n[2] Route path intelligence" -ForegroundColor Cyan
& "$PSScriptRoot\Get-NetworkPathIntel.ps1" -Target $Target -OutCsv "route-intel-$($Target.Replace('.','-')).csv"

Write-Host "\n[3] BGP prefix intelligence" -ForegroundColor Cyan
& "$PSScriptRoot\Get-BgpPrefixIntel.ps1" -Prefix $Prefix

Write-Host "\nDone. Check generated CSV/JSON files for lab reporting." -ForegroundColor Green
