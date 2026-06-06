"""app/routers/users.py – User management endpoints"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database     import get_db
from app.models       import User
from app.schemas      import (UserCreate, UserUpdate, UserResponse,
                               UserListResponse, PaginationMeta, MessageResponse)
from app.auth_utils   import hash_password
from app.dependencies import get_current_user, require_role

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=UserListResponse, summary="List all users")
def list_users(
    page:  int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    db:    Session = Depends(get_db),
    _:     User    = Depends(require_role("admin", "finance_manager", "leader")),
):
    total = db.query(User).count()
    users = db.query(User).offset((page - 1) * limit).limit(limit).all()
    return UserListResponse(
        data=[UserResponse.model_validate(u) for u in users],
        meta=PaginationMeta(total=total, page=page, limit=limit),
    )


@router.post("", response_model=UserResponse, status_code=201,
             summary="Create a new user")
def create_user(
    body: UserCreate,
    db:   Session = Depends(get_db),
    _:    User    = Depends(require_role("admin")),
):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        full_name     = body.full_name,
        email         = body.email,
        password_hash = hash_password(body.password),
        role          = body.role,
        is_active     = True,
        created_at    = datetime.now(timezone.utc),
    )
    db.add(user); db.commit(); db.refresh(user)
    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse,
            summary="Update user info or role")
def update_user(
    user_id: int,
    body:    UserUpdate,
    db:      Session = Depends(get_db),
    _:       User    = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.full_name is not None: user.full_name = body.full_name
    if body.role      is not None: user.role      = body.role
    if body.is_active is not None: user.is_active = body.is_active

    db.commit(); db.refresh(user)
    return UserResponse.model_validate(user)


@router.delete("/{user_id}", response_model=MessageResponse,
               summary="Deactivate (soft-delete) a user")
def delete_user(
    user_id: int,
    db:      Session = Depends(get_db),
    _:       User    = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    db.commit()
    return MessageResponse(message=f"User {user_id} deactivated")
