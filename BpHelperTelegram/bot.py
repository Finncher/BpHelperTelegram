#!/usr/bin/env python3
"""
BP Helper Telegram Bot
Бот для отслеживания заданий и прогресса в игре через Telegram Web App
"""

import asyncio
import json
import os
from datetime import datetime
from pathlib import Path

from telegram import Update, WebAppInfo
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

# Константы
WEB_APP_URL = "http://localhost:8000"  # Для локального теста
# WEB_APP_URL = "https://your-server.com"  # Для продакшена

DATA_DIR = Path(__file__).parent / "db"
DATA_DIR.mkdir(exist_ok=True)


def get_user_data_path(user_id: int) -> Path:
    """Путь к файлу данных пользователя"""
    return DATA_DIR / f"user_{user_id}.json"


def load_user_data(user_id: int) -> dict:
    """Загрузка данных пользователя"""
    path = get_user_data_path(user_id)
    if path.exists():
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "completed": {},
        "total_bp": 0,
        "vip": False,
        "server_x2": False,
        "counters": {},
        "stats": {}
    }


def save_user_data(user_id: int, data: dict):
    """Сохранение данных пользователя"""
    path = get_user_data_path(user_id)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка команды /start"""
    user = update.effective_user
    
    await update.message.reply_text(
        f"Добро пожаловать, {user.first_name}!\n\n"
        "Нажмите кнопку ниже, чтобы открыть Web App и начать отслеживание заданий.",
        reply_markup={
            "inline_keyboard": [
                [
                    {
                        "text": "Открыть Web App",
                        "web_app": {"url": f"{WEB_APP_URL}"}
                    }
                ],
                [
                    {
                        "text": "Статистика",
                        "callback_data": "stats"
                    },
                    {
                        "text": "Завершить день",
                        "callback_data": "end_day"
                    }
                ],
                [
                    {
                        "text": "Задания",
                        "callback_data": "tasks"
                    }
                ]
            ]
        }
    )


async def stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка команды /stats"""
    user = update.effective_user
    user_data = load_user_data(user.id)
    
    today_bp = calculate_today_bp(user_data)
    
    message = (
        f"Статистика пользователя: {user.first_name}\n\n"
        f"Дата: {user_data.get('date', 'Нет данных')}\n"
        f"Сегодня: {today_bp} BP\n"
        f"Всего: {user_data.get('total_bp', 0)} BP\n"
        f"Завершено заданий: {sum(1 for v in user_data.get('completed', {}).values() if v)}\n"
        f"Онлайн: {user_data.get('counters', {}).get('online', 0)} часов\n"
        f"VIP: {'Да' if user_data.get('vip', False) else 'Нет'}\n"
        f"Сервер x2: {'Да' if user_data.get('server_x2', False) else 'Нет'}"
    )
    
    await update.message.reply_text(message)


async def tasks(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка команды /tasks"""
    user = update.effective_user
    user_data = load_user_data(user.id)
    
    # Подсчёт выполненных заданий
    completed_count = sum(1 for v in user_data.get('completed', {}).values() if v)
    total_count = len(user_data.get('completed', {}))
    
    message = (
        f"Задания пользователя: {user.first_name}\n\n"
        f"Выполнено: {completed_count}/{total_count}\n"
        f"Прогресс: {calculate_today_bp(user_data)} BP"
    )
    
    await update.message.reply_text(message)


async def reset(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка команды /reset"""
    user = update.effective_user
    user_data = load_user_data(user.id)
    
    # Сохраняем текущий прогресс
    if user_data.get('stats') is None:
        user_data['stats'] = {}
    
    user_data['stats'][user_data.get('date', '')] = {
        'bp': calculate_today_bp(user_data),
        'completed': sum(1 for v in user_data.get('completed', {}).values() if v)
    }
    
    # Сбрасываем данные
    user_data['completed'] = {}
    user_data['counters'] = {}
    user_data['date'] = datetime.now().strftime("%Y-%m-%d")
    
    save_user_data(user.id, user_data)
    
    await update.message.reply_text("Данные успешно сброшены!")


async def end_day(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Завершение дня"""
    user = update.effective_user
    user_data = load_user_data(user.id)
    
    # Сохраняем текущий прогресс
    today_bp = calculate_today_bp(user_data)
    
    if user_data.get('stats') is None:
        user_data['stats'] = {}
    
    user_data['stats'][user_data.get('date', '')] = {
        'bp': today_bp,
        'completed': sum(1 for v in user_data.get('completed', {}).values() if v)
    }
    
    # Сбрасываем данные для нового дня
    user_data['completed'] = {}
    user_data['counters'] = {}
    user_data['date'] = datetime.now().strftime("%Y-%m-%d")
    
    save_user_data(user.id, user_data)
    
    await update.callback_query.answer("День успешно завершён!")
    await update.callback_query.edit_message_text(
        f"День завершён!\n\n"
        f"Сегодня заработано: {today_bp} BP\n"
        f"Выполнено заданий: {sum(1 for v in user_data.get('completed', {}).values() if v)}"
    )


async def stats_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка callback для статистики"""
    user = update.effective_user
    user_data = load_user_data(user.id)
    
    today_bp = calculate_today_bp(user_data)
    
    message = (
        f"Статистика пользователя: {user.first_name}\n\n"
        f"Дата: {user_data.get('date', 'Нет данных')}\n"
        f"Сегодня: {today_bp} BP\n"
        f"Всего: {user_data.get('total_bp', 0)} BP\n"
        f"Завершено заданий: {sum(1 for v in user_data.get('completed', {}).values() if v)}\n"
        f"Онлайн: {user_data.get('counters', {}).get('online', 0)} часов\n"
        f"VIP: {'Да' if user_data.get('vip', False) else 'Нет'}\n"
        f"Сервер x2: {'Да' if user_data.get('server_x2', False) else 'Нет'}"
    )
    
    await update.callback_query.answer()
    await update.callback_query.edit_message_text(message)


def calculate_today_bp(user_data: dict) -> int:
    """Расчёт today BP"""
    today_bp = 0
    multiplier = (2 if user_data.get('vip', False) else 1) * (2 if user_data.get('server_x2', False) else 1)
    
    # Загружаем задания
    tasks_path = Path(__file__).parent.parent / "tasks.json"
    if tasks_path.exists():
        with open(tasks_path, 'r', encoding='utf-8') as f:
            tasks = json.load(f)
        
        # Обычные задания
        for task_id, completed in user_data.get('completed', {}).items():
            if completed:
                task = next((t for t in tasks if t.get('id') == task_id or t.get('name') == task_id), None)
                if task:
                    today_bp += task.get('bp', 0) * multiplier
        
        # Счётчики
        for task_id, count in user_data.get('counters', {}).items():
            if count > 0:
                task = next((t for t in tasks if t.get('id') == task_id or t.get('name') == task_id), None)
                if task:
                    today_bp += task.get('bp', 0) * count * multiplier
    
    return today_bp


async def unknown(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка неизвестных команд"""
    await update.message.reply_text("Неизвестная команда. Используйте /start для начала.")


def main():
    """Запуск бота"""
    # Загружаем токен из файла или используем переменную окружения
    bot_token = "8889026001:AAF1KeDrFXKqSCSU5tRe_WxGfN1rUph2GCM"
    
    # Создаем приложение
    application = Application.builder().token(bot_token).build()
    
    # Добавляем обработчики
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("stats", stats))
    application.add_handler(CommandHandler("tasks", tasks))
    application.add_handler(CommandHandler("reset", reset))
    
    application.add_handler(CallbackQueryHandler(stats_callback, pattern="^stats$"))
    application.add_handler(CallbackQueryHandler(end_day, pattern="^end_day$"))
    application.add_handler(CallbackQueryHandler(tasks, pattern="^tasks$"))
    
    application.add_handler(CommandHandler("unknown", unknown))
    
    # Запускаем бота
    print("[OK] Бот запущен...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
