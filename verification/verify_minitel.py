from playwright.sync_api import sync_playwright

def verify_minitel():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Navigate to the game client
            page.goto("http://localhost:3000")

            # Wait for canvas to be attached
            page.wait_for_selector("canvas", state="attached", timeout=20000)

            # Wait a bit for shaders to compile and render
            page.wait_for_timeout(5000)

            # Take a screenshot
            page.screenshot(path="verification/minitel_effect.png")
            print("Screenshot taken")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_minitel()
