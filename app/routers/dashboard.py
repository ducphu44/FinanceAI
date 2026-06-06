"""app/routers/dashboard.py – Dashboard endpoints powered by real DB data"""

from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.database     import get_db
from app.models       import User, FinancialTransaction, FinancialAlert, AlertStatus
from app.dependencies import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


# ── Response schemas ──────────────────────────────────────────────────────────
class KPISummary(BaseModel):
    total_revenue:            float
    total_expense:            float
    total_budget:             float
    budget_used:              float
    budget_remaining:         float
    budget_usage_percent:     float
    number_of_alerts:         int
    top_spending_department:  Optional[str]
    top_over_budget_category: Optional[str]

class MonthlyTrendItem(BaseModel):
    month:   str
    revenue: float
    expense: float

class DepartmentExpenseItem(BaseModel):
    department: str
    expense:    float

class OverBudgetItem(BaseModel):
    transaction_id:  str
    month:           Optional[str]
    department:      str
    category:        str
    budget_amount:   float
    actual_amount:   float
    variance_amount: float
    variance_percent: float
    status:          str   # over_budget | unusual


# ── Helpers ───────────────────────────────────────────────────────────────────
def _base_query(db: Session, month: Optional[str], department: Optional[str]):
    """Return a filtered FinancialTransaction query."""
    q = db.query(FinancialTransaction)
    if month:      q = q.filter(FinancialTransaction.month      == month)
    if department: q = q.filter(FinancialTransaction.department == department)
    return q


# ─────────────────────────────────────────────────────────────────────────────
# GET /dashboard/summary
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/summary", response_model=KPISummary,
            summary="KPI summary – revenue, expense, budget utilisation, alerts")
def get_summary(
    month:      Optional[str] = Query(default=None, description="Filter by month (YYYY-MM)"),
    department: Optional[str] = Query(default=None, description="Filter by department name"),
    db:         Session = Depends(get_db),
    _:          User    = Depends(get_current_user),
):
    q = _base_query(db, month, department)

    # Aggregate revenue and expense in one pass
    agg = q.with_entities(
        func.sum(case((FinancialTransaction.transaction_type == "revenue",
                       FinancialTransaction.actual_amount), else_=0)).label("revenue"),
        func.sum(case((FinancialTransaction.transaction_type == "expense",
                       FinancialTransaction.actual_amount), else_=0)).label("expense"),
        func.sum(case((FinancialTransaction.transaction_type == "expense",
                       FinancialTransaction.budget_amount),  else_=0)).label("budget"),
    ).one()

    revenue = float(agg.revenue or 0)
    expense = float(agg.expense or 0)
    budget  = float(agg.budget  or 0)
    remaining   = round(budget - expense, 2)
    usage_pct   = round((expense / budget * 100) if budget else 0, 2)

    # Alerts count
    alert_q = db.query(FinancialAlert).filter(FinancialAlert.status == AlertStatus.open)
    if month or department:
        alert_q = alert_q.join(FinancialTransaction)
        if month:
            alert_q = alert_q.filter(FinancialTransaction.month == month)
        if department:
            alert_q = alert_q.filter(FinancialTransaction.department == department)
    alert_count = alert_q.count()

    # Top spending department (expense only)
    top_dept_row = (
        _base_query(db, month, department)
        .filter(FinancialTransaction.transaction_type == "expense")
        .with_entities(FinancialTransaction.department,
                       func.sum(FinancialTransaction.actual_amount).label("total"))
        .group_by(FinancialTransaction.department)
        .order_by(func.sum(FinancialTransaction.actual_amount).desc())
        .first()
    )
    top_dept = top_dept_row.department if top_dept_row else None

    # Top over-budget category
    top_cat_row = (
        _base_query(db, month, department)
        .filter(FinancialTransaction.actual_amount > FinancialTransaction.budget_amount)
        .with_entities(FinancialTransaction.category,
                       func.count().label("cnt"))
        .group_by(FinancialTransaction.category)
        .order_by(func.count().desc())
        .first()
    )
    top_cat = top_cat_row.category if top_cat_row else None

    return KPISummary(
        total_revenue            = revenue,
        total_expense            = expense,
        total_budget             = budget,
        budget_used              = expense,
        budget_remaining         = remaining,
        budget_usage_percent     = usage_pct,
        number_of_alerts         = alert_count,
        top_spending_department  = top_dept,
        top_over_budget_category = top_cat,
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /dashboard/monthly-trend
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/monthly-trend", response_model=list[MonthlyTrendItem],
            summary="Monthly revenue vs expense trend")
def get_monthly_trend(
    month:      Optional[str] = Query(default=None),
    department: Optional[str] = Query(default=None),
    db:         Session = Depends(get_db),
    _:          User    = Depends(get_current_user),
):
    q = db.query(FinancialTransaction)
    if month:
        q = q.filter(FinancialTransaction.month == month)
    if department:
        q = q.filter(FinancialTransaction.department == department)

    rows = (
        q.filter(FinancialTransaction.month.isnot(None))
        .with_entities(
            FinancialTransaction.month,
            func.sum(case((FinancialTransaction.transaction_type == "revenue",
                           FinancialTransaction.actual_amount), else_=0)).label("revenue"),
            func.sum(case((FinancialTransaction.transaction_type == "expense",
                           FinancialTransaction.actual_amount), else_=0)).label("expense"),
        )
        .group_by(FinancialTransaction.month)
        .order_by(FinancialTransaction.month)
        .all()
    )

    return [
        MonthlyTrendItem(
            month   = r.month,
            revenue = round(float(r.revenue or 0), 2),
            expense = round(float(r.expense or 0), 2),
        )
        for r in rows
    ]


# ─────────────────────────────────────────────────────────────────────────────
# GET /dashboard/department-expense
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/department-expense", response_model=list[DepartmentExpenseItem],
            summary="Total expense grouped by department")
def get_dept_expense(
    month:      Optional[str] = Query(default=None),
    department: Optional[str] = Query(default=None),
    db:         Session = Depends(get_db),
    _:          User    = Depends(get_current_user),
):
    q = db.query(FinancialTransaction).filter(
        FinancialTransaction.transaction_type == "expense"
    )
    if month:
        q = q.filter(FinancialTransaction.month == month)
    if department:
        q = q.filter(FinancialTransaction.department == department)

    rows = (
        q.with_entities(
            FinancialTransaction.department,
            func.sum(FinancialTransaction.actual_amount).label("expense"),
        )
        .group_by(FinancialTransaction.department)
        .order_by(func.sum(FinancialTransaction.actual_amount).desc())
        .all()
    )

    return [
        DepartmentExpenseItem(
            department = r.department,
            expense    = round(float(r.expense or 0), 2),
        )
        for r in rows
    ]


# ─────────────────────────────────────────────────────────────────────────────
# GET /dashboard/over-budget
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/over-budget", response_model=list[OverBudgetItem],
            summary="Transactions where actual > budget")
def get_over_budget(
    month:      Optional[str] = Query(default=None),
    department: Optional[str] = Query(default=None),
    limit:      int           = Query(default=50, le=200),
    db:         Session = Depends(get_db),
    _:          User    = Depends(get_current_user),
):
    q = _base_query(db, month, department).filter(
        FinancialTransaction.actual_amount > FinancialTransaction.budget_amount
    )
    rows = q.order_by(FinancialTransaction.variance_percent.desc()).limit(limit).all()

    return [
        OverBudgetItem(
            transaction_id   = r.transaction_id,
            month            = r.month,
            department       = r.department,
            category         = r.category,
            budget_amount    = round(r.budget_amount,  2),
            actual_amount    = round(r.actual_amount,  2),
            variance_amount  = round(r.variance_amount, 2),
            variance_percent = round(r.variance_percent, 2),
            status           = "unusual" if abs(r.variance_percent) > 20 else "over_budget",
        )
        for r in rows
    ]
