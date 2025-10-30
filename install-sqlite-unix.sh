#!/bin/bash
# Install SQLite precompiled binaries for Mac/Linux
# This script downloads, extracts, and tests SQLite

set -e

echo "Detecting platform..."
OS="$(uname -s)"

case "${OS}" in
    Linux*)
        SQLITE_URL="https://sqlite.org/2025/sqlite-tools-linux-x64-3500400.zip"
        INSTALL_DIR="$HOME/.local/bin"
        ;;
    Darwin*)
        SQLITE_URL="https://sqlite.org/2025/sqlite-tools-osx-x64-3500400.zip"
        INSTALL_DIR="$HOME/.local/bin"
        ;;
    *)
        echo "Unsupported platform: ${OS}"
        echo "Please install SQLite manually from https://www.sqlite.org/download.html"
        exit 1
        ;;
esac

echo "Downloading SQLite precompiled binaries for ${OS}..."
curl -L -o "/tmp/sqlite-tools.zip" "${SQLITE_URL}"

echo ""
echo "Extracting SQLite to ${INSTALL_DIR}..."
mkdir -p "${INSTALL_DIR}"
unzip -o "/tmp/sqlite-tools.zip" -d "/tmp/sqlite-extract"

# Move the binaries
mv /tmp/sqlite-extract/sqlite3 "${INSTALL_DIR}/sqlite3"
chmod +x "${INSTALL_DIR}/sqlite3"

echo ""
echo "Testing SQLite installation..."
"${INSTALL_DIR}/sqlite3" --version

echo ""
echo "Creating test database..."
"${INSTALL_DIR}/sqlite3" "/tmp/test.db" "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO test (name) VALUES ('hello'); SELECT * FROM test;"

echo ""
echo "Cleaning up..."
rm -rf "/tmp/sqlite-tools.zip" "/tmp/sqlite-extract" "/tmp/test.db"

echo ""
echo "========================================"
echo "SQLite successfully installed!"
echo "Location: ${INSTALL_DIR}/sqlite3"
echo "Version:"
"${INSTALL_DIR}/sqlite3" --version
echo "========================================"
echo ""
echo "Note: Make sure ${INSTALL_DIR} is in your PATH"
echo "Add this to your ~/.bashrc or ~/.zshrc:"
echo "export PATH=\"${INSTALL_DIR}:\$PATH\""
echo ""

exit 0
