@echo off
echo Starting DB Push...
call npm run db:push > push.log 2>&1
echo Done.
type push.log
