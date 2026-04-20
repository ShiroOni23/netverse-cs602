param(
  [Parameter(Mandatory=$true)] [string]$CsvPath,
  [Parameter(Mandatory=$false)] [string]$Org = "ShiroOni23",
  [Parameter(Mandatory=$false)] [switch]$SendInvites,
  [Parameter(Mandatory=$false)] [switch]$SkipIfPending = $true
)

$rows = Import-Csv -Path $CsvPath
if (-not $rows.Count) { throw "CSV has no rows" }

$pendingSet = @{}
if ($SkipIfPending) {
  try {
    $pendingJson = gh api "/orgs/$Org/invitations" 2>$null
    if ($LASTEXITCODE -eq 0 -and $pendingJson) {
      $pending = $pendingJson | ConvertFrom-Json
      foreach ($p in $pending) {
        if ($p.email) { $pendingSet[$p.email.ToLower()] = $true }
        if ($p.login) { $pendingSet[$p.login.ToLower()] = $true }
      }
    }
  } catch {
    Write-Host "Could not fetch pending invitations. Continuing..." -ForegroundColor Yellow
  }
}

$sent = 0
$skipped = 0
$failed = 0

foreach ($r in $rows) {
  if (-not $r.email) { continue }
  $email = $r.email.Trim()
  if ([string]::IsNullOrWhiteSpace($email)) { continue }

  if ($pendingSet.ContainsKey($email.ToLower())) {
    Write-Host "[SKIP-PENDING] $email" -ForegroundColor DarkYellow
    $skipped++
    continue
  }

  if ($SendInvites) {
    Write-Host "Inviting $email" -ForegroundColor Cyan
    $resp = gh api -X POST "/orgs/$Org/invitations" -f email="$email" -f role="direct_member" 2>&1
    if ($LASTEXITCODE -eq 0) {
      $sent++
    } else {
      $failed++
      Write-Host "[FAILED] $email :: $resp" -ForegroundColor Red
    }
  } else {
    Write-Host "[DRY RUN] would invite: $email"
  }
}

if ($SendInvites) {
  Write-Host "Completed. Sent=$sent, Skipped=$skipped, Failed=$failed" -ForegroundColor Green
} else {
  Write-Host "Completed dry run. Use -SendInvites to actually send invitations." -ForegroundColor Green
}
