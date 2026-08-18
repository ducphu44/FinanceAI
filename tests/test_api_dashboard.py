"""API test cho /dashboard – KPI summary, trend, chi phí theo phòng ban."""

from tests.conftest import auth_header


class TestDashboardAuth:
    def test_summary_requires_auth(self, client):
        assert client.get("/dashboard/summary").status_code == 401


class TestSummary:
    def test_kpi_numbers(self, client, seed_users, seed_transactions):
        res = client.get(
            "/dashboard/summary", headers=auth_header(seed_users["finance_staff"])
        )
        assert res.status_code == 200
        body = res.json()
        # revenue 1000; expense 600 + 300 = 900; budget expense 500 + 400 = 900
        assert body["total_revenue"] == 1000.0
        assert body["total_expense"] == 900.0
        assert body["total_budget"] == 900.0
        assert body["budget_used"] == 900.0
        assert body["budget_remaining"] == 0.0
        assert body["budget_usage_percent"] == 100.0
        assert body["number_of_alerts"] == 0
        assert body["top_spending_department"] == "Phòng Hành chính"
        # LƯU Ý hành vi hiện tại (xem mô tả PR): query top_over_budget_category
        # không lọc transaction_type nên giao dịch revenue (1000 > budget 0)
        # cũng bị tính là "vượt ngân sách". Cả hai category đều có count = 1.
        assert body["top_over_budget_category"] in {"Học phí", "Văn phòng phẩm"}

    def test_summary_empty_db(self, client, seed_users):
        res = client.get(
            "/dashboard/summary", headers=auth_header(seed_users["finance_staff"])
        )
        assert res.status_code == 200
        body = res.json()
        assert body["total_revenue"] == 0.0
        assert body["budget_usage_percent"] == 0.0
        assert body["top_spending_department"] is None

    def test_summary_filter_by_month(self, client, seed_users, seed_transactions):
        res = client.get(
            "/dashboard/summary?month=2024-04",
            headers=auth_header(seed_users["finance_staff"]),
        )
        body = res.json()
        assert body["total_revenue"] == 0.0
        assert body["total_expense"] == 300.0

    def test_summary_filter_by_department(self, client, seed_users, seed_transactions):
        res = client.get(
            "/dashboard/summary?department=Phòng CNTT",
            headers=auth_header(seed_users["finance_staff"]),
        )
        body = res.json()
        assert body["total_expense"] == 300.0
        assert body["top_spending_department"] == "Phòng CNTT"


class TestMonthlyTrend:
    def test_grouped_by_month(self, client, seed_users, seed_transactions):
        res = client.get(
            "/dashboard/monthly-trend",
            headers=auth_header(seed_users["finance_staff"]),
        )
        assert res.status_code == 200
        rows = res.json()
        assert [r["month"] for r in rows] == ["2024-03", "2024-04"]
        march = rows[0]
        assert march["revenue"] == 1000.0
        assert march["expense"] == 600.0


class TestDepartmentExpense:
    def test_expense_by_department(self, client, seed_users, seed_transactions):
        res = client.get(
            "/dashboard/department-expense",
            headers=auth_header(seed_users["finance_staff"]),
        )
        assert res.status_code == 200
        rows = res.json()
        # Sắp theo chi phí giảm dần; revenue không được tính vào
        assert rows[0] == {"department": "Phòng Hành chính", "expense": 600.0}
        assert rows[1] == {"department": "Phòng CNTT", "expense": 300.0}


class TestOverBudget:
    def test_only_over_budget_transactions(self, client, seed_users, seed_transactions):
        res = client.get(
            "/dashboard/over-budget",
            headers=auth_header(seed_users["finance_staff"]),
        )
        assert res.status_code == 200
        rows = res.json()
        # Chỉ TXN-EXP-001 (600 > 500) và TXN-REV-001 (1000 > 0) là actual > budget
        ids = {r["transaction_id"] for r in rows}
        assert "TXN-EXP-001" in ids
        assert "TXN-EXP-002" not in ids
        exp = next(r for r in rows if r["transaction_id"] == "TXN-EXP-001")
        assert exp["variance_percent"] == 20.0
        assert exp["status"] == "over_budget"  # |20| không > 20 nên không "unusual"
