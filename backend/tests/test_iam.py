"""Current IAM coverage for auth, serialization, and role helpers."""

from __future__ import annotations

import pytest

from crags.modules.iam.models import UserRole
from crags.modules.iam.service import (
    authenticate_user,
    find_user_by_identifier,
    is_admin_role,
    is_super_admin,
    role_from_external,
    role_to_external,
    serialize_group,
    serialize_user,
)

pytestmark = pytest.mark.unit


class TestUserAuthentication:
    def test_authenticate_user_with_username(self, db_session, member_user):
        user = authenticate_user(db_session, "member", "member12345")
        assert user is not None
        assert user.id == member_user.id
        assert user.last_login is not None

    def test_authenticate_user_with_email(self, db_session, member_user):
        user = authenticate_user(db_session, "member@test.local", "member12345")
        assert user is not None
        assert user.username == "member"

    def test_authenticate_user_rejects_invalid_password(self, db_session, member_user):
        assert authenticate_user(db_session, "member", "wrong-password") is None

    def test_authenticate_user_rejects_inactive_user(self, db_session, inactive_user):
        assert authenticate_user(db_session, "inactive", "inactive12345") is None


class TestUserLookup:
    def test_find_user_by_identifier_uses_username(self, db_session, member_user):
        found = find_user_by_identifier(db_session, "member")
        assert found is not None
        assert found.email == "member@test.local"

    def test_find_user_by_identifier_rejects_blank_values(self, db_session):
        assert find_user_by_identifier(db_session, "   ") is None


class TestSerialization:
    def test_serialize_user_exposes_group_and_external_role(self, admin_user):
        payload = serialize_user(admin_user)
        assert payload["username"] == "admin"
        assert payload["group_name"] == "research-lab"
        assert payload["role"] == "RESOURCE_ADMIN"

    def test_serialize_group_uses_public_group_name(self, test_group):
        payload = serialize_group(test_group)
        assert payload["group_name"] == "research-lab"
        assert payload["concurrent_gpu_quota"] == 32


class TestRoleHelpers:
    def test_role_conversion_round_trip(self):
        assert role_from_external("resource_admin") == UserRole.ADMIN
        assert role_to_external(UserRole.ADMIN) == "RESOURCE_ADMIN"
        assert role_to_external(UserRole.MEMBER) == "MEMBER"

    def test_admin_and_super_admin_guards(self):
        assert is_admin_role(UserRole.ADMIN) is True
        assert is_admin_role(UserRole.SUPER_ADMIN) is True
        assert is_admin_role(UserRole.MEMBER) is False
        assert is_super_admin(UserRole.SUPER_ADMIN) is True
        assert is_super_admin(UserRole.GROUP_LEAD) is False
