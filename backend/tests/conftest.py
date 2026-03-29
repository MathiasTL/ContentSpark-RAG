# Fixtures para pytest: test DB, mock JWT, mock user
import pytest


@pytest.fixture
def mock_user_id():
    return "test-user-uuid-1234"


@pytest.fixture
def mock_auth_token():
    return "Bearer test-jwt-token"
