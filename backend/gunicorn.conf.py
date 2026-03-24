import os

bind = f"0.0.0.0:{os.environ.get('PORT', '10000')}"
worker_class = "eventlet"
workers = 1
timeout = 120
graceful_timeout = 30
keepalive = 5
accesslog = "-"
errorlog = "-"
