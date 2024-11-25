const Imap = require('imap');
const { simpleParser } = require('mailparser');
const cheerio = require('cheerio');

class EmailVerifier {
  constructor() {
    this.imap = null;
  }

  createImapConnection() {
    return new Imap({
      user: process.env.EMAIL_USER,
      password: process.env.EMAIL_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      keepalive: false, // Don't keep connection alive
      debug: console.log // Add debug logging
    });
  }

  async findPaymentEmail(identifier, amount, fromUsername, timeWindow = 120) {
    return new Promise(async (resolve, reject) => {
      try {
        this.imap = this.createImapConnection();

        this.imap.once('ready', () => {
          this.imap.openBox('INBOX', false, async (err, box) => {
            if (err) {
              console.error('Error opening inbox:', err);
              this.imap.end();
              return reject(err);
            }

            const searchCriteria = [
              ['FROM', 'cash@square.com'],
              ['SINCE', new Date(Date.now() - (timeWindow * 60 * 1000))]
            ];

            this.imap.search(searchCriteria, (searchErr, results) => {
              if (searchErr) {
                this.imap.end();
                return reject(searchErr);
              }

              const emails = [];
              let completed = 0;

              const fetch = this.imap.fetch(results, { bodies: '' });

              fetch.on('message', (msg) => {
                msg.on('body', (stream) => {
                  simpleParser(stream, (parseErr, parsed) => {
                    if (parseErr) return;

                    try {
                      if (parsed.subject?.includes('sent you')) {
                        const $ = cheerio.load(parsed.html);
                        
                        // Extract all payment details
                        const amountText = $('.amount-text span').text().trim();
                        const parsedAmount = parseFloat(amountText.replace(/[^0-9.]/g, ''));
                        
                        const fromText = $('.text.profile-name').text().trim();
                        
                        const descText = $('.profile-description .text').text().trim();
                        const usernameMatch = descText.match(/Payment from \$(\w+)/);
                        const cashappUsername = usernameMatch ? usernameMatch[1] : '';
                        
                        let emailIdentifier = '';
                        $('.detail-row').each((i, row) => {
                          const label = $(row).find('.label').text().trim();
                          if (label === 'Identifier') {
                            emailIdentifier = $(row).find('.value').text().trim();
                          }
                        });

                        // Only add if identifier matches or if no identifier provided
                        if (!identifier || emailIdentifier === identifier) {
                          emails.push({
                            amount: parsedAmount,
                            from: fromText,
                            cashappUsername,
                            identifier: emailIdentifier,
                            timestamp: parsed.date,
                            subject: parsed.subject,
                            verified: identifier ? (emailIdentifier === identifier) : false
                          });
                        }
                      }
                    } catch (error) {
                      console.error('Processing error:', error);
                    }

                    completed++;
                    if (completed === results.length) {
                      this.imap.end();
                      resolve(emails);
                    }
                  });
                });
              });

              fetch.once('error', (fetchErr) => {
                this.imap.end();
                reject(fetchErr);
              });
            });
          });
        });

        this.imap.connect();

      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = new EmailVerifier(); 