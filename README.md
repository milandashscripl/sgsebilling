# SGSE Billing

A polished MERN stack billing and inventory platform for stock, sales, purchase, returns, payments, and bills.

## Features
- Multi-user auth with admin and user roles
- Stock and item management
- Single-price billing with GST support
- Purchases, returns, payments, and invoices
- Reports and print-ready summaries

## Local development
- Backend: npm install && npm run dev
- Frontend: npm install && npm run dev

## Deployment notes
- Backend: deploy to Render as a Node web service
- Frontend: deploy to Netlify from the frontend folder
- Set environment variables in Render and Netlify

## Render environment variables
- PORT=10000
- MONGODB_URI=your_mongodb_connection_string
- JWT_SECRET=your_secret

## Netlify environment variables
- VITE_API_URL=https://your-render-backend-url/api
