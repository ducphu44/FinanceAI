"""app/routers/ai.py – AI assistant and report generation endpoints"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database     import get_db
from app.models       import User, AIQuery, Report, ReportType, ReportStatus, FinancialTransaction
from app.schemas      import (AIAskRequest, AIAskResponse,
                               AIGenerateReportRequest, ReportResponse)
from app.dependencies import get_current_user

router = APIRouter(prefix="/ai", tags=["AI"])

# ── Simple rule-based mock AI engine ─────────────────────────────────────────
KEYWORDS = {
    "vượt ngân sách": (
        "Dựa trên dữ liệu 6 tháng đầu năm 2024:\n\n"
        "**Research Office** có mức vượt ngân sách cao nhất:\n"
        "- Operations: actual 62,000 / budget 20,000 → **+210%**\n\n"
        "Xếp hạng tiếp theo:\n"
        "1. Admissions Office – Marketing: **+28%**\n"
        "2. Faculty of Medicine – Salary: **+16.2%**\n"
        "3. Faculty of Engineering – Equipment: **+15%**"
    ),
    "salary": (
        "**Tổng chi phí Salary** 6 tháng đầu năm 2024:\n\n"
        "| Phòng ban | Chi phí |\n|---|---|\n"
        "| Faculty of Medicine | 52,300 |\n"
        "| Faculty of Engineering | 44,200 |\n"
        "| Faculty of Business | 38,500 |\n"
        "| Admissions Office | 32,100 |\n"
        "| Student Affairs | 29,800 |\n"
        "| Research Office | 41,600 |\n\n"
        "**Tổng cộng: 238,500** (ngân sách: 230,000 → vượt 3.7%)"
    ),
    "tháng": (
        "**Phân tích theo tháng:**\n\n"
        "Tháng 3/2024 có tỷ lệ vượt ngân sách cao nhất với 12/72 giao dịch (16.7%).\n"
        "Chi phí bất thường chủ yếu tại Research Office và Admissions Office."
    ),
}

def mock_ai_answer(question: str) -> str:
    q_lower = question.lower()
    for kw, ans in KEYWORDS.items():
        if kw in q_lower:
            return ans
    return (
        f"Dựa trên dữ liệu tài chính hiện tại, câu hỏi **\"{question}\"** "
        "đang được phân tích.\n\n"
        "Tổng quan 6 tháng đầu 2024:\n"
        "- Tổng thu: **1,842,500**\n"
        "- Tổng chi: **2,315,800**\n"
        "- Tỷ lệ sử dụng ngân sách: **89.07%**\n"
        "- Số giao dịch vượt ngân sách: **63**\n\n"
        "_Để phân tích chi tiết hơn, vui lòng liên kết với AI model thực tế._"
    )
# ─────────────────────────────────────────────────────────────────────────────


from app.services.ai_service import ask_question, generate_report as ai_generate_report
from sqlalchemy import func

@router.post("/ask", response_model=AIAskResponse,
             summary="Ask AI a question about financial data")
def ask_ai(
    body:         AIAskRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    answer = ask_question(body.question, db)

    # Persist to ai_queries table
    record = AIQuery(
        user_id     = current_user.id,
        question    = body.question,
        answer      = answer,
        data_source = body.data_source or "financial_transactions",
        created_at  = datetime.now(timezone.utc),
    )
    db.add(record); db.commit()

    return AIAskResponse(
        question    = body.question,
        answer      = answer,
        data_source = body.data_source or "financial_transactions",
        created_at  = record.created_at,
    )

@router.post("/generate-report", response_model=ReportResponse,
             summary="AI generates a draft financial report")
def generate_report(
    body:         AIGenerateReportRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    from app.models import TransactionType
    
    # Gather Context Data for Report
    context_data = {}
    
    # Summary KPI
    total_expense = db.query(func.sum(FinancialTransaction.actual_amount)).filter(FinancialTransaction.transaction_type == TransactionType.expense).scalar() or 0
    total_revenue = db.query(func.sum(FinancialTransaction.actual_amount)).filter(FinancialTransaction.transaction_type == TransactionType.revenue).scalar() or 0
    total_budget = db.query(func.sum(FinancialTransaction.budget_amount)).filter(FinancialTransaction.transaction_type == TransactionType.expense).scalar() or 1
    
    context_data["summary"] = {
        "total_revenue": total_revenue,
        "total_expense": total_expense,
        "usage_percent": round((total_expense / total_budget) * 100, 2) if total_budget > 0 else 0
    }
    
    # Over budget
    over_budget_txns = db.query(FinancialTransaction).filter(
        FinancialTransaction.variance_percent > 0
    ).order_by(FinancialTransaction.variance_percent.desc()).limit(10).all()
    
    context_data["over_budget"] = [
        {
            "department": txn.department,
            "category": txn.category,
            "actual_amount": txn.actual_amount,
            "budget_amount": txn.budget_amount,
            "variance_percent": txn.variance_percent
        } for txn in over_budget_txns
    ]

    dept_str = ", ".join(body.departments) if body.departments else "All Departments"
    content = ai_generate_report(body.period, body.report_type, context_data)

    title = f"Báo cáo Tài chính {body.period} (AI Draft)"
    report = Report(
        report_title  = title,
        report_period = body.period,
        report_type   = ReportType(body.report_type),
        content       = content,
        status        = ReportStatus.draft,
        created_by    = current_user.id,
        created_at    = datetime.now(timezone.utc),
    )
    db.add(report); db.commit(); db.refresh(report)
    return ReportResponse.model_validate(report)

