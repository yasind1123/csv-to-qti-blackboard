# CSV to QTI Blackboard Converter

Convert semicolon-delimited CSV files containing multiple choice questions into QTI 2.1 packages for Blackboard import. 

**Now supports both CLI and Backend API usage!**

## Installation

```bash
npm install -g csv-to-qti-blackboard
```

Or locally:
```bash
npm install csv-to-qti-blackboard
```

## Usage

### CLI Usage (Command Line)

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

### Backend API Usage (Node.js)

For backend applications, you can use the package programmatically:

```javascript
const { convertCsvToQtiBuffer, convertRowsToQtiBuffer } = require('csv-to-qti-blackboard/api');

// Convert CSV string to QTI Buffer
async function convertCsv() {
  const csvData = `MC;Q1;10;What is 2+2?;A;4;3;5;6;Math Question`;
  
  const qtiBuffer = await convertCsvToQtiBuffer(csvData, {
    title: 'Backend Test',
    downloadImages: true,
    mediaDir: 'images'
  });
  
  // Use buffer (save to file, send as HTTP response, etc.)
  return qtiBuffer;
}

// Express.js example
app.post('/convert-csv', async (req, res) => {
  try {
    const qtiBuffer = await convertCsvToQtiBuffer(req.body.csvData, {
      title: req.body.title || 'Converted Quiz',
      downloadImages: req.body.downloadImages || false
    });
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="quiz.zip"');
    res.send(qtiBuffer);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Using with row arrays
const rows = [
  ['MC', 'Q1', '10', 'Question 1?', 'A', 'A', 'B', 'C', 'D', 'Title 1'],
  ['MC', 'Q2', '15', 'Question 2?', 'B', 'A', 'B', 'C', 'D', 'Title 2']
];

const qtiBuffer = await convertRowsToQtiBuffer(rows, {
  title: 'Array Test'
});
```

#### API Functions

- **`convertCsvToQtiBuffer(csvString, options)`**: Convert CSV string to QTI ZIP buffer
- **`convertRowsToQtiBuffer(rows, options)`**: Convert array of rows to QTI ZIP buffer

Both functions accept the same options as CLI (title, downloadImages, mediaDir, etc.).

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
- ✅ **Backend API**: Use programmatically in Node.js applications
- ✅ **Memory Efficient**: Backend API returns buffers without file I/O

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