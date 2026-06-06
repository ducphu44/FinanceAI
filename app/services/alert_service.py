"""
app/services/alert_service.py
------------------------------
Engine phân tích chênh lệch ngân sách và tạo cảnh báo bất thường.

Các rule được áp dụng:
  1. over_budget      – actual_amount > budget_amount (expense)
  2. high_variance    – abs(variance_percent) > 20%
  3. unusual_increase – chi phí (dept, cat) tháng này tăng > 20% so với tháng trước
  4. fast_budget_usage – tổng actual/tổng budget của dept trong tháng > 80%
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    AlertLevel, AlertStatus, AlertType,
    FinancialAlert, FinancialTransaction, TransactionType,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def compute_alert_level(variance_pct: float) -> AlertLevel:
    """
    Tính alert_level dựa theo chênh lệch % so với ngưỡng kích hoạt rule.
      0-10%  → low
      10-20% → medium
      >20%   → high
    """
    abs_pct = abs(variance_pct)
    if abs_pct <= 10:
        return AlertLevel.low
    elif abs_pct <= 20:
        return AlertLevel.medium
    return AlertLevel.high


def _alert_exists(db: Session, txn_id: int, alert_type: AlertType) -> bool:
    """Kiểm tra xem cảnh báo cùng (transaction, type) đã tồn tại chưa."""
    return (
        db.query(FinancialAlert)
        .filter(
            FinancialAlert.transaction_id == txn_id,
            FinancialAlert.alert_type == alert_type,
        )
        .first()
        is not None
    )


def _make_alert(
    txn_id: int,
    alert_type: AlertType,
    level: AlertLevel,
    message: str,
) -> FinancialAlert:
    """Tạo đối tượng FinancialAlert mới (chưa add vào session)."""
    return FinancialAlert(
        transaction_id=txn_id,
        alert_type=alert_type,
        alert_level=level,
        message=message,
        status=AlertStatus.open,
        created_at=datetime.now(timezone.utc),
    )


def _prev_month(month: str) -> str:
    """Trả về tháng trước (format YYYY-MM). Ví dụ: '2024-03' → '2024-02'."""
    year, mon = int(month[:4]), int(month[5:7])
    if mon == 1:
        return f"{year - 1:04d}-12"
    return f"{year:04d}-{mon - 1:02d}"


# ── Rule 1 & 2: Per-transaction rules ────────────────────────────────────────

def analyze_transaction(db: Session, txn: FinancialTransaction) -> int:
    """
    Áp dụng rule per-transaction cho một giao dịch:
      - Rule 1: over_budget
      - Rule 2: high_variance
    Trả về số cảnh báo mới được tạo.
    """
    if txn.transaction_type != TransactionType.expense:
        return 0

    created = 0

    # Rule 1: over_budget – actual > budget
    if txn.actual_amount > txn.budget_amount:
        if not _alert_exists(db, txn.id, AlertType.over_budget):
            level = compute_alert_level(txn.variance_percent)
            msg = (
                f"[{txn.transaction_id}] {txn.department} – {txn.category}: "
                f"thực tế {txn.actual_amount:,.0f} vượt ngân sách {txn.budget_amount:,.0f} "
                f"({txn.variance_percent:+.1f}%)"
            )
            db.add(_make_alert(txn.id, AlertType.over_budget, level, msg))
            created += 1

    # Rule 2: high_variance – |variance_percent| > 20
    if abs(txn.variance_percent) > 20:
        if not _alert_exists(db, txn.id, AlertType.high_variance):
            level = compute_alert_level(abs(txn.variance_percent))
            msg = (
                f"[{txn.transaction_id}] {txn.department} – {txn.category}: "
                f"biến động lớn {txn.variance_percent:+.1f}% so với ngân sách"
            )
            db.add(_make_alert(txn.id, AlertType.high_variance, level, msg))
            created += 1

    return created


# ── Full analysis ─────────────────────────────────────────────────────────────

def run_full_analysis(db: Session) -> dict[str, int]:
    """
    Quét toàn bộ dữ liệu giao dịch và tạo các cảnh báo còn thiếu.
    Trả về dict với số cảnh báo mới tạo theo từng loại.
    """
    counts: dict[str, int] = {
        "over_budget": 0,
        "high_variance": 0,
        "unusual_increase": 0,
        "fast_budget_usage": 0,
    }

    # ── Rules 1 & 2: per-transaction ─────────────────────────────────────────
    expenses = (
        db.query(FinancialTransaction)
        .filter(FinancialTransaction.transaction_type == TransactionType.expense)
        .all()
    )

    for txn in expenses:
        # Rule 1
        if txn.actual_amount > txn.budget_amount:
            if not _alert_exists(db, txn.id, AlertType.over_budget):
                level = compute_alert_level(txn.variance_percent)
                msg = (
                    f"[{txn.transaction_id}] {txn.department} – {txn.category}: "
                    f"thực tế {txn.actual_amount:,.0f} vượt ngân sách {txn.budget_amount:,.0f} "
                    f"({txn.variance_percent:+.1f}%)"
                )
                db.add(_make_alert(txn.id, AlertType.over_budget, level, msg))
                counts["over_budget"] += 1

        # Rule 2
        if abs(txn.variance_percent) > 20:
            if not _alert_exists(db, txn.id, AlertType.high_variance):
                level = compute_alert_level(abs(txn.variance_percent))
                msg = (
                    f"[{txn.transaction_id}] {txn.department} – {txn.category}: "
                    f"biến động lớn {txn.variance_percent:+.1f}% so với ngân sách"
                )
                db.add(_make_alert(txn.id, AlertType.high_variance, level, msg))
                counts["high_variance"] += 1

    db.flush()  # assign IDs trước khi chạy aggregate rules

    # ── Rule 3: unusual_increase – tăng > 20% so với tháng trước ─────────────
    monthly_agg = (
        db.query(
            FinancialTransaction.department,
            FinancialTransaction.category,
            FinancialTransaction.month,
            func.sum(FinancialTransaction.actual_amount).label("total_actual"),
        )
        .filter(
            FinancialTransaction.transaction_type == TransactionType.expense,
            FinancialTransaction.month.isnot(None),
        )
        .group_by(
            FinancialTransaction.department,
            FinancialTransaction.category,
            FinancialTransaction.month,
        )
        .all()
    )

    # Build lookup: (dept, cat, month) → total_actual
    agg_map: dict[tuple, float] = {
        (r.department, r.category, r.month): float(r.total_actual)
        for r in monthly_agg
    }

    for (dept, cat, month), current_total in agg_map.items():
        prev_month = _prev_month(month)
        prev_total = agg_map.get((dept, cat, prev_month))
        if prev_total is None or prev_total <= 0:
            continue

        increase_pct = (current_total - prev_total) / prev_total * 100
        if increase_pct <= 20:
            continue

        # Anchor: transaction với actual_amount lớn nhất trong (dept, cat, month)
        anchor = (
            db.query(FinancialTransaction)
            .filter(
                FinancialTransaction.department == dept,
                FinancialTransaction.category == cat,
                FinancialTransaction.month == month,
                FinancialTransaction.transaction_type == TransactionType.expense,
            )
            .order_by(FinancialTransaction.actual_amount.desc())
            .first()
        )
        if anchor and not _alert_exists(db, anchor.id, AlertType.unusual_increase):
            # Chênh lệch so với ngưỡng 20%
            level = compute_alert_level(increase_pct - 20)
            msg = (
                f"{dept} – {cat} tháng {month}: chi phí tăng {increase_pct:.1f}% "
                f"so với tháng trước ({prev_total:,.0f} → {current_total:,.0f})"
            )
            db.add(_make_alert(anchor.id, AlertType.unusual_increase, level, msg))
            counts["unusual_increase"] += 1

    db.flush()

    # ── Rule 4: fast_budget_usage – dept sử dụng > 80% ngân sách trong tháng ─
    dept_month_agg = (
        db.query(
            FinancialTransaction.department,
            FinancialTransaction.month,
            func.sum(FinancialTransaction.actual_amount).label("total_actual"),
            func.sum(FinancialTransaction.budget_amount).label("total_budget"),
        )
        .filter(
            FinancialTransaction.transaction_type == TransactionType.expense,
            FinancialTransaction.month.isnot(None),
        )
        .group_by(FinancialTransaction.department, FinancialTransaction.month)
        .all()
    )

    for row in dept_month_agg:
        if not row.total_budget or float(row.total_budget) <= 0:
            continue
        usage_pct = float(row.total_actual) / float(row.total_budget) * 100
        if usage_pct <= 80:
            continue

        # Anchor: transaction với actual_amount lớn nhất trong dept/month
        anchor = (
            db.query(FinancialTransaction)
            .filter(
                FinancialTransaction.department == row.department,
                FinancialTransaction.month == row.month,
                FinancialTransaction.transaction_type == TransactionType.expense,
            )
            .order_by(FinancialTransaction.actual_amount.desc())
            .first()
        )
        if anchor and not _alert_exists(db, anchor.id, AlertType.fast_budget_usage):
            # Chênh lệch so với ngưỡng 80%
            level = compute_alert_level(usage_pct - 80)
            msg = (
                f"{row.department} tháng {row.month}: đã sử dụng {usage_pct:.1f}% ngân sách "
                f"({row.total_actual:,.0f} / {row.total_budget:,.0f})"
            )
            db.add(_make_alert(anchor.id, AlertType.fast_budget_usage, level, msg))
            counts["fast_budget_usage"] += 1

    db.commit()
    return counts
