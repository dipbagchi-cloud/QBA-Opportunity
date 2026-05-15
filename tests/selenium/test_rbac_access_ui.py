import json
import os
import subprocess
import time
from pathlib import Path

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager


ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
ARTIFACT_DIR = ROOT / "tests" / "artifacts" / "rbac-access"
FIXTURE_PATH = BACKEND_DIR / "prisma" / ".rbac-ui-test" / "fixture.json"

BASE_URL = os.getenv("QCRM_URL", "http://localhost:3000")
PASSWORD = "password123"
WAIT_SECONDS = 20
os.environ.setdefault("WDM_LOCAL", "1")


def seed_fixture():
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        ["npx.cmd" if os.name == "nt" else "npx", "ts-node", "prisma/seed-rbac-ui-test.ts"],
        cwd=BACKEND_DIR,
        text=True,
        capture_output=True,
        timeout=120,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"RBAC fixture seed failed\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        )
    return json.loads(FIXTURE_PATH.read_text())


@pytest.fixture(scope="session")
def fixture_data():
    return seed_fixture()


@pytest.fixture(scope="session")
def driver(fixture_data):
    chrome_options = Options()
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1440,1100")
    if os.getenv("QCRM_HEADLESS", "1") != "0":
        chrome_options.add_argument("--headless=new")

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    driver.implicitly_wait(2)
    yield driver
    driver.quit()


def wait(driver, seconds=WAIT_SECONDS):
    return WebDriverWait(driver, seconds)


def screenshot(driver, name):
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    driver.save_screenshot(str(ARTIFACT_DIR / f"{name}.png"))


def logout(driver):
    driver.get(f"{BASE_URL}/login")
    driver.execute_script("window.sessionStorage.clear(); window.localStorage.clear();")
    driver.delete_all_cookies()


def login(driver, email, password=PASSWORD):
    logout(driver)
    driver.get(f"{BASE_URL}/login")
    wait(driver).until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='email']"))).send_keys(email)
    driver.find_element(By.CSS_SELECTOR, "input[type='password']").send_keys(password)
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    wait(driver).until(EC.url_contains("/dashboard"))
    wait(driver).until(EC.presence_of_element_located((By.TAG_NAME, "body")))


def visible_text(driver, text):
    return driver.find_elements(By.XPATH, f"//*[contains(normalize-space(), {json.dumps(text)})]")


def assert_text_present(driver, text):
    wait(driver).until(lambda d: len(visible_text(d, text)) > 0)


def assert_text_absent(driver, text):
    assert len(visible_text(driver, text)) == 0, f"Unexpected text visible: {text}"


def visible_links_to(driver, href):
    links = driver.find_elements(By.CSS_SELECTOR, f"a[href='{href}']")
    return [link for link in links if link.is_displayed()]


def goto(driver, path):
    driver.get(f"{BASE_URL}{path}")
    wait(driver).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    time.sleep(1)


def enabled_buttons_with_text(driver, text):
    buttons = driver.find_elements(By.XPATH, f"//button[contains(normalize-space(), {json.dumps(text)})]")
    return [button for button in buttons if button.is_displayed() and button.is_enabled()]


def click_visible_button(driver, text):
    buttons = driver.find_elements(By.XPATH, f"//button[contains(normalize-space(), {json.dumps(text)})]")
    visible = [button for button in buttons if button.is_displayed()]
    assert visible, f"Button not visible: {text}"
    visible[0].click()
    time.sleep(0.5)


def first_visible(driver, css):
    items = driver.find_elements(By.CSS_SELECTOR, css)
    return next((item for item in items if item.is_displayed()), None)


def opportunity_path(fixture_data, key):
    return f"/dashboard/opportunities/{fixture_data['opportunities'][key]['id']}"


def test_contacts_only_role_hides_opportunities_and_blocks_direct_route(driver, fixture_data):
    login(driver, fixture_data["users"]["contactsOnly"]["email"])

    assert_text_present(driver, "Dashboard")
    assert visible_links_to(driver, "/dashboard/contacts")
    assert not visible_links_to(driver, "/dashboard/opportunities")
    assert not visible_links_to(driver, "/dashboard/settings")

    goto(driver, "/dashboard/opportunities")
    assert_text_present(driver, "Access Restricted")
    assert_text_present(driver, "Admin-defined role access does not allow this screen")
    screenshot(driver, "contacts-only-opportunities-denied")

    goto(driver, "/dashboard/opportunities/new")
    assert_text_present(driver, "Access Restricted")
    screenshot(driver, "contacts-only-new-opportunity-denied")


def test_assigned_sales_owner_can_edit_pipeline_opportunity(driver, fixture_data):
    login(driver, fixture_data["users"]["owner"]["email"])
    goto(driver, opportunity_path(fixture_data, "pipeline"))

    assert_text_present(driver, "Pipeline Details")
    assert len(visible_text(driver, "View-Only Access")) == 0
    assert enabled_buttons_with_text(driver, "Move to Presales")
    assert enabled_buttons_with_text(driver, "Save")

    value_input = first_visible(driver, "input[name='value']")
    assert value_input is not None
    assert value_input.is_enabled()

    comment_box = first_visible(driver, "textarea")
    assert comment_box is not None
    assert comment_box.is_enabled()
    screenshot(driver, "assigned-sales-owner-editable")


def test_same_role_unassigned_peer_is_view_only(driver, fixture_data):
    login(driver, fixture_data["users"]["peer"]["email"])
    goto(driver, opportunity_path(fixture_data, "pipeline"))

    assert_text_present(driver, "View-Only Access")
    assert_text_present(driver, "only the assigned owner, sales rep, manager, or named presales assignees can edit")
    screenshot(driver, "same-role-peer-view-only-popup")

    if enabled_buttons_with_text(driver, "Understood"):
        enabled_buttons_with_text(driver, "Understood")[0].click()
        time.sleep(0.5)

    assert not enabled_buttons_with_text(driver, "Move to Presales")
    assert not enabled_buttons_with_text(driver, "Mark as Lost")
    assert not enabled_buttons_with_text(driver, "Hold")
    assert not enabled_buttons_with_text(driver, "Save")

    value_input = first_visible(driver, "input[name='value']")
    assert value_input is not None
    assert not value_input.is_enabled()

    comment_box = first_visible(driver, "textarea")
    assert comment_box is not None
    assert not comment_box.is_enabled()
    screenshot(driver, "same-role-peer-buttons-disabled")


def test_read_only_role_can_view_but_cannot_create_or_edit(driver, fixture_data):
    login(driver, fixture_data["users"]["viewer"]["email"])

    goto(driver, "/dashboard/opportunities")
    assert_text_present(driver, "Opportunities")
    assert not enabled_buttons_with_text(driver, "New Opportunity")

    goto(driver, "/dashboard/opportunities/new")
    assert_text_present(driver, "Access Restricted")
    screenshot(driver, "read-only-new-opportunity-denied")

    goto(driver, opportunity_path(fixture_data, "pipeline"))
    assert_text_present(driver, "Pipeline Details")
    assert not enabled_buttons_with_text(driver, "Move to Presales")
    assert not enabled_buttons_with_text(driver, "Save")

    comment_box = first_visible(driver, "textarea")
    assert comment_box is not None
    assert not comment_box.is_enabled()
    screenshot(driver, "read-only-detail-no-actions")


def test_assigned_presales_user_has_presales_lifecycle_controls(driver, fixture_data):
    login(driver, fixture_data["users"]["presales"]["email"])
    goto(driver, opportunity_path(fixture_data, "presales"))

    assert_text_present(driver, "Presales")
    assert_text_present(driver, "Resource Assignment")
    assert_text_present(driver, "Estimation")
    assert_text_present(driver, "GOM Calculator")
    assert enabled_buttons_with_text(driver, "Save Estimation")
    assert enabled_buttons_with_text(driver, "Move to Sales")
    screenshot(driver, "assigned-presales-lifecycle-controls")


def test_sales_owner_sees_presales_tabs_view_only(driver, fixture_data):
    login(driver, fixture_data["users"]["owner"]["email"])
    goto(driver, opportunity_path(fixture_data, "presales"))

    assert_text_present(driver, "Presales")
    for tab in ["Project Details", "Schedule", "Resource Assignment", "Estimation", "GOM Calculator"]:
        assert_text_present(driver, tab)

    assert not enabled_buttons_with_text(driver, "Proposal Lost")
    assert not enabled_buttons_with_text(driver, "Move to Sales")
    assert not enabled_buttons_with_text(driver, "Hold")
    assert not enabled_buttons_with_text(driver, "Update")
    assert not enabled_buttons_with_text(driver, "Save Estimation")
    assert not enabled_buttons_with_text(driver, "Request Approval")

    click_visible_button(driver, "Schedule")
    duration_input = first_visible(driver, "input[name='duration']")
    assert duration_input is not None
    assert not duration_input.is_enabled()
    screenshot(driver, "sales-owner-presales-view-only-tabs")


def test_assigned_sales_owner_has_sales_stage_controls(driver, fixture_data):
    login(driver, fixture_data["users"]["owner"]["email"])
    goto(driver, opportunity_path(fixture_data, "proposal"))

    assert_text_present(driver, "Sales")
    assert enabled_buttons_with_text(driver, "Mark Proposal Sent")
    assert enabled_buttons_with_text(driver, "Send for Re-estimate")
    assert enabled_buttons_with_text(driver, "Proposal Lost")
    screenshot(driver, "assigned-sales-proposal-controls")
