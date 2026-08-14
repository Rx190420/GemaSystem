@echo off
:: GemaSystem WhatsApp Bot — Inicio automatico
:: Este archivo es ejecutado por el Programador de Tareas al iniciar sesion

cd /d "c:\xampp\htdocs\DymonSystem\whatsapp-bot"
pm2 resurrect
timeout /t 3 >nul
pm2 status
