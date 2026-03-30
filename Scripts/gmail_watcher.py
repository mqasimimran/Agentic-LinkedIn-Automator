#!/usr/bin/env python3

import os
import google.auth
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from googleapiclient.errors import HttpError

# --- Configuration ---
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
TOKEN_PATH = "token.json"
CREDENTIALS_PATH = "credentials.json"
NEEDS_ACTION_DIR = os.path.join(os.path.dirname(__file__), "..", "Needs_Action")

# Ensure the Needs_Action directory exists
os.makedirs(NEEDS_ACTION_DIR, exist_ok=True)

def authenticate_gmail():
    creds = None
    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(google.auth.transport.requests.Request())
        else:
            flow = google.auth.default.run_flow(SCOPES, google.auth.default.Credentials())