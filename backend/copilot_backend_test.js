const http = require('http');
const email = `test${Date.now()}@example.com`;
const data = JSON.stringify({ name: `Test ${email}`, email, password: 'Test1234', role: 'user' });

const registerReq = http.request(
  {
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  },
  (res) => {
    let body = '';
    res.on('data', (chunk) => (body += chunk));
    res.on('end', () => {
      console.log('register-status', res.statusCode);
      console.log(body);
      if (res.statusCode !== 201) return;
      const token = JSON.parse(body).token;
      const itemData = JSON.stringify({ name: 'Test Item', purchasePrice: 10, salePrice: 15, stock: 100 });
      const itemReq = http.request(
        {
          hostname: 'localhost',
          port: 5001,
          path: '/api/items',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(itemData),
            Authorization: 'Bearer ' + token
          }
        },
        (itemRes) => {
          let itemBody = '';
          itemRes.on('data', (chunk) => (itemBody += chunk));
          itemRes.on('end', () => {
            console.log('item-status', itemRes.statusCode);
            console.log(itemBody);
          });
        }
      );
      itemReq.on('error', (e) => console.error('item-err', e.message));
      itemReq.write(itemData);
      itemReq.end();
    });
  }
);
registerReq.on('error', (e) => console.error('register-err', e.message));
registerReq.write(data);
registerReq.end();
