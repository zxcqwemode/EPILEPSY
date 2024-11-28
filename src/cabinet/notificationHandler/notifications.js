const cron = require('node-cron');
const db = require('../../config/db');
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN);

async function sendNotifications() {
    try {
        // Получаем текущее время в Московском часовом поясе (только часы)
        const mskHour = new Date().toLocaleTimeString('ru-RU', {
            timeZone: 'Europe/Moscow',
            hour: '2-digit',
        });

        // SQL-запрос для получения всех уведомлений с часовым поясом и языком пользователя
        const query = `
            SELECT n.*, u.timezone_gmt, u.language 
            FROM notifications n
            JOIN users u ON n.user_id = u.chat_id
        `;

        const result = await db.query(query);

        // Фильтруем уведомления, которые должны отправляться в 00 часов МСК
        const notificationsToSend = result.rows.filter((notification) => {
            const userTimeInHours = parseInt(notification.notification_time.split(':')[0], 10);
            const timezoneGmt = notification.timezone_gmt;

            // Переводим пользовательское время в МСК
            const mskNotificationHour = (userTimeInHours - timezoneGmt + 3 + 24) % 24;
            return mskNotificationHour === parseInt(mskHour, 10);
        });

        // Отправляем уведомления каждому пользователю
        for (const notification of notificationsToSend) {
            // Формируем текст уведомления на соответствующем языке
            let messageText;
            if (notification.language === 'Русский') {
                messageText = `Привет, это EpilepsyBot, пишу напомнить тебе принять препарат ${notification.medication}, доза ${notification.dose}`;
            } else if (notification.language === 'English') {
                messageText = `Hello, this is EpilepsyBot reminding you to take your medication ${notification.medication}, dose ${notification.dose}`;
            } else {
                // Если язык не указан, можно задать дефолтный язык, например, русский
                messageText = `Привет, это EpilepsyBot, пишу напомнить тебе принять препарат ${notification.medication}, доза ${notification.dose}`;
            }

            try {
                await bot.sendMessage(notification.user_id, messageText);
            } catch (sendError) {
                console.error(`Ошибка отправки уведомления пользователю ${notification.user_id}:`, sendError);
            }
        }
    } catch (error) {
        console.error('Ошибка при отправке уведомлений:', error);
    }
}

// Запускаем крон каждый час для проверки уведомлений
cron.schedule('0 * * * *', sendNotifications);

module.exports = sendNotifications;
