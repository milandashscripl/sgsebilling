const http = require('http');

const API_HOST = 'localhost';
const API_PORT = 5001;

const request = (method, path, token = null, body = null) => {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      'Accept': 'application/json'
    };
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request({
      hostname: API_HOST,
      port: API_PORT,
      path,
      method,
      headers
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const result = { statusCode: res.statusCode, headers: res.headers, body };
        if (!body) return resolve(result);
        try {
          result.data = JSON.parse(body);
          resolve(result);
        } catch (err) {
          reject(new Error(`Failed JSON parse for ${path}: ${err.message} - body: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
};

(async () => {
  try {
    const unique = Date.now();
    const userEmail = `testuser+${unique}@example.com`;

    console.log('1) Registering user...');
    const register = await request('POST', '/api/auth/register', null, {
      name: `Test User ${unique}`,
      email: userEmail,
      password: 'Test1234',
      role: 'user'
    });
    console.log('register', register.statusCode, register.data?.message || register.data?.user?.email);
    if (register.statusCode !== 201) throw new Error('Registration failed');
    const token = register.data.token;

    console.log('2) Logging in...');
    const login = await request('POST', '/api/auth/login', null, {
      email: userEmail,
      password: 'Test1234'
    });
    console.log('login', login.statusCode, login.data?.user?.email);
    if (login.statusCode !== 200) throw new Error('Login failed');

    console.log('3) Fetching current user /auth/me...');
    const me = await request('GET', '/api/auth/me', token);
    console.log('me', me.statusCode, me.data?.user?.email);
    if (me.statusCode !== 200) throw new Error('/auth/me failed');

    console.log('4) Creating item type...');
    const itemType = await request('POST', '/api/item-types', token, {
      name: `TestType ${unique}`,
      unit: 'pcs',
      sgstRate: 9,
      cgstRate: 9,
      igstRate: 0,
      description: 'Test item type'
    });
    console.log('itemType', itemType.statusCode, itemType.data?.id);
    if (itemType.statusCode !== 201) throw new Error('Item type creation failed');

    console.log('5) Creating category...');
    const category = await request('POST', '/api/categories', token, {
      name: `TestCategory ${unique}`,
      description: 'Test category'
    });
    console.log('category', category.statusCode, category.data?.id);
    if (category.statusCode !== 201) throw new Error('Category creation failed');

    console.log('6) Creating item...');
    const item = await request('POST', '/api/items', token, {
      name: `Test Item ${unique}`,
      itemTypeId: itemType.data.id,
      itemType: itemType.data.name,
      categoryId: category.data.id,
      category: category.data.name,
      specification: 'Spec example',
      unit: 'pcs',
      purchasePrice: 50,
      salePrice: 85,
      sgstRate: 9,
      cgstRate: 9,
      igstRate: 0,
      stock: 12,
      description: 'Test item description'
    });
    console.log('item', item.statusCode, item.data?.id);
    if (item.statusCode !== 201) throw new Error('Item creation failed');

    console.log('7) Creating invoice...');
    const invoice = await request('POST', '/api/invoices', token, {
      items: [
        {
          itemId: item.data.id,
          name: item.data.name,
          quantity: 2,
          price: 85,
          sgstRate: 9,
          cgstRate: 9,
          igstRate: 0
        }
      ],
      type: 'sale',
      partyName: 'Test Customer',
      partyPhone: '1234567890',
      customerName: 'Test Customer',
      customerPhone: '1234567890',
      paidAmount: 170,
      notes: 'Test invoice'
    });
    console.log('invoice', invoice.statusCode, invoice.data?.id, invoice.data?.invoiceNumber);
    if (invoice.statusCode !== 201) throw new Error('Invoice creation failed');

    console.log('8) Fetching items list...');
    const itemsList = await request('GET', '/api/items', token);
    console.log('items list', itemsList.statusCode, (itemsList.data || []).length);
    
    console.log('9) Fetching item types list...');
    const itemTypesList = await request('GET', '/api/item-types', token);
    console.log('item types list', itemTypesList.statusCode, (itemTypesList.data || []).length);

    console.log('10) Fetching categories list...');
    const categoriesList = await request('GET', '/api/categories', token);
    console.log('categories list', categoriesList.statusCode, (categoriesList.data || []).length);

    console.log('11) Fetching invoices list...');
    const invoicesList = await request('GET', '/api/invoices', token);
    console.log('invoices list', invoicesList.statusCode, (invoicesList.data || []).length);

    console.log('12) Fetching reports summary...');
    const reportSummary = await request('GET', '/api/reports/summary', token);
    console.log('report summary', reportSummary.statusCode, JSON.stringify(reportSummary.data));

    console.log('13) Creating accounting account...');
    const account = await request('POST', '/api/accounting/accounts', token, {
      name: `Test Account ${unique}`,
      type: 'cash',
      openingBalance: 1000,
      notes: 'Test account'
    });
    console.log('account', account.statusCode, account.data?.id);
    if (account.statusCode !== 201) throw new Error('Account creation failed');

    console.log('14) Creating transaction...');
    const transaction = await request('POST', '/api/accounting/transactions', token, {
      date: new Date().toISOString().slice(0, 10),
      accountId: account.data.id,
      type: 'income',
      amount: 250,
      paymentMethod: 'cash',
      reference: 'TXTest',
      note: 'Test transaction'
    });
    console.log('transaction', transaction.statusCode, transaction.data?.id);
    if (transaction.statusCode !== 201) throw new Error('Transaction creation failed');

    console.log('15) Creating expense...');
    const expense = await request('POST', '/api/accounting/expenses', token, {
      date: new Date().toISOString().slice(0, 10),
      category: 'Test Expense',
      amount: 75,
      accountId: account.data.id,
      paymentMethod: 'cash',
      note: 'Test expense'
    });
    console.log('expense', expense.statusCode, expense.data?.id);
    if (expense.statusCode !== 201) throw new Error('Expense creation failed');

    console.log('16) Fetching accounting summary...');
    const accountingSummary = await request('GET', '/api/accounting/summary', token);
    console.log('accounting summary', accountingSummary.statusCode, JSON.stringify(accountingSummary.data));

    console.log('\n✅ All CRUD operations completed successfully.');
  } catch (error) {
    console.error('\n❌ CRUD test failed:', error.message);
    process.exit(1);
  }
})();
