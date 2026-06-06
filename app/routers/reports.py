"""app/routers/reports.py – Report CRUD and approval workflow"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database     import get_db
from app.models       import User, Report, ReportStatus
from app.schemas      import (ReportResponse, ReportListResponse,
                               PaginationMeta, ReportActionRequest, MessageResponse)
from app.dependencies import get_current_user, require_role

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("", response_model=ReportListResponse, summary="List all reports")
def list_reports(
    status: Optional[str] = Query(default=None, pattern="^(draft|reviewed|approved)$"),
    period: Optional[str] = Query(default=None, example="2024-03"),
    page:   int           = Query(default=1,  ge=1),
    limit:  int           = Query(default=20, ge=1, le=100),
    db:     Session = Depends(get_db),
    _:      User    = Depends(get_current_user),
):
    q = db.query(Report)
    if status: q = q.filter(Report.status        == status)
    if period: q = q.filter(Report.report_period == period)

    total   = q.count()
    reports = q.order_by(Report.created_at.desc())\
                .offset((page - 1) * limit).limit(limit).all()

    return ReportListResponse(
        data=[ReportResponse.model_validate(r) for r in reports],
        meta=PaginationMeta(total=total, page=page, limit=limit),
    )


@router.get("/{report_id}", response_model=ReportResponse,
            summary="Get a report by ID")
def get_report(
    report_id: int,
    db:        Session = Depends(get_db),
    _:         User    = Depends(get_current_user),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return ReportResponse.model_validate(report)


@router.post("/{report_id}/approve", response_model=ReportResponse,
             summary="Approve a report (leader / admin only)")
def approve_report(
    report_id:    int,
    body:         ReportActionRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(require_role("admin", "leader")),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status == ReportStatus.approved:
        raise HTTPException(status_code=409, detail="Report already approved")

    report.status      = ReportStatus.approved
    report.approved_by = current_user.id
    report.approved_at = datetime.now(timezone.utc)
    db.commit(); db.refresh(report)
    return ReportResponse.model_validate(report)


@router.post("/{report_id}/reject", response_model=MessageResponse,
             summary="Reject / revert a report to draft (manager / admin)")
def reject_report(
    report_id:    int,
    body:         ReportActionRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(require_role("admin", "finance_manager", "leader")),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    report.status      = ReportStatus.draft
    report.approved_by = None
    report.approved_at = None
    db.commit()
    return MessageResponse(message=f"Report {report_id} rejected and reverted to draft")
