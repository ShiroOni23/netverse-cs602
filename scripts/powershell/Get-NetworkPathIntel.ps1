param(
  [Parameter(Mandatory=$false)] [string]$Target = "8.8.8.8",
  [Parameter(Mandatory=$false)] [string]$OutCsv = "network-path-intel.csv"
)

Write-Host "Resolving target: $Target" -ForegroundColor Cyan
try {
  $dns = Resolve-DnsName -Name $Target -ErrorAction Stop
  $resolved = ($dns | Where-Object { $_.IPAddress } | Select-Object -First 1 -ExpandProperty IPAddress)
  if ($resolved) { $Target = $resolved }
} catch {}

Write-Host "Running traceroute to $Target" -ForegroundColor Cyan
$traceLines = tracert -d $Target 2>$null

$hopIps = @()
foreach ($line in $traceLines) {
  if ($line -match '^\s*\d+\s+') {
    $m = [regex]::Match($line, '(\d{1,3}(?:\.\d{1,3}){3})\s*$')
    if ($m.Success) { $hopIps += $m.Groups[1].Value }
  }
}

if (-not $hopIps.Count) {
  Write-Host "No hops parsed from traceroute output." -ForegroundColor Yellow
  exit 1
}

$rows = @()
$idx = 1
foreach ($ip in $hopIps) {
  Write-Host "Enriching hop $idx : $ip" -ForegroundColor DarkCyan
  $geo = $null
  try {
    $geo = Invoke-RestMethod -Uri ("http://ip-api.com/json/{0}?fields=status,country,regionName,city,isp,org,as,query" -f $ip) -TimeoutSec 12
  } catch {}

  $rows += [pscustomobject]@{
    Hop       = $idx
    IP        = $ip
    Country   = if($geo){$geo.country}else{""}
    Region    = if($geo){$geo.regionName}else{""}
    City      = if($geo){$geo.city}else{""}
    ISP       = if($geo){$geo.isp}else{""}
    Org       = if($geo){$geo.org}else{""}
    AS        = if($geo){$geo.as}else{""}
  }
  $idx++
}

$rows | Export-Csv -Path $OutCsv -NoTypeInformation -Encoding UTF8
Write-Host "Saved: $OutCsv" -ForegroundColor Green
$rows | Format-Table -AutoSize
