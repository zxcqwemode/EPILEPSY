const db = require('../../config/db');

class NotificationsRussian {
    constructor(bot) {
        this.bot = bot;
        this.timeRanges = {
            morning: Array.from({length: 6}, (_, i) => i + 6), // 6-11
            day: Array.from({length: 6}, (_, i) => i + 12),    // 12-17
            evening: Array.from({length: 6}, (_, i) => i + 18)  // 18-23
        };
        // Add state management for user inputs
        this.pendingNotifications = new Map();
    }

    setupHandlers() {
        this.setupCallbackHandlers(this.bot);
        this.setupMessageHandlers(this.bot);
    }

    async handleNotifications(bot, chatId, messageId) {
        try {
            const notifications = await this.getUserNotifications(chatId);

            // Check number of notifications and create appropriate keyboard
            const keyboard = notifications.length === 0
                ? [
                    [{ text: 'Добавить новое', callback_data: 'add_notification' }],
                    [{ text: '🔙 Назад в профиль', callback_data: 'back_to_profile' }]
                ]
                : notifications.length < 9
                    ? [
                        [
                            { text: 'Добавить новое', callback_data: 'add_notification' },
                            { text: 'Посмотреть список', callback_data: 'view_notifications' }
                        ],
                        [{ text: 'Изменить напоминание', callback_data: 'edit_notifications_select' }],
                        [{ text: '🔙 Назад в профиль', callback_data: 'back_to_profile' }]
                    ]
                    : [
                        [{ text: 'Посмотреть список', callback_data: 'view_notifications' }],
                        [{ text: 'Изменить напоминание', callback_data: 'edit_notifications_select' }],
                        [{ text: '🔙 Назад в профиль', callback_data: 'back_to_profile' }]
                    ];

            const options = {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: { inline_keyboard: keyboard }
            };

            const messageText = notifications.length === 0
                ? 'В настоящий момент у вас: 0 напоминаний.'
                : `В настоящий момент у вас настроено: ${notifications.length} напоминание(й)`;

            await bot.editMessageText(messageText, options);
        } catch (error) {
            console.error('Ошибка при обработке уведомлений:', error);
        }
    }

    async handleViewNotifications(bot, chatId, messageId) {
        try {
            const notifications = await this.getUserNotifications(chatId);

            const notificationsList = notifications.map((notification, index) =>
                `Напоминание ${index + 1}: ${notification.medication}, ${notification.dose} в ${notification.notification_time}`
            ).join('\n');

            const options = {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Назад', callback_data: 'notifications' }]
                    ]
                }
            };

            await bot.editMessageText(notificationsList || 'Нет напоминаний', options);
        } catch (error) {
            console.error('Ошибка при просмотре уведомлений:', error);
        }
    }

    async handleEditNotificationsSelect(bot, chatId, messageId) {
        try {
            const notifications = await this.getUserNotifications(chatId);

            const notificationsKeyboard = notifications.map((notification, index) => [{
                text: `Напоминание ${index + 1}: ${notification.medication}, ${notification.dose} в ${notification.notification_time}`,
                callback_data: `select_notification_${notification.id}`
            }]);

            notificationsKeyboard.push([{ text: '⬅️ Назад', callback_data: 'notifications' }]);

            const options = {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: { inline_keyboard: notificationsKeyboard }
            };

            await bot.editMessageText('Выберите напоминание, которое планируете изменить:', options);
        } catch (error) {
            console.error('Ошибка при выборе уведомлений для редактирования:', error);
        }
    }

    async handleNotificationOptions(bot, chatId, messageId, notificationId) {
        const options = {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Изменить', callback_data: `edit_notification_${notificationId}` },
                        { text: 'Удалить', callback_data: `delete_notification_${notificationId}` }
                    ],
                    [{ text: '⬅️ Назад', callback_data: 'edit_notifications_select' }]
                ]
            }
        };

        await bot.editMessageText('Выберите действие:', options);

        // Дополнительный обработчик для изменения
        bot.on('callback_query', async (callbackQuery) => {
            const data = callbackQuery.data;

            if (data === `edit_notification_${notificationId}`) {
                // Удаляем старое напоминание
                const deleted = await this.deleteNotification(notificationId);

                if (deleted) {
                    // Начинаем сценарий добавления нового напоминания
                    await bot.editMessageText('Напоминание удалено. Давайте создадим новое!', {
                        chat_id: chatId,
                        message_id: messageId,
                    });

                    await this.handleAddNotification(bot, chatId, messageId, 'time');
                } else {
                    await bot.editMessageText('Не удалось удалить напоминание. Попробуйте снова.', {
                        chat_id: chatId,
                        message_id: messageId,
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Назад к напоминаниям', callback_data: 'notifications' }]
                            ]
                        }
                    });
                }
            }
        });
    }


    async deleteNotification(notificationId) {
        try {
            const query = 'DELETE FROM notifications WHERE id = $1';
            await db.query(query, [notificationId]);
            return true;
        } catch (error) {
            console.error('Ошибка при удалении напоминания:', error);
            return false;
        }
    }

    async handleAddNotification(bot, chatId, messageId, step = 'time', dayPeriod = null) {
        let options = {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: [] }
        };

        let messageText = '';

        switch(step) {
            case 'time':
                options.reply_markup.inline_keyboard = [
                    [
                        { text: 'Утро', callback_data: 'notification_time_morning' },
                        { text: 'День', callback_data: 'notification_time_day' },
                        { text: 'Вечер', callback_data: 'notification_time_evening' }
                    ],
                    [{ text: '⬅️ Назад', callback_data: 'notifications' }]
                ];
                messageText = 'На какое время поставить напоминание?';
                break;

            case 'exact_time':
                const timeButtons = this.generateTimeButtons(dayPeriod);
                options.reply_markup.inline_keyboard = [
                    ...timeButtons,
                    [{ text: '⬅️ Назад', callback_data: 'add_notification' }]
                ];
                messageText = 'Выберите точное время:';
                break;

            case 'medication':
                options.reply_markup.inline_keyboard = this.generateMedicationKeyboard();
                messageText = 'Выберите название препарата';
                break;

            case 'dose':
                // Удалить клавиатуру из предыдущего сообщения
                await bot.editMessageReplyMarkup(
                    { inline_keyboard: [] },
                    { chat_id: chatId, message_id: messageId }
                );

                // Отправить сообщение о вводе дозы
                messageText = 'Введите дозу препарата:';
                options.reply_markup.inline_keyboard = [
                    [{ text: '⬅️ Назад к препаратам', callback_data: 'add_notification_medication' }]
                ];
                break;

        }

        await bot.editMessageText(messageText, options);
    }

    generateTimeButtons(dayPeriod) {
        const times = this.timeRanges[dayPeriod];
        const buttons = [];
        let row = [];

        times.forEach(hour => {
            row.push({
                text: `${hour}:00`,
                callback_data: `exact_time_${hour}:00`
            });

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

    generateMedicationKeyboard() {
        const medications = [
            'Вальпроевая кислота', 'Леветирацетам', 'Карбамазепин',
            'Ламотриджин', 'Топирамат', 'Окскарбазепин', 'Зонисамид',
            'Этосуксимид', 'Фенобарбитал', 'Перампанел', 'Лакосамид',
            'Габапентин', 'Прегабалин', 'Вигабатрин', 'Сультиам',
            'Руфинамид', 'Флебамат', 'Фенитоин', 'Клоназепам', 'Бензонал'
        ];

        const keyboard = medications.reduce((result, med, index) => {
            const rowIndex = Math.floor(index / 2);
            if (!result[rowIndex]) result[rowIndex] = [];
            result[rowIndex].push({ text: med, callback_data: `medication_${med}` });
            return result;
        }, []);

        keyboard.push([
            { text: 'Ввести свой вариант', callback_data: 'medication_custom' },
            { text: '⬅️ Назад', callback_data: 'notifications' }
        ]);

        return keyboard;
    }

    async handleMedicationSelection(bot, chatId, messageId, medication) {
        // Store the medication in pending notifications
        this.pendingNotifications.set(chatId, {
            ...this.pendingNotifications.get(chatId),
            medication: medication === 'custom' ? null : medication
        });

        if (medication === 'custom') {
            // Ask user to input custom medication name
            const options = {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⬅️ Назад к списку препаратов', callback_data: 'add_notification_medication' }]
                    ]
                }
            };
            await bot.editMessageText('Введите название препарата:', options);
        } else {
            // Ask for dose
            await this.handleAddNotification(bot, chatId, messageId, 'dose');
        }
    }

    async saveNotification(chatId, time, medication, dose) {
        try {
            // Check if user already has 9 notifications
            const existingNotifications = await this.getUserNotifications(chatId);
            if (existingNotifications.length >= 9) {
                return false; // Prevent adding more than 9 notifications
            }

            const query = `
                INSERT INTO notifications (user_id, notification_time, medication, dose) 
                VALUES ($1, $2, $3, $4)
            `;
            await db.query(query, [chatId, time, medication, dose]);

            // Clear pending notification after saving
            this.pendingNotifications.delete(chatId);

            return true;
        } catch (error) {
            console.error('Error saving notification:', error);
            return false;
        }
    }

    async getUserNotifications(chatId) {
        const query = 'SELECT * FROM notifications WHERE user_id = $1';
        const result = await db.query(query, [chatId]);
        return result.rows;
    }

    async completeNotificationSetup(bot, chatId, messageId) {
        const options = {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Назад к напоминаниям', callback_data: 'notifications' }]
                ]
            }
        };

        await bot.editMessageText('Ваше напоминание установлено!', options);
    }

    setupCallbackHandlers(bot) {
        //bot.removeAllListeners('callback_query');
        bot.on('callback_query', async (callbackQuery) => {
            const chatId = callbackQuery.message.chat.id;
            const messageId = callbackQuery.message.message_id;
            const data = callbackQuery.data;

            if (data.startsWith('notification_time_')) {
                const period = data.replace('notification_time_', '');
                await this.handleAddNotification(bot, chatId, messageId, 'exact_time', period);
            } else if (data.startsWith('exact_time_')) {
                const selectedTime = data.replace('exact_time_', '');
                this.pendingNotifications.set(chatId, {
                    time: selectedTime
                });
                await this.handleAddNotification(bot, chatId, messageId, 'medication');
            } else if (data.startsWith('medication_')) {
                const medication = data.replace('medication_', '');
                await this.handleMedicationSelection(bot, chatId, messageId, medication);
            } else if (data.startsWith('select_notification_')) {
                const notificationId = data.replace('select_notification_', '');
                await this.handleNotificationOptions(bot, chatId, messageId, notificationId);
            } else if (data.startsWith('delete_notification_')) {
                const notificationId = data.replace('delete_notification_', '');
                const deleted = await this.deleteNotification(notificationId);

                if (deleted) {
                    await bot.editMessageText('Напоминание успешно удалено!', {
                        chat_id: chatId,
                        message_id: messageId,
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Назад к напоминаниям', callback_data: 'notifications' }]
                            ]
                        }
                    });
                } else {
                    await bot.editMessageText('Не удалось удалить напоминание. Попробуйте снова.', {
                        chat_id: chatId,
                        message_id: messageId,
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Назад к напоминаниям', callback_data: 'notifications' }]
                            ]
                        }
                    });
                }
            } else {
                switch(data) {
                    case 'notifications':
                        await this.handleNotifications(bot, chatId, messageId);
                        break;
                    case 'add_notification':
                        await this.handleAddNotification(bot, chatId, messageId, 'time');
                        break;
                    case 'add_notification_medication':
                        await this.handleAddNotification(bot, chatId, messageId, 'medication');
                        break;
                    case 'view_notifications':
                        await this.handleViewNotifications(bot, chatId, messageId);
                        break;
                    case 'edit_notifications_select':
                        await this.handleEditNotificationsSelect(bot, chatId, messageId);
                        break;
                }
            }

            await bot.answerCallbackQuery(callbackQuery.id);
        });
    }

    setupMessageHandlers(bot) {

        bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const messageId = msg.message_id;
            const text = msg.text;

            const pendingNotification = this.pendingNotifications.get(chatId);

            if (!pendingNotification) return; // Нет активного сценария для этого пользователя

            // Если пользователь вводит название препарата
            if (pendingNotification.time && !pendingNotification.medication) {
                this.pendingNotifications.set(chatId, {
                    ...pendingNotification,
                    medication: text
                });

                // Удаляем кнопку "Назад" из сообщения
                await bot.editMessageReplyMarkup(
                    { inline_keyboard: [] },
                    { chat_id: chatId, message_id: messageId - 1 }
                );

                // Просим ввести дозу препарата
                await bot.sendMessage(chatId, 'Введите дозу препарата:');
            }
            // Если пользователь вводит дозу препарата
            else if (pendingNotification.time && pendingNotification.medication) {
                // Пытаемся сохранить напоминание
                const saved = await this.saveNotification(
                    chatId,
                    pendingNotification.time,
                    pendingNotification.medication,
                    text
                );

                // Удаляем состояние пользователя, чтобы избежать повторного вызова
                this.pendingNotifications.delete(chatId);

                if (saved) {
                    // Сообщение об успешном сохранении
                    await bot.sendMessage(chatId, 'Ваше напоминание установлено!', {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Назад к напоминаниям', callback_data: 'notifications' }]
                            ]
                        }
                    });
                } else {
                    await bot.sendMessage(chatId, 'Произошла ошибка при сохранении напоминания. Попробуйте еще раз.', {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Назад к напоминаниям', callback_data: 'notifications' }]
                            ]
                        }
                    });
                }
            }
        });
    }



}

module.exports = NotificationsRussian;