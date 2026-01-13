from playwright.sync_api import sync_playwright

def verify_font_loading():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the app (assuming default port 3000)
        try:
            page.goto("http://localhost:3000")
            page.wait_for_timeout(3000) # Wait for hydration

            # Check for font loading via JS evaluation
            font_check = page.evaluate("""
                document.fonts.check('16px VT323')
            """)
            print(f"Font VT323 Loaded: {font_check}")

            # Take a screenshot of the main page
            page.screenshot(path="verification/font_verification.png")

            # Also try to access the font file directly
            response_status = page.evaluate("""
                async () => {
                    const res = await fetch('/fonts/VT323-Regular.ttf');
                    return res.status;
                }
            """)
            print(f"Direct Font Access Status: {response_status}")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_font_loading()
