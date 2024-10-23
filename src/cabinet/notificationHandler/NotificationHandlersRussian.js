const db = require('../../config/db');

class NotificationHandlersRussian {
    constructor(bot) {
        this.bot = bot;
    }

    // Обработчик уведомлений
    async handleNotificationsRussian(chatId) {
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
            },
        };
        const sentMessage = await this.bot.sendMessage(chatId, message, options);

        // Добавляем обработчик для удаления кнопок после выбора
        this.bot.once('callback_query', async (query) => {
            await this.bot.editMessageText(message, {
                chat_id: chatId,
                message_id: sentMessage.message_id
            });
            await this.handleCallbackQueryRussian(query);
        });
    }

    // Обработчик изменения текста
    async handleChangeTextRussian(chatId) {
        await this.bot.sendMessage(chatId, "Напишите сообщение, которое я буду отправлять вам каждый день в выбранное вами время.");

        this.bot.once('message', async (msg) => {
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
            const sentMessage = await this.bot.sendMessage(chatId, confirmMessage, options);

            // Обработчик для удаления кнопок после нажатия
            this.bot.once('callback_query', async (query) => {
                if (query.data === 'back_to_profile') {
                    await this.bot.editMessageText(confirmMessage, {
                        chat_id: chatId,
                        message_id: sentMessage.message_id
                    });
                }
            });
        });
    }

    // Обработчик изменения времени
    async handleChangeTimeRussian(chatId) {
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
        const sentMessage = await this.bot.sendMessage(chatId, message, options);

        // Обработчик для удаления кнопок после выбора
        this.bot.once('callback_query', async (query) => {
            await this.bot.editMessageText(message, {
                chat_id: chatId,
                message_id: sentMessage.message_id
            });
            await this.handleSetTimeRussian(chatId, query.data);
        });
    }

    // Обработчик установки времени
    async handleSetTimeRussian(chatId, callbackData) {
        let hoursOptions = [];
        const timeRanges = {
            'time_morning_edit': Array.from({ length: 6 }, (_, i) => i + 6),
            'time_afternoon_edit': Array.from({ length: 6 }, (_, i) => i + 12),
            'time_evening_edit': Array.from({ length: 6 }, (_, i) => i + 18)
        };

        const selectedRange = timeRanges[callbackData];
        if (selectedRange) {
            hoursOptions = this.createTimeButtonsRussian(selectedRange);
        }

        const message = 'Выберите время по вашему местному времени:';
        const hourOptions = {
            reply_markup: {
                inline_keyboard: hoursOptions,
            },
        };
        const sentMessage = await this.bot.sendMessage(chatId, message, hourOptions);

        // Обработчик выбора конкретного часа
        this.bot.once('callback_query', async (query) => {
            await this.bot.editMessageText(message, {
                chat_id: chatId,
                message_id: sentMessage.message_id
            });

            if (query.data.startsWith('hour_') && query.data.endsWith('_edit')) {
                await this.saveSelectedTimeRussian(chatId, query.data);
            }
        });
    }

    // Вспомогательный метод для создания кнопок времени
    createTimeButtonsRussian(hours) {
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
    async saveSelectedTimeRussian(chatId, hourData) {
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
        const sentMessage = await this.bot.sendMessage(chatId, confirmationMessage, options);

        // Обработчик для удаления кнопок возврата
        this.bot.once('callback_query', async (query) => {
            if (query.data === 'back_to_profile') {
                await this.bot.editMessageText(confirmationMessage, {
                    chat_id: chatId,
                    message_id: sentMessage.message_id
                });
            }
        });
    }

    // Обработчик callback запросов
    async handleCallbackQueryRussian(query) {
        const chatId = query.message.chat.id;
        switch (query.data) {
            case 'change_text':
                await this.handleChangeTextRussian(chatId);
                break;
            case 'change_time':
                await this.handleChangeTimeRussian(chatId);
                break;
            case 'back_to_profile':
                // Обработка возврата в профиль
                break;
        }
    }
}

module.exports = NotificationHandlersRussian;