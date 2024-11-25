const puppeteer = require('puppeteer');

class WebReceiptVerifier {
  async verifyReceipt(receiptUrl) {
    try {
      console.log('Received URL:', receiptUrl);
      console.log('URL type:', typeof receiptUrl);

      if (!receiptUrl || typeof receiptUrl !== 'string') {
        throw new Error('Invalid receipt URL provided');
      }

      // Ensure URL is properly formatted
      try {
        new URL(receiptUrl);
      } catch (urlError) {
        throw new Error('Invalid URL format');
      }

      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      
      try {
        await page.goto(receiptUrl, {
          waitUntil: 'networkidle0',
          timeout: 30000
        });

        // Find the identifier using a more specific approach
        const identifier = await page.evaluate(() => {
          // Look for text content that matches #XXXXXXX pattern
          const identifierRegex = /#[A-Z0-9]{7}/;
          const elements = Array.from(document.querySelectorAll('*'));
          
          for (const element of elements) {
            const text = element.textContent.trim();
            const match = text.match(identifierRegex);
            if (match) {
              return match[0]; // Return just the matched identifier
            }
          }
          return null;
        });

        console.log('Found identifier:', identifier);

        if (!identifier) {
          throw new Error('Could not find valid identifier');
        }

        return {
          identifier,
          verified: true,
          source: 'web_receipt'
        };

      } finally {
        await browser.close();
      }

    } catch (error) {
      console.error('Receipt verification error:', error);
      throw new Error(`Receipt verification failed: ${error.message}`);
    }
  }
}

module.exports = new WebReceiptVerifier(); 