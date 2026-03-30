#!/usr/bin/env python3
import time
import os
import shutil
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# --- Configuration ---
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DROPZONE_DIR = os.path.join(BASE_DIR, "Dropzone")
NEEDS_ACTION_DIR = os.path.join(BASE_DIR, "Needs_Action")

os.makedirs(DROPZONE_DIR, exist_ok=True)
os.makedirs(NEEDS_ACTION_DIR, exist_ok=True)

def wait_for_file(filepath, timeout=10):
    """Waits until a file is fully written and closed by the OS."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            # Try to open the file for appending - if this works, the file is not locked
            with open(filepath, 'a'):
                return True
        except IOError:
            time.sleep(1)
    return False

class NewFileHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory:
            return

        src_path = os.path.abspath(event.src_path)
        filename = os.path.basename(src_path)
        dest_path = os.path.join(NEEDS_ACTION_DIR, filename)
        metadata_path = os.path.join(NEEDS_ACTION_DIR, f"{filename}.md")

        print(f"👀 Detected: {filename}. Checking lock...")

        # 1. Wait for Windows to release the file
        if wait_for_file(src_path):
            try:
                # 2. Copy then Delete (Safest on Windows)
                shutil.copy2(src_path, dest_path)
                
                # 3. Create metadata for Gemini
                with open(metadata_path, "w", encoding="utf-8") as f:
                    f.write(f"---\ntype: file_drop\nname: {filename}\nstatus: pending\n---\n\n")
                    f.write(f"## Asset Received\n- **Time**: {time.strftime('%H:%M:%S')}\n")
                
                # 4. Remove original
                os.remove(src_path)
                print(f"✅ Processed: {filename}")
                
            except Exception as e:
                print(f"❌ Error: {e}")
        else:
            print(f"🚫 Timeout: Could not access {filename}")

if __name__ == "__main__":
    event_handler = NewFileHandler()
    observer = Observer()
    observer.schedule(event_handler, path=DROPZONE_DIR, recursive=False)
    observer.start()
    print(f"🚀 Watcher Active on {DROPZONE_DIR}")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()