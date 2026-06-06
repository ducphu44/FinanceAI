"""
app/auth_utils.py
-----------------
JWT token creation/verification và password hashing helpers.
Dùng bcrypt trực tiếp thay vì passlib để tương thích Python 3.14+.
"""

import os, bcrypt as _bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt

SECRET_KEY         = os.getenv("SECRET_KEY", "financeai-secret-key-change-in-production-2024")
ALGORITHM          = "HS256"
TOKEN_EXPIRE_HOURS = 24


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def hash_password(plain: str) -> str:
    salt = _bcrypt.gensalt(rounds=12)
    return _bcrypt.hashpw(plain.encode("utf-8"), salt).decode("utf-8")


def create_access_token(data: dict, expires_hours: int = TOKEN_EXPIRE_HOURS) -> str:
    payload = data.copy()
    expire  = datetime.now(timezone.utc) + timedelta(hours=expires_hours)
    payload.update({"exp": expire})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
