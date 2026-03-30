# AgenticAI: Hardened LinkedIn Automator 🤖🚀

A production-grade, state-aware LinkedIn automation agent built with **Node.js** and **Playwright**. This agent is designed to bypass modern web app defenses like dynamic React states, hidden DOM elements, and accessibility-based obfuscation.

## 🛠️ The Technical Challenge
Standard automation often fails on LinkedIn due to:
* **React State Mismatch:** Buttons remaining disabled even after text is injected.
* **DOM Obfuscation:** Hidden video players using the same ARIA roles as post dialogs.
* **Anti-Bot Triggers:** Rapid-fire typing that triggers CAPTCHAs.

## ✨ Features
- **State-Aware Typing:** Mimics human cadence (50ms delay) to trigger React validation.
- **Accessibility-First Targeting:** Uses `getByRole` to find the semantic "Post" button, ignoring hidden CSS traps.
- **Ironclad Verification:** Checks for the physical disappearance of the editor before confirming success.
- **Smart Login:** Detects existing sessions to skip redundant login steps.
- **Media Support:** Automatic name-matching for paired image/text uploads.

## 📁 Project Structure
* `/Scripts`: The core logic (LinkedIn Agent, Approval Watchers).
* `/Pending_Approval`: Gemini-generated drafts awaiting review.
* `/Approved`: The dropzone for the execution agent.
* `/Done`: Archive of successfully published content.

## 🚀 How It Works
1. **Gemini AI** generates a post draft based on a prompt.
2. The **Approval Watcher** pings the user for a "Y/N" confirmation.
3. Upon approval, the **LinkedIn Agent** takes over, handles the browser handshake, and publishes the post natively.

---
*Developed as part of the AgenticAI Brand Revival Pipeline.*