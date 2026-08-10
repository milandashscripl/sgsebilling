const http = require('http');

const API_HOST = 'localhost';
const API_PORT = 5001;

const request = (method, path, body, token) => {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Accept': 'application/json' };
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({ hostname: API_HOST, port: API_PORT, path, method, headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
};

(async () => {
  try {
    const unique = Date.now();
    const userEmail = `debug${unique}@example.com`;

    const register = await request('POST', '/api/auth/register', { name: 'Debug User', email: userEmail, password: 'Test1234', role: 'user' });
    console.log('register', register.statusCode, register.body);
    const token = JSON.parse(register.body).token;

    const invoicePayload = {
      items: [
        {
          itemId: '000000000000000000000000',
          name: 'Debug Item',
          quantity: 2,
          price: 85,
          sgstRate: 9,
          cgstRate: 9,
          igstRate: 0,
          total: 170
        }
      ],
      type: 'sale',
      partyName: 'Debug Customer',
      partyPhone: '1234567890',
      customerName: 'Debug Customer',
      customerPhone: '1234567890',
      paidAmount: 170,
      notes: 'Debug invoice'
    };

    const invoice = await request('POST', '/api/invoices', invoicePayload, token);
    console.log('invoice', invoice.statusCode, invoice.body);
  } catch (error) {
    console.error('ERR', error.message);
  }
})();
