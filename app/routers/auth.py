"""app/routers/auth.py – Authentication endpoints"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database    import get_db
from app.models      import User
from app.schemas     import LoginRequest, TokenResponse, UserMe, UserResponse
from app.auth_utils  import verify_password, create_access_token, hash_password
from app.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])

# Hash giả cố định dùng khi email không tồn tại, để verify_password vẫn chạy
# bcrypt và giữ thời gian phản hồi tương đương trường hợp sai mật khẩu
# (chống dò email tồn tại qua timing side-channel).
_DUMMY_PASSWORD_HASH = hash_password("dummy-password-for-timing-safety")


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login – get JWT access token",
)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    password_hash = user.password_hash if user else _DUMMY_PASSWORD_HASH
    password_ok = verify_password(body.password, password_hash)
    # Dùng chung một thông báo lỗi (và luôn chạy verify_password) để không
    # tiết lộ email có tồn tại hay không, kể cả qua thời gian phản hồi
    if not user or not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.get(
    "/me",
    response_model=UserMe,
    summary="Get current authenticated user",
)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
