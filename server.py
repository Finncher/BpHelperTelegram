#!/usr/bin/env python3
"""
Flask API Server для BP Helper Telegram Web App
Предоставляет REST API для взаимодействия с Web App
"""

from flask import Flask, request, jsonify
from datetime import datetime
from pathlib import Path
import json

# Константы
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "db"
DATA_DIR.mkdir(exist_ok=True)
TASKS_FILE = BASE_DIR / "tasks.json"

app = Flask(__name__)

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
        "hidden_tasks": [],
        "task_order": [],
        "stats": {
            "first_run": datetime.now().strftime("%Y-%m-%d"),
            "last_run": datetime.now().strftime("%Y-%m-%d"),
            "days_used": 1,
            "total_daily_bp": 0,
            "daily_log": {}
        }
    }


def save_user_data(user_id: int, data: dict):
    """Сохранение данных пользователя"""
    path = get_user_data_path(user_id)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_tasks() -> list:
    """Загрузка заданий из tasks.json"""
    if not TASKS_FILE.exists():
        return []
    try:
        with open(TASKS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"[ERROR] Loading tasks: {e}")
        return []


def calculate_today_bp(user_data: dict) -> int:
    """Расчёт today BP"""
    today_bp = 0
    multiplier = (2 if user_data.get('vip', False) else 1) * (2 if user_data.get('server_x2', False) else 1)
    
    tasks = load_tasks()
    
    # Обычные задания
    for task_id, completed in user_data.get('completed', {}).items():
        if completed:
            task = next((t for t in tasks if t.get('id') == task_id), None)
            if task:
                today_bp += task.get('bp', 0) * multiplier
    
    # Счётчики
    for task_id, count in user_data.get('counters', {}).items():
        if count > 0:
            task = next((t for t in tasks if t.get('id') == task_id), None)
            if task:
                today_bp += task.get('bp', 0) * count * multiplier
    
    return today_bp


def get_task_by_id(task_id: str) -> dict:
    """Получить задание по ID"""
    tasks = load_tasks()
    return next((t for t in tasks if t.get('id') == task_id), None)


@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    """Загрузка всех заданий"""
    try:
        tasks = load_tasks()
        return jsonify(tasks)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/user/<user_id>', methods=['GET'])
def get_user(user_id):
    """Получить данные пользователя"""
    try:
        user_data = load_user_data(user_id)
        return jsonify(user_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/user/<user_id>', methods=['POST', 'PUT'])
def update_user(user_id):
    """Обновить данные пользователя"""
    try:
        user_data = load_user_data(user_id)
        update_data = request.get_json() or {}
        
        # Обновляем данные
        user_data.update(update_data)
        
        # Сохраняем
        save_user_data(user_id, user_data)
        
        # Возвращаем обновленные данные
        return jsonify(user_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/end-day/<user_id>', methods=['POST'])
def end_day(user_id):
    """Завершить день"""
    try:
        user_data = load_user_data(user_id)
        
        # Сохраняем текущий прогресс
        today_bp = calculate_today_bp(user_data)
        
        if user_data.get('stats') is None:
            user_data['stats'] = {
                "first_run": datetime.now().strftime("%Y-%m-%d"),
                "last_run": datetime.now().strftime("%Y-%m-%d"),
                "days_used": 1,
                "total_daily_bp": 0,
                "daily_log": {}
            }
        
        # Логируем сегодняшний результат
        today_str = datetime.now().strftime("%Y-%m-%d")
        user_data['stats']['daily_log'][today_str] = today_bp
        user_data['stats']['total_daily_bp'] += today_bp
        user_data['stats']['days_used'] += 1
        user_data['stats']['last_run'] = today_str
        
        # Сбрасываем данные для нового дня
        user_data['completed'] = {}
        user_data['counters'] = {}
        user_data['date'] = today_str
        
        save_user_data(user_id, user_data)
        
        return jsonify({
            "success": True,
            "today_bp": today_bp,
            "completed": sum(1 for v in user_data.get('completed', {}).values() if v)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/stats/<user_id>', methods=['GET'])
def get_stats(user_id):
    """Получить статистику пользователя"""
    try:
        user_data = load_user_data(user_id)
        today_bp = calculate_today_bp(user_id)
        tasks = load_tasks()
        
        # Подсчет выполненных заданий
        completed_count = sum(1 for v in user_data.get('completed', {}).values() if v)
        
        # Лучший день
        daily_log = user_data.get('stats', {}).get('daily_log', {})
        best_day = max(daily_log.values()) if daily_log else 0
        
        # Среднее в день
        days_used = user_data.get('stats', {}).get('days_used', 1)
        total_daily_bp = user_data.get('stats', {}).get('total_daily_bp', 0)
        avg_daily = total_daily_bp / days_used if days_used > 0 else 0
        
        return jsonify({
            "date": user_data.get('date'),
            "today_bp": today_bp,
            "total_bp": user_data.get('total_bp', 0),
            "completed_count": completed_count,
            "counters": user_data.get('counters', {}),
            "vip": user_data.get('vip', False),
            "server_x2": user_data.get('server_x2', False),
            "stats": {
                "first_run": user_data.get('stats', {}).get('first_run'),
                "last_run": user_data.get('stats', {}).get('last_run'),
                "days_used": days_used,
                "total_daily_bp": total_daily_bp,
                "avg_daily": round(avg_daily, 1),
                "best_day": best_day,
                "daily_log": daily_log
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/timers', methods=['GET'])
def get_timers():
    """Загрузка таймеров"""
    try:
        TIMERS_FILE = BASE_DIR / "timers.json"
        if TIMERS_FILE.exists():
            with open(TIMERS_FILE, 'r', encoding='utf-8') as f:
                return jsonify(json.load(f))
        else:
            # Возврат таймеров по умолчанию
            default_timers = [
                {"id": "timer_email", "name": "📧 Почта", "duration": 600, "custom": False},
                {"id": "timer_truck", "name": "🚛 Дальнобойщик", "duration": 420, "custom": False},
                {"id": "timer_dress", "name": "🐕 Дрессировка", "duration": 900, "custom": False},
                {"id": "timer_tir", "name": "🎯 Тир", "duration": 5400, "custom": False},
                {"id": "timer_rednecks", "name": "🔴 Rednecks", "duration": 7200, "custom": False},
                {"id": "timer_bikers", "name": "🏍️ Байкеры", "duration": 7200, "custom": False},
                {"id": "timer_meet", "name": "🚗 Car meet", "duration": 7200, "custom": False},
                {"id": "timer_merryweather", "name": "🛡️ Merryweather", "duration": 7200, "custom": False}
            ]
            return jsonify(default_timers)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/user/<user_id>/settings', methods=['POST'])
def save_settings(user_id):
    """Сохранение настроек пользователя"""
    try:
        user_data = load_user_data(user_id)
        settings = request.get_json() or {}
        
        # Обновляем настройки (task_order, hidden_tasks)
        if 'task_order' in settings:
            user_data['task_order'] = settings['task_order']
        if 'hidden_tasks' in settings:
            user_data['hidden_tasks'] = settings['hidden_tasks']
        
        save_user_data(user_id, user_data)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/user/<user_id>/reset', methods=['POST'])
def reset_progress(user_id):
    """Сброс прогресса пользователя"""
    try:
        path = get_user_data_path(user_id)
        if path.exists():
            path.unlink()
        
        return jsonify({"success": True, "message": "Progress reset"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/')
def index():
    """Корневой маршрут"""
    return jsonify({"status": "ok", "service": "BP Helper API"})


if __name__ == '__main__':
    print('[OK] Flask API Server running on http://localhost:5000')
    app.run(host='0.0.0.0', port=5000, debug=True)
