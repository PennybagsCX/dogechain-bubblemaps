#!/usr/bin/env python3
"""
Debug script to check sessionStorage behavior during onboarding.
"""

from playwright.sync_api import sync_playwright
import time

def test_session_storage():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()

        # Navigate to page
        page.goto('http://localhost:3001/')
        page.wait_for_load_state('load', timeout=30000)
        time.sleep(2)

        print("Step 1: Checking sessionStorage before onboarding opens...")
        storage_before = page.evaluate('() => sessionStorage.getItem("dogechain_onboarding_session_shown")')
        print(f"  sessionStorage value: {storage_before}")

        # Wait for modal to appear
        try:
            page.wait_for_selector('[role="dialog"]', timeout=5000)
            print("✅ Onboarding modal appeared")
        except:
            print("❌ Onboarding modal did not appear")

        print("\nStep 2: Checking sessionStorage after onboarding opens...")
        storage_after_open = page.evaluate('() => sessionStorage.getItem("dogechain_onboarding_session_shown")')
        print(f"  sessionStorage value: {storage_after_open}")

        # Check the ref value via console
        console_logs = []
        page.on('console', lambda msg: console_logs.append(msg.text))

        print("\nStep 3: Reloading page...")
        page.reload(wait_until='load', timeout=30000)
        time.sleep(3)

        print("\nStep 4: Checking sessionStorage after reload...")
        storage_after_reload = page.evaluate('() => sessionStorage.getItem("dogechain_onboarding_session_shown")')
        print(f"  sessionStorage value: {storage_after_reload}")

        # Check if modal appeared again
        try:
            page.wait_for_selector('[role="dialog"]', timeout=3000)
            print("❌ BUG: Onboarding modal appeared again after reload!")
            page.screenshot(path='/tmp/debug-bug-confirmation.png')
        except:
            print("✅ SUCCESS: Onboarding modal did NOT appear after reload")

        print("\n" + "="*60)
        print("Debug complete!")
        print("="*60)

        time.sleep(2)
        browser.close()

if __name__ == '__main__':
    test_session_storage()
