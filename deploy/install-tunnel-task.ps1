# ============================================================
#  Registers the "Snowman Dashboard Tunnel" scheduled task.
#
#  - Runs deploy\run-tunnel.bat at system startup, crash-restarting
#    "devtunnel host snowman-dash"  ->  localhost:4000
#  - "Run whether user is logged on or not" (LogonType = Password)
#  - As user Anirudh  -> the account that ran "devtunnel user login"
#    (pbidev@SNOWMAN.IN). The login token is stored per Windows user,
#    so the task MUST run as this account.
#  - Also grants Anirudh the "Log on as a batch job" right, which the
#    task needs in this mode and which Register-ScheduledTask does NOT
#    grant on its own (this is why an earlier attempt registered but
#    never actually ran - LastTaskResult stuck at 267011).
#
#  >>> RUN FROM AN ELEVATED PowerShell (right-click > Run as administrator) <<<
#      powershell -ExecutionPolicy Bypass -File "G:\Billing Dashboard\snowman-dashboard\deploy\install-tunnel-task.ps1"
# ============================================================

$ErrorActionPreference = 'Stop'

# --- must be elevated ---
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw "Not elevated. Re-open PowerShell with 'Run as administrator' and run this again." }

$TaskName = 'Snowman Dashboard Tunnel'
$Bat      = 'G:\Billing Dashboard\snowman-dashboard\deploy\run-tunnel.bat'
$LogFile  = 'G:\Billing Dashboard\snowman-dashboard\deploy\tunnel-host.log'
$RunAs    = 'SLL-BCD365\Anirudh'

if (-not (Test-Path $Bat)) { throw "Not found: $Bat" }

# --- 1. grant "Log on as a batch job" (SeBatchLogonRight) to the run-as account ---
$sid = (New-Object System.Security.Principal.NTAccount($RunAs)
       ).Translate([System.Security.Principal.SecurityIdentifier]).Value
$inf = "$env:TEMP\sbl.inf"; $sdb = "$env:TEMP\sbl.sdb"
secedit /export /cfg $inf /areas USER_RIGHTS | Out-Null
$body = Get-Content $inf
$cur  = ($body | Where-Object { $_ -match '^SeBatchLogonRight' })
if ($cur -notmatch [regex]::Escape($sid)) {
    if ($cur) { $body = $body -replace [regex]::Escape($cur), "$cur,*$sid" }
    else      { $body += "SeBatchLogonRight = *$sid" }
    Set-Content $inf $body -Encoding Unicode
    secedit /import /db $sdb /cfg $inf /areas USER_RIGHTS | Out-Null
    secedit /configure /db $sdb /areas USER_RIGHTS | Out-Null
    Write-Host "Granted 'Log on as a batch job' to $RunAs" -ForegroundColor Green
} else {
    Write-Host "$RunAs already has 'Log on as a batch job'" -ForegroundColor DarkGray
}
Remove-Item $inf,$sdb -ErrorAction SilentlyContinue

# --- 2. (re)register the task ---
$cred = Get-Credential -UserName $RunAs -Message "Windows password for $RunAs"

$action   = New-ScheduledTaskAction -Execute $Bat
$trigger  = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
              -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Force `
    -Description 'Hosts the snowman-dash dev tunnel -> localhost:4000 (permanent public URL https://fd892mps-4000.inc1.devtunnels.ms/).' `
    -Action $action -Trigger $trigger -Settings $settings `
    -User $cred.UserName -Password $cred.GetNetworkCredential().Password -RunLevel Limited

# --- 3. start + verify ---
Write-Host "`nStarting task..." -ForegroundColor Green
if (Test-Path $LogFile) { Remove-Item $LogFile -Force -ErrorAction SilentlyContinue }
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 12

Write-Host "`n--- tunnel-host.log ---" -ForegroundColor Cyan
if (Test-Path $LogFile) { Get-Content $LogFile -Tail 10 } else { Write-Host "(no log yet - task still did not run)" -ForegroundColor Yellow }

Write-Host "`n--- task state ---" -ForegroundColor Cyan
Get-ScheduledTask -TaskName $TaskName | Get-ScheduledTaskInfo |
    Select-Object TaskName, LastRunTime, LastTaskResult

Write-Host "`nExpect: log ends with 'Ready to accept connections', LastTaskResult = 267009 (running)." -ForegroundColor DarkGray
Write-Host "Then test:  https://fd892mps-4000.inc1.devtunnels.ms/" -ForegroundColor DarkGray
