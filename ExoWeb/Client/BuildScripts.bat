@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command "& '%~dp0\tools\powershell\BuildAll.ps1' -Force -ErrorAction Stop"
if NOT ["%errorlevel%"]==["0"] pause
