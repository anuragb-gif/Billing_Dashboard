# Starts the public dev tunnel (snowman-dash -> localhost:4000) from Anirudh's
# interactive session. Launched at logon from the Windows Startup folder.
#
# Why not Task Scheduler: devtunnel can't read its saved login from a
# "run whether user is logged on or not" (batch) session - it fails with
# 0x80070520. It works fine from a normal interactive session.

$DevTunnel = 'C:\Users\Anirudh\devtunnel.exe'
$LogDir    = 'G:\Billing Dashboard\snowman-dashboard\deploy'

# Give the network a moment after logon.
Start-Sleep -Seconds 15

# Stop the old startup task's crash-loop (run-tunnel.bat) and any stale host,
# so nothing fights this process for the tunnel's single host slot.
Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" |
    Where-Object { $_.CommandLine -like '*run-tunnel.bat*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Get-Process devtunnel -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Start-Process -FilePath $DevTunnel -ArgumentList 'host', 'snowman-dash' -WindowStyle Hidden `
    -RedirectStandardOutput "$LogDir\tunnel-host.log" `
    -RedirectStandardError  "$LogDir\tunnel-host-err.log"
