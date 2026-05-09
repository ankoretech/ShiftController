# ShiftController Chrome Extension by Nayem Hasan

A powerful Chrome extension providing advanced shift management, workflow automation, and system control features with customizable configurations and developer tools.

<img width="1366" height="768" alt="image" src="https://github.com/user-attachments/assets/8f0a7699-89a0-4d2b-a396-43ca65c7beb6" />

## Features

-  **Advanced Configuration Management** - Flexible settings and profiles
-  **Interactive Interface** - Intuitive popup and dashboard
-  **Developer Dashboard** - Real-time monitoring and analytics
-  **Automation** - Background service worker capabilities
-  **Customizable** - Extensive configuration options
-  **Remote Config Support** - Dynamic configuration loading

## Quick Start
For general installations
### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/ShiftController.git
   cd ShiftController0.0.0.1
   ```

2. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select this directory

### Configuration

See [CONFIG_QUICK_START.md](CONFIG_QUICK_START.md) for quick setup instructions.

For advanced configuration, refer to [CONFIG_SYSTEM.md](CONFIG_SYSTEM.md).

## Project Structure

```
ShiftController0.0.0.1/
├── background/          # Service worker background processes
├── content/            # Content scripts for page injection
├── dashboard/          # Advanced dashboard interface
├── developer/          # Developer tools and utilities
├── popup/              # Extension popup menu
├── icons/              # Extension assets
├── remote_config/      # Remote configuration support
├── manifest.json       # Extension manifest
├── config.js           # Configuration module
├── config.json         # Default configuration
└── package.json        # Dependencies
```

## Documentation

- [Quick Start Guide](CONFIG_QUICK_START.md)
- [System Configuration](CONFIG_SYSTEM.md)
- [Implementation Details](IMPLEMENTATION.md)
<img width="1366" height="768" alt="image" src="https://github.com/user-attachments/assets/10631814-3eea-4856-b42e-254ba4a6ad64" />
<img width="1366" height="768" alt="image" src="https://github.com/user-attachments/assets/e4ddbb24-a03f-42bf-a905-606fa3267844" />

## Requirements

- Chrome/Chromium browser (v90+)
- Node.js 14+ (for development)
- npm 6+ (for package management)

## Usage

1. Click the ShiftController icon in the Chrome toolbar
2. Configure settings via the popup interface
3. Access advanced features via the dashboard
4. Use developer tools for monitoring and debugging

## Development

### Build from Source

```bash
# Install dependencies
npm install

# For development with file watching
npm start

# Build for production
npm run build
```

### Debugging

- Open `chrome://extensions/`
- Enable "Developer mode"
- Click "Inspect views" on this extension
- Use the developer console for debugging

## Version

**Current Version:** 0.0.0.1 


## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Author

Nayem Hasan

## Support

For issues and feature requests, please open an [issue](https://github.com/ankoretech/ShiftController/issues).

---

**Note:** This is an early development version. Features and API may change.
