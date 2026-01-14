#!/usr/bin/env python3
"""
Test script with console log capture.
"""

from playwright.sync_api import sync_playwright
import time

def test_with_console():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()

        # Capture console logs
        console_messages = []
        def handle_console(msg):
            console_messages.append(f"{msg.type}: {msg.text}")
            print(f"  CONSOLE: {msg.text}")

        page.on('console', handle_console)

        # Clear localStorage for fresh start
        page.goto('http://localhost:3001/')
        page.wait_for_load_state('load', timeout=30000)
        time.sleep(3)

        print("\n" + "="*60)
        print("After first load - checking if modal appeared:")
        try:
            page.wait_for_selector('[role="dialog"]', timeout=1000)
            print("✅ Modal appeared")
        except:
            print("❌ Modal did NOT appear")

        print("\nReloading...")
        page.reload(wait_until='load', timeout=30000)
        time.sleep(3)

        print("\n" + "="*60)
        print("After reload - checking if modal appeared:")
        try:
            page.wait_for_selector('[role="dialog"]', timeout=1000)
            print("❌ BUG: Modal appeared again!")
        except:
            print("✅ SUCCESS: Modal did NOT appear")

        print("\n" + "="*60)
        print("Relevant console logs:")
        for msg in console_messages:
            if 'Onboarding Debug' in msg:
                print(f"  {msg}")

        time.sleep(2)
        browser.close()

if __name__ == '__main__':
    test_with_console()
