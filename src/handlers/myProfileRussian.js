const db = require('../config/db');

module.exports = async function callbackMyProfileRussian(bot, msg) {
    const chatId = msg.chat.id;

    try {
        // Запрос к базе данных для получения информации о пользователе
        const user = await db.query('SELECT * FROM users WHERE chat_id = $1', [chatId]);

        if (user.rows.length === 0) {
            await bot.sendMessage(chatId, 'Ошибка! Ваш профиль не найден.');
            return;
        }

        const { chat_id, gender, timezone_gmt, notification_period, notification_hour_msk } = user.rows[0];

        // Формирование сообщения с данными профиля
        const profileMessage = `
Ваш профиль:
- ID: ${chat_id}
- Пол: ${gender || 'Не указан'}
- Часовой пояс (GMT): ${timezone_gmt}
- Период уведомлений: ${notification_period || 'Не указан'}
- Час уведомлений (МСК): ${notification_hour_msk || 'Не указан'}
        `;

        // Отправка профиля пользователю
        await bot.sendMessage(chatId, profileMessage);
    } catch (err) {
        console.error('Ошибка при обработке команды myProfileRussian:', err);
        await bot.sendMessage(chatId, 'Произошла ошибка при получении профиля. Попробуйте позже.');
    }
};
