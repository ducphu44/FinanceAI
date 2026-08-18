# FinanceAI – Hệ thống Quản lý Tài chính Đại học

Hệ thống quản lý tài chính gồm **backend FastAPI** (Python) và **frontend Next.js** (React + Recharts), tích hợp **AI Agent** hỗ trợ hỏi đáp và sinh báo cáo tài chính.

---

## ✨ Tính năng chính

- **Xác thực & phân quyền**: đăng nhập JWT, 4 vai trò (`admin`, `finance_staff`, `finance_manager`, `leader`).
- **Upload dữ liệu**: nhập file CSV/XLSX giao dịch tài chính (pandas + openpyxl), tự động tính chênh lệch ngân sách và sinh cảnh báo.
- **Dashboard**: KPI tổng hợp, xu hướng thu chi theo tháng, chi phí theo phòng ban, danh sách vượt ngân sách — hiển thị bằng biểu đồ **Recharts** trên frontend.
- **Cảnh báo tài chính**: phát hiện vượt ngân sách / chi tiêu bất thường, xử lý trạng thái (resolve / ignore).
- **AI Assistant + Chatbot widget**: AI Agent dùng **OpenAI Function Calling** (`gpt-4o-mini`) — tự động gọi các tool truy vấn SQL (giao dịch vượt ngân sách, chi phí/doanh thu theo phòng ban, KPI tổng hợp) để trả lời từ dữ liệu thật, không bịa số liệu. Khi chưa cấu hình `OPENAI_API_KEY`, hệ thống fallback sang chế độ mock.
- **Báo cáo tài chính**: AI sinh báo cáo nháp dạng Markdown theo cấu trúc 7 phần; quy trình duyệt `draft → submit → approve/reject`. Trang báo cáo hiển thị dashboard trực quan (biểu đồ, chỉ số) và hỗ trợ **xuất file Markdown** hoặc **in / lưu PDF**.
- **Quản lý người dùng**: CRUD user theo quyền admin.

---

## 📁 Cấu trúc thư mục

```
.
├── main.py                # Entry point FastAPI (tự khởi tạo DB + seed khi start)
├── requirements.txt       # Dependencies backend
├── app/
│   ├── database.py        # Kết nối DB (SQLite mặc định, PostgreSQL qua DATABASE_URL)
│   ├── models.py          # ORM models (users, transactions, alerts, reports, ...)
│   ├── schemas.py         # Pydantic schemas
│   ├── auth_utils.py      # JWT + bcrypt
│   ├── dependencies.py    # Auth dependencies (get_current_user, phân quyền)
│   ├── routers/           # auth, users, files, dashboard, alerts, ai, reports
│   └── services/          # ai_service (AI Agent + sinh báo cáo), alert_service
├── frontend/              # Next.js 16 + React 19 + Tailwind CSS 4 + Recharts
│   ├── app/               # Pages: login, dashboard, upload, reports, alerts,
│   │                      #        ai-assistant, users
│   └── components/        # Header, Sidebar, ChatbotWidget
├── scripts/
│   ├── init_db.py         # Khởi tạo bảng + seed dữ liệu demo
│   └── test_chatbot_agent.py  # Test AI Agent function calling
├── sample_data/           # File CSV/XLSX mẫu để upload
├── uploads/               # File người dùng upload (tạo tự động)
└── docs/
    ├── api_endpoints.md          # Tài liệu chi tiết API
    └── sample_data_dictionary.md # Mô tả cột dữ liệu mẫu
```

---

## ⚙️ Cài đặt & chạy Backend

Yêu cầu: Python 3.10+

```bash
# 1. Tạo và kích hoạt virtual environment
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 2. Cài dependencies
pip install -r requirements.txt

# 3. Chạy server
uvicorn main:app --reload
```

- API chạy tại `http://localhost:8000` — Swagger: `/docs`, ReDoc: `/redoc`, health check: `/health`.
- **Database tự khởi tạo khi start**: bảng được tạo và seed dữ liệu demo tự động (SQLite tại `database/financial.db`). Có thể chạy thủ công: `python scripts/init_db.py`.

### Biến môi trường (tùy chọn, file `.env`)

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `DATABASE_URL` | SQLite `database/financial.db` | Chuỗi kết nối PostgreSQL khi deploy (hỗ trợ Render, tự đổi `postgres://` → `postgresql://`) |
| `OPENAI_API_KEY` | _(trống → dùng mock)_ | Bật AI Agent thật (OpenAI function calling) |
| `SECRET_KEY` | key dev có sẵn | Secret ký JWT — đổi khi production |

---

## 💻 Chạy Frontend

Yêu cầu: Node.js 18+

```bash
cd frontend
npm install
npm run dev
```

Mở `http://localhost:3000`. Frontend gọi API qua biến `NEXT_PUBLIC_API_URL` (mặc định `http://localhost:8000`).

---

## 👥 Tài khoản Demo

| Email | Role | Quyền hạn |
|-------|------|-----------|
| `admin@example.com` | `admin` | Toàn quyền hệ thống |
| `staff@example.com` | `finance_staff` | Upload file, xem dữ liệu |
| `manager@example.com` | `finance_manager` | Quản lý báo cáo, xử lý cảnh báo |
| `leader@example.com` | `leader` | Phê duyệt báo cáo |

> **Mật khẩu demo:** `password123` (băm bằng bcrypt)

---

## 📡 API chính

| Nhóm | Prefix | Chức năng |
|------|--------|-----------|
| Auth | `/auth` | Login, lấy thông tin user hiện tại |
| Users | `/users` | CRUD người dùng (admin) |
| Files | `/files` | Upload CSV/XLSX, danh sách & chi tiết file |
| Dashboard | `/dashboard` | KPI summary, xu hướng theo tháng, chi phí phòng ban, vượt ngân sách |
| Alerts | `/alerts` | Tổng hợp, danh sách, phân tích, resolve/ignore cảnh báo |
| AI | `/ai` | `POST /ai/ask` (hỏi đáp AI Agent), `POST /ai/generate-report` (sinh báo cáo nháp) |
| Reports | `/reports` | Danh sách, chi tiết, submit, approve, reject báo cáo |

Chi tiết request/response: xem [`docs/api_endpoints.md`](docs/api_endpoints.md).

---

## 🗄️ Database

6 bảng chính: `users`, `uploaded_files`, `financial_transactions`, `financial_alerts`, `ai_queries`, `reports` (chi tiết trong `app/models.py`).

Kiểm tra nhanh với SQLite CLI:

```bash
sqlite3 database/financial.db
.tables
SELECT id, full_name, email, role FROM users;
.quit
```
