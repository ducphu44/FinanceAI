"""API test cho health check và /auth (login, me) qua FastAPI TestClient."""

from tests.conftest import TEST_PASSWORD, auth_header


class TestHealth:
    def test_root(self, client):
        res = client.get("/")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "ok"
        assert body["service"] == "FinanceAI API"

    def test_health(self, client):
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"


class TestLogin:
    def test_login_returns_token_and_user(self, client, seed_users):
        res = client.post(
            "/auth/login",
            json={"email": "staff@test.com", "password": TEST_PASSWORD},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["token_type"] == "bearer"
        assert body["access_token"]
        assert body["user"]["email"] == "staff@test.com"
        assert body["user"]["role"] == "finance_staff"

    def test_login_token_usable_for_me(self, client, seed_users):
        token = client.post(
            "/auth/login",
            json={"email": "admin@test.com", "password": TEST_PASSWORD},
        ).json()["access_token"]

        res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        assert res.json()["email"] == "admin@test.com"

    def test_login_inactive_user_forbidden(self, client, seed_users):
        res = client.post(
            "/auth/login",
            json={"email": "inactive@test.com", "password": TEST_PASSWORD},
        )
        assert res.status_code == 403

    def test_login_unknown_email_falls_back_to_admin(self, client, seed_users):
        # LƯU Ý: đây là hành vi HIỆN TẠI của app (bug bảo mật – xem mô tả PR):
        # email không tồn tại sẽ tự động đăng nhập bằng tài khoản admin đầu tiên.
        res = client.post(
            "/auth/login",
            json={"email": "khongtontai@test.com", "password": "buanhap"},
        )
        assert res.status_code == 200
        assert res.json()["user"]["role"] == "admin"

    def test_login_unknown_email_without_admin_returns_404(self, client):
        # DB rỗng, không có admin để fallback
        res = client.post(
            "/auth/login",
            json={"email": "khongtontai@test.com", "password": "x"},
        )
        assert res.status_code == 404

    def test_login_missing_fields_returns_422(self, client):
        res = client.post("/auth/login", json={"email": "a@b.com"})
        assert res.status_code == 422


class TestGetMe:
    def test_me_without_token_unauthorized(self, client):
        assert client.get("/auth/me").status_code == 401

    def test_me_with_invalid_token_unauthorized(self, client):
        res = client.get(
            "/auth/me", headers={"Authorization": "Bearer token.khong.hople"}
        )
        assert res.status_code == 401

    def test_me_with_token_of_nonexistent_user_unauthorized(self, client, seed_users):
        from app.auth_utils import create_access_token

        token = create_access_token({"sub": "99999", "role": "admin"})
        res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 401

    def test_me_returns_current_user(self, client, seed_users):
        res = client.get(
            "/auth/me", headers=auth_header(seed_users["finance_manager"])
        )
        assert res.status_code == 200
        body = res.json()
        assert body["email"] == "manager@test.com"
        assert body["is_active"] is True
