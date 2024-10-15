const db = require('../config/db'); // Импортируем базу данных

// Функция для обработки уведомлений
module.exports = async function handleNotificationsRussian(bot, chatId) {
    // Отправка сообщения с инструкциями
    const message = "Здесь вы можете изменить текст и время сообщений.";

    // Определяем кнопки для управления уведомлениями
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Назад', callback_data: 'back_to_profile' },
                    { text: 'Изменить уведомление', callback_data: 'change_notification' },
                ],
            ],
        },
    };

    // Отправляем сообщение пользователю
    await bot.sendMessage(chatId, message, options);
};

// Функция для изменения уведомлений
module.exports = async function handleChangeNotificationRussian(bot, chatId) {
    // Сообщение с выбором изменения
    const message = "Выберите, что именно вы желаете изменить:";

    // Определяем кнопки для изменения уведомлений
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Текст', callback_data: 'change_text' },
                    { text: 'Время', callback_data: 'change_time' },
                ],
                [
                    { text: 'Назад', callback_data: 'back_to_notifications' },
                ],
            ],
        },
    };

    // Отправляем сообщение пользователю
    await bot.sendMessage(chatId, message, options);
};

// Функция для изменения времени уведомления
module.exports = async function handleChangeTimeRussian(bot, chatId) {
    const message = "Когда вам удобно получать уведомления?";

    // Определяем кнопки для выбора времени
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Утром', callback_data: 'time_morning' },
                    { text: 'Днем', callback_data: 'time_afternoon' },
                    { text: 'Вечером', callback_data: 'time_evening' },
                ],
            ],
        },
    };

    // Отправляем сообщение пользователю
    await bot.sendMessage(chatId, message, options);
};

// Функция для обработки выбранного времени
module.exports = async function handleSetTimeRussian(bot, chatId, selectedTime) {
    let hoursOptions = [];
    if (selectedTime === 'Утром') {
        hoursOptions = [
            { text: '6:00', callback_data: 'hour_6' },
            { text: '7:00', callback_data: 'hour_7' },
            { text: '8:00', callback_data: 'hour_8' },
            { text: '9:00', callback_data: 'hour_9' },
            { text: '10:00', callback_data: 'hour_10' },
            { text: '11:00', callback_data: 'hour_11' }
        ];
    } else if (selectedTime === 'Днем') {
        hoursOptions = [
            { text: '12:00', callback_data: 'hour_12' },
            { text: '13:00', callback_data: 'hour_13' },
            { text: '14:00', callback_data: 'hour_14' },
            { text: '15:00', callback_data: 'hour_15' },
            { text: '16:00', callback_data: 'hour_16' },
            { text: '17:00', callback_data: 'hour_17' }
        ];
    } else if (selectedTime === 'Вечером') {
        hoursOptions = [
            { text: '18:00', callback_data: 'hour_18' },
            { text: '19:00', callback_data: 'hour_19' },
            { text: '20:00', callback_data: 'hour_20' },
            { text: '21:00', callback_data: 'hour_21' },
            { text: '22:00', callback_data: 'hour_22' },
            { text: '23:00', callback_data: 'hour_23' },
        ];
    }

    // Сообщение с выбором часов
    const hourOptions = {
        reply_markup: {
            inline_keyboard: hoursOptions,
        },
    };

    // Отправляем сообщение пользователю
    await bot.sendMessage(chatId, 'Выберите время:', hourOptions);

    // Обработчик выбора часа
    bot.on('callback_query', async (callbackQuery) => {
        const hourData = callbackQuery.data;
        if (hourData.startsWith('hour_')) {
            const hour = hourData.split('_')[1];
            const notificationHourGmt = parseInt(hour); // Здесь может потребоваться обработка часового пояса

            // Сохраняем новое время в базе данных
            await db.query('UPDATE users SET notification_hour_gmt = $1 WHERE chat_id = $2', [notificationHourGmt, chatId]);
            await bot.sendMessage(chatId, `Время уведомления обновлено на: ${hour}:00 GMT.`);
        }
    });
};
