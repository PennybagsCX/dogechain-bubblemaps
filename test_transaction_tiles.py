#!/usr/bin/env python3
"""Test script to verify Recent Transactions tiles are full width in Wallet Details sidebar."""

from playwright.sync_api import sync_playwright
import time

def test_transaction_tiles_width():
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()

        try:
            # Navigate to app
            print("Navigating to http://localhost:3000...")
            page.goto('http://localhost:3000')
            page.wait_for_load_state('networkidle')
            print("Page loaded successfully")

            # Wait for map to render
            time.sleep(2)

            # Try different approaches to find and click a wallet
            print("Looking for a wallet to click...")

            # Try to find any interactive element that might be a wallet
            # First, let's see what's on the page
            page_content = page.content()

            # Look for wallet-related elements
            selectors_to_try = [
                'circle',
                'g.wallet-node',
                '.wallet-node',
                '[data-wallet]',
                'text=Wallet',
                'button:has-text("Search")',
                'input[placeholder*="search" i]',
            ]

            clicked_wallet = False
            for selector in selectors_to_try:
                try:
                    element = page.locator(selector).first
                    if element.count() > 0:
                        print(f"Found {element.count()} elements with selector: {selector}")
                        # Take a screenshot first
                        page.screenshot(path='/tmp/before_click.png')
                        # Try clicking
                        element.click(timeout=2000)
                        print(f"Clicked element using selector: {selector}")
                        clicked_wallet = True
                        break
                except Exception as e:
                    print(f"Failed with selector '{selector}': {str(e)[:100]}")
                    continue

            if not clicked_wallet:
                print("Could not find or click a wallet. Taking debug screenshot...")
                page.screenshot(path='/tmp/debug_screenshot.png', full_page=True)
                print("Debug screenshot saved to /tmp/debug_screenshot.png")

                # Try using search to find a wallet
                print("\nTrying to use search functionality...")
                try:
                    search_input = page.locator('input[placeholder*="search" i], input[type="search"]').first
                    if search_input.count() > 0:
                        search_input.fill('0x')
                        search_input.press('Enter')
                        time.sleep(2)
                        print("Searched for '0x', waiting for results...")
                except Exception as e:
                    print(f"Search attempt failed: {e}")

            # Wait for sidebar to open
            time.sleep(1)

            # Take screenshot of desktop view
            print("Taking screenshot of desktop wallet sidebar...")
            page.screenshot(path='/tmp/desktop_wallet_sidebar.png', full_page=False)

            # Check transaction tiles in sidebar
            print("Checking transaction tiles...")
            page.wait_for_selector('a[href*="/tx/"]', timeout=10000)

            # Get all transaction tiles
            transaction_tiles = page.locator('a[href*="/tx/"]')
            tile_count = transaction_tiles.count()
            print(f"Found {tile_count} transaction tiles")

            if tile_count > 0:
                # Get the first tile
                first_tile = transaction_tiles.first

                # Get tile and parent container dimensions
                tile_box = first_tile.bounding_box()
                sidebar_container = page.locator('.overflow-y-auto').first
                container_box = sidebar_container.bounding_box()

                print(f"\nDesktop View Analysis:")
                print(f"  Container width: {container_box['width']}px")
                print(f"  First tile width: {tile_box['width']}px")
                print(f"  Tile left position: {tile_box['x']}px")
                print(f"  Tile right position: {tile_box['x'] + tile_box['width']}px")
                print(f"  Container right position: {container_box['x'] + container_box['width']}px")

                # Check if tile is full width (with small margin for scrollbar)
                width_diff = container_box['width'] - tile_box['width']
                print(f"  Width difference: {width_diff}px")

                if width_diff < 20:  # Allow up to 20px for scrollbar/margin
                    print("  ✅ PASS: Tile appears to be full width (accounting for scrollbar)")
                else:
                    print(f"  ❌ FAIL: Tile is NOT full width (diff: {width_diff}px)")

            # Test mobile view
            print("\n" + "="*60)
            print("Testing mobile view (375x667)...")
            page.set_viewport_size({'width': 375, 'height': 667})
            time.sleep(1)

            # Close and reopen sidebar on mobile
            try:
                page.keyboard.press('Escape')
                time.sleep(0.5)

                # Click on the first circle element again
                circle = page.locator('circle').first
                if circle.count() > 0:
                    circle.click()
                    print("Clicked wallet for mobile view")
            except Exception as e:
                print(f"Could not click wallet for mobile: {e}")
                print("Skipping mobile test...")
                browser.close()
                return

            time.sleep(1)

            # Take screenshot of mobile view
            print("Taking screenshot of mobile wallet sidebar...")
            page.screenshot(path='/tmp/mobile_wallet_sidebar.png', full_page=False)

            # Check mobile transaction tiles
            page.wait_for_selector('a[href*="/tx/"]', timeout=10000)
            mobile_tiles = page.locator('a[href*="/tx/"]')
            mobile_tile_count = mobile_tiles.count()
            print(f"Found {mobile_tile_count} transaction tiles on mobile")

            if mobile_tile_count > 0:
                mobile_first_tile = mobile_tiles.first
                mobile_tile_box = mobile_first_tile.bounding_box()

                # Get mobile sidebar width
                mobile_sidebar = page.locator('.fixed.z-\\[100\\]').first
                mobile_sidebar_box = mobile_sidebar.bounding_box()

                print(f"\nMobile View Analysis:")
                print(f"  Sidebar width: {mobile_sidebar_box['width']}px")
                print(f"  First tile width: {mobile_tile_box['width']}px")
                print(f"  Tile left position: {mobile_tile_box['x']}px")

                mobile_width_diff = mobile_sidebar_box['width'] - mobile_tile_box['width']
                print(f"  Width difference: {mobile_width_diff}px")

                if mobile_width_diff < 20:
                    print("  ✅ PASS: Mobile tile appears to be full width")
                else:
                    print(f"  ❌ FAIL: Mobile tile is NOT full width (diff: {mobile_width_diff}px)")

            print("\n" + "="*60)
            print("Screenshots saved:")
            print("  - /tmp/desktop_wallet_sidebar.png")
            print("  - /tmp/mobile_wallet_sidebar.png")

            time.sleep(2)

        except Exception as e:
            print(f"Error during testing: {e}")
            import traceback
            traceback.print_exc()
        finally:
            browser.close()

if __name__ == '__main__':
    test_transaction_tiles_width()
