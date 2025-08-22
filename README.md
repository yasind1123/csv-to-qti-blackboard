# CSV to QTI Blackboard Converter

Convert semicolon-delimited CSV files containing multiple choice questions into QTI 2.1 packages for Blackboard import.

## Installation

```bash
npm install -g csv-to-qti-blackboard
```

Or locally:
```bash
npm install csv-to-qti-blackboard
```

## Usage

The tool provides two equivalent command names:

```bash
# Using the primary command
convert-csv-to-qti input.csv output.zip

# Using the alternative command
csv-to-qti-blackboard input.csv output.zip
```

### Options

```bash
--delimiter        CSV delimiter (default: ";")
--encoding         CSV encoding (default: "utf8")
--title            Test title (default: "CSV'den Aktarılan Havuz")
--download-images  Download images into ZIP and localize sources (default: false)
--media-dir        Media folder inside ZIP (default: "media")
--test-id          Test ID (default: auto-generated)
--navigation-mode  Navigation mode: "linear" or "nonlinear" (default: "nonlinear")
--submission-mode  Submission mode: "individual" or "simultaneous" (default: "individual")
--shuffle          Shuffle choices (default: false)
--max-choices      Maximum number of choices (default: 1)
```

### Examples

```bash
# Basic conversion
convert-csv-to-qti questions.csv test.zip

# With custom title and image download
convert-csv-to-qti questions.csv test.zip --title="Math Test" --download-images

# With shuffled choices
csv-to-qti-blackboard questions.csv test.zip --shuffle --title="Quiz 1"
```

## CSV Format

The tool expects semicolon-delimited CSV with these columns:

- **Column 0**: `type` (currently only "MC" supported for Multiple Choice)
- **Column 1**: `identifier` (question ID like Mat_5348_6700)
- **Column 2**: `points` (numeric score)
- **Column 3**: `prompt` (HTML content, often contains `<img src="...">`)
- **Column 4**: `correct` (answer key: A/B/C/D)
- **Columns 5-8**: `choiceA-D` (optional choice text, defaults to A/B/C/D labels)
- **Column 9**: `title` (optional question title, defaults to identifier)

### Sample CSV

```csv
MC;76066;10;<img src="https://example.com/image1.png">;A;A;B;C;D
MC;76067;10;<img src="https://example.com/image2.png">;D;A;B;C;D
```

## Features

- ✅ **HTML Support**: Properly renders HTML content including images in Blackboard
- ✅ **Image Download**: Optional automatic image downloading and embedding
- ✅ **QTI 2.1 Compliance**: Generates standard-compliant QTI packages
- ✅ **Blackboard Compatible**: Tested with Blackboard Learn
- ✅ **UTF-8 Support**: Handles Turkish and other international characters
- ✅ **Flexible Options**: Customizable navigation, shuffling, and scoring

## Generated Package Structure

```
output.zip
├── imsmanifest.xml     # Package manifest
├── assessmentTest.xml  # Test structure
├── 76066.xml          # Individual question files
├── 76067.xml
└── media/             # Downloaded images (if --download-images used)
    ├── image1.png
    └── image2.png
```

## Troubleshooting

### Images Not Displaying in Blackboard

Make sure your CSV contains proper HTML image tags:
```html
<img src="https://example.com/image.png">
```

The tool now properly embeds HTML without CDATA wrapping, ensuring Blackboard renders images correctly.

### CSV Encoding Issues

If you see garbled characters, try specifying the encoding:
```bash
convert-csv-to-qti input.csv output.zip --encoding="utf8"
```

## License

MIT

## Credits

This tool was developed with assistance from [Claude Code](https://claude.ai/code) by Anthropic. Special thanks to Claude for helping implement proper HTML rendering in QTI packages and troubleshooting Blackboard compatibility issues! 🤖✨