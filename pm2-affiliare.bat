@echo off

SET PM2_HOME = C:\etc\.pm2

pm2 start “c:\project\queues\server\server.js” --name QueueSystem