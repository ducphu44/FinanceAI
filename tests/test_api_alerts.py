"""API test cho /alerts – danh sách, tổng hợp, resolve/ignore."""

import pytest

from app import models
from tests.conftest import auth_header


@pytest.fixture()
def seed_alert(db_session, seed_transactions):
    """Một cảnh báo over_budget/high đang mở, gắn với TXN-EXP-001."""
    txn = seed_transactions[1]
    alert = models.FinancialAlert(
        transaction_id=txn.id,
        alert_type="over_budget",
        alert_level="high",
        message="Chi vượt ngân sách 20%",
        status="open",
    )
    db_session.add(alert)
    db_session.commit()
    db_session.refresh(alert)
    return alert


class TestAlertSummary:
    def test_requires_auth(self, client):
        assert client.get("/alerts/summary").status_code == 401

    def test_counts(self, client, seed_users, seed_alert):
        res = client.get(
            "/alerts/summary", headers=auth_header(seed_users["finance_staff"])
        )
        assert res.status_code == 200
        body = res.json()
        assert body["total_open"] == 1
        assert body["high_open"] == 1
        assert body["medium_open"] == 0
        assert body["total_resolved"] == 0
        assert body["by_type"]["over_budget"] == 1


class TestListAlerts:
    def test_list_includes_transaction_info(self, client, seed_users, seed_alert):
        res = client.get("/alerts", headers=auth_header(seed_users["finance_staff"]))
        assert res.status_code == 200
        body = res.json()
        assert body["meta"]["total"] == 1
        alert = body["data"][0]
        assert alert["txn_ref"] == "TXN-EXP-001"
        assert alert["department"] == "Phòng Hành chính"
        assert alert["month"] == "2024-03"

    def test_filter_by_status_no_match(self, client, seed_users, seed_alert):
        res = client.get(
            "/alerts?status=resolved",
            headers=auth_header(seed_users["finance_staff"]),
        )
        assert res.json()["meta"]["total"] == 0

    def test_invalid_status_rejected(self, client, seed_users, seed_alert):
        res = client.get(
            "/alerts?status=sai-trang-thai",
            headers=auth_header(seed_users["finance_staff"]),
        )
        assert res.status_code == 422


class TestResolveAlert:
    def test_resolve(self, client, seed_users, seed_alert):
        user = seed_users["finance_manager"]
        res = client.post(
            f"/alerts/{seed_alert.id}/resolve",
            headers=auth_header(user),
            json={"note": "đã kiểm tra"},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "resolved"
        assert body["resolved_by"] == user.id
        assert body["resolved_at"] is not None

    def test_resolve_twice_conflict(self, client, seed_users, seed_alert):
        header = auth_header(seed_users["finance_manager"])
        client.post(f"/alerts/{seed_alert.id}/resolve", headers=header, json={})
        res = client.post(f"/alerts/{seed_alert.id}/resolve", headers=header, json={})
        assert res.status_code == 409

    def test_resolve_nonexistent_404(self, client, seed_users):
        res = client.post(
            "/alerts/99999/resolve",
            headers=auth_header(seed_users["finance_manager"]),
            json={},
        )
        assert res.status_code == 404


class TestIgnoreAlert:
    def test_ignore(self, client, seed_users, seed_alert):
        res = client.post(
            f"/alerts/{seed_alert.id}/ignore",
            headers=auth_header(seed_users["finance_staff"]),
        )
        assert res.status_code == 200
        assert res.json()["status"] == "ignored"

    def test_ignore_non_open_conflict(self, client, seed_users, seed_alert):
        header = auth_header(seed_users["finance_staff"])
        client.post(f"/alerts/{seed_alert.id}/ignore", headers=header)
        res = client.post(f"/alerts/{seed_alert.id}/ignore", headers=header)
        assert res.status_code == 409
