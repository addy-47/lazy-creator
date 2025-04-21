import logging
import logging.handlers
import os
from pathlib import Path

# Define log directory
LOG_DIR = 'logs'

# Ensure log directory exists
Path(LOG_DIR).mkdir(parents=True, exist_ok=True)

# Define log format
FORMATTER = logging.Formatter('%(asctime)s - %(levelname)s - %(name)s - %(message)s')

def setup_logger(name, log_file, level=logging.INFO):
    """Function to setup a logger with file and console handlers"""
    # Create logger
    logger = logging.getLogger(name)
    logger.setLevel(level)

    # Remove existing handlers to avoid duplicates
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)

    # Create file handler
    file_handler = logging.handlers.TimedRotatingFileHandler(
        os.path.join(LOG_DIR, log_file),
        when='midnight',
        interval=1,
        backupCount=7,
        delay=True  # Only open the file when we actually log something
    )
    file_handler.setFormatter(FORMATTER)
    file_handler.setLevel(level)

    # Create console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(FORMATTER)
    console_handler.setLevel(level)

    # Add handlers to logger
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger

# Setup application logger
app_logger = setup_logger('app', 'app.log')

# Setup video creation logger
video_logger = setup_logger('video_creation', 'video_creation.log')

def get_app_logger():
    """Get the application logger"""
    return app_logger

def get_video_logger():
    """Get the video creation logger"""
    return video_logger

def configure_root_logger():
    """Configure the root logger to use app.log"""
    # Configure root logger with a separate file handler
    root_handler = logging.handlers.RotatingFileHandler(
        os.path.join(LOG_DIR, 'app.log'),
        maxBytes=10*1024*1024,
        backupCount=5
    )
    root_handler.setFormatter(FORMATTER)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(FORMATTER)

    # This ensures consistency if other modules just call logging.info etc.
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(name)s - %(message)s',
        handlers=[root_handler, console_handler]
    )
