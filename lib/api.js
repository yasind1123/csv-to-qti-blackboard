const { parse } = require("csv-parse");
const Archiver = require("archiver");
const axios = require("axios");
const sanitize = require("sanitize-filename");
const path = require("path");

// Import helper functions from CLI module
const {
  cleanHtmlPrompt,
  extractFirstImageUrl,
  replaceImageSrc,
  buildAssessmentItemXml,
  buildAssessmentTestXml,
  buildManifestXml,
  downloadToBuffer
} = require("../convert-csv-to-qti.js");

/**
 * Backend API için CSV string'ini QTI Buffer'a dönüştürür
 * @param {string} csvString - CSV içeriği (string olarak)
 * @param {Object} options - Dönüştürme seçenekleri
 * @returns {Promise<Buffer>} QTI ZIP paketi buffer'ı
 */
async function convertCsvToQtiBuffer(csvString, options = {}) {
  const {
    delimiter = ";",
    title = "CSV'den Aktarılan Havuz",
    downloadImages = false,
    mediaDir = "media",
    testId,
    navigationMode = "nonlinear",
    submissionMode = "individual",
    shuffle = false,
    maxChoices = 1
  } = options;

  // CSV'yi parse et
  const rows = await new Promise((resolve, reject) => {
    const out = [];
    const parser = parse({
      delimiter,
      bom: true,
      relax_quotes: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true
    });

    parser.on("data", rec => out.push(rec));
    parser.on("error", reject);
    parser.on("end", () => resolve(out));
    
    parser.write(csvString);
    parser.end();
  });

  if (!rows.length) {
    throw new Error("CSV boş görünüyor.");
  }

  // Memory-based ZIP oluştur
  const zip = Archiver("zip", { zlib: { level: 9 } });
  const buffers = [];

  zip.on('data', (chunk) => buffers.push(chunk));

  const finalTestId = testId || ("TEST-" + Math.random().toString(36).slice(2, 10).toUpperCase());
  const testHref = "assessmentTest.xml";
  const itemRefs = [];
  const itemsXml = [];

  const willEmbed = !!downloadImages;
  const usedMediaNames = new Set();

  // Her satırdan item üret
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    const type = (r[0] || "").toString().toUpperCase();
    if (type && type !== "MC") {
      continue;
    }

    let identifier = (r[1] || `Q${String(i + 1).padStart(4, "0")}`).toString().trim();
    identifier = sanitize(identifier) || `Q${String(i + 1).padStart(4, "0")}`;

    const pointsRaw = r[2];
    const points = isFinite(pointsRaw) ? Number(pointsRaw) : parseFloat(pointsRaw) || 1.0;

    let promptHtml = cleanHtmlPrompt(r[3] || "");
    let correct = (r[4] || "A").toString().trim().toUpperCase();
    if (!["A", "B", "C", "D"].includes(correct)) correct = "A";

    const questionTitle = (r[9] || identifier).toString().trim();

    // Görsel gömme opsiyonu
    if (willEmbed) {
      try {
        const url = extractFirstImageUrl(promptHtml);
        if (url) {
          const ext = path.extname(new URL(url).pathname) || ".png";
          let mediaName = sanitize(`${identifier}${ext}`) || `${identifier}.png`;
          let cnt = 1;
          while (usedMediaNames.has(mediaName)) {
            mediaName = sanitize(`${identifier}_${cnt}${ext}`) || `${identifier}_${cnt}.png`;
            cnt++;
          }
          usedMediaNames.add(mediaName);

          const buf = await downloadToBuffer(url);
          zip.append(buf, { name: `${mediaDir}/${mediaName}` });
          promptHtml = replaceImageSrc(promptHtml, `${mediaDir}/${mediaName}`);
        }
      } catch (err) {
        // Hata durumunda sessizce devam et
      }
    }

    const itemXml = buildAssessmentItemXml({
      identifier,
      title: questionTitle,
      points,
      promptHtml,
      correct,
      shuffle,
      maxChoices
    });

    const itemFile = `${identifier}.xml`;
    itemsXml.push({ file: itemFile, xml: itemXml });

    itemRefs.push({
      refId: `REF-${identifier}`,
      href: itemFile
    });
  }

  if (!itemsXml.length) {
    throw new Error("Hiç soru üretilmedi. CSV formatını kontrol edin.");
  }

  // XML'leri oluştur
  const testXml = buildAssessmentTestXml(finalTestId, title, itemRefs, navigationMode, submissionMode);
  const manifestXml = buildManifestXml(
    { identifier: `RES-${finalTestId}`, href: testHref },
    itemsXml.map(it => ({ identifier: `RES-${path.basename(it.file, ".xml")}`, href: it.file }))
  );

  // ZIP'e ekle
  zip.append(manifestXml, { name: "imsmanifest.xml" });
  zip.append(testXml, { name: testHref });
  for (const it of itemsXml) {
    zip.append(it.xml, { name: it.file });
  }

  // ZIP'i finalize et ve buffer döndür
  await zip.finalize();
  
  return new Promise((resolve, reject) => {
    zip.on('end', () => {
      resolve(Buffer.concat(buffers));
    });
    zip.on('error', reject);
  });
}

/**
 * CSV satırlarını parse ederek QTI Buffer'a dönüştürür
 * @param {Array<Array<string>>} rows - CSV satır dizisi
 * @param {Object} options - Dönüştürme seçenekleri
 * @returns {Promise<Buffer>} QTI ZIP paketi buffer'ı
 */
async function convertRowsToQtiBuffer(rows, options = {}) {
  // Satırları CSV string'e çevir
  const csvString = rows.map(row => 
    row.map(cell => 
      typeof cell === 'string' && cell.includes(';') ? `"${cell}"` : cell
    ).join(';')
  ).join('\n');
  
  return convertCsvToQtiBuffer(csvString, options);
}

module.exports = {
  convertCsvToQtiBuffer,
  convertRowsToQtiBuffer
};