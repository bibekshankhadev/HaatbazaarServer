# HaatBazaar Server API Documentation

## Overview
HaatBazaar is a location-based agricultural marketplace connecting farmers and buyers. This is the backend API server.

## Base URL
```
http://localhost:5000/api
```

## Authentication
All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## Endpoints

### Auth Routes (`/auth`)

#### Register User
```
POST /auth/register
```
**Body:**
```json
{
  "name": "John Doe",
  "phone": "9876543210",
  "password": "password123",
  "role": "farmer", // "buyer", "farmer", or "admin"
  "address": "Village Name, State", // Required for farmers
  "latitude": 28.7041,
  "longitude": 77.1025
}
```
**Files:** `image` (profile picture)

#### Login
```
POST /auth/login
```
**Body:**
```json
{
  "phone": "9876543210",
  "password": "password123"
}
```

---

### Product Routes (`/products`)

#### Get All Products
```
GET /products?category=vegetables&minPrice=100&maxPrice=500&q=tomato&page=1&limit=12&haatEventId=xyz
```

#### Get Single Product
```
GET /products/:id
```

#### Create Product (Farmer/Admin)
```
POST /products
```
**Auth:** Required (Farmer/Admin)
**Body:**
```json
{
  "title": "Fresh Tomatoes",
  "description": "Organic tomatoes",
  "category": "vegetables",
  "quantity": 100,
  "price": 50,
  "freshness": 2,
  "haatEventId": "event_id_optional"
}
```
**Files:** `image` (product image)

#### Update Product (Owner/Admin)
```
PUT /products/:id
```
**Auth:** Required (Owner/Admin)
**Body:** Same as create

#### Delete Product (Owner/Admin)
```
DELETE /products/:id
```
**Auth:** Required (Owner/Admin)

#### Get Pending Products (Admin)
```
GET /products/admin/pending
```
**Auth:** Required (Admin)

#### Update Product Status (Admin)
```
PUT /products/admin/:id/status
```
**Auth:** Required (Admin)
**Body:**
```json
{
  "status": "approved" // or "rejected"
}
```

---

### HaatBazaar Events (`/haat-events`)

#### Create Event (Admin)
```
POST /haat-events
```
**Auth:** Required (Admin)
**Body:**
```json
{
  "name": "Weekly Farmers Market",
  "description": "Weekly market for local farmers",
  "latitude": 28.7041,
  "longitude": 77.1025,
  "address": "Market Square, Delhi",
  "eventDate": "2024-02-15T09:00:00Z",
  "registrationDeadline": "2024-02-14T18:00:00Z"
}
```

#### Get All Events
```
GET /haat-events?status=upcoming
```

#### Get Single Event
```
GET /haat-events/:id
```

#### Register for Event (Farmer)
```
POST /haat-events/:eventId/register
```
**Auth:** Required (Farmer)

#### Update Event Status (Admin)
```
PUT /haat-events/:id/status
```
**Auth:** Required (Admin)
**Body:**
```json
{
  "status": "active" // "upcoming", "active", "completed", "cancelled"
}
```

---

### Orders (`/orders`)

#### Create Order (Buyer)
```
POST /orders
```
**Auth:** Required (Buyer)
**Body:**
```json
{
  "farmerId": "farmer_id",
  "products": [
    {
      "product": "product_id",
      "quantity": 10
    }
  ],
  "deliveryLocation": {
    "latitude": 28.7041,
    "longitude": 77.1025,
    "address": "Home Address"
  }
}
```

#### Get My Orders
```
GET /orders?role=buyer
```
**Auth:** Required
**Query:** `role` (buyer, farmer, or omit for both)

#### Get Single Order
```
GET /orders/:id
```
**Auth:** Required (Buyer/Farmer/Admin)

#### Update Order Status (Farmer)
```
PUT /orders/:id/status
```
**Auth:** Required (Farmer/Admin)
**Body:**
```json
{
  "status": "accepted" // "accepted", "rejected", "shipped", "delivered", "cancelled"
}
```

#### Cancel Order (Buyer)
```
DELETE /orders/:id
```
**Auth:** Required (Buyer)

---

### Negotiations (`/negotiations`)

#### Create/Place Offer (Buyer)
```
POST /negotiations
```
**Auth:** Required (Buyer)
**Body:**
```json
{
  "productId": "product_id",
  "price": 45,
  "quantity": 5,
  "message": "Can you provide at this price?"
}
```

#### Get My Negotiations
```
GET /negotiations?status=active
```
**Auth:** Required
**Query:** `status` (active, accepted, rejected, expired)

#### Get Single Negotiation
```
GET /negotiations/:id
```
**Auth:** Required

#### Respond to Negotiation (Farmer)
```
PUT /negotiations/:id/respond
```
**Auth:** Required (Farmer)
**Body:**
```json
{
  "action": "counter", // "counter", "accept", "reject"
  "price": 50,
  "quantity": 5,
  "message": "Can meet at this price"
}
```

---

### Group Sales (`/group-sales`)

#### Create Group Sale (Farmer)
```
POST /group-sales
```
**Auth:** Required (Farmer)
**Body:**
```json
{
  "productId": "product_id",
  "requiredQuantity": 100,
  "pricePerUnit": 40,
  "deadline": "2024-02-20T18:00:00Z",
  "haatEventId": "event_id_optional"
}
```

#### Get All Group Sales
```
GET /group-sales?status=open&haatEventId=xyz
```

#### Get Single Group Sale
```
GET /group-sales/:id
```

#### Join Group Sale (Buyer)
```
POST /group-sales/:id/join
```
**Auth:** Required (Buyer)
**Body:**
```json
{
  "quantity": 20
}
```

#### Update Group Sale Status (Farmer)
```
PUT /group-sales/:id/status
```
**Auth:** Required (Farmer)
**Body:**
```json
{
  "status": "closed" // "open", "closed", "completed", "cancelled"
}
```

---

### Location (`/location`)

#### Update Location (Mobile App)
```
POST /location/update
```
**Auth:** Required
**Body:**
```json
{
  "latitude": 28.7041,
  "longitude": 77.1025,
  "accuracy": 10
}
```

#### Get Location History
```
GET /location/history?limit=10
```
**Auth:** Required

#### Get User's Active Location
```
GET /location/user/:userId
```

#### Find Farmers Nearby
```
GET /location/nearby/farmers?latitude=28.7041&longitude=77.1025&radiusKm=5
```
**Auth:** Required (Buyer)

---

### Admin Routes (`/admin`)

#### Get Dashboard Stats
```
GET /admin/dashboard/stats
```
**Auth:** Required (Admin)

#### Get Revenue Report
```
GET /admin/reports/revenue
```
**Auth:** Required (Admin)

#### Get Pending Farmers
```
GET /admin/farmers/pending
```
**Auth:** Required (Admin)

#### Approve Farmer
```
PUT /admin/farmers/:userId/approve
```
**Auth:** Required (Admin)

#### Reject Farmer
```
PUT /admin/farmers/:userId/reject
```
**Auth:** Required (Admin)

#### Get All Users
```
GET /admin/users?role=farmer&approved=true
```
**Auth:** Required (Admin)

#### Delete User
```
DELETE /admin/users/:userId
```
**Auth:** Required (Admin)

#### Get Pending Negotiations
```
GET /admin/negotiations/pending
```
**Auth:** Required (Admin)

---

## Mobile App Integration

### Location Tracking Setup
1. Get user location from device GPS
2. Call `POST /location/update` endpoint every 5-10 minutes
3. Include latitude, longitude, and accuracy

### Sample Request Flow

**Farmer Registration & Product Upload:**
1. POST /auth/register (with profile picture)
2. Wait for admin approval
3. POST /haat-events/:eventId/register (for nearby event)
4. POST /products (with product image + EXIF validation)
5. Wait for product approval

**Buyer Flow:**
1. POST /auth/register (with profile picture)
2. GET /products (browse products)
3. POST /negotiations (place offer on product)
4. OR POST /orders (direct order)
5. GET /orders (track orders)

---

## Image Metadata Validation

### EXIF Photo Date Validation
Products with uploaded images are validated to ensure:
- Photo taken date (from EXIF) is within 24 hours of upload
- This prevents misuse of old photos to pass off old produce as fresh

**Response includes:**
```json
{
  "imageValidation": {
    "isValidated": true,
    "uploadDate": "2024-02-10T10:00:00Z",
    "photoDate": "2024-02-10T09:30:00Z"
  }
}
```

---

## Error Responses

All errors follow this format:
```json
{
  "message": "Error description",
  "error": "Detailed error message"
}
```

**Common Status Codes:**
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Server Error

---

## Environment Variables Required

```
MONGODB_URI=mongodb://...
JWT_SECRET=your_secret_key
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
PORT=5000
```

---

## Running the Server

```bash
# Development
npm run dev

# Production
npm start
```

Server runs on `http://localhost:5000` by default.
