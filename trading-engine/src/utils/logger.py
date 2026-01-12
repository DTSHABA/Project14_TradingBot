"""
Structured logging with rotation for the trading engine.
"""
import logging
import os
import sys
import time
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
from datetime import datetime
from pathlib import Path
import gzip
import shutil


class WindowsSafeTimedRotatingFileHandler(TimedRotatingFileHandler):
    """
    TimedRotatingFileHandler that handles Windows file locking issues gracefully.
    
    On Windows, file rotation can fail if the file is still open or locked by another process.
    This handler catches PermissionError and handles it gracefully by:
    1. Closing the file stream before rotation
    2. Retrying rotation with a small delay
    3. Silently continuing if rotation still fails (logs continue to current file)
    """
    
    def rotate(self, source, dest):
        """
        Override rotate to handle Windows file locking issues.
        This is the method that actually renames the file.
        """
        # Close the file stream first to release the lock
        if self.stream:
            self.stream.close()
            self.stream = None
        
        # Try to rename the file with retry logic
        try:
            os.rename(source, dest)
        except (OSError, PermissionError):
            # On Windows, file might still be locked by another process
            # Wait a bit and try again
            time.sleep(0.2)
            try:
                os.rename(source, dest)
            except (OSError, PermissionError):
                # If it still fails, just silently continue
                # The log will continue to be written to the current file
                # This prevents the application from crashing
                pass
    
    def doRollover(self):
        """
        Override doRollover to handle Windows file locking issues.
        """
        # Close stream before rollover
        if self.stream:
            self.stream.close()
            self.stream = None
        
        # Get the time that this sequence started at and make it a TimeTuple
        currentTime = int(time.time())
        dstNow = time.localtime(currentTime)[-1]
        t = self.rolloverAt - self.interval
        if self.utc:
            timeTuple = time.gmtime(t)
        else:
            timeTuple = time.localtime(t)
            dstThen = timeTuple[-1]
            if dstNow != dstThen:
                if dstNow:
                    addend = 3600
                else:
                    addend = -3600
                timeTuple = time.localtime(t + addend)
        
        dfn = self.rotation_filename(self.baseFilename + "." + time.strftime(self.suffix, timeTuple))
        
        # Try to rotate the file, with error handling for Windows
        # Use our custom rotate method which handles Windows file locking
        try:
            if os.path.exists(self.baseFilename):
                self.rotate(self.baseFilename, dfn)
        except Exception:
            # Catch any other exception during rotation
            pass
        
        # Clean up old log files
        if self.backupCount > 0:
            for s in self.getFilesToDelete():
                try:
                    os.remove(s)
                except (OSError, PermissionError):
                    # Ignore errors when deleting old files
                    pass
        
        # Update rollover time
        if self.rolloverAt < currentTime:
            newRolloverAt = self.computeRollover(currentTime)
            while newRolloverAt <= currentTime:
                newRolloverAt = newRolloverAt + self.interval
            self.rolloverAt = newRolloverAt
        
        # Reopen the file
        if not self.delay:
            self.stream = self._open()
    
    def emit(self, record):
        """
        Override emit to handle errors gracefully, including rotation errors.
        """
        try:
            # Try to emit the record
            super().emit(record)
        except (OSError, PermissionError) as e:
            # If we can't write to the log file (e.g., file is locked),
            # or if rotation fails, just silently continue
            # This prevents error messages from cluttering the console
            pass
        except Exception:
            # Catch any other exception during emit (including rotation errors)
            # Silently continue to prevent crashes
            pass
    
    def handleError(self, record):
        """
        Override handleError to suppress error messages on Windows.
        On Windows, file rotation errors are common and we handle them gracefully,
        so we don't need to print error messages to the console.
        """
        # Silently ignore errors - we've already handled them in emit()
        # This prevents "--- Logging error ---" messages from appearing
        pass


def setup_logger(name: str, log_dir: str = "logs", level: int = logging.INFO) -> logging.Logger:
    """
    Configure structured logging with daily rotation.
    
    Args:
        name: Logger name
        log_dir: Directory for log files
        level: Logging level (DEBUG, INFO, WARNING, ERROR)
    
    Returns:
        Configured logger instance
    """
    # Create log directory if it doesn't exist
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)
    
    # Create logger
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Remove existing handlers to avoid duplicates
    logger.handlers.clear()
    
    # Console handler with formatted output
    console_handler = logging.StreamHandler()
    console_handler.setLevel(level)
    console_format = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(console_format)
    logger.addHandler(console_handler)
    
    # File handler with daily rotation (Windows-safe)
    log_file = log_path / f"{name}.log"
    
    # Use Windows-safe handler on Windows, standard handler on other platforms
    if sys.platform == 'win32':
        file_handler = WindowsSafeTimedRotatingFileHandler(
            log_file,
            when='midnight',
            interval=1,
            backupCount=30,  # Keep 30 days
            encoding='utf-8'
        )
    else:
        file_handler = TimedRotatingFileHandler(
            log_file,
            when='midnight',
            interval=1,
            backupCount=30,  # Keep 30 days
            encoding='utf-8'
        )
    
    file_handler.setLevel(level)
    file_format = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_format)
    logger.addHandler(file_handler)
    
    return logger


def rotate_logs(log_dir: str = "logs") -> None:
    """
    Compress log files older than 7 days.
    
    Args:
        log_dir: Directory containing log files
    """
    log_path = Path(log_dir)
    if not log_path.exists():
        return
    
    cutoff_date = datetime.now().timestamp() - (7 * 24 * 60 * 60)  # 7 days ago
    
    for log_file in log_path.glob("*.log*"):
        # Skip already compressed files
        if log_file.suffix == '.gz':
            continue
        
        # Check if file is older than 7 days
        if log_file.stat().st_mtime < cutoff_date:
            # Compress the file
            with open(log_file, 'rb') as f_in:
                compressed_path = log_path / f"{log_file.name}.gz"
                with gzip.open(compressed_path, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
            
            # Remove original file
            log_file.unlink()
            logging.getLogger(__name__).info(f"Compressed and removed old log file: {log_file.name}")












