# Restarts the dev tunnel host if it has died or is stuck.
#
# The host process can stay alive while hosting nothing: after a relay drop it
# tries to reconnect with an expired access token ("Refreshed tunnel access
# token is not valid") and never recovers. So besides "is the process running",
# check that the tunnel service actually sees a host connection.
#
# Runs every 10 minutes from the "Snowman Tunnel Watchdog" task (interactive
# logon, so devtunnel's saved login is readable).

$DevTunnel = 'C:\Users\Anirudh\devtunnel.exe'
$Deploy    = 'G:\Billing Dashboard\snowman-dashboard\deploy'
$Log       = "$Deploy\tunnel-watchdog.log"

$running = [bool](Get-Process devtunnel -ErrorAction SilentlyContinue)
$show    = & $DevTunnel show snowman-dash 2>&1 | Out-String
$hosts   = if ($show -match 'Host connections\s*:\s*(\d+)') { [int]$Matches[1] } else { -1 }

if ($running -and $hosts -ge 1) { exit 0 }

$reason = if (-not $running) { 'host process not running' }
          elseif ($hosts -eq 0) { 'process running but 0 host connections (stuck)' }
          else { 'could not read tunnel status' }
Add-Content -Path $Log -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] restarting tunnel: $reason"

& "$Deploy\start-tunnel.ps1" -NoDelay
