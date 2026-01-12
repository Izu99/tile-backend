# API Testing Guide with Postman

Complete guide to test all backend API endpoints using Postman with sample data.

## 🚀 Setup

### 1. Install Postman
Download from: https://www.postman.com/downloads/

### 2. Start Your Server
```bash
cd server
npm run dev
```

Server should run on: `http://localhost:5000`

### 3. Base URL
```
http://localhost:5000/api
```

---

## 📋 Testing Workflow

Follow this order to test the complete flow:

1. **Health Check** - Verify server is running
2. **Super Admin Setup** - Create company via Super Admin (requires manual DB role update first)
3. **Login** - Get JWT token (as Company)
4. **Create Supplier** - Add supplier
5. **Create Purchase Order** - Test PO creation
6. **Create Quotation** - Test quotation
7. **Create Material Sale** - Test material sale
8. **Create Job Cost** - Test job cost
9. **Dashboard Stats** - Verify analytics
10. **Reports** - Test reporting

---

## 🧪 API Endpoints with Sample Data

### 1. Health Check ✓

**No authentication required**

```http
GET http://localhost:5000/api/health
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2025-12-06T07:54:05.000Z"
}
```

---

### 2. Login User 🔐

**Note:** Public registration is disabled. New companies must be created by a Super Admin. Use the credentials provided by the admin to login.

**Method:** `POST`  
**URL:** `http://localhost:5000/api/auth/login`  
**Headers:** 
- `Content-Type: application/json`

**Body (JSON):**
```json
{
  "email": "john@business.com",
  "password": "password123"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "657a1b2c3d4e5f6g7h8i9j0k",
      "name": "John Doe",
      "email": "john@business.com"
    }
  }
}
```

---

### 3. Get Current User Profile 👤

**📝 Save the token!** Copy the JWT token from the response - you'll need it for all protected endpoints.

---


### 4. Get Current User Profile 👤

**Method:** `GET`  
**URL:** `http://localhost:5000/api/auth/me`  
**Headers:** 
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Expected Response:**
```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "_id": "657a1b2c3d4e5f6g7h8i9j0k",
    "name": "John Doe",
    "email": "john@business.com",
    "companyName": "Doe Tiles & Construction"
  }
}
```

---

## 🔧 Protected Endpoints (Require Authentication)

**For all endpoints below, add this header:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

### 5. Create Supplier 🏢

**Method:** `POST`  
**URL:** `http://localhost:5000/api/suppliers`  
**Headers:** 
- `Content-Type: application/json`
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Body (JSON):**
```json
{
  "name": "ABC Building Supplies",
  "phone": "+1-555-0200",
  "email": "contact@abcsupplies.com",
  "address": "456 Supplier Ave, Brooklyn, NY 11201",
  "category": "Building Materials"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Supplier created successfully",
  "data": {
    "_id": "657a2b3c4d5e6f7g8h9i0j1k",
    "name": "ABC Building Supplies",
    "phone": "+1-555-0200",
    "email": "contact@abcsupplies.com",
    "category": "Building Materials"
  }
}
```

**📝 Save the supplier _id!** You'll need it for purchase orders.

---

### 6. Get All Suppliers 📋

**Method:** `GET`  
**URL:** `http://localhost:5000/api/suppliers?page=1&limit=10`  
**Headers:** 
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `search` - Search by name, category, phone
- `category` - Filter by category

**Example with search:**
```
http://localhost:5000/api/suppliers?search=ABC
```

---

### 7. Create Purchase Order 📦

**Method:** `POST`  
**URL:** `http://localhost:5000/api/purchase-orders`  
**Headers:** 
- `Content-Type: application/json`
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Body (JSON):**
```json
{
  "quotationId": "QUO-001",
  "customerName": "Smith Construction Ltd",
  "supplier": "657a2b3c4d5e6f7g8h9i0j1k",
  "orderDate": "2025-12-06",
  "expectedDelivery": "2025-12-15",
  "status": "Draft",
  "items": [
    {
      "name": "Ceramic Floor Tiles",
      "quantity": 500,
      "unit": "sqft",
      "unitPrice": 5.50
    },
    {
      "name": "Tile Adhesive",
      "quantity": 20,
      "unit": "bags",
      "unitPrice": 15.00
    }
  ],
  "notes": "Urgent order - needed for Smith project"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Purchase order created successfully",
  "data": {
    "_id": "657a3b4c5d6e7f8g9h0i1j2k",
    "poId": "PO-001",
    "customerName": "Smith Construction Ltd",
    "supplier": {
      "_id": "657a2b3c4d5e6f7g8h9i0j1k",
      "name": "ABC Building Supplies"
    },
    "totalAmount": 3050,
    "status": "Draft",
    "items": [...]
  }
}
```

---

### 8. Update Purchase Order Status 🔄

**Method:** `PATCH`  
**URL:** `http://localhost:5000/api/purchase-orders/PO_ID/status`  
**Headers:** 
- `Content-Type: application/json`
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Body (JSON):**
```json
{
  "status": "Ordered"
}
```

**Valid Status Values:**
- `Draft`
- `Ordered`
- `Delivered`
- `Paid`

---

### 9. Create Quotation 📄

**Method:** `POST`  
**URL:** `http://localhost:5000/api/quotations`  
**Headers:** 
- `Content-Type: application/json`
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Body (JSON):**
```json
{
  "type": "quotation",
  "customerName": "Johnson Remodeling",
  "customerPhone": "+1-555-0300",
  "customerAddress": "789 Customer Rd, Queens, NY 11354",
  "projectTitle": "Bathroom Renovation - Apartment 5B",
  "invoiceDate": "2025-12-06",
  "dueDate": "2025-12-20",
  "lineItems": [
    {
      "item": {
        "category": "Floor Tile",
        "name": "Porcelain Marble-Look Tile",
        "costPrice": 4.00,
        "sellingPrice": 6.50
      },
      "quantity": 150,
      "customDescription": "",
      "isOriginalQuotationItem": true
    },
    {
      "item": {
        "category": "Wall Tile",
        "name": "Subway Tiles - White",
        "costPrice": 2.50,
        "sellingPrice": 4.00
      },
      "quantity": 200,
      "isOriginalQuotationItem": true
    }
  ],
  "paymentHistory": []
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Document created successfully",
  "data": {
    "_id": "657a4b5c6d7e8f9g0h1i2j3k",
    "documentNumber": "001",
    "type": "quotation",
    "status": "pending",
    "customerName": "Johnson Remodeling",
    "subtotal": 1775,
    "totalPayments": 0,
    "amountDue": 1775
  }
}
```

---

### 10. Get All Quotations 📋

**Method:** `GET`  
**URL:** `http://localhost:5000/api/quotations`  
**Headers:** 
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `search` - Search by customer name or project
- `status` - Filter by status (pending, approved, paid, closed)
- `startDate` - Filter by start date
- `endDate` - Filter by end date

**Expected Response:**
```json
{
  "success": true,
  "message": "Documents retrieved successfully",
  "data": [
    {
      "_id": "657a4b5c6d7e8f9g0h1i2j3k",
      "documentNumber": "001",
      "type": "quotation",
      "status": "pending",
      "customerName": "Johnson Remodeling",
      "invoiceDate": "2025-12-06T00:00:00.000Z",
      "amountDue": 1775
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "pages": 1,
    "limit": 10
  }
}
```

---

### 11. Get Single Quotation 📄

**Method:** `GET`  
**URL:** `http://localhost:5000/api/quotations/QUOTATION_ID`  
**Headers:** 
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Expected Response:**
```json
{
  "success": true,
  "message": "Document retrieved successfully",
  "data": {
    "_id": "657a4b5c6d7e8f9g0h1i2j3k",
    "documentNumber": "001",
    "type": "quotation",
    "status": "pending",
    "customerName": "Johnson Remodeling",
    "lineItems": [...],
    "paymentHistory": []
  }
}
```

---

### 12. Update Quotation ✏️

**Method:** `PUT`  
**URL:** `http://localhost:5000/api/quotations/QUOTATION_ID`  
**Headers:** 
- `Content-Type: application/json`
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Body (JSON):**
```json
{
  "customerName": "Johnson Remodeling (Updated)",
  "status": "approved"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Document updated successfully",
  "data": {
    "_id": "657a4b5c6d7e8f9g0h1i2j3k",
    "customerName": "Johnson Remodeling (Updated)",
    "status": "approved"
  }
}
```

---

### 13. Delete Quotation 🗑️

**Method:** `DELETE`  
**URL:** `http://localhost:5000/api/quotations/QUOTATION_ID`  
**Headers:** 
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Expected Response:**
```json
{
  "success": true,
  "message": "Document deleted successfully",
  "data": null
}
```

---

### 14. Add Payment to Quotation 💰

**Method:** `POST`  
**URL:** `http://localhost:5000/api/quotations/QUOTATION_ID/payments`  
**Headers:** 
- `Content-Type: application/json`
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Body (JSON):**
```json
{
  "amount": 500,
  "date": "2025-12-06",
  "description": "Initial deposit - 30%"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Payment added successfully",
  "data": {
    "totalPayments": 500,
    "amountDue": 1275,
    "status": "pending"
  }
}
```

---

### 15. Convert Quotation to Invoice 🔄

**Method:** `PATCH`  
**URL:** `http://localhost:5000/api/quotations/QUOTATION_ID/convert-to-invoice`  
**Headers:** 
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Expected Response:**
```json
{
  "success": true,
  "message": "Quotation converted to invoice successfully",
  "data": {
    "type": "invoice",
    "status": "approved"
  }
}
```

---

### 16. Create Material Sale 🧱

**Method:** `POST`  
**URL:** `http://localhost:5000/api/material-sales`  
**Headers:** 
- `Content-Type: application/json`
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Body (JSON):**
```json
{
  "customerName": "Wilson Home Improvement",
  "customerPhone": "+1-555-0400",
  "customerAddress": "321 Homeowner St, Manhattan, NY 10002",
  "saleDate": "2025-12-06",
  "items": [
    {
      "category": "Floor Tile",
      "colorCode": "BG-2401",
      "productName": "Beige Marble Effect",
      "plank": 25,
      "sqftPerPlank": 22,
      "totalSqft": 550,
      "unitPrice": 7.00,
      "amount": 3850,
      "costPerSqft": 4.50,
      "totalCost": 2475
    },
    {
      "category": "Wall Tile",
      "colorCode": "WH-1205",
      "productName": "White Glossy Subway",
      "plank": 15,
      "sqftPerPlank": 18,
      "totalSqft": 270,
      "unitPrice": 5.00,
      "amount": 1350,
      "costPerSqft": 3.00,
      "totalCost": 810
    }
  ],
  "paymentHistory": [
    {
      "amount": 2000,
      "date": "2025-12-06",
      "description": "Cash payment - 50% upfront"
    }
  ],
  "status": "partial",
  "notes": "Customer will pick up on Friday"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Material sale created successfully",
  "data": {
    "_id": "657a5b6c7d8e9f0g1h2i3j4k",
    "invoiceNumber": "001",
    "customerName": "Wilson Home Improvement",
    "totalAmount": 5200,
    "totalCost": 3285,
    "totalProfit": 1915,
    "profitPercentage": 58.3,
    "totalPaid": 2000,
    "amountDue": 3200,
    "status": "partial"
  }
}
```

---

### 17. Get All Material Sales 📋

**Method:** `GET`  
**URL:** `http://localhost:5000/api/material-sales`  
**Headers:** 
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `search` - Search by customer name
- `status` - Filter by status (pending, partial, paid)
- `startDate` - Filter by start date
- `endDate` - Filter by end date

**Expected Response:**
```json
{
  "success": true,
  "message": "Material sales retrieved successfully",
  "data": [
    {
      "_id": "657a5b6c7d8e9f0g1h2i3j4k",
      "invoiceNumber": "001",
      "customerName": "Wilson Home Improvement",
      "saleDate": "2025-12-06T00:00:00.000Z",
      "totalAmount": 5200,
      "status": "partial"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "pages": 1,
    "limit": 10
  }
}
```

---

### 18. Get Single Material Sale 📄

**Method:** `GET`  
**URL:** `http://localhost:5000/api/material-sales/SALE_ID`  
**Headers:** 
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Expected Response:**
```json
{
  "success": true,
  "message": "Material sale retrieved successfully",
  "data": {
    "_id": "657a5b6c7d8e9f0g1h2i3j4k",
    "invoiceNumber": "001",
    "customerName": "Wilson Home Improvement",
    "items": [...],
    "paymentHistory": [...]
  }
}
```

---

### 19. Update Material Sale ✏️

**Method:** `PUT`  
**URL:** `http://localhost:5000/api/material-sales/SALE_ID`  
**Headers:** 
- `Content-Type: application/json`
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Body (JSON):**
```json
{
  "customerName": "Wilson Home Improvement (Updated)",
  "notes": "Updated delivery instructions"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Material sale updated successfully",
  "data": {
    "_id": "657a5b6c7d8e9f0g1h2i3j4k",
    "customerName": "Wilson Home Improvement (Updated)",
    "notes": "Updated delivery instructions"
  }
}
```

---

### 20. Delete Material Sale 🗑️

**Method:** `DELETE`  
**URL:** `http://localhost:5000/api/material-sales/SALE_ID`  
**Headers:** 
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Expected Response:**
```json
{
  "success": true,
  "message": "Material sale deleted successfully",
  "data": null
}
```

---

### 21. Create Job Cost Document 💼

**Method:** `POST`  
**URL:** `http://localhost:5000/api/job-costs`  
**Headers:** 
- `Content-Type: application/json`
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Body (JSON):**
```json
{
  "customerName": "Martinez Family",
  "customerPhone": "+1-555-0500",
  "projectTitle": "Complete Kitchen Remodel",
  "invoiceDate": "2025-12-06",
  "invoiceItems": [
    {
      "category": "Floor Tile",
      "name": "Premium Hardwood-Look Tile",
      "quantity": 400,
      "costPrice": 5.00,
      "sellingPrice": 8.50
    },
    {
      "category": "Backsplash",
      "name": "Glass Mosaic Tiles",
      "quantity": 50,
      "costPrice": 12.00,
      "sellingPrice": 18.00
    }
  ],
  "purchaseOrderItems": [
    {
      "poId": "PO-001",
      "itemName": "Kitchen Cabinets",
      "quantity": 8,
      "unitCost": 350.00
    },
    {
      "poId": "PO-002",
      "itemName": "Countertop Granite",
      "quantity": 25,
      "unitCost": 45.00
    }
  ],
  "otherExpenses": [
    {
      "description": "Labor - Installation Team",
      "amount": 2500,
      "category": "Labor",
      "date": "2025-12-06"
    },
    {
      "description": "Plumbing Fixtures",
      "amount": 800,
      "category": "Materials",
      "date": "2025-12-05"
    }
  ]
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Job cost created successfully",
  "data": {
    "_id": "657a6b7c8d9e0f1g2h3i4j5k",
    "invoiceId": "001",
    "projectTitle": "Complete Kitchen Remodel",
    "totalRevenue": 4300,
    "materialCost": 2600,
    "purchaseOrderCost": 3925,
    "otherExpensesCost": 3300,
    "totalCost": 9825,
    "profit": -5525,
    "profitMargin": -128.5
  }
}
```

---

### 22. Dashboard Stats 📊

**Method:** `GET`  
**URL:** `http://localhost:5000/api/dashboard/stats?period=last30days`  
**Headers:** 
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Query Parameters:**
- `period`: `today`, `last7days`, `last30days`, `thisMonth`, `ytd`

**Expected Response:**
```json
{
  "success": true,
  "message": "Dashboard stats retrieved successfully",
  "data": {
    "totalRevenue": 9500.00,
    "totalProfit": 1915.00,
    "totalOutstanding": 4475.00,
    "activeProjects": 1,
    "totalExpenses": 3050.00,
    "profitMargin": "20.16",
    "counts": {
      "quotations": 1,
      "invoices": 0,
      "materialSales": 1,
      "purchaseOrders": 1,
      "jobCosts": 1
    }
  }
}
```

---

### 23. Revenue Trend Chart 📈

**Method:** `GET`  
**URL:** `http://localhost:5000/api/dashboard/charts/revenue-trend?period=last30days`  
**Headers:** 
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Expected Response:**
```json
{
  "success": true,
  "message": "Revenue trend retrieved successfully",
  "data": [
    {
      "date": "2025-12-06",
      "value": 9500
    }
  ]
}
```

---

### 24. Sales Summary Report 📄

**Method:** `GET`  
**URL:** `http://localhost:5000/api/reports/sales-summary?startDate=2025-12-01&endDate=2025-12-31`  
**Headers:** 
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Query Parameters:**
- `startDate` - Start date (YYYY-MM-DD)
- `endDate` - End date (YYYY-MM-DD)

**Expected Response:**
```json
{
  "success": true,
  "message": "Sales summary retrieved successfully",
  "data": {
    "period": {
      "start": "2025-12-01T00:00:00.000Z",
      "end": "2025-12-31T23:59:59.999Z"
    },
    "totalInvoices": 0,
    "totalMaterialSales": 1,
    "invoiceRevenue": 0,
    "materialSaleRevenue": 5200,
    "totalRevenue": 5200,
    "totalCollected": 2000
  }
}
```

---

### 25. Profit Analysis Report 💹

**Method:** `GET`  
**URL:** `http://localhost:5000/api/reports/profit-analysis?startDate=2025-12-01&endDate=2025-12-31`  
**Headers:** 
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Expected Response:**
```json
{
  "success": true,
  "message": "Profit analysis retrieved successfully",
  "data": {
    "period": {...},
    "materialSales": {
      "count": 1,
      "revenue": 5200,
      "cost": 3285,
      "profit": 1915
    },
    "projectJobs": {
      "count": 1,
      "revenue": 4300,
      "cost": 9825,
      "profit": -5525
    },
    "totalProfit": -3610,
    "totalExpenses": 3050
  }
}
```

---

### 26. Outstanding Payments Report 💳

**Method:** `GET`  
**URL:** `http://localhost:5000/api/reports/outstanding-payments`  
**Headers:** 
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Expected Response:**
```json
{
  "success": true,
  "message": "Outstanding payments retrieved successfully",
  "data": {
    "invoices": [],
    "materialSales": [
      {
        "invoiceNumber": "001",
        "customerName": "Wilson Home Improvement",
        "saleDate": "2025-12-06",
        "totalAmount": 5200,
        "amountPaid": 2000,
        "amountDue": 3200
      }
    ],
    "totalOutstanding": 3200
  }
}
```

---

## 🎯 Quick Test Checklist

Test these in order:

- [ ] Health check works
- [ ] Register user (get token)
- [ ] Login user (verify token)
- [ ] Get user profile
- [ ] Create supplier
- [ ] Get all suppliers
- [ ] Create purchase order
- [ ] Update PO status
- [ ] Create quotation
- [ ] Add payment to quotation
- [ ] Convert quotation to invoice
- [ ] Create material sale
- [ ] Create job cost
- [ ] Get dashboard stats
- [ ] Get revenue trend
- [ ] Get sales summary report
- [ ] Get profit analysis report
- [ ] Get outstanding payments report

---

## 💡 Postman Tips

### Setting Environment Variables

1. Create environment: "Business Management API"
2. Add variables:
   - `base_url`: `http://localhost:5000/api`
   - `token`: (paste your JWT token here)

3. Use in requests:
   - URL: `{{base_url}}/suppliers`
   - Header: `Authorization: Bearer {{token}}`

### Saving Token Automatically

In **Tests** tab after login/register:

```javascript
var jsonData = pm.response.json();
if (jsonData.data && jsonData.data.token) {
    pm.environment.set("token", jsonData.data.token);
}
```

### Pre-request Script for Auth

```javascript
pm.request.headers.add({
    key: 'Authorization',
    value: 'Bearer ' + pm.environment.get('token')
});
```


---

### 27. Get Company Categories 📂

**Method:** `GET`  
**URL:** `http://localhost:5000/api/categories`  
**Headers:** 
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Expected Response:**
```json
{
  "success": true,
  "message": "Categories retrieved successfully",
  "data": [
    {
      "id": "657a7b8c9d0e1f2g3h4i5j6k",
      "name": "Floor Tile",
      "companyId": "657a1b2c3d4e5f6g7h8i9j0k",
      "items": [
        {
          "id": "657a8b9c0d1e2f3g4h5i6j7k",
          "itemName": "60x60 White Tile",
          "baseUnit": "sqft",
          "sqftPerUnit": 4,
          "categoryId": "657a7b8c9d0e1f2g3h4i5j6k"
        }
      ]
    }
  ]
}
```

---

## 👑 Super Admin Endpoints (Require `role: super-admin`)

**Note:** To test these, you must manually change a user's role to `super-admin` in the database, or register a new user and update their role via MongoDB Compass/Shell, as there is no public endpoint to create a super admin.

**Headers for all:**
```
Authorization: Bearer ADMIN_JWT_TOKEN
```

### 28. Super Admin Dashboard 📊

**Method:** `GET`
**URL:** `http://localhost:5000/api/super-admin/dashboard/stats`

**Expected Response:**
```json
{
  "success": true,
  "message": "Dashboard stats retrieved successfully",
  "data": {
    "stats": {
      "totalCompanies": 24,
      "activeCompanies": 18,
      "inactiveCompanies": 6,
      "totalCategories": 48
    },
    "recentActivity": [...],
    "recentCompanies": [...]
  }
}
```

### 29. List All Companies 🏢

**Method:** `GET`
**URL:** `http://localhost:5000/api/super-admin/companies?search=Tile`

### 30. Create Company (Register User) ➕

**Method:** `POST`
**URL:** `http://localhost:5000/api/super-admin/companies`
**Body:**
```json
{
  "name": "New Owner",
  "email": "owner@newcompany.com",
  "password": "password123",
  "phone": "0771234567",
  "companyName": "New Tiles Ltd",
  "companyAddress": "Colombo 03",
  "companyPhone": "0112345678"
}
```

### 31. Update Company ✏️

**Method:** `PUT`
**URL:** `http://localhost:5000/api/super-admin/companies/USER_ID`
**Body:**
```json
{
  "companyName": "Updated Tiles Ltd",
  "isActive": false
}
```

### 32. Get Company Categories 📂

**Method:** `GET`
**URL:** `http://localhost:5000/api/super-admin/companies/COMPANY_ID/categories`

### 33. Create Category ➕

**Method:** `POST`
**URL:** `http://localhost:5000/api/super-admin/categories`
**Body:**
```json
{
  "name": "Ceramic Floors",
  "companyId": "COMPANY_ID"
}
```

### 34. Add Item Template 📝

**Method:** `POST`
**URL:** `http://localhost:5000/api/super-admin/categories/CATEGORY_ID/items`
**Body:**
```json
{
  "itemName": "60x60 White Tile",
  "baseUnit": "sqft",
  "sqftPerUnit": 4
}
```

---

## 🐛 Common Errors

### Error: "Not authorized to access this route"

**Cause:** Missing or invalid JWT token

**Solution:** 
1. Login again to get fresh token
2. Add `Authorization: Bearer YOUR_TOKEN` header
3. Check token hasn't expired (30 days default)

### Error: "Supplier not found"

**Cause:** Using wrong supplier ID

**Solution:** 
1. Create supplier first
2. Copy the `_id` from response
3. Use that ID in purchase order

### Error: "Validation failed"

**Cause:** Missing required fields

**Solution:** Check the error response for which fields are required

---

## 📦 Complete Postman Collection JSON

Save this as `business-management-api.postman_collection.json`:

```json
{
  "info": {
    "name": "Business Management API",
    "description": "Complete API collection for testing",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Register",
          "request": {
            "method": "POST",
            "header": [{"key": "Content-Type", "value": "application/json"}],
            "url": "{{base_url}}/auth/register",
            "body": {
              "mode": "raw",
              "raw": "{\"name\":\"John Doe\",\"email\":\"john@business.com\",\"password\":\"password123\",\"companyName\":\"Doe Tiles\"}"
            }
          }
        },
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "header": [{"key": "Content-Type", "value": "application/json"}],
            "url": "{{base_url}}/auth/login",
            "body": {
              "mode": "raw",
              "raw": "{\"email\":\"john@business.com\",\"password\":\"password123\"}"
            }
          }
        }
      ]
    }
  ]
}
```

Import this into Postman to get started quickly!

---

## ✅ Success!

You should now be able to test all API endpoints and verify your backend is working correctly! 🎉
