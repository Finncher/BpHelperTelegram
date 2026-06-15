// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;

// Настройки
const API_URL = 'http://localhost:5000/api'; // Для локального теста
// const API_URL = 'https://your-server.com/api'; // Для продакшена

// Состояние приложения
let userData = {
    date: new Date().toISOString().split('T')[0],
    completed: {},
    total_bp: 0,
    vip: false,
    server_x2: false,
    counters: {},
    hidden_tasks: [],
    task_order: [],
    stats: {}
};

let tasks = []; // Будет заполнено из tasks.json
let timers = []; // Будет заполнено из API

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    // Расширяем Web App на весь экран
    tg.ready();
    tg.expand();

    // Устанавливаем цвета темы из Telegram
    setupTheme();

    // Получаем ID пользователя
    const userId = tg.initDataUnsafe?.user?.id || 'guest';
    
    // Загружаем данные пользователя и задания
    await Promise.all([
        loadUserData(userId),
        loadTasks(),
        loadTimers()
    ]);

    // Инициализируем обработчики событий
    initEventListeners();

    // Обновляем интерфейс
    updateUI();
});

// Настройка темы из Telegram
function setupTheme() {
    const themeParams = tg.themeParams;
    
    if (themeParams) {
        // Используем цвета Telegram, если доступны
        if (themeParams.bg_color) {
            document.documentElement.style.setProperty('--bg-primary', themeParams.bg_color);
        }
        if (themeParams.text_color) {
            document.documentElement.style.setProperty('--text-primary', themeParams.text_color);
        }
    }
}

// Загрузка данных пользователя
async function loadUserData(userId) {
    try {
        const response = await fetch(`${API_URL}/user/${userId}`);
        if (response.ok) {
            const data = await response.json();
            userData = data;
        } else {
            // Если пользователь новый, создаем запись
            await fetch(`${API_URL}/user/${userId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: new Date().toISOString().split('T')[0],
                    completed: {},
                    total_bp: 0,
                    vip: false,
                    server_x2: false,
                    counters: {},
                    hidden_tasks: [],
                    task_order: [],
                    stats: {
                        first_run: new Date().toISOString().split('T')[0],
                        last_run: new Date().toISOString().split('T')[0],
                        days_used: 1,
                        total_daily_bp: 0,
                        daily_log: {}
                    }
                })
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

// Загрузка заданий
async function loadTasks() {
    try {
        const response = await fetch(`${API_URL}/tasks`);
        if (response.ok) {
            tasks = await response.json();
        }
    } catch (error) {
        console.error('Ошибка загрузки заданий:', error);
    }
}

// Загрузка таймеров
async function loadTimers() {
    try {
        const response = await fetch(`${API_URL}/timers`);
        if (response.ok) {
            timers = await response.json();
        }
    } catch (error) {
        console.error('Ошибка загрузки таймеров:', error);
    }
}

// Инициализация обработчиков событий
function initEventListeners() {
    // Переключатели VIP и ×2
    const vipToggle = document.getElementById('vip-toggle');
    const x2Toggle = document.getElementById('x2-toggle');
    
    if (vipToggle) {
        vipToggle.addEventListener('change', (e) => {
            userData.vip = e.target.checked;
            saveUserData();
            updateUI();
        });
    }

    if (x2Toggle) {
        x2Toggle.addEventListener('change', (e) => {
            userData.server_x2 = e.target.checked;
            saveUserData();
            updateUI();
        });
    }

    // Кнопки завершения дня и сброса
    const endDayBtn = document.getElementById('end-day-btn');
    const resetBtn = document.getElementById('reset-btn');
    
    if (endDayBtn) {
        endDayBtn.addEventListener('click', endDay);
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', resetProgress);
    }

    // Вкладки
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const filter = btn.dataset.tab;
            renderTasks(filter);
        });
    });
}

// Сохранение данных пользователя
async function saveUserData() {
    try {
        const userId = tg.initDataUnsafe?.user?.id || 'guest';
        await fetch(`${API_URL}/user/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
    } catch (error) {
        console.error('Ошибка сохранения данных:', error);
    }
}

// Обработка завершения дня
async function endDay() {
    const userId = tg.initDataUnsafe?.user?.id || 'guest';
    
    if (confirm('⚠️ Вы уверены, что хотите завершить день? Весь прогресс будет сохранён.')) {
        try {
            const response = await fetch(`${API_URL}/end-day/${userId}`, {
                method: 'POST'
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // Обновляем данные
                userData.completed = {};
                userData.counters = {};
                userData.date = new Date().toISOString().split('T')[0];
                
                updateUI();
                tg.showAlert(`День успешно завершён! 🌙\nСегодня заработано: ${data.today_bp} BP`);
            } else {
                tg.showAlert('Ошибка при завершении дня');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            tg.showAlert('Ошибка при завершении дня');
        }
    }
}

// Сброс прогресса
async function resetProgress() {
    const userId = tg.initDataUnsafe?.user?.id || 'guest';
    
    if (confirm('⚠️ Вы уверены, что хотите сбросить весь прогресс? Это действие нельзя отменить.')) {
        try {
            await fetch(`${API_URL}/user/${userId}/reset`, {
                method: 'POST'
            });
            
            // Перезагружаем страницу
            location.reload();
        } catch (error) {
            console.error('Ошибка:', error);
            tg.showAlert('Ошибка при сбросе прогресса');
        }
    }
}

// Обновление интерфейса
function updateUI() {
    // Дата
    document.getElementById('current-date')?.textContent = userData.date || 'Неизвестно';
    
    // Статистика
    const todayBP = calculateTodayBP();
    const multiplier = (userData.vip ? 2 : 1) * (userData.server_x2 ? 2 : 1);
    
    document.getElementById('today-bp')?.textContent = todayBP;
    document.getElementById('total-bp')?.textContent = userData.total_bp || 0;
    
    // Обновляем тумблеры
    document.getElementById('vip-toggle')?.setAttribute('checked', userData.vip);
    document.getElementById('x2-toggle')?.setAttribute('checked', userData.server_x2);
    
    // Обновляем онлайн-счётчик
    updateOnlineCounter();
    
    // Рендер заданий
    renderTasks();
    
    // Рендер таймеров
    renderTimers();
}

// Обновление он-счётчика
function updateOnlineCounter() {
    const counterLabel = document.getElementById('online-count');
    if (counterLabel) {
        counterLabel.textContent = userData.counters?.online || 0;
    }
}

// Расчёт сегодняшних BP
function calculateTodayBP() {
    let todayBP = 0;
    const multiplier = (userData.vip ? 2 : 1) * (userData.server_x2 ? 2 : 1);
    
    // Обычные задания
    for (const [taskId, completed] of Object.entries(userData.completed || {})) {
        if (completed) {
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                todayBP += task.bp * multiplier;
            }
        }
    }
    
    // Счётчики
    for (const [taskId, count] of Object.entries(userData.counters || {})) {
        if (count > 0) {
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                todayBP += task.bp * count * multiplier;
            }
        }
    }
    
    return todayBP;
}

// Рендер заданий
async function renderTasks(filter = 'solo') {
    // Загружаем задания, если ещё не загружены
    if (tasks.length === 0) {
        await loadTasks();
    }
    
    // Определяем контейнер на основе фильтра
    let containerId;
    switch(filter) {
        case 'solo': containerId = 'solo-tasks'; break;
        case 'pair': containerId = 'pair-tasks'; break;
        case 'faction': containerId = 'faction-tasks'; break;
        default: containerId = 'all-tasks';
    }
    
    const taskList = document.getElementById(containerId);
    if (!taskList) return;
    
    taskList.innerHTML = '';
    
    // Фильтрация заданий
    const filteredTasks = tasks.filter(task => {
        if (filter === 'all') return true;
        return task.type === filter;
    });
    
    // Сортировка по task_order
    const taskOrder = userData.task_order || [];
    filteredTasks.sort((a, b) => {
        const aIndex = taskOrder.indexOf(a.id);
        const bIndex = taskOrder.indexOf(b.id);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
    });
    
    // Рендер каждого задания
    for (const task of filteredTasks) {
        const taskItem = document.createElement('div');
        taskItem.className = `task-item ${userData.completed?.[task.id] ? 'completed' : ''}`;
        
        const isCounter = task.count || task.timer;
        const counterValue = userData.counters?.[task.id] || 0;
        const counterMax = task.count || 0;
        
        // Формируем HTML для задания
        let controlsHTML = '';
        
        if (task.timer) {
            // Таймер
            controlsHTML = `
                <button class="timer-btn" onclick="openTimer('${task.id}', '${task.name}', ${task.timer})">
                    ⏱️ ${task.timer}s
                </button>
            `;
        } else if (isCounter) {
            // Счётчик с +/- 
            controlsHTML = `
                <div class="task-counter">
                    <button class="task-counter-btn minus" onclick="updateCounter('${task.id}', -1)">−</button>
                    <span class="task-counter-value">${counterValue}${counterMax > 0 ? '/' + counterMax : ''}</span>
                    <button class="task-counter-btn plus" onclick="updateCounter('${task.id}', 1)">+</button>
                </div>
            `;
        }
        
        taskItem.innerHTML = `
            <div class="task-info">
                <label class="task-checkbox-wrapper">
                    <input type="checkbox" 
                           ${userData.completed?.[task.id] ? 'checked' : ''}
                           onchange="toggleTask('${task.id}', this.checked)">
                    <span class="checkbox-custom"></span>
                </label>
                
                <div class="task-text">
                    <div class="task-name">${task.name}</div>
                    <div class="task-bp">${task.bp} BP</div>
                </div>
            </div>
            
            <div class="task-controls">
                ${controlsHTML}
                <span class="task-type ${task.type}">${getTaskTypeLabel(task.type)}</span>
            </div>
        `;
        
        taskList.appendChild(taskItem);
    }
}

// Переключение задания
function toggleTask(taskId, completed) {
    if (completed) {
        userData.completed[taskId] = true;
        
        // Если это онлайн-задание, добавляем в счётчик
        if (taskId === 'task_0') {
            userData.counters.online = (userData.counters.online || 0) + 1;
            if (userData.counters.online >= 8) {
                userData.counters.online = 8;
            }
        }
    } else {
        delete userData.completed[taskId];
        
        // Если это онлайн-задание, уменьшаем счётчик
        if (taskId === 'task_0') {
            userData.counters.online = Math.max(0, (userData.counters.online || 0) - 1);
        }
    }
    
    saveUserData();
    updateUI();
}

// Обновление счётчика
function updateCounter(taskId, delta) {
    const currentCount = userData.counters?.[taskId] || 0;
    let newCount = currentCount + delta;
    
    // Ограничиваем счётчик
    const task = tasks.find(t => t.id === taskId);
    const maxCount = task?.count || 0;
    
    if (maxCount > 0) {
        newCount = Math.max(0, Math.min(newCount, maxCount));
    } else {
        newCount = Math.max(0, newCount);
    }
    
    userData.counters[taskId] = newCount;
    
    // Если счётчик достиг max, отмечаем задание как выполненное
    if (maxCount > 0 && newCount >= maxCount) {
        userData.completed[taskId] = true;
    } else {
        delete userData.completed[taskId];
    }
    
    saveUserData();
    updateUI();
}

// Функция для глобального доступа
window.toggleTask = toggleTask;
window.updateCounter = updateCounter;

// Получить метку типа задания
function getTaskTypeLabel(type) {
    const labels = {
        'solo': '👤',
        'pair': '👥',
        'faction': '🏰'
    };
    return labels[type] || type;
}

// Рендер таймеров
function renderTimers() {
    const timersContainer = document.getElementById('timers-list');
    if (!timersContainer) return;
    
    timersContainer.innerHTML = '';
    
    if (timers.length === 0) return;
    
    for (const timer of timers) {
        const timerItem = document.createElement('div');
        timerItem.className = 'timer-item';
        
        timerItem.innerHTML = `
            <div class="timer-info">
                <span class="timer-name">${timer.name}</span>
                <span class="timer-duration">${formatDuration(timer.duration)}</span>
            </div>
            <div class="timer-controls">
                <button class="timer-control-btn start" onclick="startTimer('${timer.id}')">▶</button>
                <button class="timer-control-btn stop" onclick="stopTimer('${timer.id}')">⏹</button>
                <button class="timer-control-btn reset" onclick="resetTimer('${timer.id}')">🔁</button>
            </div>
        `;
        
        timersContainer.appendChild(timerItem);
    }
}

// Форматировать продолжительность
function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
        const hrs = Math.floor(mins / 60);
        const remainingMins = mins % 60;
        return `${hrs}ч ${remainingMins}м`;
    }
    return `${mins}м ${secs}с`;
}

// Запустить таймер
function startTimer(timerId) {
    tg.showAlert(`Таймер "${timerId}" запущен`);
    // Здесь можно добавить логику запуска таймера
}

// Остановить таймер
function stopTimer(timerId) {
    tg.showAlert(`Таймер "${timerId}" остановлен`);
    // Здесь можно добавить логику остановки таймера
}

// Сбросить таймер
function resetTimer(timerId) {
    tg.showAlert(`Таймер "${timerId}" сброшен`);
    // Здесь можно добавить логику сброса таймера
}

// Открыть окно таймера
function openTimer(taskId, taskName, duration) {
    // Здесь можно добавить логику открытия окна таймера
    const timerWindow = document.getElementById('timer-overlay');
    if (timerWindow) {
        document.getElementById('timer-name').textContent = taskName;
        document.getElementById('timer-display').textContent = formatDuration(duration);
        timerWindow.classList.remove('hidden');
    }
}

// Экспорт функций для глобального доступа
window.openTimer = openTimer;
window.startTimer = startTimer;
window.stopTimer = stopTimer;
window.resetTimer = resetTimer;

// Закрыть окно таймера
function closeTimer() {
    const timerWindow = document.getElementById('timer-overlay');
    if (timerWindow) {
        timerWindow.classList.add('hidden');
    }
}
window.closeTimer = closeTimer;

// Добавить обработчик для закрытия окна таймера
document.addEventListener('click', (e) => {
    if (e.target.closest('.timer-overlay') && !e.target.closest('.timer-content')) {
        closeTimer();
    }
});

// Отправка данных при закрытии страницы
window.addEventListener('beforeunload', () => {
    saveUserData();
});
