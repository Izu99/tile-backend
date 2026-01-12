# Business Management Backend API

A modern, secure Node.js Express MongoDB backend for a comprehensive business management application.

## 🚀 Features

- **Authentication & Authorization** - JWT-based auth with bcrypt password hashing
- **Supplier Management** - CRUD operations with search and pagination
- **Purchase Orders** - Full lifecycle management with file uploads
- **Quotations & Invoices** - Project-based document management with payment tracking
- **Material Sales** - Track material sales with profit calculations
- **Job Cost Analysis** - Comprehensive project cost tracking and profit analysis
- **Dashboard Analytics** - Real-time KPIs, revenue trends, and profit breakdowns
- **Comprehensive Reports** - Sales, profit, customer, supplier, and payment reports

## 🛠️ Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (jsonwebtoken) + bcrypt
- **Security**: Helmet, express-rate-limit, express-mongo-sanitize, HPP
- **Validation**: express-validator
- **File Upload**: Multer
- **Development**: Nodemon, Morgan (logging), Colors (console styling)

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas cloud)
- npm or yarn

## ⚙️ Installation

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Environment Configuration

Create a `.env` file in the server directory:

```env
NODE_ENV=development
PORT=5000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/business_management

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRE=30d

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000

# CORS
CORS_ORIGIN=*
```

### 3. Start MongoDB

**Local MongoDB:**
```bash
mongod
```

**MongoDB Atlas:**
Update `MONGODB_URI` in `.env` with your Atlas connection string.

### 4. Run the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:5000`

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login user | No |
| GET | `/auth/me` | Get current user | Yes |
| PUT | `/auth/profile` | Update profile | Yes |
| PUT | `/auth/change-password` | Change password | Yes |

### Supplier Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/suppliers` | Get all suppliers (paginated) |
| GET | `/suppliers/:id` | Get single supplier |
| POST | `/suppliers` | Create supplier |
| PUT | `/suppliers/:id` | Update supplier |
| DELETE | `/suppliers/:id` | Delete supplier |

### Purchase Order Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/purchase-orders` | Get all POs (with filters) |
| GET | `/purchase-orders/:id` | Get single PO |
| POST | `/purchase-orders` | Create PO |
| PUT | `/purchase-orders/:id` | Update PO |
| PATCH | `/purchase-orders/:id/status` | Update PO status |
| POST | `/purchase-orders/:id/invoice-image` | Upload invoice image |
| DELETE | `/purchase-orders/:id` | Delete PO |

### Quotation/Invoice Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/quotations` | Get all documents |
| GET | `/quotations/:id` | Get single document |
| POST | `/quotations` | Create quotation |
| PUT | `/quotations/:id` | Update document |
| PATCH | `/quotations/:id/convert-to-invoice` | Convert to invoice |
| PATCH | `/quotations/:id/status` | Update status |
| POST | `/quotations/:id/payments` | Add payment |
| DELETE | `/quotations/:id` | Delete document |

### Material Sale Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/material-sales` | Get all material sales |
| GET | `/material-sales/:id` | Get single sale |
| POST | `/material-sales` | Create sale |
| PUT | `/material-sales/:id` | Update sale |
| POST | `/material-sales/:id/payments` | Add payment |
| PATCH | `/material-sales/:id/status` | Update status |
| DELETE | `/material-sales/:id` | Delete sale |

### Job Cost Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/job-costs` | Get all job costs |
| GET | `/job-costs/:id` | Get single job cost |
| POST | `/job-costs` | Create job cost |
| PUT | `/job-costs/:id` | Update job cost |
| DELETE | `/job-costs/:id` | Delete job cost |

### Dashboard Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard/stats` | Get dashboard KPIs |
| GET | `/dashboard/charts/revenue-trend` | Get revenue trend data |
| GET | `/dashboard/charts/profit-breakdown` | Get profit breakdown |
| GET | `/dashboard/actionable-items` | Get actionable items |

### Report Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/reports/sales-summary` | Get sales summary |
| GET | `/reports/profit-analysis` | Get profit analysis |
| GET | `/reports/customer-summary` | Get customer summary |
| GET | `/reports/supplier-summary` | Get supplier summary |
| GET | `/reports/outstanding-payments` | Get outstanding payments |

## 🔐 Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Example: Register and Login

**Register:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "companyName": "My Business"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

## 📂 Project Structure

```
server/
├── config/
│   └── database.js          # MongoDB connection
├── controllers/
│   ├── authController.js
│   ├── supplierController.js
│   ├── purchaseOrderController.js
│   ├── quotationController.js
│   ├── materialSaleController.js
│   ├── jobCostController.js
│   ├── dashboardController.js
│   └── reportController.js
├── middleware/
│   ├── auth.js              # JWT authentication
│   ├── errorHandler.js      # Error handling
│   └── validation.js        # Request validation
├── models/
│   ├── User.js
│   ├── Supplier.js
│   ├── PurchaseOrder.js
│   ├── QuotationDocument.js
│   ├── MaterialSale.js
│   └── JobCost.js
├── routes/
│   ├── authRoutes.js
│   ├── supplierRoutes.js
│   ├── purchaseOrderRoutes.js
│   ├── quotationRoutes.js
│   ├── materialSaleRoutes.js
│   ├── jobCostRoutes.js
│   ├── dashboardRoutes.js
│   └── reportRoutes.js
├── utils/
│   ├── responseHandler.js   # Standardized responses
│   └── idGenerator.js       # Auto-increment IDs
├── .env                     # Environment variables
├── .gitignore
├── package.json
└── server.js                # Main entry point
```

## 🧪 Testing

Use tools like **Thunder Client**, **Postman**, or **Insomnia** to test the API endpoints.

### Health Check
```bash
curl http://localhost:5000/api/health
```

## 🔒 Security Features

- **Helmet** - Secure HTTP headers
- **Rate Limiting** - Prevent brute force attacks
- **NoSQL Injection Prevention** - Sanitize MongoDB queries
- **HPP** - HTTP parameter pollution prevention
- **CORS** - Cross-origin resource sharing configured
- **JWT** - Secure token-based authentication
- **Bcrypt** - Password hashing with salt

## 🚀 Deployment

For production deployment:

1. Set `NODE_ENV=production` in `.env`
2. Use a strong `JWT_SECRET`
3. Configure `CORS_ORIGIN` to your frontend domain
4. Use MongoDB Atlas for database
5. Deploy to platforms like:
   - Heroku
   - AWS EC2
   - Digital Ocean
   - Vercel (serverless)
   - Railway

## 📝 License

ISC

## 👨‍💻 Author

Your Name

---

**Happy Coding! 🎉**
