# Financial Management System

Hệ thống quản lý tài chính với SQLite, SQLAlchemy và Python.

---

## 📁 Cấu trúc thư mục

```
.
├── app/
│   ├── __init__.py
│   ├── database.py        # Kết nối database (SQLAlchemy engine + session)
│   └── models.py          # ORM models (6 bảng)
├── scripts/
│   └── init_db.py         # Khởi tạo bảng + seed dữ liệu demo
├── database/
│   └── financial.db       # SQLite file (tạo tự động)
├── sample_data/
│   ├── financial_sample.csv
│   └── financial_sample.xlsx
└── docs/
    └── sample_data_dictionary.md
```

---

## ⚙️ Cài đặt môi trường

```bash
# Bước 1: Tạo virtual environment
python3 -m venv venv

# Bước 2: Kích hoạt (macOS / Linux)
source venv/bin/activate
# Hoặc Windows:
# venv\Scripts\activate

# Bước 3: Cài đặt dependencies
venv/bin/pip install sqlalchemy bcrypt pandas openpyxl
```

> ✅ **Đã cài đặt thành công:** SQLAlchemy 2.0.50, bcrypt 5.0.0, pandas 3.0.3, openpyxl 3.1.5

---

## 🗄️ Khởi tạo Database

Chạy lệnh sau từ **thư mục gốc** của dự án:

```bash
# Nếu đã kích hoạt venv:
python scripts/init_db.py

# Hoặc dùng trực tiếp venv Python:
venv/bin/python scripts/init_db.py
```

Lệnh này sẽ:
1. Tạo file `database/financial.db`
2. Tạo đầy đủ **6 bảng** trong database
3. Seed **4 user demo**
4. Thêm dữ liệu mẫu (file upload, giao dịch, alert, AI query, report)

**Kết quả mong đợi:**

```
───────────────────────────────────────────────────────
🔧  Khởi tạo database schema …
✅  Đã tạo 6 bảng:
    • ai_queries            (6 cột)
    • financial_alerts      (9 cột)
    • financial_transactions (15 cột)
    • reports               (10 cột)
    • uploaded_files        (8 cột)
    • users                 (7 cột)

👤  Seed demo users …
    ✅  admin@example.com (admin) → id=1
    ✅  staff@example.com (finance_staff) → id=2
    ✅  manager@example.com (finance_manager) → id=3
    ✅  leader@example.com (leader) → id=4

🎉  Khởi tạo database hoàn tất!
```

---

## 👥 Tài khoản Demo

| Email | Role | Quyền hạn |
|-------|------|-----------|
| `admin@example.com` | `admin` | Toàn quyền hệ thống |
| `staff@example.com` | `finance_staff` | Upload file, xem dữ liệu |
| `manager@example.com` | `finance_manager` | Quản lý báo cáo, duyệt alert |
| `leader@example.com` | `leader` | Phê duyệt báo cáo |

> **Mật khẩu demo:** `password123`  
> Mật khẩu được băm bằng **bcrypt** (12 rounds).

---

## 🗂️ Database Schema

### Bảng `users`
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | INTEGER PK | Auto-increment |
| full_name | VARCHAR(150) | Họ tên |
| email | VARCHAR(255) UNIQUE | Email đăng nhập |
| password_hash | VARCHAR(255) | Mật khẩu băm bcrypt |
| role | ENUM | admin / finance_staff / finance_manager / leader |
| is_active | BOOLEAN | Trạng thái tài khoản |
| created_at | DATETIME | Thời gian tạo |

### Bảng `uploaded_files`
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | INTEGER PK | Auto-increment |
| file_name | VARCHAR(255) | Tên file |
| file_type | VARCHAR(20) | csv / xlsx |
| uploaded_by | FK → users.id | Người upload |
| uploaded_at | DATETIME | Thời điểm upload |
| total_rows | INTEGER | Số dòng dữ liệu |
| status | ENUM | pending / processing / success / failed |
| error_message | TEXT | Thông báo lỗi nếu có |

### Bảng `financial_transactions`
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | INTEGER PK | Auto-increment |
| upload_file_id | FK → uploaded_files.id | File nguồn |
| transaction_id | VARCHAR(50) UNIQUE | Mã giao dịch (TXN-XXXX) |
| date | DATE | Ngày giao dịch |
| month | VARCHAR(7) | YYYY-MM |
| department | VARCHAR(150) | Phòng ban |
| category | VARCHAR(100) | Khoản mục |
| transaction_type | ENUM | expense / revenue |
| budget_amount | FLOAT | Ngân sách |
| actual_amount | FLOAT | Thực tế |
| variance_amount | FLOAT | Chênh lệch (actual - budget) |
| variance_percent | FLOAT | Chênh lệch % |
| description | TEXT | Mô tả |
| status | ENUM | active / reviewed / archived |
| created_at | DATETIME | Thời gian tạo |

### Bảng `financial_alerts`
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | INTEGER PK | Auto-increment |
| transaction_id | FK → financial_transactions.id | Giao dịch liên quan |
| alert_type | ENUM | over_budget / monthly_spike / unusual_revenue |
| alert_level | ENUM | info / warning / critical |
| message | TEXT | Nội dung cảnh báo |
| status | ENUM | open / resolved / ignored |
| created_at | DATETIME | Thời gian tạo |
| resolved_by | FK → users.id | Người giải quyết |
| resolved_at | DATETIME | Thời gian giải quyết |

### Bảng `ai_queries`
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | INTEGER PK | Auto-increment |
| user_id | FK → users.id | Người dùng |
| question | TEXT | Câu hỏi |
| answer | TEXT | Câu trả lời |
| data_source | VARCHAR(255) | Nguồn dữ liệu |
| created_at | DATETIME | Thời gian |

### Bảng `reports`
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | INTEGER PK | Auto-increment |
| report_title | VARCHAR(300) | Tiêu đề báo cáo |
| report_period | VARCHAR(50) | Kỳ báo cáo (2024-03) |
| report_type | ENUM | monthly / quarterly / annual / custom |
| content | TEXT | Nội dung báo cáo |
| status | ENUM | draft / reviewed / approved |
| created_by | FK → users.id | Người tạo |
| reviewed_by | FK → users.id | Người review |
| approved_by | FK → users.id | Người phê duyệt |
| created_at | DATETIME | Thời gian tạo |
| approved_at | DATETIME | Thời gian phê duyệt |

---

## 🔍 Kiểm tra database bằng SQLite CLI

```bash
sqlite3 database/financial.db

# Xem danh sách bảng
.tables

# Xem cấu trúc bảng
.schema users

# Xem dữ liệu user
SELECT id, full_name, email, role FROM users;

# Thoát
.quit
```
