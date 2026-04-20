param(
  [Parameter(Mandatory=$true)] [string]$CsvPath,
  [Parameter(Mandatory=$false)] [string]$Org = "ShiroOni23",
  [Parameter(Mandatory=$false)] [switch]$SendInvites,
  [Parameter(Mandatory=$false)] [switch]$SkipIfPending = $true,
  [Parameter(Mandatory=$false)] [int]$MaxRetries = 3,
  [Parameter(Mandatory=$false)] [int]$BaseDelaySeconds = 20,
  [Parameter(Mandatory=$false)] [string]$RemainingCsvPath = "data/invite_remaining.csv"
)

$rows = Import-Csv -Path $CsvPath
if (-not $rows.Count) { throw "CSV has no rows" }

$pendingSet = @{}
if ($SkipIfPending) {
  try {
    $pendingJson = gh api "/orgs/$Org/invitations" --paginate 2>$null
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
$remaining = @()

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
    $attempt = 0
    $done = $false

    while (-not $done -and $attempt -lt $MaxRetries) {
      $attempt++
      $resp = gh api -X POST "/orgs/$Org/invitations" -f email="$email" -f role="direct_member" 2>&1
      $respText = ($resp | Out-String)

      if ($LASTEXITCODE -eq 0) {
        $sent++
        $done = $true
        break
      }

      if ($respText -match "already an active member" -or $respText -match "already has a pending invitation") {
        Write-Host "[SKIP-ALREADY] $email" -ForegroundColor DarkYellow
        $skipped++
        $done = $true
        break
      }

      if ($respText -match "Over invitation rate limit") {
        $wait = [Math]::Max(1, $BaseDelaySeconds * $attempt)
        Write-Host "[RATE-LIMIT] $email attempt $attempt/$MaxRetries. Waiting ${wait}s..." -ForegroundColor Yellow
        Start-Sleep -Seconds $wait
        continue
      }

      if ($attempt -ge $MaxRetries) {
        $failed++
        $remaining += $r
        Write-Host "[FAILED] $email :: $respText" -ForegroundColor Red
      }
    }
  } else {
    Write-Host "[DRY RUN] would invite: $email"
  }
}

if ($SendInvites) {
  if ($remaining.Count -gt 0) {
    $remaining | Export-Csv -NoTypeInformation -Path $RemainingCsvPath
    Write-Host "Saved remaining invites to $RemainingCsvPath" -ForegroundColor Yellow
  }
  Write-Host "Completed. Sent=$sent, Skipped=$skipped, Failed=$failed, Remaining=$($remaining.Count)" -ForegroundColor Green
} else {
  Write-Host "Completed dry run. Use -SendInvites to actually send invitations." -ForegroundColor Green
}
