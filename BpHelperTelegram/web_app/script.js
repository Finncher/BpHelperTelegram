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
    stats: {}
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    // Расширяем Web App на весь экран
    tg.ready();
    tg.expand();

    // Устанавливаем цвета темы из Telegram
    setupTheme();

    // Получаем ID пользователя
    const userId = tg.initDataUnsafe?.user?.id || 'guest';
    document.getElementById('user-name').textContent = `Пользователь: ${userId}`;

    // Загружаем данные пользователя
    await loadUserData(userId);

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
                    stats: {}
                })
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

// Инициализация обработчиков событий
function initEventListeners() {
    // Переключатели VIP и ×2
    document.getElementById('vip-toggle').addEventListener('change', (e) => {
        userData.vip = e.target.checked;
        saveUserData();
        updateUI();
    });

    document.getElementById('x2-toggle').addEventListener('change', (e) => {
        userData.server_x2 = e.target.checked;
        saveUserData();
        updateUI();
    });

    // Онлайн-счётчик
    document.querySelector('.counter-btn.minus').addEventListener('click', () => {
        userData.counters.online = Math.max(0, (userData.counters.online || 0) - 1);
        saveUserData();
        updateUI();
    });

    document.querySelector('.counter-btn.plus').addEventListener('click', () => {
        userData.counters.online = (userData.counters.online || 0) + 1;
        saveUserData();
        updateUI();
    });

    // Кнопки завершения дня и отправки статистики
    document.getElementById('end-day-btn').addEventListener('click', endDay);
    document.getElementById('send-stats-btn').addEventListener('click', sendStats);

    // Вкладки
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
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
                userData = data;
                updateUI();
                tg.showAlert('День успешно завершён! 🌙');
            } else {
                tg.showAlert('Ошибка при завершении дня');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            tg.showAlert('Ошибка при завершении дня');
        }
    }
}

// Отправка статистики
async function sendStats() {
    const userId = tg.initDataUnsafe?.user?.id || 'guest';
    
    try {
        const response = await fetch(`${API_URL}/stats/${userId}`);
        if (response.ok) {
            const stats = await response.json();
            const message = `📊 *Статистика пользователя:*\n\n` +
                          `📅 Дата: ${stats.date || 'Нет данных'}\n` +
                          `💰 Сегодня: ${stats.today_bp || 0} BP\n` +
                          `📊 Всего: ${stats.total_bp || 0} BP\n` +
                          `✅ Завершено заданий: ${stats.completed_count || 0}\n` +
                          `🕒 Онлайн: ${stats.counters?.online || 0} часов\n` +
                          `✅ VIP: ${stats.vip ? 'Да' : 'Нет'}\n` +
                          `✅ Сервер ×2: ${stats.server_x2 ? 'Да' : 'Нет'}`;
            
            tg.showAlert(message);
            
            // Отправка в Telegram (если нужно)
            tg.sendData(JSON.stringify({ type: 'stats', stats }));
        }
    } catch (error) {
        console.error('Ошибка:', error);
        tg.showAlert('Ошибка при получении статистики');
    }
}

// Обновление интерфейса
function updateUI() {
    // Дата
    document.getElementById('current-date').textContent = userData.date || 'Неизвестно';
    
    // Статистика
    const todayBP = calculateTodayBP();
    const multiplier = (userData.vip ? 2 : 1) * (userData.server_x2 ? 2 : 1);
    
    document.getElementById('today-bp').textContent = `${todayBP} BP`;
    document.getElementById('total-bp').textContent = `${userData.total_bp || 0} BP`;
    
    // Переключатели
    document.getElementById('vip-toggle').checked = userData.vip || false;
    document.getElementById('x2-toggle').checked = userData.server_x2 || false;
    
    // Онлайн-счётчик
    document.getElementById('online-count').textContent = userData.counters?.online || 0;
    
    // Рендер заданий
    renderTasks();
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
let tasks = []; // Будет заполнено из tasks.json

async function renderTasks(filter = 'all') {
    // Загружаем задания, если ещё не загружены
    if (tasks.length === 0) {
        try {
            const response = await fetch('tasks.json');
            if (response.ok) {
                tasks = await response.json();
                // Добавляем ID к каждому заданию
                tasks = tasks.map((task, index) => ({ ...task, id: `task_${index}` }));
            }
        } catch (error) {
            console.error('Ошибка загрузки заданий:', error);
            return;
        }
    }
    
    const taskList = document.getElementById('task-list');
    taskList.innerHTML = '';
    
    // Фильтрация заданий
    const filteredTasks = tasks.filter(task => {
        if (filter === 'all') return true;
        return task.type === filter;
    });
    
    // Рендер каждого задания
    for (const task of filteredTasks) {
        const taskItem = document.createElement('div');
        taskItem.className = `task-item ${userData.completed?.[task.id] ? 'completed' : ''}`;
        
        const isCounter = task.counter || task.count;
        const counterValue = userData.counters?.[task.id] || 0;
        const counterMax = task.counter || task.count || 0;
        
        taskItem.innerHTML = `
            <input type="checkbox" class="task-checkbox" 
                   ${userData.completed?.[task.id] ? 'checked' : ''}
                   onchange="toggleTask('${task.id}', this.checked)">
            
            <div class="task-info">
                <div class="task-name">${task.name}</div>
                <div class="task-bp">${task.bp} BP</div>
            </div>
            
            <div class="task-controls">
                ${isCounter ? `
                    <div class="task-counter">
                        <button class="task-counter-btn minus" 
                                onclick="updateCounter('${task.id}', -1)">−</button>
                        <span class="task-counter-value">${counterValue}${counterMax > 0 ? '/' + counterMax : ''}</span>
                        <button class="task-counter-btn plus" 
                                onclick="updateCounter('${task.id}', 1)">+</button>
                    </div>
                ` : ''}
                
                <span class="task-type ${task.type}">${task.type}</span>
            </div>
        `;
        
        taskList.appendChild(taskItem);
    }
}

// Переключение задания
function toggleTask(taskId, completed) {
    if (completed) {
        userData.completed[taskId] = true;
    } else {
        delete userData.completed[taskId];
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
    const maxCount = task?.counter || task?.count || 0;
    
    if (maxCount > 0) {
        newCount = Math.max(0, Math.min(newCount, maxCount));
    } else {
        newCount = Math.max(0, newCount);
    }
    
    userData.counters[taskId] = newCount;
    saveUserData();
    updateUI();
}

// Экспорт функций для глобального доступа
window.toggleTask = toggleTask;
window.updateCounter = updateCounter;

// Отправка данных при закрытии страницы
window.addEventListener('beforeunload', () => {
    saveUserData();
});