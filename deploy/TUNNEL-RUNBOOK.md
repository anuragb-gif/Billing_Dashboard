# Dev tunnel runbook — exposing a local port to the internet

Everything below runs **on the office server SLL-BCD365**, as user **Anirudh**
(the account already logged into `devtunnel` as `pbidev@SNOWMAN.IN`).

`devtunnel.exe` lives at `C:\Users\Anirudh\devtunnel.exe` and
`G:\Billing Dashboard\snowman-dashboard\deploy\devtunnel.exe`.

## What is already set up (don't redo)

- `devtunnel user login` — done, token cached under Anirudh's profile.
- Anirudh has the **"Log on as a batch job"** right — so any new scheduled
  task that runs as Anirudh "whether logged on or not" will start fine.
- Named tunnel **`snowman-dash`** with port **4000** →
  `https://fd892mps-4000.inc1.devtunnels.ms/`
- Task **"Snowman Dashboard Tunnel"** runs `deploy\run-tunnel.bat` at startup
  and crash-restarts the host.

One `devtunnel host <tunnel>` process serves **all ports on that tunnel**.

---

## Case A — add another port to the EXISTING tunnel  (~30 seconds)

Use this when the new thing also runs on SLL-BCD365 and one shared URL prefix
is fine (you just get `https://fd892mps-<newport>.inc1.devtunnels.ms/`).

```powershell
$DT = "C:\Users\Anirudh\devtunnel.exe"
$port = 5050                                   # <-- your new local port

& $DT port create snowman-dash -p $port
& $DT access create snowman-dash -p $port --anonymous   # public; omit for private
& $DT show snowman-dash                        # note the new URL

# make the running host pick it up
schtasks /End /TN "Snowman Dashboard Tunnel"
schtasks /Run /TN "Snowman Dashboard Tunnel"
```

Remove a port later: `& $DT port delete snowman-dash -p 5050`

---

## Case B — a brand-new SEPARATE tunnel + its own auto-start task  (~3 minutes)

Use this when you want an independent URL / lifecycle.

```powershell
$DT   = "C:\Users\Anirudh\devtunnel.exe"
$name = "snowman-report"      # <-- tunnel id (letters/digits/-, unique)
$port = 4100                  # <-- local port

& $DT create $name
& $DT port create $name -p $port
& $DT access create $name -p $port --anonymous
& $DT show $name             # <-- copy the https://...devtunnels.ms/ URL
```

Then create the launcher + task:

1. Copy `deploy\run-tunnel.bat` to `deploy\run-tunnel-<name>.bat` and change
   two lines:
   - `set "LOG=%~dp0tunnel-host-<name>.log"`   (a NEW filename — never reuse a
     log owned by another account or the task dies on "Access is denied")
   - `"%DEVTUNNEL_EXE%" host <name> >> "%LOG%" 2>&1`

2. Register it — **elevated PowerShell** (Run as administrator):

```powershell
$cred = Get-Credential -UserName "SLL-BCD365\Anirudh" -Message "Anirudh password"
Register-ScheduledTask -TaskName "Snowman Tunnel <name>" -Force `
  -Action   (New-ScheduledTaskAction -Execute "G:\Billing Dashboard\snowman-dashboard\deploy\run-tunnel-<name>.bat") `
  -Trigger  (New-ScheduledTaskTrigger -AtStartup) `
  -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew) `
  -User     $cred.UserName -Password $cred.GetNetworkCredential().Password `
  -RunLevel Limited
Start-ScheduledTask -TaskName "Snowman Tunnel <name>"
```

3. Verify: `Get-Content deploy\tunnel-host-<name>.log -Tail 10` →
   should end with `Ready to accept connections`. Then open the URL off-network.

---

## Rules that keep it painless

| Do | Why |
|----|-----|
| Use `devtunnel create <name>` (named tunnel) | fixed URL; VS Code Ports panel gives a throwaway URL that dies when VS Code closes |
| Put `--anonymous` on the **port** (`access create ... -p <port>`) | that's what makes it reachable without a Microsoft login |
| Every task → its **own** `tunnel-host-*.log` with a fresh name | a log file owned by another Windows user is read-only to the task → silent "Access is denied" loop |
| Register the task **elevated**, run-as **Anirudh** | needs the stored password + batch-logon right (already granted for Anirudh) |
| `LastTaskResult 267009` = running (good), `267011` = never ran (bad) | quick health check |

## Quick checks

```powershell
$DT = "C:\Users\Anirudh\devtunnel.exe"
& $DT list                     # all tunnels, ports, expiry
& $DT show snowman-dash        # ports + URLs for one tunnel
Get-ScheduledTask | ? TaskName -like "*Tunnel*" | Get-ScheduledTaskInfo | ft TaskName,LastRunTime,LastTaskResult
```

Tunnels are deleted after **30 days with no host connection**. While a startup
task is hosting continuously that never triggers; if the server is off for a
month straight you re-run Case B and hand out the new URL.
