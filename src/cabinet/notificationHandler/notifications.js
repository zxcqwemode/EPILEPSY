const db = require('../../config/db');
const cron = require('node-cron');

// Функция для отправки уведомления
async function sendNotification(bot, chatId, message) {
    await bot.sendMessage(chatId, message);
}

// Функция для планирования уведомлений
async function scheduleNotifications(bot) {
    // Запрашиваем всех пользователей из базы данных
    const users = await db.query(
        'SELECT chat_id, language, notification_text, notification_hour_msk FROM users WHERE notification_hour_msk IS NOT NULL'
    );

    users.rows.forEach(user => {
        const { chat_id, language, notification_text, notification_hour_msk } = user;

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

        // Рассчитываем время для cron на основе notification_hour_msk
        const userHour = notification_hour_msk; // Используем notification_hour_msk
        const cronTime = `0 ${userHour} * * *`; // Каждый день в указанное время

        // Запускаем задачу cron на определенное время каждый день
        cron.schedule(cronTime, async () => {
            await sendNotification(bot, chat_id, message);
        });

        console.log(`Уведомление запланировано для ${chat_id} на ${userHour}:00 по МСК.`);
    });
}

// Экспортируем функцию для вызова из других модулей
module.exports = scheduleNotifications;
