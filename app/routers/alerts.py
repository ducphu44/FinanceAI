"""app/routers/alerts.py – Financial alert endpoints (phiên bản đầy đủ)"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database  import get_db
from app.models    import (
    AlertStatus, AlertType, AlertLevel,
    FinancialAlert, FinancialTransaction, User,
)
from app.schemas   import (
    AlertDetailResponse, AlertDetailListResponse,
    AlertSummaryResponse, ResolveAlertRequest,
    PaginationMeta,
)
from app.dependencies import get_current_user
from app.services.alert_service import run_full_analysis

router = APIRouter(prefix="/alerts", tags=["Alerts"])


# ── Serializer helper ─────────────────────────────────────────────────────────

def _to_detail(a: FinancialAlert) -> AlertDetailResponse:
    """Chuyển ORM object sang AlertDetailResponse (bao gồm thông tin transaction)."""
    txn = a.transaction  # lazy-loaded
    return AlertDetailResponse(
        id=a.id,
        transaction_id=a.transaction_id,
        alert_type=a.alert_type,
        alert_level=a.alert_level,
        message=a.message,
        status=a.status,
        created_at=a.created_at,
        resolved_by=a.resolved_by,
        resolved_at=a.resolved_at,
        txn_ref=txn.transaction_id if txn else None,
        department=txn.department if txn else None,
        category=txn.category if txn else None,
        month=txn.month if txn else None,
    )


# ── GET /alerts/summary ───────────────────────────────────────────────────────

@router.get(
    "/summary",
    response_model=AlertSummaryResponse,
    summary="Tổng hợp số lượng cảnh báo theo mức độ và trạng thái",
)
def get_alert_summary(
    db: Session = Depends(get_db),
    _:  User    = Depends(get_current_user),
):
    open_q = db.query(FinancialAlert).filter(FinancialAlert.status == AlertStatus.open)

    total_open     = open_q.count()
    high_open      = open_q.filter(FinancialAlert.alert_level == AlertLevel.high).count()
    medium_open    = open_q.filter(FinancialAlert.alert_level == AlertLevel.medium).count()
    low_open       = open_q.filter(FinancialAlert.alert_level == AlertLevel.low).count()
    total_resolved = (
        db.query(FinancialAlert)
        .filter(FinancialAlert.status == AlertStatus.resolved)
        .count()
    )

    by_type: dict = {}
    for atype in AlertType:
        by_type[atype.value] = (
            db.query(FinancialAlert)
            .filter(
                FinancialAlert.alert_type == atype,
                FinancialAlert.status == AlertStatus.open,
            )
            .count()
        )

    return AlertSummaryResponse(
        total_open=total_open,
        high_open=high_open,
        medium_open=medium_open,
        low_open=low_open,
        total_resolved=total_resolved,
        by_type=by_type,
    )


# ── GET /alerts ───────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=AlertDetailListResponse,
    summary="Danh sách cảnh báo tài chính",
)
def list_alerts(
    status:     Optional[str] = Query(default=None, pattern="^(open|resolved|ignored)$"),
    level:      Optional[str] = Query(default=None, pattern="^(low|medium|high)$"),
    alert_type: Optional[str] = Query(default=None,
                                      description="over_budget | high_variance | unusual_increase | fast_budget_usage"),
    month:      Optional[str] = Query(default=None, description="Ví dụ: 2024-03"),
    department: Optional[str] = Query(default=None),
    page:       int           = Query(default=1,  ge=1),
    limit:      int           = Query(default=20, ge=1, le=100),
    db:         Session       = Depends(get_db),
    _:          User          = Depends(get_current_user),
):
    q = db.query(FinancialAlert)

    if status:     q = q.filter(FinancialAlert.status     == status)
    if level:      q = q.filter(FinancialAlert.alert_level == level)
    if alert_type: q = q.filter(FinancialAlert.alert_type  == alert_type)

    if month or department:
        q = q.join(FinancialTransaction, FinancialAlert.transaction_id == FinancialTransaction.id)
        if month:      q = q.filter(FinancialTransaction.month      == month)
        if department: q = q.filter(FinancialTransaction.department == department)

    total       = q.count()
    alerts_list = (
        q.order_by(FinancialAlert.created_at.desc())
         .offset((page - 1) * limit)
         .limit(limit)
         .all()
    )

    return AlertDetailListResponse(
        data=[_to_detail(a) for a in alerts_list],
        meta=PaginationMeta(total=total, page=page, limit=limit),
    )


# ── POST /alerts/run-analysis ─────────────────────────────────────────────────

@router.post(
    "/run-analysis",
    summary="Chạy phân tích cảnh báo toàn bộ dữ liệu",
)
def trigger_analysis(
    db: Session = Depends(get_db),
    _:  User    = Depends(get_current_user),
):
    """
    Kích hoạt engine phân tích toàn bộ giao dịch và tạo các cảnh báo còn thiếu.
    Cảnh báo đã tồn tại sẽ không bị tạo lại (idempotent).
    """
    counts = run_full_analysis(db)
    total  = sum(counts.values())
    return {
        "message": f"Phân tích hoàn tất. Đã tạo {total} cảnh báo mới.",
        "created": counts,
    }


# ── POST /alerts/{alert_id}/resolve ──────────────────────────────────────────

@router.post(
    "/{alert_id}/resolve",
    response_model=AlertDetailResponse,
    summary="Đánh dấu cảnh báo đã giải quyết",
)
def resolve_alert(
    alert_id:     int,
    body:         ResolveAlertRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    alert = (
        db.query(FinancialAlert)
        .filter(FinancialAlert.id == alert_id)
        .first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Không tìm thấy cảnh báo")
    if alert.status == AlertStatus.resolved:
        raise HTTPException(status_code=409, detail="Cảnh báo đã được giải quyết")

    alert.status      = AlertStatus.resolved
    alert.resolved_by = current_user.id
    alert.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    return _to_detail(alert)


# ── POST /alerts/{alert_id}/ignore ───────────────────────────────────────────

@router.post(
    "/{alert_id}/ignore",
    response_model=AlertDetailResponse,
    summary="Bỏ qua cảnh báo",
)
def ignore_alert(
    alert_id: int,
    db:       Session = Depends(get_db),
    _:        User    = Depends(get_current_user),
):
    alert = (
        db.query(FinancialAlert)
        .filter(FinancialAlert.id == alert_id)
        .first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Không tìm thấy cảnh báo")
    if alert.status != AlertStatus.open:
        raise HTTPException(
            status_code=409,
            detail=f"Cảnh báo đang ở trạng thái '{alert.status}', không thể bỏ qua",
        )

    alert.status = AlertStatus.ignored
    db.commit()
    db.refresh(alert)
    return _to_detail(alert)
