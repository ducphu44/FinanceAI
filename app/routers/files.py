"""app/routers/files.py – Full file upload with validation, import & alerting"""

from __future__ import annotations

import io, os, shutil
from datetime import datetime, timezone
from typing import Any

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database    import get_db
from app.models      import (User, UploadedFile, FinancialTransaction,
                              FinancialAlert, FileStatus,
                              TransactionType, TransactionStatus,
                              AlertType, AlertLevel, AlertStatus)
from app.schemas     import FileResponse, FileListResponse, PaginationMeta
from app.dependencies import get_current_user

router = APIRouter(prefix="/files", tags=["Files"])

UPLOAD_DIR   = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
ALLOWED_EXTS = {".csv", ".xlsx", ".xls"}
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── Required columns (transaction_id is optional – auto-generated if absent) ─
REQUIRED_COLS = {
    "date", "month", "department", "category",
    "transaction_type", "budget_amount", "actual_amount", "description",
}


# ── Response schemas ──────────────────────────────────────────────────────────
class PreviewRow(BaseModel):
    transaction_id:  str
    date:            str
    month:           str
    department:      str
    category:        str
    transaction_type: str
    budget_amount:   float
    actual_amount:   float
    variance_amount: float
    variance_percent: float
    row_status:      str   # normal | over_budget | unusual

class UploadDetailResponse(BaseModel):
    file_id:        int
    file_name:      str
    total_rows:     int
    valid_rows:     int
    skipped_rows:   int
    number_of_alerts: int
    preview_rows:   list[PreviewRow]
    message:        str


# ── Helper: read dataframe ────────────────────────────────────────────────────
def _read_df(path: str, ext: str) -> pd.DataFrame:
    if ext == ".csv":
        return pd.read_csv(path)
    return pd.read_excel(path)


# ── Helper: classify row ──────────────────────────────────────────────────────
def _classify(variance_pct: float, actual: float, budget: float) -> str:
    if actual > budget:
        if abs(variance_pct) > 20:
            return "unusual"
        return "over_budget"
    return "normal"


# ─────────────────────────────────────────────────────────────────────────────
# POST /files/upload
# ─────────────────────────────────────────────────────────────────────────────
@router.post(
    "/upload",
    response_model=UploadDetailResponse,
    status_code=201,
    summary="Upload and import CSV/Excel financial data",
)
async def upload_file(
    file:         UploadFile = File(...),
    db:           Session    = Depends(get_db),
    current_user: User       = Depends(get_current_user),
):
    # ── 1. Validate extension ─────────────────────────────────────────────────
    fname = file.filename or "unnamed"
    ext   = os.path.splitext(fname)[1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(
            status_code=400,
            detail={
                "error":   "unsupported_file_type",
                "message": f"File type '{ext}' is not supported. Allowed: .csv, .xlsx, .xls",
                "allowed": list(ALLOWED_EXTS),
            },
        )

    # ── 2. Save to disk ───────────────────────────────────────────────────────
    ts        = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    save_path = os.path.join(UPLOAD_DIR, f"{ts}_{fname}")
    raw_bytes = await file.read()
    with open(save_path, "wb") as fp:
        fp.write(raw_bytes)

    # ── 3. Read DataFrame ─────────────────────────────────────────────────────
    try:
        df = _read_df(save_path, ext)
    except Exception as exc:
        _save_failed_record(db, fname, ext, current_user.id, str(exc))
        raise HTTPException(
            status_code=422,
            detail={"error": "parse_error", "message": f"Cannot read file: {exc}"},
        )

    # Normalize column names
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    # ── 4. Check required columns ─────────────────────────────────────────────
    missing = REQUIRED_COLS - set(df.columns)
    if missing:
        _save_failed_record(
            db, fname, ext, current_user.id,
            f"Missing columns: {sorted(missing)}"
        )
        raise HTTPException(
            status_code=422,
            detail={
                "error":           "missing_columns",
                "message":         "File is missing required columns.",
                "missing_columns": sorted(missing),
                "required_columns": sorted(REQUIRED_COLS),
                "found_columns":   sorted(df.columns.tolist()),
            },
        )

    # ── 5. Create uploaded_files record (processing) ──────────────────────────
    file_record = UploadedFile(
        file_name   = fname,
        file_type   = ext.lstrip("."),
        uploaded_by = current_user.id,
        uploaded_at = datetime.now(timezone.utc),
        total_rows  = len(df),
        status      = FileStatus.processing,
    )
    db.add(file_record); db.commit(); db.refresh(file_record)

    # ── 6. Process each row ───────────────────────────────────────────────────
    valid_rows   = 0
    skipped_rows = 0
    alert_count  = 0
    preview_data: list[PreviewRow] = []

    for idx, row in df.iterrows():
        try:
            # Normalize date
            raw_date = str(row.get("date", "")).strip()
            try:
                parsed_date = pd.to_datetime(raw_date).date()
            except Exception:
                parsed_date = None

            # Normalize month (YYYY-MM)
            raw_month = str(row.get("month", "")).strip()
            if len(raw_month) >= 7:
                month_str = raw_month[:7]
            elif parsed_date:
                month_str = parsed_date.strftime("%Y-%m")
            else:
                month_str = None

            # Normalize amounts
            try:
                budget = float(str(row["budget_amount"]).replace(",", "").strip())
                actual = float(str(row["actual_amount"]).replace(",", "").strip())
            except (ValueError, TypeError):
                skipped_rows += 1
                continue

            # Calculate variance
            variance_amt = round(actual - budget, 2)
            variance_pct = round((variance_amt / budget * 100) if budget != 0 else 0.0, 2)

            # Row status
            row_status = _classify(variance_pct, actual, budget)

            # Transaction ID
            txn_id = str(row.get("transaction_id", "")).strip()
            if not txn_id:
                txn_id = f"TXN-{file_record.id:04d}-{idx+1:04d}"

            # Transaction type
            tx_type_raw = str(row.get("transaction_type", "expense")).strip().lower()
            tx_type = TransactionType.expense if tx_type_raw == "expense" else TransactionType.revenue

            # Skip duplicates
            existing = db.query(FinancialTransaction)\
                         .filter(FinancialTransaction.transaction_id == txn_id).first()
            if existing:
                skipped_rows += 1
                continue

            # Save transaction
            txn = FinancialTransaction(
                upload_file_id   = file_record.id,
                transaction_id   = txn_id,
                date             = parsed_date,
                month            = month_str,
                department       = str(row.get("department", "")).strip(),
                category         = str(row.get("category",   "")).strip(),
                transaction_type = tx_type,
                budget_amount    = budget,
                actual_amount    = actual,
                variance_amount  = variance_amt,
                variance_percent = variance_pct,
                description      = str(row.get("description", "")).strip(),
                status           = TransactionStatus.active,
                created_at       = datetime.now(timezone.utc),
            )
            db.add(txn); db.flush()

            # Create alert if needed
            if row_status in ("over_budget", "unusual"):
                from app.services.alert_service import compute_alert_level
                a_type  = AlertType.over_budget if row_status == "over_budget" else AlertType.high_variance
                a_level = compute_alert_level(abs(variance_pct))
                alert   = FinancialAlert(
                    transaction_id = txn.id,
                    alert_type     = a_type,
                    alert_level    = a_level,
                    message        = (
                        f"[{txn_id}] {row.get('department','')} – {row.get('category','')}: "
                        f"thực tế={actual:,.0f} vs ngân sách={budget:,.0f} ({variance_pct:+.1f}%)"
                    ),
                    status         = AlertStatus.open,
                    created_at     = datetime.now(timezone.utc),
                )
                db.add(alert)
                alert_count += 1

            valid_rows += 1

            # Collect preview (first 10 rows)
            if len(preview_data) < 10:
                preview_data.append(PreviewRow(
                    transaction_id   = txn_id,
                    date             = str(parsed_date) if parsed_date else raw_date,
                    month            = month_str or "",
                    department       = str(row.get("department", "")),
                    category         = str(row.get("category",   "")),
                    transaction_type = tx_type_raw,
                    budget_amount    = budget,
                    actual_amount    = actual,
                    variance_amount  = variance_amt,
                    variance_percent = variance_pct,
                    row_status       = row_status,
                ))

        except Exception:
            skipped_rows += 1
            continue

    # ── 7. Finalize file record ───────────────────────────────────────────────
    file_record.total_rows  = valid_rows + skipped_rows
    file_record.status      = FileStatus.success
    db.commit()

    dup_note = " (Duplicate transaction IDs were skipped)" if skipped_rows > 0 else ""
    return UploadDetailResponse(
        file_id          = file_record.id,
        file_name        = fname,
        total_rows       = valid_rows + skipped_rows,
        valid_rows       = valid_rows,
        skipped_rows     = skipped_rows,
        number_of_alerts = alert_count,
        preview_rows     = preview_data,
        message          = (
            f"Successfully imported {valid_rows} rows. "
            f"{skipped_rows} rows skipped{dup_note}. "
            f"{alert_count} alerts created."
        ),
    )


# ── GET /files ────────────────────────────────────────────────────────────────
@router.get("", response_model=FileListResponse, summary="List uploaded files")
def list_files(
    page:  int     = Query(default=1,  ge=1),
    limit: int     = Query(default=20, ge=1, le=100),
    db:    Session = Depends(get_db),
    _:     User    = Depends(get_current_user),
):
    total   = db.query(UploadedFile).count()
    records = (db.query(UploadedFile)
               .order_by(UploadedFile.uploaded_at.desc())
               .offset((page - 1) * limit).limit(limit).all())
    return FileListResponse(
        data=[FileResponse.model_validate(r) for r in records],
        meta=PaginationMeta(total=total, page=page, limit=limit),
    )


# ── GET /files/{file_id} ──────────────────────────────────────────────────────
@router.get("/{file_id}", response_model=FileResponse, summary="Get file detail by ID")
def get_file(
    file_id: int,
    db:      Session = Depends(get_db),
    _:       User    = Depends(get_current_user),
):
    record = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse.model_validate(record)


# ── Internal helper ───────────────────────────────────────────────────────────
def _save_failed_record(db: Session, fname: str, ext: str,
                         user_id: int, error: str) -> UploadedFile:
    rec = UploadedFile(
        file_name     = fname,
        file_type     = ext.lstrip("."),
        uploaded_by   = user_id,
        uploaded_at   = datetime.now(timezone.utc),
        status        = FileStatus.failed,
        error_message = error,
    )
    db.add(rec); db.commit()
    return rec
