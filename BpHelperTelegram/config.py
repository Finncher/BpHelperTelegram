#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
🎯 Конфигурация Telegram Web App
"""

import os

# ===================== #
# TELEGRAM BOT CONFIG   #
# ===================== #
BOT_TOKEN = "8889026001:AAF1KeDrFXKqSCSU5tRe_WxGfN1rUph2GCM"

# ===================== #
# WEB APP CONFIG        #
# ===================== #
# Для локального теста используйте: http://localhost:8000
# Для продакшена: https://your-domain.com
WEB_APP_URL = "http://localhost:8000/web_app"  # Замените на ваш URL при развертывании

# ===================== #
# PATHS                 #
# ===================== #
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(BASE_DIR)

TASKS_FILE = os.path.join(PARENT_DIR, "tasks.json")
SETTINGS_FILE = os.path.join(PARENT_DIR, "settings.json")
TIMERS_FILE = os.path.join(PARENT_DIR, "timers.json")
SAVE_DIR = os.path.join(BASE_DIR, "db")

# ===================== #
# SETTINGS              #
# ===================== #
DEBUG_MODE = True  # Включить подробное логирование
