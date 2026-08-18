"""Unit test cho app/schemas.py – validation của các Pydantic schema chính."""

import pytest
from pydantic import ValidationError

from app.schemas import (
    AIAskRequest,
    AIGenerateReportRequest,
    LoginRequest,
    MessageResponse,
    PaginationMeta,
    ResolveAlertRequest,
    UserCreate,
    UserUpdate,
)


class TestCommonSchemas:
    def test_message_response(self):
        assert MessageResponse(message="ok").message == "ok"

    def test_pagination_meta_defaults(self):
        meta = PaginationMeta(total=100)
        assert meta.page == 1
        assert meta.limit == 50

    def test_pagination_meta_requires_total(self):
        with pytest.raises(ValidationError):
            PaginationMeta()


class TestLoginRequest:
    def test_valid(self):
        body = LoginRequest(email="a@b.com", password="secret")
        assert body.email == "a@b.com"

    def test_missing_password_fails(self):
        with pytest.raises(ValidationError):
            LoginRequest(email="a@b.com")


class TestUserCreate:
    def _valid_kwargs(self, **overrides):
        kwargs = dict(
            full_name="Nguyễn Văn A",
            email="a@example.com",
            password="password123",
        )
        kwargs.update(overrides)
        return kwargs

    def test_valid_with_default_role(self):
        user = UserCreate(**self._valid_kwargs())
        assert user.role == "finance_staff"

    @pytest.mark.parametrize(
        "role", ["admin", "finance_staff", "finance_manager", "leader"]
    )
    def test_all_valid_roles(self, role):
        assert UserCreate(**self._valid_kwargs(role=role)).role == role

    def test_invalid_role_fails(self):
        with pytest.raises(ValidationError):
            UserCreate(**self._valid_kwargs(role="superuser"))

    def test_short_password_fails(self):
        with pytest.raises(ValidationError):
            UserCreate(**self._valid_kwargs(password="12345"))  # < 6 ký tự

    def test_short_full_name_fails(self):
        with pytest.raises(ValidationError):
            UserCreate(**self._valid_kwargs(full_name="A"))  # < 2 ký tự


class TestUserUpdate:
    def test_all_fields_optional(self):
        body = UserUpdate()
        assert body.full_name is None
        assert body.role is None
        assert body.is_active is None

    def test_partial_update(self):
        body = UserUpdate(is_active=False)
        assert body.is_active is False

    def test_invalid_role_fails(self):
        with pytest.raises(ValidationError):
            UserUpdate(role="khong-ton-tai")


class TestAISchemas:
    def test_ask_request_valid(self):
        body = AIAskRequest(question="Phòng nào vượt ngân sách?")
        assert body.data_source == "financial_transactions"

    def test_ask_request_question_too_short_fails(self):
        with pytest.raises(ValidationError):
            AIAskRequest(question="hi?")  # < 5 ký tự

    def test_generate_report_default_type(self):
        body = AIGenerateReportRequest(period="2024-03")
        assert body.report_type == "monthly"
        assert body.departments is None

    @pytest.mark.parametrize("rtype", ["monthly", "quarterly", "annual", "custom"])
    def test_generate_report_valid_types(self, rtype):
        body = AIGenerateReportRequest(period="2024", report_type=rtype)
        assert body.report_type == rtype

    def test_generate_report_invalid_type_fails(self):
        with pytest.raises(ValidationError):
            AIGenerateReportRequest(period="2024", report_type="weekly")


class TestAlertSchemas:
    def test_resolve_request_note_optional(self):
        assert ResolveAlertRequest().note is None
        assert ResolveAlertRequest(note="đã xử lý").note == "đã xử lý"
