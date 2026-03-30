const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const APPROVED_DIR = path.resolve(__dirname, '..', 'Approved');
const DONE_DIR = path.resolve(__dirname, '..', 'Done');
const LINKEDIN_EMAIL = process.env.LINKEDIN_EMAIL; 
const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD;

let isProcessing = false;

async function postToLinkedIn(content, fileName) {
    let browser;
    let page;
    try {
        isProcessing = true; 
        console.log(`[Status] Starting True Button Agent for: ${fileName}`);
        
        browser = await chromium.launch({ headless: false, slowMo: 100 }); 
        const context = await browser.newContext();
        page = await context.newPage();

        // --- STEP 1: LOGIN ---
        console.log('[Status] Navigating to LinkedIn...');
        await page.goto('https://www.linkedin.com/login');
        
        const needsLogin = await page.locator('#username').isVisible({ timeout: 5000 }).catch(() => false);
        if (needsLogin) {
            console.log('[Status] Entering credentials...');
            await page.fill('#username', LINKEDIN_EMAIL);
            await page.fill('#password', LINKEDIN_PASSWORD);
            await page.click('button[type="submit"]');
        }

        console.log('⚠️ CHECK BROWSER: Solve CAPTCHA and wait for Feed.');
        await page.waitForURL('**/feed/**', { timeout: 90000 });
        console.log('[Status] Feed loaded. Waiting 5s...');
        await page.waitForTimeout(5000); 

        // --- STEP 2: OPEN POST BOX ---
        console.log('[Status] Hunting for "Start a post"...');
        await page.getByText('Start a post', { exact: false }).first().click();
        
        console.log('[Status] Waiting for text editor to appear...');
        // We ensure we only lock onto a VISIBLE text box
        const editor = page.locator('[contenteditable="true"]').filter({ visible: true }).first();
        await editor.waitFor({ state: 'visible', timeout: 10000 });

        // --- STEP 3: TYPE ---
        console.log('[Status] Editor found! Typing content slowly...');
        await editor.click(); 
        await page.keyboard.type(content, { delay: 50 });
        
        console.log('[Status] Waking up LinkedIn validation...');
        await page.keyboard.press('Space');
        await page.keyboard.press('Backspace');
        // Give the "Post" button 2 full seconds to turn blue
        await page.waitForTimeout(2000); 

        // --- STEP 4: CLICK THE TRUE POST BUTTON ---
        console.log('[Status] Finding the exact "Post" button via Accessibility Role...');
        // getByRole completely ignores HTML classes and nested spans. 
        // It acts like a screen reader, finding the exact button labeled "Post".
        const postButton = page.getByRole('button', { name: 'Post', exact: true });
        
        console.log('[Status] Waiting for button to become enabled and clicking...');
        // Playwright will automatically wait here until LinkedIn removes the "disabled" lock
        await postButton.click({ timeout: 10000 });

        // --- STEP 5: VERIFY ---
        console.log('[Status] Waiting for the text editor to vanish (Upload in progress)...');
        // CRITICAL FIX: We wait for the TEXT BOX to hide, bypassing the video player bug.
        await editor.waitFor({ state: 'hidden', timeout: 15000 });
        
        console.log(`🚀 SUCCESS: ${fileName} is LIVE!`);
        await page.waitForTimeout(5000); 
        return true;

    } catch (error) {
        console.error(`❌ ERROR: ${error.message}`);
        if (page) {
            const shotPath = path.join(__dirname, 'error_view.png');
            await page.screenshot({ path: shotPath }).catch(() => {});
            console.log(`📸 Saved screenshot to: ${shotPath}`);
        }
        return false;
    } finally {
        if (browser) await browser.close();
        isProcessing = false;
    }
}

async function checkAndProcess() {
    if (isProcessing) return;
    const files = fs.readdirSync(APPROVED_DIR).filter(f => f.endsWith('.md'));
    if (files.length === 0) return;

    const file = files[0];
    const filePath = path.join(APPROVED_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const success = await postToLinkedIn(content, file);
    if (success) {
        fs.renameSync(filePath, path.join(DONE_DIR, file));
        console.log(`[Archive] Moved to /Done`);
    } else {
        console.log(`[Retry] Post failed. Check error_view.png. Keeping file in /Approved.`);
    }
}

console.log('🚀 Linkden Poster Agent Online.');
setInterval(checkAndProcess, 15000);