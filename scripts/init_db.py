"""
scripts/init_db.py
------------------
Script khởi tạo database và seed dữ liệu demo.

Cách chạy:
    python scripts/init_db.py
"""

import sys
import os

# Thêm thư mục gốc vào PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt
from datetime import datetime
from sqlalchemy import inspect, text

from app.database import engine, SessionLocal, Base
from app.models import (
    User, UploadedFile, FinancialTransaction, FinancialAlert,
    AIQuery, Report,
    UserRole, FileStatus, TransactionType, TransactionStatus,
    AlertType, AlertLevel, AlertStatus, ReportType, ReportStatus,
)

DEMO_USERS = [
    {
        "full_name"  : "System Administrator",
        "email"      : "admin@example.com",
        "password"   : "password123",
        "role"       : UserRole.admin,
    },
    {
        "full_name"  : "Nguyen Thi Lan",
        "email"      : "staff@example.com",
        "password"   : "password123",
        "role"       : UserRole.finance_staff,
    },
    {
        "full_name"  : "Tran Van Minh",
        "email"      : "manager@example.com",
        "password"   : "password123",
        "role"       : UserRole.finance_manager,
    },
    {
        "full_name"  : "Le Thi Hoa",
        "email"      : "leader@example.com",
        "password"   : "password123",
        "role"       : UserRole.leader,
    },
]


def hash_password(plain: str) -> str:
    """Băm mật khẩu bằng bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(plain.encode("utf-8"), salt).decode("utf-8")


def create_tables() -> None:
    """Tạo tất cả bảng theo models đã định nghĩa."""
    print("─" * 55)
    print("🔧  Khởi tạo database schema …")
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    tables    = inspector.get_table_names()
    print(f"✅  Đã tạo {len(tables)} bảng:")
    for t in sorted(tables):
        cols = [c["name"] for c in inspector.get_columns(t)]
        print(f"    • {t} ({len(cols)} cột)")
    print()


def seed_users(db) -> dict[str, User]:
    """Tạo 4 user demo nếu chưa tồn tại. Trả về dict email → User."""
    print("👤  Seed demo users …")
    user_map: dict[str, User] = {}

    for data in DEMO_USERS:
        existing = db.query(User).filter(User.email == data["email"]).first()
        if existing:
            print(f"    ⚠️  {data['email']} đã tồn tại – bỏ qua")
            user_map[data["email"]] = existing
        else:
            user = User(
                full_name     = data["full_name"],
                email         = data["email"],
                password_hash = hash_password(data["password"]),
                role          = data["role"],
                is_active     = True,
                created_at    = datetime.utcnow(),
            )
            db.add(user)
            db.flush()   # lấy id trước khi commit
            user_map[data["email"]] = user
            print(f"    ✅  {data['email']} ({data['role']}) → id={user.id}")

    db.commit()
    print()
    return user_map


def seed_demo_data(db, user_map: dict[str, User]) -> None:
    """Tạo dữ liệu demo nhỏ: 1 file upload + 3 giao dịch + 1 alert + 1 query + 1 report."""
    staff   = user_map.get("staff@example.com")
    manager = user_map.get("manager@example.com")
    leader  = user_map.get("leader@example.com")

    print("📂  Seed demo uploaded file …")
    demo_file = db.query(UploadedFile).filter(UploadedFile.file_name == "financial_sample.csv").first()
    if not demo_file:
        demo_file = UploadedFile(
            file_name   = "financial_sample.csv",
            file_type   = "csv",
            uploaded_by = staff.id if staff else None,
            uploaded_at = datetime.utcnow(),
            total_rows  = 321,
            status      = FileStatus.success,
        )
        db.add(demo_file)
        db.flush()
        print(f"    ✅  UploadedFile id={demo_file.id}")
    else:
        print(f"    ⚠️  UploadedFile đã tồn tại id={demo_file.id}")

    print("💰  Seed demo transactions …")
    demo_txns = [
        ("TXN-DEMO-001", "Faculty of Medicine",   "Salary",    "expense", 45000, 52000),
        ("TXN-DEMO-002", "Faculty of Engineering","Equipment", "expense", 30000, 28500),
        ("TXN-DEMO-003", "Research Office",       "Operations","revenue", 20000, 62000),
    ]

    txn_objs = []
    for tid, dept, cat, ttype, budget, actual in demo_txns:
        existing = db.query(FinancialTransaction).filter(FinancialTransaction.transaction_id == tid).first()
        if existing:
            print(f"    ⚠️  {tid} đã tồn tại")
            txn_objs.append(existing)
            continue

        variance_amt = round(actual - budget, 2)
        variance_pct = round((variance_amt / budget) * 100, 2) if budget else 0.0

        t = FinancialTransaction(
            upload_file_id   = demo_file.id,
            transaction_id   = tid,
            date             = datetime(2024, 3, 15).date(),
            month            = "2024-03",
            department       = dept,
            category         = cat,
            transaction_type = TransactionType(ttype),
            budget_amount    = budget,
            actual_amount    = actual,
            variance_amount  = variance_amt,
            variance_percent = variance_pct,
            description      = f"Demo transaction – {cat} for {dept}",
            status           = TransactionStatus.active,
        )
        db.add(t)
        db.flush()
        txn_objs.append(t)
        print(f"    ✅  {tid}: budget={budget:,.0f} actual={actual:,.0f} variance={variance_pct:+.1f}%")

    print("🚨  Seed demo alert …")
    over_txn = txn_objs[0]
    existing_alert = db.query(FinancialAlert).filter(
        FinancialAlert.transaction_id == over_txn.id,
        FinancialAlert.alert_type     == AlertType.over_budget,
    ).first()
    if not existing_alert:
        alert = FinancialAlert(
            transaction_id = over_txn.id,
            alert_type     = AlertType.over_budget,
            alert_level    = AlertLevel.medium,
            message        = (
                f"[{over_txn.transaction_id}] Vượt ngân sách "
                f"{over_txn.variance_percent:+.1f}%: "
                f"thực tế={over_txn.actual_amount:,.0f} > ngân sách={over_txn.budget_amount:,.0f}"
            ),
            status         = AlertStatus.open,
        )
        db.add(alert)
        db.flush()
        print(f"    ✅  Alert id={alert.id} – over_budget / medium")
    else:
        print(f"    ⚠️  Alert đã tồn tại")

    print("🤖  Seed demo AI query …")
    if staff and db.query(AIQuery).count() == 0:
        q = AIQuery(
            user_id     = staff.id,
            question    = "Phòng ban nào vượt ngân sách nhiều nhất trong tháng 3/2024?",
            answer      = "Faculty of Medicine vượt ngân sách 15.6% với tổng chi phí thực tế 52,000.",
            data_source = "financial_transactions",
        )
        db.add(q)
        print(f"    ✅  AI Query đã thêm")

    print("📊  Seed demo report …")
    if db.query(Report).count() == 0:
        r = Report(
            report_title  = "Báo cáo Tài chính Tháng 3/2024",
            report_period = "2024-03",
            report_type   = ReportType.monthly,
            content       = "# Báo cáo tháng 3/2024\n\nDữ liệu demo – chưa có nội dung thực.",
            status        = ReportStatus.draft,
            created_by    = staff.id   if staff   else None,
            reviewed_by   = manager.id if manager else None,
            approved_by   = leader.id  if leader  else None,
        )
        db.add(r)
        print(f"    ✅  Report đã thêm")

    db.commit()
    print()


def verify_db() -> None:
    """Kiểm tra nhanh – đếm số bản ghi từng bảng."""
    print("🔍  Xác minh dữ liệu …")
    tables = [
        "users", "uploaded_files", "financial_transactions",
        "financial_alerts", "ai_queries", "reports",
    ]
    with engine.connect() as conn:
        for tbl in tables:
            count = conn.execute(text(f"SELECT COUNT(*) FROM {tbl}")).scalar()
            print(f"    {tbl:<30} {count:>5} bản ghi")
    print()


if __name__ == "__main__":
    create_tables()

    db = SessionLocal()
    try:
        user_map = seed_users(db)
        seed_demo_data(db, user_map)
    except Exception as exc:
        db.rollback()
        print(f"❌  Lỗi: {exc}")
        raise
    finally:
        db.close()

    verify_db()
    print("─" * 55)
    print("🎉  Khởi tạo database hoàn tất!")
    print(f"    Database: database/financial.db")
    print("─" * 55)
