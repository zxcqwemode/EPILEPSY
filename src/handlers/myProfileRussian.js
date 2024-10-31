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
Добро пожаловать в ваш личный кабинет!
Ваш профиль:
- ID: ${chat_id}
- Пол: ${gender || 'Не указан'}
- Часовой пояс (GMT): ${timezone_gmt}
- Период уведомлений: ${notification_period || 'Не указан'}
- Час уведомлений: ${notification_hour_msk+timezone_gmt-3 || 'Не указан'}
        `;

        // Определяем кнопки для личного кабинета
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Информация о заболевании', callback_data: 'info_about_disease' },
                        { text: 'Уведомления', callback_data: 'notifications' },
                    ],
                    [
                        { text: 'Календарь приступов', callback_data: 'seizure_calendar' },
                        { text: 'Приступ', callback_data: 'start_timer_seizure' },
                    ],
                    [
                        { text: 'Связь с врачом', callback_data: 'doctor_connection' },
                    ],
                ],
            },
        };

        // Отправка профиля пользователю с возможностью последующего удаления
        await bot.sendMessage(chatId, profileMessage, options);


    } catch (err) {
        console.error('Ошибка при обработке команды myProfileRussian:', err);
        await bot.sendMessage(chatId, 'Произошла ошибка при получении профиля. Попробуйте позже.');
    }
};