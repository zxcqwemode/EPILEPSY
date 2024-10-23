const db = require('../config/db'); // Импортируем базу данных

// Функция для обработки выбранного времени
module.exports = async function handleSetTimeRussian(bot, chatId, callbackData) {
    let hoursOptions = [];

    // Определяем период времени на основе переданного callbackData
    if (callbackData === 'time_morning_edit') {
        hoursOptions = [
            [{ text: '6:00', callback_data: 'hour_6_edit' }, { text: '7:00', callback_data: 'hour_7_edit' }, { text: '8:00', callback_data: 'hour_8_edit' }],
            [{ text: '9:00', callback_data: 'hour_9_edit' }, { text: '10:00', callback_data: 'hour_10_edit' }, { text: '11:00', callback_data: 'hour_11_edit' }]
        ];
    } else if (callbackData === 'time_afternoon_edit') {
        hoursOptions = [
            [{ text: '12:00', callback_data: 'hour_12_edit' }, { text: '13:00', callback_data: 'hour_13_edit' }, { text: '14:00', callback_data: 'hour_14_edit' }],
            [{ text: '15:00', callback_data: 'hour_15_edit' }, { text: '16:00', callback_data: 'hour_16_edit' }, { text: '17:00', callback_data: 'hour_17_edit' }]
        ];
    } else if (callbackData === 'time_evening_edit') {
        hoursOptions = [
            [{ text: '18:00', callback_data: 'hour_18_edit' }, { text: '19:00', callback_data: 'hour_19_edit' }, { text: '20:00', callback_data: 'hour_20_edit' }],
            [{ text: '21:00', callback_data: 'hour_21_edit' }, { text: '22:00', callback_data: 'hour_22_edit' }, { text: '23:00', callback_data: 'hour_23_edit' }]
        ];
    }

    const hourOptions = {
        reply_markup: {
            inline_keyboard: hoursOptions,
        },
    };

    await bot.sendMessage(chatId, 'Выберите время по вашему местному времени:', hourOptions);

    // Обработчик для выбора часа
    bot.once('callback_query', async (callbackQuery) => {
        const hourData = callbackQuery.data;
        if (hourData.startsWith('hour_') && hourData.endsWith('_edit')) {
            const hour = parseInt(hourData.split('_')[1]); // Получаем выбранный час

            // Получаем timezone_gmt из базы данных
            const user = await db.query('SELECT timezone_gmt FROM users WHERE chat_id = $1', [chatId]);
            const timezoneGmt = user.rows[0]?.timezone_gmt || 0; // Убедимся, что значение существует, если нет — ставим 0

            // Рассчитываем значения для notification_hour_gmt и notification_hour_msk
            const notificationHourGmt = (hour - timezoneGmt + 24) % 24; // Приводим к 24-часовому формату для GMT
            const notificationHourMsk = hour - timezoneGmt + 3; // МСК = GMT + 3

            // Сохраняем новое время в базе данных
            await db.query('UPDATE users SET notification_hour_gmt = $1, notification_hour_msk = $2 WHERE chat_id = $3', [notificationHourGmt, notificationHourMsk, chatId]);

            // Отправляем сообщение с подтверждением
            const confirmationMessage = `Время уведомления обновлено на: ${notificationHourMsk+timezoneGmt-3}:00 по вашему времени. Чтобы вернуться в профиль, нажмите на кнопку "Вернуться".`;

            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Вернуться', callback_data: 'back_to_profile' }],
                    ],
                },
            };

            await bot.sendMessage(chatId, confirmationMessage, options);
        }
    });
};
