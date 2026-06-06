"""
app/schemas.py
--------------
Pydantic schemas cho toàn bộ API request/response.
"""

from __future__ import annotations
from datetime import datetime, date
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, Field


# ─────────────────────────────────────────────────────────────────────────────
# Common
# ─────────────────────────────────────────────────────────────────────────────
class MessageResponse(BaseModel):
    message: str

class PaginationMeta(BaseModel):
    total: int
    page:  int = 1
    limit: int = 50


# ─────────────────────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email:    str = Field(..., example="staff@example.com")
    password: str = Field(..., example="password123")

class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user:         "UserResponse"

class UserMe(BaseModel):
    id:         int
    full_name:  str
    email:      str
    role:       str
    is_active:  bool
    created_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# Users
# ─────────────────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    full_name: str  = Field(..., min_length=2, example="Nguyễn Văn A")
    email:     str  = Field(..., example="user@example.com")
    password:  str  = Field(..., min_length=6)
    role:      str  = Field(default="finance_staff",
                            pattern="^(admin|finance_staff|finance_manager|leader)$")

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role:      Optional[str] = Field(default=None,
                                     pattern="^(admin|finance_staff|finance_manager|leader)$")
    is_active: Optional[bool] = None

class UserResponse(BaseModel):
    id:         int
    full_name:  str
    email:      str
    role:       str
    is_active:  bool
    created_at: datetime

    model_config = {"from_attributes": True}

class UserListResponse(BaseModel):
    data: List[UserResponse]
    meta: PaginationMeta


# ─────────────────────────────────────────────────────────────────────────────
# Files
# ─────────────────────────────────────────────────────────────────────────────
class FileResponse(BaseModel):
    id:            int
    file_name:     str
    file_type:     str
    uploaded_by:   Optional[int]
    uploaded_at:   datetime
    total_rows:    Optional[int]
    status:        str
    error_message: Optional[str]

    model_config = {"from_attributes": True}

class FileListResponse(BaseModel):
    data: List[FileResponse]
    meta: PaginationMeta

class FileUploadResponse(BaseModel):
    file:    FileResponse
    message: str


# ─────────────────────────────────────────────────────────────────────────────
# Dashboard
# ─────────────────────────────────────────────────────────────────────────────
class KPISummary(BaseModel):
    total_revenue:       float
    total_expense:       float
    total_budget:        float
    budget_used:         float
    budget_remaining:    float
    budget_utilization:  float  # percent
    over_budget_count:   int
    alert_count:         int

class MonthlyTrendItem(BaseModel):
    month:   str
    revenue: float
    expense: float
    budget:  float

class DepartmentExpenseItem(BaseModel):
    department: str
    amount:     float
    budget:     float
    variance:   float

class OverBudgetItem(BaseModel):
    transaction_id:  str
    department:      str
    category:        str
    budget_amount:   float
    actual_amount:   float
    variance_amount: float
    variance_percent: float
    date:            Optional[str]


# ─────────────────────────────────────────────────────────────────────────────
# Alerts
# ─────────────────────────────────────────────────────────────────────────────
class AlertResponse(BaseModel):
    """Schema cơ bản – dùng khi không cần thông tin transaction."""
    id:             int
    transaction_id: int
    alert_type:     str
    alert_level:    str
    message:        str
    status:         str
    created_at:     datetime
    resolved_by:    Optional[int]
    resolved_at:    Optional[datetime]

    model_config = {"from_attributes": True}

class AlertDetailResponse(BaseModel):
    """Schema đầy đủ – bao gồm thông tin phòng ban, khoản mục từ transaction."""
    id:             int
    transaction_id: int
    alert_type:     str
    alert_level:    str
    message:        str
    status:         str
    created_at:     datetime
    resolved_by:    Optional[int]
    resolved_at:    Optional[datetime]
    # Thông tin từ FinancialTransaction (joined)
    txn_ref:    Optional[str]   = None   # transaction_id string
    department: Optional[str]   = None
    category:   Optional[str]   = None
    month:      Optional[str]   = None

    model_config = {"from_attributes": True}

class AlertListResponse(BaseModel):
    data: List[AlertResponse]
    meta: PaginationMeta

class AlertDetailListResponse(BaseModel):
    data: List[AlertDetailResponse]
    meta: PaginationMeta

class AlertSummaryResponse(BaseModel):
    total_open:     int
    high_open:      int
    medium_open:    int
    low_open:       int
    total_resolved: int
    by_type:        dict

class ResolveAlertRequest(BaseModel):
    note: Optional[str] = Field(default=None, example="Đã kiểm tra và xử lý")


# ─────────────────────────────────────────────────────────────────────────────
# AI
# ─────────────────────────────────────────────────────────────────────────────
class AIAskRequest(BaseModel):
    question:    str = Field(..., min_length=5, example="Phòng ban nào vượt ngân sách nhiều nhất?")
    data_source: Optional[str] = Field(default="financial_transactions")

class AIAskResponse(BaseModel):
    question:    str
    answer:      str
    data_source: str
    created_at:  datetime
    disclaimer:  str = "Câu trả lời do AI hỗ trợ, cần kiểm tra lại trước khi sử dụng chính thức."

class AIGenerateReportRequest(BaseModel):
    period:      str = Field(..., example="2024-03")
    report_type: str = Field(default="monthly", pattern="^(monthly|quarterly|annual|custom)$")
    departments: Optional[List[str]] = None


# ─────────────────────────────────────────────────────────────────────────────
# Reports
# ─────────────────────────────────────────────────────────────────────────────
class ReportResponse(BaseModel):
    id:            int
    report_title:  str
    report_period: Optional[str]
    report_type:   str
    content:       Optional[str]
    status:        str
    created_by:    Optional[int]
    reviewed_by:   Optional[int]
    approved_by:   Optional[int]
    created_at:    datetime
    approved_at:   Optional[datetime]

    model_config = {"from_attributes": True}

class ReportListResponse(BaseModel):
    data: List[ReportResponse]
    meta: PaginationMeta

class ReportActionRequest(BaseModel):
    comment: Optional[str] = Field(default=None, example="Đã xem xét và phê duyệt")
