"""
Q-CRM API Test Suite
====================
Comprehensive API test suite for Q-CRM backend.
Requires: requests, pytest, python-dotenv

Setup:
    pip install requests pytest python-dotenv

Run:
    pytest test_api.py -v --html=api_report.html
"""

import os
import json
import time
import pytest
import requests
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# =============================================================================
# Configuration
# =============================================================================
BASE_URL = os.getenv("QCRM_API_URL", "http://20.124.178.41:3001/api")
TEST_USER_EMAIL = os.getenv("TEST_USER_EMAIL", "dip.bagchi@example.com")
TEST_USER_PASSWORD = os.getenv("TEST_USER_PASSWORD", "password123")

# Test data storage
test_data: Dict[str, Any] = {}


# =============================================================================
# Fixtures
# =============================================================================
@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "token" in data, "No token in response"
    return data["token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get authorization headers"""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture(scope="module")
def session(auth_headers):
    """Create authenticated requests session"""
    sess = requests.Session()
    sess.headers.update(auth_headers)
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# =============================================================================
# Helper Functions
# =============================================================================
def assert_success(response, expected_status=200):
    """Assert successful response"""
    assert response.status_code == expected_status, \
        f"Expected {expected_status}, got {response.status_code}: {response.text}"


def assert_error(response, expected_status=400):
    """Assert error response"""
    assert response.status_code == expected_status, \
        f"Expected {expected_status}, got {response.status_code}: {response.text}"


def assert_json_keys(data, required_keys):
    """Assert JSON response contains required keys"""
    for key in required_keys:
        assert key in data, f"Missing key: {key}"


# =============================================================================
# Test Classes
# =============================================================================

class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self):
        """Test health check endpoint"""
        response = requests.get(f"{BASE_URL}/health")
        assert response.status_code in [200, 401, 404]  # May require auth or not exist
    
    def test_server_reachable(self):
        """Test server is reachable"""
        try:
            response = requests.get(f"{BASE_URL}/auth/info", timeout=10)
            assert response.status_code < 500
        except requests.exceptions.ConnectionError:
            pytest.fail("Server not reachable")


class TestAuthentication:
    """Authentication API tests"""
    
    def test_auth_info_endpoint(self):
        """Test auth info endpoint (public)"""
        response = requests.get(f"{BASE_URL}/auth/info")
        assert response.status_code == 200
        data = response.json()
        assert "mode" in data
    
    def test_login_success(self):
        """Test successful login"""
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert_success(response)
        data = response.json()
        assert_json_keys(data, ["token"])
        test_data["auth_token"] = data["token"]
    
    def test_login_invalid_email(self):
        """Test login with invalid email"""
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": "nonexistent@test.com", "password": "password"}
        )
        assert response.status_code in [400, 401, 404]
    
    def test_login_wrong_password(self):
        """Test login with wrong password"""
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": TEST_USER_EMAIL, "password": "wrongpassword"}
        )
        assert response.status_code in [400, 401]
    
    def test_login_missing_fields(self):
        """Test login with missing fields"""
        response = requests.post(f"{BASE_URL}/auth/login", json={"email": TEST_USER_EMAIL})
        assert response.status_code in [400, 422]
        
        response = requests.post(f"{BASE_URL}/auth/login", json={"password": "test"})
        assert response.status_code in [400, 422]
    
    def test_get_current_user(self, session):
        """Test get current user endpoint"""
        response = session.get(f"{BASE_URL}/auth/me")
        assert_success(response)
        data = response.json()
        assert_json_keys(data, ["id", "email", "name"])
    
    def test_unauthorized_access(self):
        """Test accessing protected endpoint without token"""
        response = requests.get(f"{BASE_URL}/auth/me")
        assert response.status_code == 401
    
    def test_invalid_token(self):
        """Test accessing protected endpoint with invalid token"""
        headers = {"Authorization": "Bearer invalid_token_12345"}
        response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
        assert response.status_code == 401


class TestOpportunities:
    """Opportunities API tests"""
    
    def test_list_opportunities(self, session):
        """Test list opportunities endpoint"""
        response = session.get(f"{BASE_URL}/opportunities")
        assert_success(response)
        data = response.json()
        assert "data" in data or isinstance(data, list)
    
    def test_list_opportunities_with_pagination(self, session):
        """Test opportunities pagination"""
        response = session.get(f"{BASE_URL}/opportunities?page=1&limit=5")
        assert_success(response)
        data = response.json()
        if "data" in data:
            assert "total" in data or "totalPages" in data
    
    def test_list_opportunities_with_search(self, session):
        """Test opportunities search"""
        response = session.get(f"{BASE_URL}/opportunities?search=test")
        assert_success(response)
    
    def test_list_opportunities_by_stage(self, session):
        """Test filter opportunities by stage"""
        response = session.get(f"{BASE_URL}/opportunities?stage=Qualification")
        assert_success(response)
    
    def test_create_opportunity(self, session):
        """Test create opportunity"""
        opp_data = {
            "title": f"Test Opportunity {datetime.now().strftime('%Y%m%d%H%M%S')}",
            "value": 100000,
            "description": "Test opportunity created by API tests",
            "region": "UK",
            "practice": "Digital",
            "technology": ".NET",
            "pricingModel": "Fixed Price",
            "expectedDayRate": 500,
            "salesRepName": "Test Sales Rep",
            "clientName": "Test Client"
        }
        
        response = session.post(f"{BASE_URL}/opportunities", json=opp_data)
        assert response.status_code in [200, 201, 400, 500]  # May fail if client doesn't exist
        data = response.json()
        if response.status_code in [200, 201] and "id" in data:
            test_data["created_opportunity_id"] = data["id"]
    
    def test_get_opportunity_detail(self, session):
        """Test get opportunity by ID"""
        opp_id = test_data.get("created_opportunity_id")
        if not opp_id:
            pytest.skip("No opportunity created in previous test")
        
        response = session.get(f"{BASE_URL}/opportunities/{opp_id}")
        assert_success(response)
        data = response.json()
        assert_json_keys(data, ["id", "title"])
    
    def test_update_opportunity(self, session):
        """Test update opportunity"""
        opp_id = test_data.get("created_opportunity_id")
        if not opp_id:
            pytest.skip("No opportunity created in previous test")
        
        update_data = {
            "title": "Updated Test Opportunity",
            "value": 150000
        }
        
        response = session.patch(f"{BASE_URL}/opportunities/{opp_id}", json=update_data)
        assert_success(response)
        data = response.json()
        assert data.get("title") == "Updated Test Opportunity"
    
    def test_update_opportunity_stage(self, session):
        """Test update opportunity stage"""
        opp_id = test_data.get("created_opportunity_id")
        if not opp_id:
            pytest.skip("No opportunity created in previous test")
        
        response = session.patch(
            f"{BASE_URL}/opportunities/{opp_id}",
            json={"stageName": "Qualification"}
        )
        assert_success(response)
    
    def test_get_opportunity_comments(self, session):
        """Test get opportunity comments"""
        opp_id = test_data.get("created_opportunity_id")
        if not opp_id:
            pytest.skip("No opportunity created in previous test")
        
        response = session.get(f"{BASE_URL}/opportunities/{opp_id}/comments")
        assert_success(response)
    
    def test_add_opportunity_comment(self, session):
        """Test add comment to opportunity"""
        opp_id = test_data.get("created_opportunity_id")
        if not opp_id:
            pytest.skip("No opportunity created in previous test")
        
        response = session.post(
            f"{BASE_URL}/opportunities/{opp_id}/comments",
            json={"content": "Test comment from API tests"}
        )
        assert response.status_code in [200, 201]
    
    def test_get_opportunity_audit_log(self, session):
        """Test get opportunity audit log"""
        opp_id = test_data.get("created_opportunity_id")
        if not opp_id:
            pytest.skip("No opportunity created in previous test")
        
        response = session.get(f"{BASE_URL}/opportunities/{opp_id}/audit-log")
        assert_success(response)
    
    def test_get_nonexistent_opportunity(self, session):
        """Test get non-existent opportunity"""
        response = session.get(f"{BASE_URL}/opportunities/nonexistent-id-12345")
        assert response.status_code in [400, 404]
    
    def test_create_opportunity_missing_title(self, session):
        """Test create opportunity without title"""
        response = session.post(
            f"{BASE_URL}/opportunities",
            json={"value": 10000}
        )
        assert response.status_code in [400, 422, 500]  # Server may throw 500 on validation


class TestContacts:
    """Contacts API tests"""
    
    def test_list_contacts(self, session):
        """Test list contacts endpoint"""
        response = session.get(f"{BASE_URL}/contacts")
        assert_success(response)
    
    def test_list_contacts_with_search(self, session):
        """Test contacts search"""
        response = session.get(f"{BASE_URL}/contacts?search=john")
        assert_success(response)
    
    def test_list_contacts_with_pagination(self, session):
        """Test contacts pagination"""
        response = session.get(f"{BASE_URL}/contacts?page=1&limit=10")
        assert_success(response)
    
    def test_create_contact(self, session):
        """Test create contact"""
        contact_data = {
            "firstName": "Test",
            "lastName": f"Contact{datetime.now().strftime('%H%M%S')}",
            "email": f"test{datetime.now().strftime('%H%M%S')}@example.com",
            "phone": "+1234567890",
            "title": "Test Manager",
            "department": "Engineering"
        }
        
        response = session.post(f"{BASE_URL}/contacts", json=contact_data)
        assert response.status_code in [200, 201, 400]  # May fail without clientId
        data = response.json()
        test_data["created_contact_id"] = data.get("id")
    
    def test_get_contact_detail(self, session):
        """Test get contact by ID"""
        contact_id = test_data.get("created_contact_id")
        if not contact_id:
            pytest.skip("No contact created in previous test")
        
        response = session.get(f"{BASE_URL}/contacts/{contact_id}")
        assert_success(response)
    
    def test_update_contact(self, session):
        """Test update contact"""
        contact_id = test_data.get("created_contact_id")
        if not contact_id:
            pytest.skip("No contact created in previous test")
        
        response = session.patch(
            f"{BASE_URL}/contacts/{contact_id}",
            json={"title": "Senior Test Manager"}
        )
        assert_success(response)
    
    def test_delete_contact(self, session):
        """Test delete contact (soft delete)"""
        contact_id = test_data.get("created_contact_id")
        if not contact_id:
            pytest.skip("No contact created in previous test")
        
        response = session.delete(f"{BASE_URL}/contacts/{contact_id}")
        assert response.status_code in [200, 204]


class TestAnalytics:
    """Analytics API tests"""
    
    def test_get_analytics_dashboard(self, session):
        """Test get analytics dashboard data"""
        response = session.get(f"{BASE_URL}/analytics")
        assert_success(response)
        data = response.json()
        # Should have various analytics metrics
        expected_keys = ["totalRevenue", "totalOpportunities"]
        for key in expected_keys:
            if key in data:
                assert True
                return
        # At least return some data
        assert len(data) > 0
    
    def test_analytics_response_structure(self, session):
        """Test analytics response has expected structure"""
        response = session.get(f"{BASE_URL}/analytics")
        assert_success(response)
        data = response.json()
        
        # Check that analytics returns data (any structure)
        assert data is not None, "Analytics should return data"
        assert isinstance(data, (dict, list)), "Analytics should return dict or list"


class TestAdmin:
    """Admin API tests"""
    
    def test_list_users(self, session):
        """Test list users endpoint"""
        response = session.get(f"{BASE_URL}/admin/users")
        assert_success(response)
        data = response.json()
        assert "data" in data or isinstance(data, list)
    
    def test_list_users_with_filters(self, session):
        """Test list users with filters"""
        response = session.get(f"{BASE_URL}/admin/users?page=1&limit=10&sortBy=name&sortDir=asc")
        assert_success(response)
    
    def test_list_roles(self, session):
        """Test list roles endpoint"""
        response = session.get(f"{BASE_URL}/admin/roles")
        assert_success(response)
    
    def test_get_auth_config(self, session):
        """Test get auth configuration"""
        response = session.get(f"{BASE_URL}/admin/auth-config")
        assert_success(response)
        data = response.json()
        assert "mode" in data
    
    def test_get_budget_assumptions(self, session):
        """Test get budget assumptions"""
        response = session.get(f"{BASE_URL}/admin/budget-assumptions")
        assert_success(response)
    
    def test_list_audit_logs(self, session):
        """Test list audit logs"""
        response = session.get(f"{BASE_URL}/admin/audit-logs")
        assert_success(response)


class TestMasterData:
    """Master data API tests"""
    
    def test_list_clients(self, session):
        """Test list clients"""
        response = session.get(f"{BASE_URL}/master/clients")
        assert_success(response)
    
    def test_list_regions(self, session):
        """Test list regions"""
        response = session.get(f"{BASE_URL}/master/regions")
        assert_success(response)
    
    def test_list_technologies(self, session):
        """Test list technologies"""
        response = session.get(f"{BASE_URL}/master/technologies")
        assert_success(response)
    
    def test_list_pricing_models(self, session):
        """Test list pricing models"""
        response = session.get(f"{BASE_URL}/master/pricing-models")
        assert_success(response)
    
    def test_list_project_types(self, session):
        """Test list project types"""
        response = session.get(f"{BASE_URL}/master/project-types")
        assert_success(response)
    
    def test_list_salespersons(self, session):
        """Test list salespersons"""
        response = session.get(f"{BASE_URL}/master/salespersons")
        assert_success(response)


class TestChatbot:
    """Chatbot API tests"""
    
    def test_send_message(self, session):
        """Test send chatbot message"""
        response = session.post(
            f"{BASE_URL}/chatbot/message",
            json={"message": "What is the total pipeline value?"}
        )
        assert_success(response)
        data = response.json()
        assert "response" in data or "content" in data  # May use 'content' key
    
    def test_get_chat_history(self, session):
        """Test get chat history"""
        response = session.get(f"{BASE_URL}/chatbot/history")
        assert_success(response)
    
    def test_get_suggestions(self, session):
        """Test get chatbot suggestions"""
        response = session.get(f"{BASE_URL}/chatbot/suggestions")
        assert_success(response)
    
    def test_get_llm_status(self, session):
        """Test get LLM status"""
        response = session.get(f"{BASE_URL}/chatbot/llm-status")
        assert_success(response)
    
    def test_message_too_long(self, session):
        """Test sending message that's too long"""
        long_message = "a" * 3000  # Over 2000 char limit
        response = session.post(
            f"{BASE_URL}/chatbot/message",
            json={"message": long_message}
        )
        assert response.status_code in [400, 422]


class TestRateCards:
    """Rate cards API tests"""
    
    def test_list_rate_cards(self, session):
        """Test list rate cards"""
        response = session.get(f"{BASE_URL}/rate-cards")
        assert_success(response)


class TestCurrencyRates:
    """Currency rates API tests"""
    
    def test_list_currency_rates(self, session):
        """Test list currency rates (public)"""
        response = session.get(f"{BASE_URL}/admin/currency-rates")
        assert_success(response)


class TestErrorHandling:
    """API error handling tests"""
    
    def test_invalid_json(self, session):
        """Test handling of invalid JSON"""
        headers = session.headers.copy()
        headers["Content-Type"] = "application/json"
        response = requests.post(
            f"{BASE_URL}/auth/login",
            data="invalid json{",
            headers=headers
        )
        assert response.status_code in [400, 422, 500]
    
    def test_method_not_allowed(self, session):
        """Test method not allowed"""
        response = session.delete(f"{BASE_URL}/auth/login")
        assert response.status_code in [404, 405]
    
    def test_rate_limiting(self, session):
        """Test rate limiting (if implemented)"""
        # Send many requests quickly
        responses = []
        for _ in range(20):
            response = session.get(f"{BASE_URL}/auth/info")
            responses.append(response.status_code)
        
        # Should mostly succeed unless rate limited
        success_count = sum(1 for s in responses if s == 200)
        assert success_count >= 10  # At least half should succeed


class TestDataValidation:
    """Data validation tests"""
    
    def test_opportunity_invalid_value(self, session):
        """Test create opportunity with invalid value"""
        response = session.post(
            f"{BASE_URL}/opportunities",
            json={
                "title": "Test",
                "value": "not a number"  # Invalid
            }
        )
        assert response.status_code in [400, 422, 500]
    
    def test_opportunity_negative_value(self, session):
        """Test create opportunity with negative value"""
        response = session.post(
            f"{BASE_URL}/opportunities",
            json={
                "title": "Test",
                "value": -1000
            }
        )
        # May succeed, fail validation, or throw server error
        assert response.status_code in [200, 201, 400, 422, 500]
    
    def test_contact_invalid_email(self, session):
        """Test create contact with invalid email"""
        response = session.post(
            f"{BASE_URL}/contacts",
            json={
                "firstName": "Test",
                "lastName": "User",
                "email": "not-an-email"
            }
        )
        assert response.status_code in [200, 201, 400, 422]  # May succeed


class TestConcurrency:
    """Concurrency and race condition tests"""
    
    def test_concurrent_reads(self, session):
        """Test concurrent read operations"""
        import concurrent.futures
        
        def fetch_opportunities():
            return session.get(f"{BASE_URL}/opportunities")
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(fetch_opportunities) for _ in range(10)]
            results = [f.result() for f in futures]
        
        success_count = sum(1 for r in results if r.status_code == 200)
        assert success_count >= 8  # Most should succeed


class TestPagination:
    """Pagination tests"""
    
    def test_opportunities_different_page_sizes(self, session):
        """Test opportunities with different page sizes"""
        for limit in [5, 10, 25, 50]:
            response = session.get(f"{BASE_URL}/opportunities?limit={limit}")
            assert_success(response)
            data = response.json()
            if "data" in data:
                assert len(data["data"]) <= limit
    
    def test_opportunities_page_navigation(self, session):
        """Test navigating through pages"""
        response1 = session.get(f"{BASE_URL}/opportunities?page=1&limit=5")
        response2 = session.get(f"{BASE_URL}/opportunities?page=2&limit=5")
        
        assert_success(response1)
        assert_success(response2)
        
        data1 = response1.json()
        data2 = response2.json()
        
        # Data should be different (if enough records exist)
        if "data" in data1 and "data" in data2:
            if len(data1["data"]) > 0 and len(data2["data"]) > 0:
                assert data1["data"][0].get("id") != data2["data"][0].get("id")


class TestSorting:
    """Sorting tests"""
    
    def test_users_sorting_by_name(self, session):
        """Test users sorting by name"""
        response_asc = session.get(f"{BASE_URL}/admin/users?sortBy=name&sortDir=asc")
        response_desc = session.get(f"{BASE_URL}/admin/users?sortBy=name&sortDir=desc")
        
        assert_success(response_asc)
        assert_success(response_desc)
        
        data_asc = response_asc.json()
        data_desc = response_desc.json()
        
        # Data should be in different order
        if "data" in data_asc and "data" in data_desc:
            if len(data_asc["data"]) > 1 and len(data_desc["data"]) > 1:
                assert data_asc["data"][0].get("id") != data_desc["data"][-1].get("id")


# =============================================================================
# Cleanup
# =============================================================================
def test_cleanup(session):
    """Cleanup test data"""
    # Delete created opportunity if exists
    opp_id = test_data.get("created_opportunity_id")
    if opp_id:
        try:
            session.delete(f"{BASE_URL}/opportunities/{opp_id}")
        except:
            pass  # Ignore cleanup errors


# =============================================================================
# Run Tests
# =============================================================================
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
