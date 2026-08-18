"""Unit test cho app/auth_utils.py – hash/verify mật khẩu và JWT token."""

from datetime import datetime, timedelta, timezone

from jose import jwt

from app.auth_utils import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)


class TestPasswordHashing:
    def test_hash_and_verify_roundtrip(self):
        hashed = hash_password("matkhau123")
        assert hashed != "matkhau123"
        assert verify_password("matkhau123", hashed) is True

    def test_verify_wrong_password_fails(self):
        hashed = hash_password("matkhau123")
        assert verify_password("saimatkhau", hashed) is False

    def test_hash_is_salted(self):
        # Hai lần hash cùng một mật khẩu phải cho kết quả khác nhau (salt ngẫu nhiên)
        assert hash_password("matkhau123") != hash_password("matkhau123")

    def test_hash_format_is_bcrypt(self):
        assert hash_password("abc123").startswith("$2b$")

    def test_verify_with_invalid_hash_returns_false(self):
        assert verify_password("matkhau123", "khong-phai-bcrypt-hash") is False

    def test_verify_with_empty_hash_returns_false(self):
        assert verify_password("matkhau123", "") is False

    def test_unicode_password(self):
        hashed = hash_password("mật khẩu tiếng Việt ✓")
        assert verify_password("mật khẩu tiếng Việt ✓", hashed) is True
        assert verify_password("mật khẩu tiếng việt ✓", hashed) is False


class TestJWTToken:
    def test_create_and_decode_roundtrip(self):
        token = create_access_token({"sub": "42", "role": "admin"})
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "42"
        assert payload["role"] == "admin"
        assert "exp" in payload

    def test_expiry_is_in_the_future(self):
        token = create_access_token({"sub": "1"}, expires_hours=24)
        payload = decode_token(token)
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        now = datetime.now(timezone.utc)
        assert now + timedelta(hours=23) < exp <= now + timedelta(hours=25)

    def test_expired_token_returns_none(self):
        token = create_access_token({"sub": "1"}, expires_hours=-1)
        assert decode_token(token) is None

    def test_tampered_token_returns_none(self):
        token = create_access_token({"sub": "1"})
        assert decode_token(token + "xyz") is None

    def test_garbage_token_returns_none(self):
        assert decode_token("khong.phai.jwt") is None

    def test_token_signed_with_other_key_returns_none(self):
        forged = jwt.encode(
            {"sub": "1", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            "khoa-gia-mao",
            algorithm=ALGORITHM,
        )
        assert decode_token(forged) is None

    def test_original_data_dict_not_mutated(self):
        data = {"sub": "1"}
        create_access_token(data)
        assert data == {"sub": "1"}  # hàm phải copy, không thêm "exp" vào dict gốc

    def test_token_verifiable_with_secret_key(self):
        token = create_access_token({"sub": "7"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "7"
