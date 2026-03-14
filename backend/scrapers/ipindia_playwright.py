from playwright.sync_api import sync_playwright

LOGIN_URL = "https://ipindiaonline.gov.in/trademarkefiling/user/frmLoginNew.aspx"


def login_ipindia(username, password):

    with sync_playwright() as p:

        browser = p.chromium.launch(headless=False)

        page = browser.new_page()

        page.goto(LOGIN_URL)

        page.fill("#ctl00_ContentPlaceHolder1_txtUserName", username)

        page.fill("#ctl00_ContentPlaceHolder1_txtPassword", password)

        print("Solve captcha in browser...")

        input("Press ENTER after solving captcha")

        page.click("#ctl00_ContentPlaceHolder1_btnLogin")

        page.wait_for_timeout(5000)

        print("Current page:", page.url)

        browser.close()
