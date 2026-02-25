# Twitter Setup

## Account
- **Email:** mttrly@mttrly.com
- **Auth Token:** 3591d6b53db307b8d8605262530ddfa858bcbba0
- **Status:** ✅ Authenticated in headless browser (port 18800)

## Browser Info
- **Type:** Chromium headless (Playwright)
- **CDP Endpoint:** http://127.0.0.1:18800
- **Connection:** Via `chromium.connectOverCDP()`
- **Current State:** Logged in, homepage accessible

## How to Use

```javascript
const { chromium } = require('playwright');

const browser = await chromium.connectOverCDP('http://127.0.0.1:18800');
const page = browser.contexts()[0].pages()[0];

// Navigate
await page.goto('https://x.com/home');

// Click, type, interact
await page.locator('button:has-text("Post")').click();
```

## Important Notes
- Cookie is already loaded → no need to re-authenticate
- Browser stays open between sessions
- Use `waitForTimeout()` for page loads
- Twitter protects against bots → use data-testid selectors when possible
