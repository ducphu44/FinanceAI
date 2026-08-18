"""API test cho /users – CRUD và phân quyền theo role."""

from tests.conftest import auth_header


class TestListUsers:
    def test_admin_can_list(self, client, seed_users):
        res = client.get("/users", headers=auth_header(seed_users["admin"]))
        assert res.status_code == 200
        body = res.json()
        assert body["meta"]["total"] == 4
        assert len(body["data"]) == 4

    def test_manager_can_list(self, client, seed_users):
        res = client.get("/users", headers=auth_header(seed_users["finance_manager"]))
        assert res.status_code == 200

    def test_staff_forbidden(self, client, seed_users):
        res = client.get("/users", headers=auth_header(seed_users["finance_staff"]))
        assert res.status_code == 403

    def test_unauthenticated(self, client, seed_users):
        assert client.get("/users").status_code == 401

    def test_pagination(self, client, seed_users):
        res = client.get(
            "/users?page=1&limit=2", headers=auth_header(seed_users["admin"])
        )
        body = res.json()
        assert body["meta"]["total"] == 4
        assert len(body["data"]) == 2


class TestCreateUser:
    def test_admin_creates_user(self, client, seed_users):
        res = client.post(
            "/users",
            headers=auth_header(seed_users["admin"]),
            json={
                "full_name": "Người Mới",
                "email": "moi@test.com",
                "password": "matkhau123",
                "role": "leader",
            },
        )
        assert res.status_code == 201
        body = res.json()
        assert body["email"] == "moi@test.com"
        assert body["role"] == "leader"
        assert body["is_active"] is True
        assert "password" not in body and "password_hash" not in body

    def test_password_is_hashed_in_db(self, client, seed_users, db_session):
        from app.auth_utils import verify_password
        from app.models import User

        client.post(
            "/users",
            headers=auth_header(seed_users["admin"]),
            json={
                "full_name": "Người Mới",
                "email": "moi2@test.com",
                "password": "matkhau123",
            },
        )
        user = db_session.query(User).filter(User.email == "moi2@test.com").one()
        assert user.password_hash != "matkhau123"
        assert verify_password("matkhau123", user.password_hash)

    def test_duplicate_email_conflict(self, client, seed_users):
        res = client.post(
            "/users",
            headers=auth_header(seed_users["admin"]),
            json={
                "full_name": "Trùng Email",
                "email": "staff@test.com",
                "password": "matkhau123",
            },
        )
        assert res.status_code == 409

    def test_invalid_role_rejected(self, client, seed_users):
        res = client.post(
            "/users",
            headers=auth_header(seed_users["admin"]),
            json={
                "full_name": "Sai Role",
                "email": "sairole@test.com",
                "password": "matkhau123",
                "role": "hacker",
            },
        )
        assert res.status_code == 422

    def test_non_admin_forbidden(self, client, seed_users):
        res = client.post(
            "/users",
            headers=auth_header(seed_users["finance_manager"]),
            json={
                "full_name": "Không Được",
                "email": "khongduoc@test.com",
                "password": "matkhau123",
            },
        )
        assert res.status_code == 403


class TestUpdateUser:
    def test_admin_updates_role(self, client, seed_users):
        staff = seed_users["finance_staff"]
        res = client.put(
            f"/users/{staff.id}",
            headers=auth_header(seed_users["admin"]),
            json={"role": "finance_manager", "full_name": "Tên Mới"},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["role"] == "finance_manager"
        assert body["full_name"] == "Tên Mới"

    def test_update_nonexistent_user_404(self, client, seed_users):
        res = client.put(
            "/users/99999",
            headers=auth_header(seed_users["admin"]),
            json={"full_name": "Ma"},
        )
        assert res.status_code == 404


class TestDeleteUser:
    def test_soft_delete_deactivates(self, client, seed_users, db_session):
        staff = seed_users["finance_staff"]
        res = client.delete(
            f"/users/{staff.id}", headers=auth_header(seed_users["admin"])
        )
        assert res.status_code == 200
        db_session.refresh(staff)
        assert staff.is_active is False

    def test_deactivated_user_token_rejected(self, client, seed_users, db_session):
        staff = seed_users["finance_staff"]
        header = auth_header(staff)
        client.delete(f"/users/{staff.id}", headers=auth_header(seed_users["admin"]))
        # Token cũ của user đã bị vô hiệu hóa không dùng được nữa
        assert client.get("/auth/me", headers=header).status_code == 401

    def test_delete_nonexistent_user_404(self, client, seed_users):
        res = client.delete("/users/99999", headers=auth_header(seed_users["admin"]))
        assert res.status_code == 404
