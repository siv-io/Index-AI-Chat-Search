# Searcch

<div align="center">
  <img src="https://github.com/siv-io/Index-AI-Chat-Search/public/thumbnail.jpe" alt="Prompt Search Extension UI" width="400" />

</div>

## Search your AI chats with context

## Table of Contents

- [Features](#features)
- [Installation](#installation)
  - [Option 1: Download Pre-built Extension](#option-1-download-pre-built-extension-recommended)
  - [Option 2: Build from Source](#option-2-build-from-source)
- [How it Works](#how-it-works)
  - [Embedding Generation](#embedding-generation)
  - [Search Process](#search-process)
  - [How do I know my data is safe](#how-do-i-know-my-data-is-safe)
- [Usage](#usage)
- [Development](#development)
- [Known Issues](#known-issues)
- [Contributing](#contributing)
- [Privacy & Security](#privacy--security)
- [Attribution](#attribution)
- [Support](#support)

## Features

- 🔍 **Semantic Search**: Search through your chats with context and meaning
- 🔏 **Privacy First**: Your data never leaves your computer ([How it works](#how-it-works))
- 🤖 **Multi-Platform Support**: Works with ChatGPT, Claude, and Perplexity
- ⚡ **Fast & Efficient**: Local processing with vector embeddings
- 🔄 **Auto-Sync**: Automatically processes new conversations

## Installation

### Option 1: Download Pre-built Extension (Recommended)

1. Download the latest `.crx` file from the [Releases](https://github.com/siv-io/prompt_search_crxjs/releases) page
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Drag and drop the downloaded `.crx` file into the extensions page
5. Click "Add extension" when prompted

### Option 2: Build from Source

1. Clone this repository:

   ```bash
   git clone https://github.com/siv-io/prompt_search_crxjs.git
   cd prompt_search_crxjs
   ```

2. Install dependencies:

   ```bash
   yarn install
   ```

3. Build the extension:

   ```bash
   # For Chrome
   yarn build:chrome

   # For Firefox
   yarn build:firefox
   ```

4. Load the extension:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist_chrome` folder

## How It Works

### Embedding Generation

It used [Hugging Face Transformers](https://github.com/huggingface/transformers) to generate vector embeddings locally using the [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) model.

The embeddings are stored in local IndexDB database

- **Privacy**: All processing happens locally - no data sent to external servers
- **Performance**: Optimized for fast embedding generation
- **Compatibility**: Works within Chrome extension constraints (no CDN requests allowed)

The `ort-wasm-simd-threaded.jsep.mjs` file contains the ONNX Runtime WebAssembly module that powers the embedding generation. This file is bundled with the extension to comply with Chrome's Content Security Policy restrictions.

### Search Process

1. **Chat fetching**: The extension fetches your chats when you visit any of the supported AI sites — [Claude.ai](https://claude.ai), [ChatGPT.com](https://chatgpt.com), [Perplexity.ai](https://www.perplexity.ai)
2. **Embedding Generation**: Each conversation is then converted into a embeddings (basically your text is converted to numbers by a locally run model) that is used to find similar texts when you search
3. **Storage**: Embeddings are stored locally in IndexedDB for fast retrieval
4. **Search**: Your queries are converted to embeddings and compared against stored conversations
5. **Results**: Most similar conversations are returned with similarity scores

### How do I know my data is safe

All conversation data and embeddings are stored locally in **IndexedDB**. To inspect the stored data:

1. Right-click on the extension icon
2. Select "Inspect"
3. Go to the "Application" tab
4. Navigate to "IndexedDB" in the left sidebar
5. Expand the extension's database to view stored conversations and embeddings

## Usage

1. **Initial Setup**: After installation, the extension will automatically start collecting your conversations
2. **Wait for Processing**: Allow the extension to fetch and process your data (progress is shown in the popup)
3. **Search**: Click the extension icon and enter your search query
4. **Filter Results**: Use the filter buttons to narrow down results by platform or date range
5. **View Details**: Click on any result to open the original conversation

## Development

### Prerequisites

- Node.js 18+
- Yarn package manager

### Scripts

```bash
# Development
yarn dev:chrome    # Run Chrome extension in development mode
yarn dev:firefox   # Run Firefox extension in development mode

# Building
yarn build:chrome  # Build for Chrome
yarn build:firefox # Build for Firefox
```

### Project Structure

```
src/
├── pages/
│   ├── background/     # Service worker and background scripts
│   ├── content/        # Content scripts for each platform
│   ├── popup/          # Extension popup UI
│   └── options/        # Extension options page
├── assets/             # Static assets
└── locales/           # Internationalization files

database/              # Database schema and services
types/                 # TypeScript type definitions
```

## Known Issues

- **Old Thread Conversations**: Conversations in existing threads are not captured once the extension is initialized - Fix in progress

- **CSP Compliance**: The extension currently uses `'wasm-unsafe-eval'` Content Security Policy directive, which is not allowed in the Chrome Web Store.
  Ideally, an offscreen document should be used to generate embeddings to comply with Chrome's security requirements.

### 🔧 Minor Issues

- Large conversation datasets may take several minutes
- Rate limiting might affect chat retreival
- Embedding generation is CPU-intensive

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## Privacy & Security

- **Local Processing**: All data processing happens on your device
- **No External Requests**: No conversation data is sent to external servers
- **Secure Storage**: Data is stored locally using IndexedDB
- **Open Source**: Full source code is available for review

## License

This project is licensed under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.en).

## Attribution

This project uses code and inspiration from the following open-source projects:

- **[chatgpt-exporter](https://github.com/pionxzh/chatgpt-exporter)** - Used this repository to understand how to fetch ChatGPT conversations and implement the data extraction logic for ChatGPT chats.

## Support

If you encounter any issues or have questions:

1. Check the [Known Issues](#known-issues) section
2. Search existing [GitHub Issues](https://github.com/siv-io/prompt_search_crxjs/issues)
3. Create a new issue with detailed information about your problem

---

**Note**: This extension can access your private AI chats - however data never leaves your system
