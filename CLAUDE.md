# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js package that converts semicolon-delimited CSV files containing multiple choice questions into QTI 2.1 packages for Blackboard import. The tool provides both CLI and Backend API functionality, generating compliant assessment packages with proper XML structure and optional image downloading.

**Dual Usage:**
- **CLI Mode**: Command line tool for direct file conversion
- **API Mode**: Backend functions returning buffers for web applications

## Key Commands

### CLI Usage
```bash
# Install dependencies
npm install

# Run the converter
node convert-csv-to-qti.js <input.csv> <output.zip>

# With image download (embeds images into ZIP)
node convert-csv-to-qti.js <input.csv> <output.zip> --download-images

# Custom options
node convert-csv-to-qti.js <input.csv> <output.zip> --delimiter=";" --title="Custom Pool Name" --media-dir="images"
```

### Backend API Usage
```javascript
const { convertCsvToQtiBuffer, convertRowsToQtiBuffer } = require('./lib/api');

// Convert CSV string to buffer
const qtiBuffer = await convertCsvToQtiBuffer(csvString, options);

// Convert row arrays to buffer  
const qtiBuffer = await convertRowsToQtiBuffer(rows, options);
```

## CSV Format Schema

The tool expects semicolon-delimited CSV with these columns:
- Column 0: `type` (currently only "MC" supported)
- Column 1: `identifier` (question ID like Mat_5348_6700)
- Column 2: `points` (numeric score)
- Column 3: `prompt` (HTML content, often contains `<img src="...">`)
- Column 4: `correct` (answer key: A/B/C/D)
- Columns 5-8: `choiceA-D` (optional choice text, defaults to A/B/C/D labels)

## Architecture

### File Structure
```
├── convert-csv-to-qti.js    # CLI entry point with shared helper functions
├── lib/
│   └── api.js               # Backend API functions
├── example-backend-usage.js # Usage examples
└── package.json             # Exports both CLI and API
```

### Core Components

- **CLI Module (`convert-csv-to-qti.js`)**: Command line interface with file I/O
- **API Module (`lib/api.js`)**: Backend functions returning buffers
- **CSV Parser**: Uses `csv-parse` with custom options for semicolon delimiter and UTF-8 BOM support
- **QTI Generator**: Creates compliant QTI 2.1 XML using manual XML construction for better HTML handling
- **Image Handler**: Downloads and embeds images using `axios` with local path rewriting
- **ZIP Packager**: Uses `archiver` to create final QTI package with manifest

### Shared Functions (exported from CLI module)
- `cleanHtmlPrompt()`: Sanitizes HTML content
- `extractFirstImageUrl()`: Extracts image URLs from HTML
- `replaceImageSrc()`: Updates image sources to local paths
- `buildAssessmentItemXml()`: Creates QTI item XML
- `buildAssessmentTestXml()`: Generates test structure
- `buildManifestXml()`: Creates IMS package manifest
- `downloadToBuffer()`: Downloads images as buffers

### XML Structure

Generates three main XML files:
1. `imsmanifest.xml` - Package manifest with resource declarations
2. `assessmentTest.xml` - Test structure with item references
3. `{identifier}.xml` - Individual assessment items (one per question)

### API Functions (`lib/api.js`)

- `convertCsvToQtiBuffer(csvString, options)`: Main API function for CSV string input
- `convertRowsToQtiBuffer(rows, options)`: API function for row array input

Both functions:
- Accept same options as CLI (title, downloadImages, mediaDir, etc.)
- Return Promise<Buffer> with QTI ZIP content
- Handle memory-based ZIP creation without file I/O
- Use shared helper functions from CLI module

## Dependencies

- `xmlbuilder2`: QTI XML generation with namespace support
- `csv-parse`: CSV parsing with Turkish character support
- `archiver`: ZIP package creation
- `axios`: Image downloading with timeout handling
- `yargs`: CLI argument parsing
- `sanitize-filename`: Safe filename generation for cross-platform compatibility

## Important Notes

### CLI vs API Mode
- **CLI mode**: Runs when `require.main === module` (direct execution)
- **API mode**: Functions exported via `module.exports` for programmatic use
- **No code duplication**: API module imports and reuses all helper functions from CLI
- **Full compatibility**: Both modes support all features (image download, custom options, etc.)

### Backend Integration
- Import API functions: `require('csv-to-qti-blackboard/api')`
- Functions return buffers, not files - suitable for web APIs
- Memory-efficient: No temporary file creation
- Error handling: Throws errors that can be caught and handled appropriately