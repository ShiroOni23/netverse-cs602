param(
  [Parameter(Mandatory=$false)] [string]$Prefix = "8.8.8.0/24"
)

Write-Host "Fetching BGP/prefix intelligence for $Prefix" -ForegroundColor Cyan

$ripe = $null
try {
  $ripe = Invoke-RestMethod -Uri ("https://stat.ripe.net/data/prefix-overview/data.json?resource={0}" -f $Prefix) -TimeoutSec 20
} catch {
  Write-Host "RIPEstat query failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

if (-not $ripe) { exit 1 }

$data = $ripe.data
Write-Host "Resource: $($data.resource)" -ForegroundColor Green
Write-Host "Asns: $($data.asns | ForEach-Object { $_.asn } | Sort-Object -Unique -Join ', ')"
Write-Host "Holder(s): $($data.asns | ForEach-Object { $_.holder } | Sort-Object -Unique -Join ' | ')"
Write-Host "Related Prefixes (first 10):"
$data.related_prefixes | Select-Object -First 10 | ForEach-Object {
  Write-Host " - $($_.prefix) ($($_.relation))"
}

$out = [pscustomobject]@{
  QueriedAt       = (Get-Date).ToString("s")
  Resource        = $data.resource
  AsnCount        = @($data.asns).Count
  ASNList         = (@($data.asns | ForEach-Object { $_.asn }) -join ',')
  HolderList      = (@($data.asns | ForEach-Object { $_.holder }) -join ' | ')
  RouteOriginASNs = (@($data.asns | ForEach-Object { $_.asn }) -join ',')
}
$out | ConvertTo-Json | Set-Content -Encoding UTF8 "bgp-prefix-intel.json"
Write-Host "Saved: bgp-prefix-intel.json" -ForegroundColor Green
