"""
tests/conftest.py
-----------------
Fixtures dùng chung cho toàn bộ test suite.

Nguyên tắc quan trọng:
- Ép DATABASE_URL = "sqlite://" (in-memory) TRƯỚC KHI import bất kỳ module app
  nào, để engine thật trong app.database không bao giờ trỏ tới file database
  thật trên đĩa.
- Mỗi test dùng một engine SQLite in-memory riêng (StaticPool) và override
  dependency get_db, nên các test hoàn toàn cô lập với nhau và với DB thật.
- TestClient được dùng KHÔNG qua context manager để lifespan (seed dữ liệu
  demo) không chạy trong lúc test.
"""

import os
import sys

# Cho phép `import app` / `import main` khi pytest chạy từ bất kỳ đâu
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Phải đặt trước khi import app.database (module đọc env var lúc import)
os.environ["DATABASE_URL"] = "sqlite://"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models
from app.auth_utils import create_access_token, hash_password
from app.database import Base, get_db
from main import app

TEST_PASSWORD = "password123"


@pytest.fixture(scope="session")
def password_hash() -> str:
    """Hash bcrypt tính một lần cho cả session (bcrypt rounds=12 khá chậm)."""
    return hash_password(TEST_PASSWORD)


@pytest.fixture()
def db_session():
    """Session gắn với một database SQLite in-memory mới cho từng test."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def client(db_session):
    """TestClient với get_db được override sang session in-memory."""

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture()
def seed_users(db_session, password_hash):
    """Tạo sẵn user cho các role chính + một user bị vô hiệu hóa."""
    users = {}
    specs = [
        ("admin",           "Quản trị viên",  "admin@test.com",    True),
        ("finance_staff",   "Nhân viên TC",   "staff@test.com",    True),
        ("finance_manager", "Trưởng phòng TC", "manager@test.com", True),
        ("finance_staff",   "Đã nghỉ việc",   "inactive@test.com", False),
    ]
    for role, name, email, active in specs:
        user = models.User(
            full_name=name,
            email=email,
            password_hash=password_hash,
            role=role,
            is_active=active,
        )
        db_session.add(user)
        key = "inactive" if not active else role
        users[key] = user
    db_session.commit()
    for user in users.values():
        db_session.refresh(user)
    return users


def auth_header(user: models.User) -> dict:
    """Tạo header Authorization: Bearer <token> cho một user."""
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def seed_transactions(db_session):
    """Ba giao dịch mẫu: 1 revenue + 2 expense (một cái vượt ngân sách)."""
    txns = [
        models.FinancialTransaction(
            transaction_id="TXN-REV-001",
            month="2024-03",
            department="Phòng Đào tạo",
            category="Học phí",
            transaction_type="revenue",
            budget_amount=0.0,
            actual_amount=1000.0,
            variance_amount=0.0,
            variance_percent=0.0,
        ),
        models.FinancialTransaction(
            transaction_id="TXN-EXP-001",
            month="2024-03",
            department="Phòng Hành chính",
            category="Văn phòng phẩm",
            transaction_type="expense",
            budget_amount=500.0,
            actual_amount=600.0,
            variance_amount=100.0,
            variance_percent=20.0,
        ),
        models.FinancialTransaction(
            transaction_id="TXN-EXP-002",
            month="2024-04",
            department="Phòng CNTT",
            category="Thiết bị",
            transaction_type="expense",
            budget_amount=400.0,
            actual_amount=300.0,
            variance_amount=-100.0,
            variance_percent=-25.0,
        ),
    ]
    db_session.add_all(txns)
    db_session.commit()
    for txn in txns:
        db_session.refresh(txn)
    return txns
