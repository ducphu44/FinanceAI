# 📡 API Endpoints Reference – FinanceAI

> **Base URL:** `http://localhost:8000`  
> **Docs (Swagger):** `http://localhost:8000/docs`  
> **Docs (ReDoc):** `http://localhost:8000/redoc`  
> **Auth:** Bearer JWT Token  

---

## 🔑 Authentication

### `POST /auth/login`
Đăng nhập và nhận JWT token.

**Request Body:**
```json
{ "email": "staff@example.com", "password": "password123" }
```
**Response `200`:**
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "user": { "id": 2, "full_name": "Nguyễn Thị Lan", "email": "staff@example.com", "role": "finance_staff", ... }
}
```

---

### `GET /auth/me`
Lấy thông tin user đang đăng nhập.

**Headers:** `Authorization: Bearer <token>`  
**Response `200`:** `UserMe` object

---

## 👥 Users

| Method | Endpoint | Role Required | Mô tả |
|--------|----------|---------------|-------|
| GET | `/users` | admin, finance_manager, leader | Danh sách users |
| POST | `/users` | admin | Tạo user mới |
| PUT | `/users/{user_id}` | admin | Cập nhật user |
| DELETE | `/users/{user_id}` | admin | Vô hiệu hoá user |

**POST /users – Request Body:**
```json
{
  "full_name": "Nguyễn Văn A",
  "email": "newuser@example.com",
  "password": "securepass123",
  "role": "finance_staff"
}
```

**PUT /users/{id} – Request Body:**
```json
{ "full_name": "Tên mới", "role": "finance_manager", "is_active": true }
```

---

## 📁 Files

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/files/upload` | Upload file CSV/Excel |
| GET | `/files` | Danh sách file đã upload |
| GET | `/files/{file_id}` | Chi tiết file |

**POST /files/upload** – `multipart/form-data`
- Field: `file` (CSV hoặc Excel)

**Response:**
```json
{
  "file": { "id": 1, "file_name": "financial_sample.csv", "status": "success", "total_rows": 321, ... },
  "message": "File uploaded successfully. 321 rows detected."
}
```

---

## 📊 Dashboard

| Method | Endpoint | Query Params | Mô tả |
|--------|----------|-------------|-------|
| GET | `/dashboard/summary` | `month`, `dept` | KPI cards |
| GET | `/dashboard/monthly-trend` | `year` | Biểu đồ thu chi theo tháng |
| GET | `/dashboard/department-expense` | `month` | Chi phí theo phòng ban |
| GET | `/dashboard/over-budget` | `month`, `dept`, `limit` | Giao dịch vượt ngân sách |

**GET /dashboard/summary – Response:**
```json
{
  "total_revenue": 1842500,
  "total_expense": 2315800,
  "total_budget": 2600000,
  "budget_used": 2315800,
  "budget_remaining": 284200,
  "budget_utilization": 89.07,
  "over_budget_count": 63,
  "alert_count": 4
}
```

---

## 🚨 Alerts

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/alerts` | Danh sách cảnh báo (filter: status, level) |
| POST | `/alerts/{alert_id}/resolve` | Giải quyết cảnh báo |

**GET /alerts – Query Params:**
- `status`: `open` | `resolved` | `ignored`
- `level`: `info` | `warning` | `critical`
- `page`, `limit`

**POST /alerts/{id}/resolve – Request Body:**
```json
{ "note": "Đã kiểm tra và xử lý" }
```

---

## 🤖 AI

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/ai/ask` | Hỏi AI về dữ liệu tài chính |
| POST | `/ai/generate-report` | AI tạo báo cáo draft |

**POST /ai/ask – Request Body:**
```json
{
  "question": "Phòng ban nào vượt ngân sách nhiều nhất?",
  "data_source": "financial_transactions"
}
```
**Response:**
```json
{
  "question": "Phòng ban nào vượt ngân sách nhiều nhất?",
  "answer": "Research Office có mức vượt ngân sách cao nhất...",
  "data_source": "financial_transactions",
  "created_at": "2024-06-05T14:30:00Z",
  "disclaimer": "Câu trả lời do AI hỗ trợ, cần kiểm tra lại trước khi sử dụng chính thức."
}
```

**POST /ai/generate-report – Request Body:**
```json
{
  "period": "2024-03",
  "report_type": "monthly",
  "departments": ["Faculty of Medicine", "Research Office"]
}
```

---

## 📋 Reports

| Method | Endpoint | Role Required | Mô tả |
|--------|----------|---------------|-------|
| GET | `/reports` | All | Danh sách báo cáo |
| GET | `/reports/{report_id}` | All | Chi tiết báo cáo |
| POST | `/reports/{report_id}/approve` | admin, leader | Phê duyệt báo cáo |
| POST | `/reports/{report_id}/reject` | admin, finance_manager, leader | Từ chối báo cáo |

**POST /reports/{id}/approve – Request Body:**
```json
{ "comment": "Đã xem xét và phê duyệt" }
```

---

## 🔧 Chạy Backend

```bash
# Kích hoạt venv
source venv/bin/activate

# Chạy server
uvicorn main:app --reload --port 8000

# Hoặc dùng trực tiếp
venv/bin/uvicorn main:app --reload --port 8000
```

Truy cập Swagger UI: **http://localhost:8000/docs**

---

## 📦 HTTP Status Codes

| Code | Ý nghĩa |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (wrong role) |
| 404 | Not Found |
| 409 | Conflict (duplicate / already resolved) |
| 422 | Unprocessable Entity (Pydantic validation) |
| 500 | Internal Server Error |
