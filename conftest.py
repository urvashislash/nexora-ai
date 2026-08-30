import sys
from pathlib import Path

# Ensure ai_service and root are on sys.path for test discovery from any directory
ROOT_DIR = Path(__file__).resolve().parent
AI_SERVICE_DIR = ROOT_DIR / "ai_service"

if str(AI_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_DIR))

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
