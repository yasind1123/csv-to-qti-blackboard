#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { create } = require("xmlbuilder2");
const { parse } = require("csv-parse");
const Archiver = require("archiver");
const yargs = require("yargs");
const { hideBin } = require("yargs/helpers");
const axios = require("axios");
const sanitize = require("sanitize-filename");

/**
 * CSV şema varsayımı (noktalı virgül ; ile ayrılmış):
 * 0: type      -> "MC" (tek doğru şıklı çoktan seçmeli)
 * 1: identifier-> soru ID (örn: Mat_5348_6700)
 * 2: points    -> puan (örn: 10)
 * 3: prompt    -> HTML (sıklıkla <img src="..."> içeriyor)
 * 4: correct   -> A/B/C/D
 * 5: choiceA   -> varsa A seçeneği metni (opsiyonel)
 * 6: choiceB   -> varsa B seçeneği metni (opsiyonel)
 * 7: choiceC
 * 8: choiceD
 * 9: title     -> soru başlığı (opsiyonel, yoksa identifier kullanılır)
 *
 * Eğer 5–8 boşsa A–D olarak label basar; prompt içindeki görsel soruyu temsil eder.
 */

const QTI_NS = "http://www.imsglobal.org/xsd/imsqti_v2p1";
const IMSCP_NS = "http://www.imsglobal.org/xsd/imscp_v1p1";
const XSI_NS = "http://www.w3.org/2001/XMLSchema-instance";

function cleanHtmlPrompt(raw) {
  if (!raw || typeof raw !== "string") return "<p>Soru metni bulunamadı.</p>";
  // İç içe çift tırnakları normalize et
  let s = raw.trim().replace(/""/g, '"').replace(/^"+|"+$/g, "");
  return s;
}

function extractFirstImageUrl(html) {
  if (!html) return null;
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function replaceImageSrc(html, newSrc) {
  if (!html) return html;
  return html.replace(/(<img[^>]+src=["'])([^"']+)(["'])/i, `$1${newSrc}$3`);
}

function buildAssessmentItemXml({ identifier, title, points, promptHtml, correct, shuffle = false, maxChoices = 1 }) {
  // Manually construct the XML to have better control over HTML content
  const xmlString = `<?xml version="1.0" encoding="utf-8"?>
<assessmentItem xmlns="${QTI_NS}" identifier="${identifier}" title="${title}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>${correct}</value>
    </correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>${points}</value>
    </defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="${shuffle}" maxChoices="${maxChoices}">
      <prompt>${promptHtml}</prompt>
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
      <simpleChoice identifier="C">C</simpleChoice>
      <simpleChoice identifier="D">D</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p1/rptemplates/match_correct"/>
</assessmentItem>`;
  
  return xmlString;
}

function buildAssessmentTestXml(testId, title, itemRefs, navigationMode = "nonlinear", submissionMode = "individual") {
  const doc = create({ version: "1.0", encoding: "utf-8" })
    .ele("assessmentTest", { xmlns: QTI_NS, identifier: testId, title })
    .ele("testPart", { identifier: "part1", navigationMode, submissionMode })
    .ele("assessmentSection", { identifier: "section1", title: "Bölüm 1", visible: "true" });

  const section = doc;
  itemRefs.forEach(({ refId, href }) => {
    section.ele("assessmentItemRef", { identifier: refId, href }).up();
  });

  return section.up().up().end({ prettyPrint: true });
}

function buildManifestXml(testRes, itemResList) {
  const doc = create({ version: "1.0", encoding: "utf-8" })
    .ele("manifest", {
      xmlns: IMSCP_NS,
      "xmlns:imsqti": QTI_NS,
      "xmlns:xsi": XSI_NS,
      identifier: `MANIFEST-${Math.random().toString(36).slice(2, 10)}`,
      "xsi:schemaLocation": `${IMSCP_NS} http://www.imsglobal.org/xsd/imscp_v1p1.xsd ${QTI_NS} http://www.imsglobal.org/xsd/imsqti_v2p1.xsd`
    })
    .ele("organizations").up()
    .ele("resources");

  // Test resource
  const r = doc.ele("resource", {
    identifier: testRes.identifier,
    type: "imsqti_test_xmlv2p1",
    href: testRes.href
  });
  r.ele("file", { href: testRes.href }).up();
  r.up();

  // Item resources
  itemResList.forEach((res) => {
    const rr = doc.ele("resource", {
      identifier: res.identifier,
      type: "imsqti_item_xmlv2p1",
      href: res.href
    });
    rr.ele("file", { href: res.href }).up();
    rr.up();
  });

  return doc.up().end({ prettyPrint: true });
}

async function downloadToBuffer(url) {
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 20000 });
  return Buffer.from(res.data);
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .usage("Usage: $0 <input.csv> <output.zip> [options]")
    .demandCommand(2)
    .option("delimiter", { type: "string", default: ";", desc: "CSV delimiter" })
    .option("encoding", { type: "string", default: "utf8", desc: "CSV encoding" })
    .option("title", { type: "string", default: "CSV’den Aktarılan Havuz", desc: "Test başlığı" })
    .option("download-images", { type: "boolean", default: false, desc: "Görselleri ZIP içine indir ve kaynakları yerelleştir" })
    .option("media-dir", { type: "string", default: "media", desc: "ZIP içindeki medya klasörü" })
    .option("test-id", { type: "string", desc: "Test ID (varsayılan: otomatik oluşturulur)" })
    .option("navigation-mode", { type: "string", default: "nonlinear", choices: ["linear", "nonlinear"], desc: "Navigasyon modu" })
    .option("submission-mode", { type: "string", default: "individual", choices: ["individual", "simultaneous"], desc: "Gönderim modu" })
    .option("shuffle", { type: "boolean", default: false, desc: "Seçenekleri karıştır" })
    .option("max-choices", { type: "number", default: 1, desc: "Maksimum seçim sayısı" })
    .help()
    .argv;

  const inputCsv = path.resolve(String(argv._[0]));
  const outputZip = path.resolve(String(argv._[1]));
  const delimiter = argv.delimiter;

  if (!fs.existsSync(inputCsv)) {
    console.error("CSV bulunamadı:", inputCsv);
    process.exit(1);
  }

  // CSV'yi oku
  const rows = await new Promise((resolve, reject) => {
    const out = [];
    fs.createReadStream(inputCsv, { encoding: argv.encoding })
      .pipe(parse({
        delimiter,
        bom: true,
        relax_quotes: true,
        relax_column_count: true,
        skip_empty_lines: true,
        trim: true
      }))
      .on("data", rec => out.push(rec))
      .on("error", reject)
      .on("end", () => resolve(out));
  });

  if (!rows.length) {
    console.error("CSV boş görünüyor.");
    process.exit(1);
  }

  // ZIP hazırlığı
  const outStream = fs.createWriteStream(outputZip);
  const zip = Archiver("zip", { zlib: { level: 9 } });
  zip.pipe(outStream);

  const testId = argv["test-id"] || ("TEST-" + Math.random().toString(36).slice(2, 10).toUpperCase());
  const testHref = "assessmentTest.xml";
  const itemRefs = [];
  const itemsXml = [];

  const mediaDir = argv["media-dir"];
  const willEmbed = !!argv["download-images"];
  const usedMediaNames = new Set();

  // Her satırdan item üret
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    const type = (r[0] || "").toString().toUpperCase();
    if (type && type !== "MC") {
      // Şimdilik sadece MC destekliyoruz; diğerleri atlanır.
      continue;
    }

    let identifier = (r[1] || `Q${String(i + 1).padStart(4, "0")}`).toString().trim();
    identifier = sanitize(identifier) || `Q${String(i + 1).padStart(4, "0")}`;

    const pointsRaw = r[2];
    const points = isFinite(pointsRaw) ? Number(pointsRaw) : parseFloat(pointsRaw) || 1.0;

    let promptHtml = cleanHtmlPrompt(r[3] || "");
    let correct = (r[4] || "A").toString().trim().toUpperCase();
    if (!["A", "B", "C", "D"].includes(correct)) correct = "A";

    // Soru başlığı (9. sütun varsa kullan, yoksa identifier)
    const questionTitle = (r[9] || identifier).toString().trim();

    // Görsel gömme opsiyonu
    if (willEmbed) {
      try {
        const url = extractFirstImageUrl(promptHtml);
        if (url) {
          const ext = path.extname(new URL(url).pathname) || ".png";
          let mediaName = sanitize(`${identifier}${ext}`) || `${identifier}.png`;
          // Çakışma olursa arttır
          let cnt = 1;
          while (usedMediaNames.has(mediaName)) {
            mediaName = sanitize(`${identifier}_${cnt}${ext}`) || `${identifier}_${cnt}.png`;
            cnt++;
          }
          usedMediaNames.add(mediaName);

          const buf = await downloadToBuffer(url);
          zip.append(buf, { name: `${mediaDir}/${mediaName}` });
          // prompt içindeki src'yi lokal dosyaya çevir
          promptHtml = replaceImageSrc(promptHtml, `${mediaDir}/${mediaName}`);
        }
      } catch (err) {
        console.warn(`[Uyarı] Görsel indirilemedi (${identifier}):`, err.message);
      }
    }

    const itemXml = buildAssessmentItemXml({
      identifier,
      title: questionTitle,
      points,
      promptHtml,
      correct,
      shuffle: argv.shuffle,
      maxChoices: argv["max-choices"]
    });

    const itemFile = `${identifier}.xml`;
    itemsXml.push({ file: itemFile, xml: itemXml });

    itemRefs.push({
      refId: `REF-${identifier}`,
      href: itemFile
    });
  }

  if (!itemsXml.length) {
    console.error("Hiç soru üretilmedi. CSV formatını kontrol edin.");
    process.exit(1);
  }

  // assessmentTest.xml
  const testXml = buildAssessmentTestXml(testId, argv.title, itemRefs, argv["navigation-mode"], argv["submission-mode"]);

  // imsmanifest.xml
  const manifestXml = buildManifestXml(
    { identifier: `RES-${testId}`, href: testHref },
    itemsXml.map(it => ({ identifier: `RES-${path.basename(it.file, ".xml")}`, href: it.file }))
  );

  // ZIP’e yaz
  zip.append(manifestXml, { name: "imsmanifest.xml" });
  zip.append(testXml, { name: testHref });
  for (const it of itemsXml) {
    zip.append(it.xml, { name: it.file });
  }

  await zip.finalize();

  await new Promise((res, rej) => {
    outStream.on("close", res);
    outStream.on("error", rej);
  });

  console.log("QTI paket hazır:", outputZip);
}

// CLI çalıştırma - sadece doğrudan çalıştırıldığında
if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

// API kullanımı için fonksiyonları export et
module.exports = {
  cleanHtmlPrompt,
  extractFirstImageUrl,
  replaceImageSrc,
  buildAssessmentItemXml,
  buildAssessmentTestXml,
  buildManifestXml,
  downloadToBuffer
};
