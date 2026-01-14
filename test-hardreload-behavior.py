#!/usr/bin/env python3
"""
Test hard reload behavior: Modal should show on first visit AND on hard reloads.
"""

from playwright.sync_api import sync_playwright
import time

def test_hard_reload():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()

        print("="*60)
        print("TEST: Onboarding Hard Reload Behavior")
        print("="*60)

        # First visit
        print("\n📍 Step 1: First visit to homepage")
        page.goto('http://localhost:3001/')
        page.wait_for_load_state('load', timeout=30000)
        time.sleep(2)

        try:
            page.wait_for_selector('[role="dialog"]', timeout=3000)
            print("✅ Step 1 PASSED: Modal appeared on first visit")
        except:
            print("❌ Step 1 FAILED: Modal did NOT appear on first visit")

        # Hard refresh
        print("\n📍 Step 2: Hard refresh (Cmd+R)")
        page.reload(wait_until='load', timeout=30000)
        time.sleep(2)

        try:
            page.wait_for_selector('[role="dialog"]', timeout=3000)
            print("✅ Step 2 PASSED: Modal appeared on hard refresh")
        except:
            print("❌ Step 2 FAILED: Modal did NOT appear on hard refresh")

        # Another hard refresh
        print("\n📍 Step 3: Another hard refresh")
        page.reload(wait_until='load', timeout=30000)
        time.sleep(2)

        try:
            page.wait_for_selector('[role="dialog"]', timeout=3000)
            print("✅ Step 3 PASSED: Modal appeared on second hard refresh")
        except:
            print("❌ Step 3 FAILED: Modal did NOT appear on second hard refresh")

        print("\n" + "="*60)
        print("Expected Behavior:")
        print("  - Modal shows on first visit: YES")
        print("  - Modal shows on hard refresh: YES")
        print("  - Modal shows on subsequent hard refreshes: YES")
        print("  - Modal stops showing after completion: YES")
        print("="*60)

        time.sleep(2)
        browser.close()

if __name__ == '__main__':
    test_hard_reload()
