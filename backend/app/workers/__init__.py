import dramatiq
from dramatiq.brokers.redis import RedisBroker
import os

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_broker = RedisBroker(url=redis_url)
dramatiq.set_broker(redis_broker)

from app.workers.polling import *