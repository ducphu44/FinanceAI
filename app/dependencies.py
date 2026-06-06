"""
app/dependencies.py
-------------------
FastAPI dependencies dùng chung (get_current_user, require_role, ...).
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database  import get_db
from app.models    import User
from app.auth_utils import decode_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Validate JWT and return the current User object."""
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials:
        raise exc

    payload = decode_token(credentials.credentials)
    if not payload:
        raise exc

    user_id: int | None = payload.get("sub")
    if user_id is None:
        raise exc

    user = db.query(User).filter(User.id == int(user_id), User.is_active == True).first()
    if not user:
        raise exc
    return user


def require_role(*roles: str):
    """Factory: returns a dependency that checks the current user's role."""
    def _checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {list(roles)}",
            )
        return current_user
    return _checker
