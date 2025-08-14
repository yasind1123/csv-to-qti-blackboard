# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js CLI tool that converts semicolon-delimited CSV files containing multiple choice questions into QTI 2.1 packages for Blackboard import. The tool generates compliant assessment packages with proper XML structure and optional image downloading.

## Key Commands

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

## CSV Format Schema

The tool expects semicolon-delimited CSV with these columns:
- Column 0: `type` (currently only "MC" supported)
- Column 1: `identifier` (question ID like Mat_5348_6700)
- Column 2: `points` (numeric score)
- Column 3: `prompt` (HTML content, often contains `<img src="...">`)
- Column 4: `correct` (answer key: A/B/C/D)
- Columns 5-8: `choiceA-D` (optional choice text, defaults to A/B/C/D labels)

## Architecture

### Core Components

- **CSV Parser**: Uses `csv-parse` with custom options for semicolon delimiter and UTF-8 BOM support
- **QTI Generator**: Creates compliant QTI 2.1 XML using `xmlbuilder2` with proper namespaces
- **Image Handler**: Downloads and embeds images using `axios` with local path rewriting
- **ZIP Packager**: Uses `archiver` to create final QTI package with manifest

### XML Structure

Generates three main XML files:
1. `imsmanifest.xml` - Package manifest with resource declarations
2. `assessmentTest.xml` - Test structure with item references
3. `{identifier}.xml` - Individual assessment items (one per question)

### Key Functions

- `buildAssessmentItemXml()`: Creates QTI item XML with response processing template
- `buildAssessmentTestXml()`: Generates test structure with navigation settings
- `buildManifestXml()`: Creates IMS package manifest with proper resource mapping
- Image handling: `extractFirstImageUrl()`, `replaceImageSrc()`, `downloadToBuffer()`

## Dependencies

- `xmlbuilder2`: QTI XML generation with namespace support
- `csv-parse`: CSV parsing with Turkish character support
- `archiver`: ZIP package creation
- `axios`: Image downloading with timeout handling
- `yargs`: CLI argument parsing
- `sanitize-filename`: Safe filename generation for cross-platform compatibility