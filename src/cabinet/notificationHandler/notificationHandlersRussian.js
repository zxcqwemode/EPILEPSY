const db = require('../../config/db');


module.exports = async function notificationHandlersRussian(bot, chatId, messageId) {
    const message = "Здесь вы можете изменить время или текст уведомления";
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Текст', callback_data: 'change_text' },
                    { text: 'Время', callback_data: 'change_time' },
                ],
                [
                    { text: 'Назад', callback_data: 'back_to_profile' },
                ],
            ],
        }
    };

    // Изменяем существующее сообщение на новое с кнопками
    await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: options.reply_markup
    });

    // Устанавливаем слушатель для обработки нажатий на кнопки
    bot.once('callback_query', async (query) => {
        if (query.data !== 'back_to_profile') {
            await bot.editMessageText(message, {
                chat_id: chatId,
                message_id: messageId
            });
            await handleCallbackQueryRussian(bot, chatId, query.data);
        }
    });
};

// Обработчик callback запросов
async function handleCallbackQueryRussian(bot, chatId, callbackData) {
    switch (callbackData) {
        case 'change_text':
            await handleChangeTextRussian(bot, chatId);
            break;
        case 'change_time':
            await handleChangeTimeRussian(bot, chatId);
            break;
    }
}

// Обработчик изменения текста
async function handleChangeTextRussian(bot, chatId) {
    await bot.sendMessage(chatId, "Напишите сообщение, которое я буду отправлять вам каждый день в выбранное вами время.");

    bot.once('message', async (msg) => {
        const notificationText = msg.text;
        await db.query('UPDATE users SET notification_text = $1 WHERE chat_id = $2', [notificationText, chatId]);

        const confirmMessage = `Отлично, теперь я буду вам присылать вместо стандартного уведомления вот это: "${notificationText}".`;
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Вернуться в профиль', callback_data: 'back_to_profile' }],
                ],
            },
        };
        await bot.sendMessage(chatId, confirmMessage, options);
    });
}

// Обработчик изменения времени
async function handleChangeTimeRussian(bot, chatId) {
    const message = "Когда вам удобно получать уведомления?";
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Утром', callback_data: 'time_morning_edit' },
                    { text: 'Днем', callback_data: 'time_afternoon_edit' },
                    { text: 'Вечером', callback_data: 'time_evening_edit' },
                ],
            ],
        },
    };
    const sentMessage = await bot.sendMessage(chatId, message, options);

    bot.once('callback_query', async (query) => {
        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: sentMessage.message_id
        });
        await handleSetTimeRussian(bot, chatId, query.data);
    });
}

// Обработчик установки времени
async function handleSetTimeRussian(bot, chatId, callbackData) {
    let hoursOptions = [];
    const timeRanges = {
        'time_morning_edit': Array.from({ length: 6 }, (_, i) => i + 6),
        'time_afternoon_edit': Array.from({ length: 6 }, (_, i) => i + 12),
        'time_evening_edit': Array.from({ length: 6 }, (_, i) => i + 18)
    };

    const selectedRange = timeRanges[callbackData];
    if (selectedRange) {
        hoursOptions = createTimeButtonsRussian(selectedRange);
    }

    const message = 'Выберите время по вашему местному времени:';
    const hourOptions = {
        reply_markup: {
            inline_keyboard: hoursOptions,
        },
    };
    const sentMessage = await bot.sendMessage(chatId, message, hourOptions);

    bot.once('callback_query', async (query) => {
        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: sentMessage.message_id
        });

        if (query.data.startsWith('hour_') && query.data.endsWith('_edit')) {
            await saveSelectedTimeRussian(bot, chatId, query.data);
        }
    });
}

// Вспомогательный метод для создания кнопок времени
function createTimeButtonsRussian(hours) {
    const buttons = [];
    let row = [];

    hours.forEach(hour => {
        row.push({ text: `${hour}:00`, callback_data: `hour_${hour}_edit` });
        if (row.length === 3) {
            buttons.push([...row]);
            row = [];
        }
    });

    if (row.length > 0) {
        buttons.push(row);
    }

    return buttons;
}

// Сохранение выбранного времени
async function saveSelectedTimeRussian(bot, chatId, hourData) {
    const hour = parseInt(hourData.split('_')[1]);
    const user = await db.query('SELECT timezone_gmt FROM users WHERE chat_id = $1', [chatId]);
    const timezoneGmt = user.rows[0]?.timezone_gmt || 0;

    const notificationHourGmt = (hour - timezoneGmt + 24) % 24;
    const notificationHourMsk = hour - timezoneGmt + 3;

    await db.query(
        'UPDATE users SET notification_hour_gmt = $1, notification_hour_msk = $2 WHERE chat_id = $3',
        [notificationHourGmt, notificationHourMsk, chatId]
    );

    const confirmationMessage = `Время уведомления обновлено на: ${hour}:00 по вашему времени. Чтобы вернуться в профиль, нажмите на кнопку "Вернуться".`;
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Вернуться', callback_data: 'back_to_profile' }],
            ],
        },
    };
    await bot.sendMessage(chatId, confirmationMessage, options);
}