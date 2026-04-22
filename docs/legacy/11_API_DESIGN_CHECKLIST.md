# W기프트 API Design Checklist

## Overview

This document provides a comprehensive checklist for API design compliance, based on the audit conducted against REST best practices and E2E test results.

---

## Security Checklist

### Authentication & Authorization

| Endpoint | Auth Required | Role Required | Status |
|----------|--------------|---------------|--------|
| `GET /products` | No | - | ✅ Public |
| `POST /products` | Yes (JWT) | ADMIN | ✅ Fixed |
| `PATCH /products/:id` | Yes (JWT) | ADMIN | ✅ Fixed |
| `DELETE /products/:id` | Yes (JWT) | ADMIN | ✅ Fixed |
| `GET /users` | No | - | ✅ Public (list) |
| `POST /users` | Yes (JWT) | ADMIN | ✅ Fixed |
| `PATCH /users/:id` | Yes (JWT) | ADMIN | ✅ Fixed |
| `DELETE /users/:id` | Yes (JWT) | ADMIN | ✅ Fixed |
| `GET /site-configs` | No | - | ✅ Public (read) |
| `POST /site-configs` | Yes (JWT) | ADMIN | ✅ Fixed |
| `PATCH /site-configs/:id` | Yes (JWT) | ADMIN | ✅ Fixed |
| `DELETE /site-configs/:id` | Yes (JWT) | ADMIN | ✅ Fixed |
| `GET /vouchers/stock/:productId` | Yes (JWT) | ADMIN | ✅ Fixed |
| `POST /vouchers/bulk` | Yes (JWT) | ADMIN | ✅ Existing |
| `GET /vouchers` | Yes (JWT) | ADMIN | ✅ Existing |
| `POST /orders` | Yes (JWT) | - | ✅ Existing |
| `GET /orders/my` | Yes (JWT) | - | ✅ Existing |
| `GET /orders/:id` | Yes (JWT) | - | ⚠️ Needs user ownership check |
| `POST /trade-ins` | Yes (JWT) | - | ✅ Existing |
| `GET /trade-ins/my` | Yes (JWT) | - | ✅ Existing |
| `GET /admin/*` | Yes (JWT) | ADMIN | ✅ Existing |

---

## HTTP Status Codes

### Standard Response Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PATCH, PUT |
| 201 | Created | Successful POST (resource created) |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation errors, malformed request |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Valid auth but insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Duplicate resource, business rule violation |
| 422 | Unprocessable Entity | Semantic validation errors |
| 500 | Internal Server Error | Unexpected server errors |

### Status Code Checklist

- [ ] POST endpoints return 201 for successful creation
- [ ] DELETE endpoints return 204 (no body) or 200 (with deleted entity)
- [ ] Return 400 for validation errors with field-specific messages
- [ ] Return 401 for missing/invalid authentication
- [ ] Return 403 for role/permission errors
- [ ] Return 404 for non-existent resources
- [ ] Return 409 for duplicate key violations

---

## Error Response Format

### Standardized Error Schema

```json
{
  "statusCode": 400,
  "error": "BadRequest",
  "message": "Human-readable error description",
  "details": {
    "field": "fieldName",
    "constraint": "constraint name",
    "value": "provided value"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/products"
}
```

### Error Response Checklist

- [ ] All errors include `statusCode` field
- [ ] All errors include human-readable `message`
- [ ] Validation errors include field-specific `details`
- [ ] Include `timestamp` for debugging
- [ ] Include `path` to identify endpoint

---

## REST Naming Conventions

### URL Structure

| Pattern | Example | Correct |
|---------|---------|---------|
| Plural nouns for collections | `/products`, `/users` | ✅ |
| Singular for single resource | `/products/:id` | ✅ |
| Nested resources | `/users/:id/orders` | ✅ |
| Avoid verbs in URLs | ~~`/createProduct`~~ | ✅ |
| Lowercase with hyphens | `/site-configs` | ✅ |

### Naming Checklist

- [x] All collection endpoints use plural nouns
- [x] Resource IDs in URL path, not query params
- [x] No verbs in resource URLs
- [x] Consistent casing (lowercase + hyphens)
- [ ] Sub-resources properly nested

---

## Request/Response Patterns

### Pagination

**Request:**
```
GET /products?skip=0&take=20
GET /products?page=1&limit=20
```

**Response:**
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "pageSize": 20,
  "hasNext": true,
  "hasPrev": false
}
```

### Filtering

**Request:**
```
GET /products?brand=SHINSEGAE&isActive=true
GET /orders?status=PENDING&userId=123
```

### Pagination Checklist

- [ ] All list endpoints support `skip`/`take` or `page`/`limit`
- [ ] Response includes total count
- [ ] Response includes pagination metadata
- [ ] Default page size is reasonable (20-50)
- [ ] Maximum page size is enforced (100)

---

## Validation Rules

### Product Validation

| Field | Rule | Error Code |
|-------|------|------------|
| brand | Enum: SHINSEGAE, HYUNDAI, LOTTE, DAISO, OLIVEYOUNG | 400 |
| name | Required, 1-100 chars | 400 |
| price | Required, > 0 | 400 |
| discountRate | 0-100 | 400 |
| tradeInRate | 0-100 | 400 |

### Order Validation

| Field | Rule | Error Code |
|-------|------|------------|
| items | Required, non-empty array | 400 |
| items[].productId | Must exist | 404 |
| items[].quantity | > 0, <= stock | 400 |
| paymentMethod | Enum: CARD, VIRTUAL_ACCOUNT, BANK_TRANSFER | 400 |

### User Validation

| Field | Rule | Error Code |
|-------|------|------------|
| email | Required, valid format, unique | 400/409 |
| password | Min 8 chars, complexity | 400 |
| phone | Valid Korean phone format | 400 |

---

## API Documentation (Swagger)

### Required Documentation

- [x] All endpoints have `@ApiOperation` summary
- [x] All endpoints have `@ApiTags` grouping
- [x] Protected endpoints have `@ApiBearerAuth`
- [ ] All DTOs have `@ApiProperty` decorators
- [ ] Response types documented with `@ApiResponse`
- [ ] Error responses documented

### Documentation Checklist

```typescript
// Example of well-documented endpoint
@Post()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
@ApiOperation({ summary: 'Create a new product' })
@ApiResponse({ status: 201, description: 'Product created successfully' })
@ApiResponse({ status: 400, description: 'Validation error' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
async create(@Body() createDto: CreateProductDto): Promise<Product> {
  return this.productService.create(createDto);
}
```

---

## Test Coverage Requirements

### E2E Test Matrix

| Feature | Happy Path | Error Cases | Auth Tests | Status |
|---------|------------|-------------|------------|--------|
| Products CRUD | ✅ | ✅ | ✅ | Fixed |
| Orders | ✅ | ⚠️ | ✅ | Partial |
| Trade-Ins | ✅ | ✅ | ✅ | Pass |
| Vouchers | ✅ | ⚠️ | ✅ | Partial |
| Cart | ⚠️ | ⚠️ | ✅ | Partial |
| Admin | ✅ | ⚠️ | ✅ | Partial |
| Auth | ✅ | ✅ | ✅ | Pass |

### Test Requirements

- [ ] Each endpoint has at least one happy path test
- [ ] Validation errors return proper 4xx codes
- [ ] Auth required endpoints reject unauthenticated requests
- [ ] Role-restricted endpoints reject unauthorized users
- [ ] Error messages are meaningful and actionable

---

## Implementation Priorities

### P0 - Critical (Security)
1. ✅ Add guards to Product controller
2. ✅ Add guards to SiteConfig controller
3. ✅ Add guards to Users controller
4. ✅ Add role guard to voucher stock endpoint

### P1 - High (Functionality)
5. [ ] Add user ownership check in Orders.getOrder()
6. [ ] Add duplicate PIN validation in voucher bulk create
7. [ ] Standardize cart POST response (201 vs 200)
8. [ ] Add stock validation in cart add

### P2 - Medium (Consistency)
9. [ ] Implement product filtering (?brand=X)
10. [ ] Add total field to voucher stock response ✅
11. [ ] Standardize DELETE response codes
12. [ ] Populate product relations in cart response

### P3 - Low (Polish)
13. [ ] Add @ApiResponse decorators to all endpoints
14. [ ] Document all DTO properties with @ApiProperty
15. [ ] Create consistent error response interceptor
16. [ ] Add request/response logging

---

## Changelog

| Date | Author | Changes |
|------|--------|---------|
| 2024-01-15 | Dev Team | Initial audit and security fixes |
| - | - | Added guards to Product, SiteConfig, Users controllers |
| - | - | Added role guard to voucher stock endpoint |
| - | - | Added total field to stock response |
