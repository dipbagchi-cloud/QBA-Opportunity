# Q-CRM Test Suite

Comprehensive test suite for Q-CRM application including Selenium frontend tests and API tests.

## Directory Structure

```
tests/
├── api/
│   └── test_api.py          # API endpoint tests
├── selenium/
│   └── test_frontend.py     # Frontend UI tests
├── requirements.txt         # Python dependencies
└── README.md               # This file
```

## Setup

### 1. Install Python Dependencies

```bash
cd tests
pip install -r requirements.txt
```

### 2. Install Chrome WebDriver (for Selenium tests)

The webdriver-manager package will automatically download the appropriate ChromeDriver. Ensure Chrome browser is installed.

### 3. Configure Environment Variables (Optional)

Create a `.env` file or set environment variables:

```bash
# API/Frontend URL
export QCRM_URL="http://20.124.178.41:3000"      # Frontend URL
export QCRM_API_URL="http://20.124.178.41:3001/api"  # API URL

# Test Credentials
export TEST_USER_EMAIL="admin@qpeople.co.uk"
export TEST_USER_PASSWORD="Welcome@CRM1"
```

## Running Tests

### Run All Tests

```bash
pytest -v
```

### Run API Tests Only

```bash
pytest api/test_api.py -v
```

### Run Selenium Tests Only

```bash
pytest selenium/test_frontend.py -v
```

### Run Specific Test Class

```bash
pytest api/test_api.py::TestAuthentication -v
```

### Run with HTML Report

```bash
pytest -v --html=test_report.html
```

### Run in Parallel (faster)

```bash
pytest -v -n auto
```

### Run with Coverage

```bash
pytest --cov=. --cov-report=html
```

## Test Categories

### API Tests (`test_api.py`)

| Category | Description |
|----------|-------------|
| `TestHealthCheck` | Server health and connectivity |
| `TestAuthentication` | Login, logout, token management |
| `TestOpportunities` | CRUD operations on opportunities |
| `TestContacts` | Contact management |
| `TestAnalytics` | Dashboard analytics data |
| `TestAdmin` | User/role management |
| `TestMasterData` | Clients, regions, technologies |
| `TestChatbot` | AI chatbot functionality |
| `TestRateCards` | Rate card management |
| `TestErrorHandling` | Error responses |
| `TestDataValidation` | Input validation |
| `TestConcurrency` | Concurrent request handling |
| `TestPagination` | Pagination functionality |
| `TestSorting` | Sort functionality |

### Selenium Tests (`test_frontend.py`)

| Category | Description |
|----------|-------------|
| `TestAuthentication` | Login page and authentication |
| `TestDashboard` | Dashboard page elements |
| `TestOpportunities` | Opportunities list and forms |
| `TestContacts` | Contact management UI |
| `TestSettings` | Settings page tabs |
| `TestGOM` | GOM calculator page |
| `TestAgents` | AI chatbot interface |
| `TestResponsiveDesign` | Mobile/tablet viewports |
| `TestNavigation` | Sidebar and breadcrumb navigation |
| `TestAccessibility` | Basic accessibility checks |
| `TestErrorHandling` | 404 pages, unauthorized access |

## Test Configuration

### Headless Mode (Selenium)

To run Selenium tests without opening a browser window, uncomment this line in `test_frontend.py`:

```python
chrome_options.add_argument("--headless")
```

### Custom Base URL

For local development:

```bash
export QCRM_URL="http://localhost:3000"
export QCRM_API_URL="http://localhost:3001/api"
pytest -v
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        cd tests
        pip install -r requirements.txt
    
    - name: Run API Tests
      env:
        QCRM_API_URL: ${{ secrets.QCRM_API_URL }}
        TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
        TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
      run: pytest tests/api -v --html=api_report.html
    
    - name: Upload Test Report
      uses: actions/upload-artifact@v3
      with:
        name: test-report
        path: api_report.html
```

## Troubleshooting

### Chrome/ChromeDriver Issues

```bash
# Update Chrome
# On Windows: winget upgrade Google.Chrome
# On macOS: brew upgrade --cask google-chrome

# Clear webdriver cache
rm -rf ~/.wdm
```

### Connection Refused

Ensure the target server is running and accessible:

```bash
curl http://20.124.178.41:3001/api/auth/info
```

### SSL Certificate Errors

For self-signed certificates, add to test files:

```python
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
```

## Adding New Tests

### API Test Template

```python
class TestNewFeature:
    """New feature API tests"""
    
    def test_feature_get(self, session):
        """Test GET endpoint"""
        response = session.get(f"{BASE_URL}/new-endpoint")
        assert_success(response)
    
    def test_feature_post(self, session):
        """Test POST endpoint"""
        response = session.post(
            f"{BASE_URL}/new-endpoint",
            json={"field": "value"}
        )
        assert response.status_code in [200, 201]
```

### Selenium Test Template

```python
class TestNewPage:
    """New page tests"""
    
    def test_page_loads(self, logged_in_driver):
        """Test page loads correctly"""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/dashboard/new-page")
        wait = WebDriverWait(driver, EXPLICIT_WAIT)
        
        time.sleep(2)
        assert "new-page" in driver.current_url.lower()
```

## License

Internal use only. Q-People Ltd.
