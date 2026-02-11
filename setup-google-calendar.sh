#!/bin/bash

# Google Calendar Setup Script for LazyCal
# This script helps set up Google Calendar API credentials

echo "=========================================="
echo "LazyCal - Google Calendar Setup"
echo "=========================================="
echo ""

CONFIG_DIR="$HOME/.config/lazycal"

echo "To use LazyCal with Google Calendar, you need to:"
echo ""
echo "1. Go to Google Cloud Console:"
echo "   https://console.cloud.google.com/"
echo ""
echo "2. Create a new project or select existing one"
echo ""
echo "3. Enable Google Calendar API:"
echo "   - Go to 'APIs & Services' → 'Library'"
echo "   - Search for 'Google Calendar API'"
echo "   - Click 'Enable'"
echo ""
echo "4. Create OAuth 2.0 Credentials:"
echo "   - Go to 'APIs & Services' → 'Credentials'"
echo "   - Click 'Create Credentials' → 'OAuth 2.0 Client ID'"
echo "   - Select 'Desktop app' as Application type"
echo "   - Give it a name (e.g., 'LazyCal')"
echo "   - Click 'Create'"
echo ""
echo "5. Download the credentials:"
echo "   - Click the download button (⬇️) next to your new credential"
echo "   - Save the JSON file"
echo ""
echo "6. Copy the credentials file to the config directory:"
echo "   mkdir -p $CONFIG_DIR"
echo "   cp ~/Downloads/client_secret_*.json $CONFIG_DIR/credentials.json"
echo ""

# Check if credentials already exist
if [ -f "$CONFIG_DIR/credentials.json" ]; then
    echo "✓ credentials.json already exists at $CONFIG_DIR/"
    echo ""
    read -p "Do you want to overwrite it? (y/N): " overwrite
    if [[ $overwrite =~ ^[Yy]$ ]]; then
        echo "Please copy your new credentials.json to: $CONFIG_DIR/"
        echo ""
        read -p "Press Enter when done..."
    else
        echo "Keeping existing credentials."
    fi
else
    echo "Creating config directory..."
    mkdir -p "$CONFIG_DIR"
    echo ""
    echo "Please copy your downloaded credentials.json to:"
    echo "  $CONFIG_DIR/credentials.json"
    echo ""
    read -p "Press Enter when done..."
fi

# Verify credentials
if [ -f "$CONFIG_DIR/credentials.json" ]; then
    echo ""
    echo "✓ credentials.json found!"
    echo ""
    echo "You can now run LazyCal with:"
    echo "  bun run start"
    echo ""
    echo "On first run, a browser window will open for OAuth authentication."
    echo "After authenticating, copy the authorization code and paste it in the terminal."
    echo ""
else
    echo ""
    echo "✗ credentials.json not found at $CONFIG_DIR/"
    echo ""
    echo "Please make sure to copy the credentials file before running LazyCal."
    echo ""
fi
