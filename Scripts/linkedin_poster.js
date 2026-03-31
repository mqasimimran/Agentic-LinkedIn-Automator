const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const APPROVED_DIR = path.resolve(__dirname, '..', 'Approved');
const DONE_DIR = path.resolve(__dirname, '..', 'Done');
const LINKEDIN_EMAIL = process.env.LINKEDIN_EMAIL; 
const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD;

const HEADLESS_MODE = false; 

let isProcessing = false;

async function postToLinkedIn(content, fileName, mediaFilePath) {
    let browser;
    let page;
    try {
        isProcessing = true; 
        console.log(`\n[Status] Starting Dialog-Lock Agent for: ${fileName}`);
        if (mediaFilePath) console.log(`[Status] 📎 Attached Media detected: ${path.basename(mediaFilePath)}`);
        
        browser = await chromium.launch({ headless: HEADLESS_MODE, slowMo: 100 }); 
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
        
        console.log('[Status] Finding the text editor inside the dialog...');
        // CRITICAL FIX: Lock onto the dialog, ignoring the top search bar
        const editor = page.locator('div[role="dialog"] [contenteditable="true"]').first();
        await editor.waitFor({ state: 'visible', timeout: 15000 });

        // --- STEP 3: MEDIA UPLOAD ---
        if (mediaFilePath) {
            console.log('[Status] Attempting to upload media...');
            try {
                const mediaBtn = page.getByRole('button', { name: /Add media/i }).first();
                
                const [fileChooser] = await Promise.all([
                    page.waitForEvent('filechooser', { timeout: 10000 }),
                    mediaBtn.click()
                ]);
                
                console.log('[Status] File dialog opened. Injecting image...');
                await fileChooser.setFiles(mediaFilePath);
                
                await page.waitForTimeout(4000); 

                console.log('[Status] Hunting for the Next/Done confirmation button...');
                
                const nextBtn = page.locator('button:has-text("Next")').last();
                const doneBtn = page.locator('button:has-text("Done")').last();

                if (await nextBtn.isVisible({ timeout: 3000 })) {
                    console.log('[Status] Found "Next". Clicking...');
                    await nextBtn.click();
                } else if (await doneBtn.isVisible({ timeout: 3000 })) {
                    console.log('[Status] Found "Done". Clicking...');
                    await doneBtn.click();
                } else {
                    console.log('[Warning] Text locator failed. Trying primary blue button fallback...');
                    await page.locator('div[role="dialog"] button.artdeco-button--primary').last().click();
                }

                // Wait for the modal to slide away 
                await page.waitForTimeout(3000);
            } catch (e) {
                console.log(`[Warning] Media upload skipped or failed: ${e.message}`);
            }
        }

        // --- STEP 4: TYPE CONTENT (DIALOG LOCK FIX) ---
        console.log('[Status] Finding the FRESH text editor inside the dialog...');
        // Re-grab the editor specifically inside the dialog to avoid the global search bar
        const freshEditor = page.locator('div[role="dialog"] [contenteditable="true"]').first();
        await freshEditor.waitFor({ state: 'visible', timeout: 15000 });
        
        console.log('[Status] Clicking Editor and typing slowly...');
        await freshEditor.click(); 
        await page.keyboard.type(content, { delay: 50 });
        
        console.log('[Status] Waking up LinkedIn validation...');
        await page.keyboard.press('Space');
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(2000); 

        // --- STEP 5: SUBMIT ---
        console.log('[Status] Finding the exact "Post" button...');
        const postButton = page.getByRole('button', { name: 'Post', exact: true });
        
        console.log('[Status] Waiting for button to unlock and clicking...');
        await postButton.click({ timeout: 10000 });

        // --- STEP 6: VERIFY ---
        console.log('[Status] Waiting for the text editor to vanish (Upload in progress)...');
        await freshEditor.waitFor({ state: 'hidden', timeout: 30000 });
        
        console.log(`🚀 SUCCESS: ${fileName} is LIVE!`);
        await page.waitForTimeout(5000); 
        return true;

    } catch (error) {
        console.error(`❌ ERROR: ${error.message}`);
        if (page && !HEADLESS_MODE) {
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

    const mdFile = files[0];
    const mdFilePath = path.join(APPROVED_DIR, mdFile);
    const content = fs.readFileSync(mdFilePath, 'utf-8');
    
    const baseName = path.parse(mdFile).name;
    const supportedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.mp4'];
    let mediaFilePath = null;
    let foundMediaFile = null;

    for (const ext of supportedExtensions) {
        const checkPath = path.join(APPROVED_DIR, baseName + ext);
        if (fs.existsSync(checkPath)) {
            mediaFilePath = checkPath;
            foundMediaFile = baseName + ext;
            break;
        }
    }
    
    const success = await postToLinkedIn(content, mdFile, mediaFilePath);
    
    if (success) {
        fs.renameSync(mdFilePath, path.join(DONE_DIR, mdFile));
        console.log(`[Archive] Moved ${mdFile} to /Done`);
        
        if (mediaFilePath) {
            fs.renameSync(mediaFilePath, path.join(DONE_DIR, foundMediaFile));
            console.log(`[Archive] Moved ${foundMediaFile} to /Done`);
        }
    } else {
        console.log(`[Retry] Post failed. Check error_view.png. Keeping files in /Approved.`);
    }
}

console.log('🚀 Linkden Poster Agent Online.');
setInterval(checkAndProcess, 15000);
