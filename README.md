# LazyCal - Google Calendar TUI

A beautiful terminal-based Google Calendar interface built with [OpenTUI](https://github.com/anomalyco/opentui).

![Demo](screenshot.png)

## Features

- 📅 Month view calendar with event indicators
- 🎯 Navigate with arrow keys or vim-style (h/j/k/l)
- 📊 Side panel shows events for selected day
- 🌐 Google Calendar API integration (optional)
- 🎨 Beautiful dark theme with color-coded events
- ⚡ Fast and responsive terminal UI
- 🔄 Auto-sync with Google Calendar

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd lazycal

# Install dependencies
bun install
```

## Usage

### Quick Start (with sample data)

```bash
bun run start
```

### Connect to Google Calendar

To use real Google Calendar data:

1. **Create a Google Cloud Project:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project
   - Enable the Google Calendar API

2. **Create OAuth 2.0 Credentials:**
   - Go to "Credentials" in the left menu
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Choose "Desktop application" as the application type
   - Download the JSON credentials file

3. **Configure LazyCal:**
   ```bash
   mkdir -p ~/.config/lazycal
   cp /path/to/downloaded/credentials.json ~/.config/lazycal/
   ```
   
   Or run the setup script:
   ```bash
   bash setup-google-calendar.sh
   ```

4. **Run the app:**
   ```bash
   bun run start
   ```
   
   On first run, a browser window will open for OAuth authentication.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` / `h` | Previous month |
| `→` / `l` | Next month |
| `↑` / `k` | Navigate up (previous week) |
| `↓` / `j` | Navigate down (next week) |
| `Enter` | View day details (logs to console) |
| `t` | Go to today |
| `r` | Refresh events from Google Calendar |
| `q` / `Ctrl+C` | Quit |

## Project Structure

```
lazycal/
├── index.ts              # Main TUI application
├── google-calendar.ts    # Google Calendar API integration
├── package.json          # Project dependencies
├── setup-google-calendar.sh  # Setup helper script
└── README.md            # This file
```

## Development

```bash
# Run in development mode
bun run dev

# Type checking
bun run typecheck
```

## Requirements

- [Bun](https://bun.sh) v1.2.0+
- [Zig](https://ziglang.org/) (for OpenTUI compilation)
- Google Calendar API credentials (optional)

## License

MIT

## Acknowledgments

Built with [OpenTUI](https://github.com/anomalyco/opentui) - A powerful TypeScript library for building terminal user interfaces.
