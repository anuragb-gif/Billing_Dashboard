' Runs a PowerShell script with no visible window, so the 10-minute
' watchdog doesn't flash a console on the Remote Desktop session.
' Usage: wscript.exe run-hidden.vbs "<path to .ps1>"
Set shell = CreateObject("WScript.Shell")
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & WScript.Arguments(0) & """", 0, False
