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
TASKS_FILE = BASE_DIR.parent / "tasks.json"

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
        "stats": {}
    }


def save_user_data(user_id: int, data: dict):
    """Сохранение данных пользователя"""
    path = get_user_data_path(user_id)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def calculate_today_bp(user_data: dict) -> int:
    """Расчёт today BP"""
    today_bp = 0
    multiplier = (2 if user_data.get('vip', False) else 1) * (2 if user_data.get('server_x2', False) else 1)
    
    # Загружаем задания
    if TASKS_FILE.exists():
        with open(TASKS_FILE, 'r', encoding='utf-8') as f:
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
            user_data['stats'] = {}
        
        user_data['stats'][user_data.get('date', '')] = {
            'bp': today_bp,
            'completed': sum(1 for v in user_data.get('completed', {}).values() if v)
        }
        
        # Сбрасываем данные для нового дня
        user_data['completed'] = {}
        user_data['counters'] = {}
        user_data['date'] = datetime.now().strftime("%Y-%m-%d")
        
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
        today_bp = calculate_today_bp(user_data)
        
        return jsonify({
            "date": user_data.get('date'),
            "today_bp": today_bp,
            "total_bp": user_data.get('total_bp', 0),
            "completed_count": sum(1 for v in user_data.get('completed', {}).values() if v),
            "counters": user_data.get('counters', {}),
            "vip": user_data.get('vip', False),
            "server_x2": user_data.get('server_x2', False)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/')
def index():
    """Корневой маршрут"""
    return jsonify({"status": "ok", "service": "BP Helper API"})


if __name__ == '__main__':
    print('[OK] Flask API Server running on http://localhost:5000')
    app.run(host='0.0.0.0', port=5000, debug=True)
