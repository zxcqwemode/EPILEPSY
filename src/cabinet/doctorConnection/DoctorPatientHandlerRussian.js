const db = require('../../config/db');

class DoctorPatientHandlerRussian {
    constructor(bot) {
        this.bot = bot;
        this.waitingForKey = new Set(); // Ожидание первичного ввода ключа
        this.waitingForName = new Set(); // Ожидание ввода имени
        this.waitingForMessage = new Set(); // Ожидание ввода сообщения
    }

    async handleDoctorConnectionRussian(chatId) {
        const userResult = await db.query('SELECT doctor_key, key_valid, name FROM users WHERE chat_id = $1', [chatId]);
        const user = userResult.rows[0];

        if (user && user.key_valid) {
            await this.showDoctorMenuRussian(chatId);
        } else {
            await this.requestDoctorKeyRussian(chatId);
        }
    }

    async showDoctorMenuRussian(chatId) {
        await this.bot.sendMessage(chatId, "Выберите действие:", {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'История сообщений', callback_data: 'view_messages'}],
                    [{text: 'Написать сообщение', callback_data: 'send_message'}],
                    [{text: 'Сменить врача', callback_data: 'change_doctor'}],
                    [{text: 'Назад в профиль', callback_data: 'back_to_profile'}]
                ]
            }
        });
    }

    async requestDoctorKeyRussian(chatId) {
        this.waitingForKey.add(chatId);
        await this.bot.sendMessage(chatId, "Введите ключ от врача:");
    }

    async showInvalidKeyMenuRussian(chatId) {
        this.waitingForKey.delete(chatId);
        await this.bot.sendMessage(chatId, "Неверный ключ.", {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Ввести ключ', callback_data: 'retry_key'}],
                    [{text: 'Назад в профиль', callback_data: 'back_to_profile'}]
                ]
            }
        });
    }

    async handleKeyInputRussian(chatId, messageText) {
        if (!this.waitingForKey.has(chatId)) return;

        const doctorResult = await db.query('SELECT * FROM doctors WHERE doctor_key = $1', [messageText]);

        if (doctorResult.rows.length > 0) {
            this.waitingForKey.delete(chatId);
            this.waitingForName.add(chatId);
            await db.query('UPDATE users SET doctor_key = $1, key_valid = TRUE WHERE chat_id = $2', [messageText, chatId]);
            await this.bot.sendMessage(chatId, "Ключ верный! Пожалуйста, введите ваше имя:");
        } else {
            await this.showInvalidKeyMenuRussian(chatId);
        }
    }

    async handleNameInputRussian(chatId, messageText) {
        if (!this.waitingForName.has(chatId)) return;

        this.waitingForName.delete(chatId);
        await db.query('UPDATE users SET name = $1 WHERE chat_id = $2', [messageText, chatId]);
        await this.showDoctorMenuRussian(chatId);
    }

    async handleViewMessagesRussian(chatId) {
        const messages = await db.query('SELECT m.*, u.name FROM messages m JOIN users u ON m.user_id = u.chat_id WHERE user_id = $1 ORDER BY message_date DESC', [chatId]);

        let messageText = messages.rows.length > 0
            ? "История переписки:\n\n" + messages.rows.map(msg =>
            `${msg.name} (${new Date(msg.message_date).toLocaleString()}):\n${msg.message_text}\n`
        ).join('\n')
            : "У вас нет сообщений.";

        await this.bot.sendMessage(chatId, messageText, {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Назад', callback_data: 'doctor_connection'}]
                ]
            }
        });
    }

    async handleSendMessageRussian(chatId) {
        this.waitingForMessage.add(chatId);

        const sentMessage = await this.bot.sendMessage(chatId, "Напишите ваше сообщение:", {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Отменить', callback_data: 'doctor_connection'}]
                ]
            }
        });

        // Сохраняем ID последнего сообщения, чтобы потом удалить кнопку "Отменить"
        this.lastSentMessageId = sentMessage.message_id;
    }


    async handleMessageInputRussian(chatId, messageText) {
        if (!this.waitingForMessage.has(chatId)) return;

        const userResult = await db.query('SELECT doctor_key, name FROM users WHERE chat_id = $1', [chatId]);
        if (userResult.rows.length > 0) {
            const {doctor_key, name} = userResult.rows[0];

            await db.query(
                'INSERT INTO messages (user_id, doctor_key, message_text, message_date) VALUES ($1, $2, $3, NOW())',
                [chatId, doctor_key, messageText]
            );

            const doctorResult = await db.query('SELECT chat_id FROM doctors WHERE doctor_key = $1', [doctor_key]);
            if (doctorResult.rows.length > 0) {
                const doctorChatId = doctorResult.rows[0].chat_id;
                await this.bot.sendMessage(doctorChatId, `Сообщение от ${name}:\n${messageText}`);
            }

            // Удаляем клавиатуру с кнопкой "Отменить"
            try {
                await this.bot.editMessageReplyMarkup(
                    {inline_keyboard: []},
                    {
                        chat_id: chatId,
                        message_id: this.lastSentMessageId // ID сообщения с кнопкой "Отменить"
                    }
                );
            } catch (error) {
                if (!error.message.includes('message is not modified')) {
                    console.error('Error removing cancel button:', error);
                }
            }

            this.waitingForMessage.delete(chatId);
            await this.bot.sendMessage(chatId, "Сообщение отправлено", {
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Написать еще', callback_data: 'send_message'}],
                        [{text: 'Назад', callback_data: 'doctor_connection'}]
                    ]
                }
            });
        }
    }

    async handleChangeDoctorRussian(chatId) {
        await db.query('UPDATE users SET doctor_key = NULL, key_valid = FALSE WHERE chat_id = $1', [chatId]);
        await this.requestDoctorKeyRussian(chatId);
    }

    async handleMessageRussian(msg) {
        const chatId = msg.chat.id;
        const messageText = msg.text;

        // Проверка на блокируемые команды
        if (this.isWaitingForInputRussian(chatId)) {
            if (messageText === '/start' || messageText === '/myProfile') {
                return; // Блокируем команды
            }
        }

        if (this.waitingForKey.has(chatId)) {
            await this.handleKeyInputRussian(chatId, messageText);
        } else if (this.waitingForName.has(chatId)) {
            await this.handleNameInputRussian(chatId, messageText);
        } else if (this.waitingForMessage.has(chatId)) {
            await this.handleMessageInputRussian(chatId, messageText);
        }
    }

    isWaitingForInputRussian(chatId) {
        return this.waitingForKey.has(chatId) ||
            this.waitingForName.has(chatId) ||
            this.waitingForMessage.has(chatId);
    }

    async handleCallbackRussian(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;

        // Удаляем клавиатуру, если callback_data не 'back_to_profile'
        if (data !== 'back_to_profile') {
            try {
                await this.bot.editMessageReplyMarkup(
                    {inline_keyboard: []},
                    {
                        chat_id: chatId,
                        message_id: callbackQuery.message.message_id
                    }
                );
            } catch (error) {
                if (!error.message.includes('message is not modified')) {
                    console.error('Error removing keyboard:', error);
                }
            }
        }

        switch (data) {
            case 'doctor_connection':
                await this.handleDoctorConnectionRussian(chatId);
                break;
            case 'view_messages':
                await this.handleViewMessagesRussian(chatId);
                break;
            case 'send_message':
                await this.handleSendMessageRussian(chatId);
                break;
            case 'change_doctor':
                await this.handleChangeDoctorRussian(chatId);
                break;
            case 'retry_key':
                await this.requestDoctorKeyRussian(chatId);
                break;
        }

        try {
            await this.bot.answerCallbackQuery(callbackQuery.id);
        } catch (error) {
            console.error('Error answering callback query:', error);
        }
    }
}

module.exports = DoctorPatientHandlerRussian;
