"""
app/models.py
-------------
SQLAlchemy ORM models cho toàn bộ hệ thống tài chính.
"""

from datetime import datetime
from sqlalchemy import (
    Integer, String, Boolean, Float, Text, DateTime, Date,
    ForeignKey, Enum
)
from sqlalchemy.orm import relationship, mapped_column, Mapped
from typing import Optional
from app.database import Base

# ── Enums ─────────────────────────────────────────────────────────────────────
import enum

class UserRole(str, enum.Enum):
    admin           = "admin"
    finance_staff   = "finance_staff"
    finance_manager = "finance_manager"
    leader          = "leader"

class FileStatus(str, enum.Enum):
    pending    = "pending"
    processing = "processing"
    success    = "success"
    failed     = "failed"

class TransactionType(str, enum.Enum):
    revenue = "revenue"
    expense = "expense"

class TransactionStatus(str, enum.Enum):
    active   = "active"
    reviewed = "reviewed"
    archived = "archived"

class AlertType(str, enum.Enum):
    over_budget       = "over_budget"       # actual > budget
    high_variance     = "high_variance"     # variance_percent > 20%
    unusual_increase  = "unusual_increase"  # chi phí tăng > 20% so với tháng trước
    fast_budget_usage = "fast_budget_usage" # sử dụng > 80% ngân sách

class AlertLevel(str, enum.Enum):
    low    = "low"    # chênh lệch 0-10%
    medium = "medium" # chênh lệch > 10-20%
    high   = "high"   # chênh lệch > 20%

class AlertStatus(str, enum.Enum):
    open     = "open"
    resolved = "resolved"
    ignored  = "ignored"

class ReportStatus(str, enum.Enum):
    draft    = "draft"
    reviewed = "reviewed"
    approved = "approved"

class ReportType(str, enum.Enum):
    monthly   = "monthly"
    quarterly = "quarterly"
    annual    = "annual"
    custom    = "custom"


# ─────────────────────────────────────────────────────────────────────────────
# 1. users
# ─────────────────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id            : Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    full_name     : Mapped[str]            = mapped_column(String(150), nullable=False)
    email         : Mapped[str]            = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash : Mapped[str]            = mapped_column(String(255), nullable=False)
    role          : Mapped[str]            = mapped_column(
                                                Enum(UserRole, name="user_role"),
                                                nullable=False,
                                                default=UserRole.finance_staff
                                            )
    is_active     : Mapped[bool]           = mapped_column(Boolean, default=True, nullable=False)
    created_at    : Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    uploaded_files  : Mapped[list["UploadedFile"]] = relationship("UploadedFile", back_populates="uploader", foreign_keys="UploadedFile.uploaded_by")
    ai_queries      : Mapped[list["AIQuery"]]      = relationship("AIQuery", back_populates="user")
    reports_created : Mapped[list["Report"]]       = relationship("Report", back_populates="creator",  foreign_keys="Report.created_by")
    reports_reviewed: Mapped[list["Report"]]       = relationship("Report", back_populates="reviewer", foreign_keys="Report.reviewed_by")
    reports_approved: Mapped[list["Report"]]       = relationship("Report", back_populates="approver", foreign_keys="Report.approved_by")
    resolved_alerts : Mapped[list["FinancialAlert"]] = relationship("FinancialAlert", back_populates="resolver")

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role}>"


# ─────────────────────────────────────────────────────────────────────────────
# 2. uploaded_files
# ─────────────────────────────────────────────────────────────────────────────
class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id            : Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    file_name     : Mapped[str]            = mapped_column(String(255), nullable=False)
    file_type     : Mapped[str]            = mapped_column(String(20),  nullable=False)   # csv / xlsx
    uploaded_by   : Mapped[int]            = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    uploaded_at   : Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    total_rows    : Mapped[Optional[int]]  = mapped_column(Integer, nullable=True)
    status        : Mapped[str]            = mapped_column(
                                                Enum(FileStatus, name="file_status"),
                                                default=FileStatus.pending,
                                                nullable=False
                                            )
    error_message : Mapped[Optional[str]]  = mapped_column(Text, nullable=True)

    # Relationships
    uploader     : Mapped[Optional["User"]]              = relationship("User", back_populates="uploaded_files", foreign_keys=[uploaded_by])
    transactions : Mapped[list["FinancialTransaction"]]  = relationship("FinancialTransaction", back_populates="upload_file")

    def __repr__(self) -> str:
        return f"<UploadedFile id={self.id} name={self.file_name!r} status={self.status}>"


# ─────────────────────────────────────────────────────────────────────────────
# 3. financial_transactions
# ─────────────────────────────────────────────────────────────────────────────
class FinancialTransaction(Base):
    __tablename__ = "financial_transactions"

    id               : Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    upload_file_id   : Mapped[Optional[int]]  = mapped_column(ForeignKey("uploaded_files.id", ondelete="SET NULL"), nullable=True)
    transaction_id   : Mapped[str]            = mapped_column(String(50),  nullable=False, unique=True, index=True)
    date             : Mapped[Optional[str]]  = mapped_column(Date,         nullable=True)
    month            : Mapped[Optional[str]]  = mapped_column(String(7),    nullable=True, index=True)   # YYYY-MM
    department       : Mapped[str]            = mapped_column(String(150),  nullable=False, index=True)
    category         : Mapped[str]            = mapped_column(String(100),  nullable=False, index=True)
    transaction_type : Mapped[str]            = mapped_column(
                                                    Enum(TransactionType, name="transaction_type"),
                                                    nullable=False
                                                )
    budget_amount    : Mapped[float]          = mapped_column(Float, nullable=False, default=0.0)
    actual_amount    : Mapped[float]          = mapped_column(Float, nullable=False, default=0.0)
    variance_amount  : Mapped[float]          = mapped_column(Float, nullable=False, default=0.0)
    variance_percent : Mapped[float]          = mapped_column(Float, nullable=False, default=0.0)
    description      : Mapped[Optional[str]]  = mapped_column(Text,  nullable=True)
    status           : Mapped[str]            = mapped_column(
                                                    Enum(TransactionStatus, name="transaction_status"),
                                                    default=TransactionStatus.active,
                                                    nullable=False
                                                )
    created_at       : Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    upload_file : Mapped[Optional["UploadedFile"]]  = relationship("UploadedFile", back_populates="transactions")
    alerts      : Mapped[list["FinancialAlert"]]    = relationship("FinancialAlert", back_populates="transaction")

    def __repr__(self) -> str:
        return f"<FinancialTransaction id={self.id} txn_id={self.transaction_id!r}>"


# ─────────────────────────────────────────────────────────────────────────────
# 4. financial_alerts
# ─────────────────────────────────────────────────────────────────────────────
class FinancialAlert(Base):
    __tablename__ = "financial_alerts"

    id             : Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    transaction_id : Mapped[int]            = mapped_column(ForeignKey("financial_transactions.id", ondelete="CASCADE"), nullable=False)
    alert_type     : Mapped[str]            = mapped_column(
                                                 Enum(AlertType, name="alert_type"),
                                                 nullable=False
                                             )
    alert_level    : Mapped[str]            = mapped_column(
                                                 Enum(AlertLevel, name="alert_level"),
                                                 nullable=False
                                             )
    message        : Mapped[str]            = mapped_column(Text, nullable=False)
    status         : Mapped[str]            = mapped_column(
                                                 Enum(AlertStatus, name="alert_status"),
                                                 default=AlertStatus.open,
                                                 nullable=False
                                             )
    created_at     : Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    resolved_by    : Mapped[Optional[int]]  = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at    : Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    transaction : Mapped["FinancialTransaction"] = relationship("FinancialTransaction", back_populates="alerts")
    resolver    : Mapped[Optional["User"]]       = relationship("User", back_populates="resolved_alerts")

    def __repr__(self) -> str:
        return f"<FinancialAlert id={self.id} type={self.alert_type} level={self.alert_level}>"


# ─────────────────────────────────────────────────────────────────────────────
# 5. ai_queries
# ─────────────────────────────────────────────────────────────────────────────
class AIQuery(Base):
    __tablename__ = "ai_queries"

    id          : Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id     : Mapped[Optional[int]]  = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    question    : Mapped[str]            = mapped_column(Text, nullable=False)
    answer      : Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    data_source : Mapped[Optional[str]]  = mapped_column(String(255), nullable=True)
    created_at  : Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user : Mapped[Optional["User"]] = relationship("User", back_populates="ai_queries")

    def __repr__(self) -> str:
        return f"<AIQuery id={self.id} user_id={self.user_id}>"


# ─────────────────────────────────────────────────────────────────────────────
# 6. reports
# ─────────────────────────────────────────────────────────────────────────────
class Report(Base):
    __tablename__ = "reports"

    id            : Mapped[int]            = mapped_column(Integer, primary_key=True, autoincrement=True)
    report_title  : Mapped[str]            = mapped_column(String(300), nullable=False)
    report_period : Mapped[Optional[str]]  = mapped_column(String(50),  nullable=True)   # e.g. "2024-Q1"
    report_type   : Mapped[str]            = mapped_column(
                                                Enum(ReportType, name="report_type"),
                                                nullable=False,
                                                default=ReportType.monthly
                                            )
    content       : Mapped[Optional[str]]  = mapped_column(Text, nullable=True)          # JSON hoặc Markdown
    status        : Mapped[str]            = mapped_column(
                                                Enum(ReportStatus, name="report_status"),
                                                default=ReportStatus.draft,
                                                nullable=False
                                            )
    created_by    : Mapped[Optional[int]]  = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_by   : Mapped[Optional[int]]  = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_by   : Mapped[Optional[int]]  = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at    : Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    approved_at   : Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    creator  : Mapped[Optional["User"]] = relationship("User", back_populates="reports_created",  foreign_keys=[created_by])
    reviewer : Mapped[Optional["User"]] = relationship("User", back_populates="reports_reviewed", foreign_keys=[reviewed_by])
    approver : Mapped[Optional["User"]] = relationship("User", back_populates="reports_approved", foreign_keys=[approved_by])

    def __repr__(self) -> str:
        return f"<Report id={self.id} title={self.report_title!r} status={self.status}>"
