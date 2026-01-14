#!/usr/bin/env python3
"""
Test script to verify onboarding hard reload fix.

Expected behavior:
1. First visit: Onboarding modal appears
2. Hard refresh: Onboarding does NOT appear again
3. Help icon: Can manually trigger onboarding
"""

from playwright.sync_api import sync_playwright
import time

def test_onboarding():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()

        # Clear localStorage to simulate first-time visitor
        page.goto('http://localhost:3001/')
        page.wait_for_load_state('load', timeout=30000)
        time.sleep(2)  # Additional wait for React to render

        print("📸 Step 1: Taking initial screenshot...")
        page.screenshot(path='/tmp/onboarding-step1-initial.png', full_page=True)

        # Check if onboarding modal is visible
        try:
            page.wait_for_selector('[role="dialog"]', timeout=5000)
            print("✅ Step 1 PASSED: Onboarding modal appeared on first visit")
            page.screenshot(path='/tmp/onboarding-step1-modal.png', full_page=True)
        except:
            print("❌ Step 1 FAILED: Onboarding modal did not appear")

        # Close the onboarding modal (click X button)
        try:
            page.click('aria-label="Close onboarding guide"')
            time.sleep(1)
            print("✅ Closed onboarding modal")
        except:
            print("⚠️  Could not close onboarding (may have already been dismissed)")

        # Hard refresh the page
        print("\n🔄 Step 2: Performing hard refresh...")
        page.reload(wait_until='load', timeout=30000)
        time.sleep(2)

        print("📸 Step 2: Taking screenshot after hard refresh...")
        page.screenshot(path='/tmp/onboarding-step2-after-refresh.png', full_page=True)

        # Check if onboarding modal appears again (it should NOT)
        try:
            page.wait_for_selector('[role="dialog"]', timeout=3000)
            print("❌ Step 2 FAILED: Onboarding modal appeared after hard refresh (BUG!)")
            page.screenshot(path='/tmp/onboarding-step2-bug.png', full_page=True)
        except:
            print("✅ Step 2 PASSED: Onboarding modal did NOT appear after hard refresh")

        # Test help icon functionality
        print("\n❓ Step 3: Testing help icon...")
        try:
            page.click('aria-label="Open user guide"')
            time.sleep(1)
            page.wait_for_selector('[role="dialog"]', timeout=3000)
            print("✅ Step 3 PASSED: Help icon successfully re-opens onboarding")
            page.screenshot(path='/tmp/onboarding-step3-help-icon.png', full_page=True)
        except:
            print("❌ Step 3 FAILED: Help icon did not open onboarding")

        print("\n" + "="*60)
        print("Test completed! Screenshots saved to /tmp/")
        print("="*60)

        time.sleep(2)
        browser.close()

if __name__ == '__main__':
    test_onboarding()
