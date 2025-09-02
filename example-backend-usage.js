const { convertCsvToQtiBuffer, convertRowsToQtiBuffer } = require('./lib/api');

// Backend kullanım örneği
async function example() {
  // CSV string olarak
  const csvData = `MC;Test_Question_1;10;Hangi seçenek doğru?;A;Seçenek A;Seçenek B;Seçenek C;Seçenek D;Test Sorusu 1
MC;Test_Question_2;15;<img src="https://example.com/image.jpg"/> Bu görselde ne görülüyor?;B;A seçeneği;B seçeneği;C seçeneği;D seçeneği;Görsel Soru`;

  try {
    // Buffer olarak QTI paketi al
    const qtiBuffer = await convertCsvToQtiBuffer(csvData, {
      title: 'Backend Test Havuzu',
      downloadImages: true,
      mediaDir: 'images'
    });

    console.log('QTI paketi oluşturuldu, boyut:', qtiBuffer.length, 'bytes');
    
    // Express.js ile kullanım örneği:
    /*
    app.post('/convert-csv', async (req, res) => {
      const csvData = req.body.csvData;
      const qtiBuffer = await convertCsvToQtiBuffer(csvData, {
        title: req.body.title || 'API Dönüşümü',
        downloadImages: req.body.downloadImages || false
      });
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="quiz.zip"');
      res.send(qtiBuffer);
    });
    */

    // Satır dizisi olarak da kullanabilirsiniz:
    const rows = [
      ['MC', 'Q1', '10', 'Soru 1?', 'A', 'A', 'B', 'C', 'D', 'Soru 1'],
      ['MC', 'Q2', '20', 'Soru 2?', 'B', 'A', 'B', 'C', 'D', 'Soru 2']
    ];
    
    const qtiBuffer2 = await convertRowsToQtiBuffer(rows, {
      title: 'Satır Dizisi Test'
    });
    
    console.log('İkinci paket oluşturuldu, boyut:', qtiBuffer2.length, 'bytes');
    
  } catch (error) {
    console.error('Hata:', error.message);
  }
}

// Test et (eğer doğrudan çalıştırılıyorsa)
if (require.main === module) {
  example();
}