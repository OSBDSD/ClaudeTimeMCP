@echo off
REM Install SQLite precompiled binaries for Windows
REM This script downloads, extracts, and tests SQLite

echo Downloading SQLite precompiled binaries...
curl -L -o "%TEMP%\sqlite-tools-win-x64-3500400.zip" "https://sqlite.org/2025/sqlite-tools-win-x64-3500400.zip"

if %ERRORLEVEL% neq 0 (
    echo Failed to download SQLite
    exit /b 1
)

echo.
echo Extracting SQLite to C:\sqlite...
if not exist "C:\sqlite" mkdir "C:\sqlite"
tar -xf "%TEMP%\sqlite-tools-win-x64-3500400.zip" -C "C:\sqlite"

if %ERRORLEVEL% neq 0 (
    echo Failed to extract SQLite
    exit /b 1
)

echo.
echo Testing SQLite installation...
"C:\sqlite\sqlite3.exe" --version

if %ERRORLEVEL% neq 0 (
    echo SQLite test failed
    exit /b 1
)

echo.
echo Creating test database...
"C:\sqlite\sqlite3.exe" "%TEMP%\test.db" "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO test (name) VALUES ('hello'); SELECT * FROM test;"

if %ERRORLEVEL% neq 0 (
    echo SQLite functional test failed
    exit /b 1
)

echo.
echo Cleaning up...
del "%TEMP%\sqlite-tools-win-x64-3500400.zip"
del "%TEMP%\test.db"

echo.
echo ========================================
echo SQLite successfully installed!
echo Location: C:\sqlite\sqlite3.exe
echo Version:
"C:\sqlite\sqlite3.exe" --version
echo ========================================
echo.

exit /b 0
