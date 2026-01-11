from playwright.sync_api import sync_playwright

def verify_map():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # Go to the game
            page.goto("http://localhost:3000")

            # Wait for connection and level data (give it a few seconds)
            page.wait_for_timeout(3000)

            # Press 'M' to toggle map
            page.keyboard.press("m")

            # Wait for map to appear (simple timeout for visual check)
            page.wait_for_timeout(1000)

            # Take screenshot
            page.screenshot(path="verification/map_debug.png")
            print("Screenshot taken at verification/map_debug.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_map()
