"""app/routers/auth.py – Authentication endpoints"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database    import get_db
from app.models      import User
from app.schemas     import LoginRequest, TokenResponse, UserMe, UserResponse
from app.auth_utils  import verify_password, create_access_token
from app.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login – get JWT access token",
)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    # Bỏ qua kiểm tra mật khẩu để đăng nhập nhanh
    if not user:
        # Nếu nhập bừa email, tự động lấy tài khoản admin đầu tiên
        user = db.query(User).filter(User.role == "admin").first()
        if not user:
            raise HTTPException(status_code=404, detail="No admin user found")
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
