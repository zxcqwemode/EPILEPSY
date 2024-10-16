const db = require('../../config/db');
const cron = require('node-cron');

// Функция для отправки уведомления
async function sendNotification(bot, chatId, message) {
    await bot.sendMessage(chatId, message);
}

// Функция для планирования уведомлений
async function scheduleNotifications(bot) {
    // Запрашиваем всех пользователей из базы данных
    const users = await db.query('SELECT chat_id, notification_hour_gmt, language, notification_text FROM users WHERE notification_hour_gmt IS NOT NULL');

    users.rows.forEach(user => {
        const { chat_id, notification_hour_gmt, language, notification_text } = user;

        // Определяем текст уведомления
        let message;
        if (notification_text && notification_text.trim()) {
            // Если есть текст уведомления, используем его
            message = notification_text;
        } else {
            // В зависимости от языка отправляем соответствующее сообщение
            if (language === 'Русский') {
                message = "Привет, это я - EpilepsyBot! Я пишу напомнить о приеме препаратов.";
            } else if (language === 'English') {
                message = "Hello, I am EpilepsyBot! I'm here to remind you to take your medication.";
            }
        }

        // Запускаем задачу cron на определенное время каждый день
        const cronTime = `0 ${notification_hour_gmt+3} * * *`; // Каждый день в указанное время

        cron.schedule(cronTime, async () => {
            await sendNotification(bot, chat_id, message);
        });

        console.log(`Уведомление запланировано для ${chat_id} на ${notification_hour_gmt}:00 GMT.`);
    });
}

// Экспортируем функцию для вызова из других модулей
module.exports = scheduleNotifications;
