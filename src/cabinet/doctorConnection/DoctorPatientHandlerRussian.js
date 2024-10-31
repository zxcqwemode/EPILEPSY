const db = require('../../config/db');

class DoctorPatientHandlerRussian {
    constructor(bot) {
        this.bot = bot;
        this.waitingForKey = new Set();
        this.waitingForName = new Set();
        this.waitingForMessage = new Set();
        this.waitingForAttachment = new Set(); // Для ожидания прикрепления файла
        this.messageBuffer = new Map(); // Буфер для хранения составных сообщений

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
        const messages = await db.query(`
            SELECT m.*, u.name 
            FROM messages m 
            JOIN users u ON m.user_id = u.chat_id 
            WHERE user_id = $1 
            ORDER BY message_date DESC
        `, [chatId]);

        let messageText = "";
        if (messages.rows.length > 0) {
            messageText = "История переписки:\n\n";
            for (const msg of messages.rows) {
                messageText += `${msg.name} (${new Date(msg.message_date).toLocaleString()}):\n`;
                if (msg.message_text) {
                    messageText += `${msg.message_text}\n`;
                }
                if (msg.file_id) {
                    const fileTypeText = msg.file_type === 'photo' ? 'Фото' : 'Файл';
                    messageText += `[Прикреплён ${fileTypeText}]\n`;
                }
                messageText += '\n';
            }
        } else {
            messageText = "У вас нет сообщений.";
        }

        await this.bot.sendMessage(chatId, messageText, {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Назад', callback_data: 'doctor_connection'}]
                ]
            }
        });
    }


    getFileTypeText(fileType) {
        switch (fileType) {
            case 'photo':
                return 'фото';
            case 'document':
                return 'файл';
            default:
                return 'файл';
        }
    }

    async handleSendMessageRussian(chatId) {
        this.waitingForMessage.add(chatId);
        this.waitingForAttachment.add(chatId);

        this.messageBuffer.set(chatId, {
            text: null,
            files: []
        });

        await this.bot.sendMessage(chatId,
            "Напишите ваше сообщение и/или отправьте файл/фото.\n" +
            "Вы можете:\n" +
            "1. Отправить только текст\n" +
            "2. Отправить только файл/фото\n" +
            "3. Отправить текст и затем файл/фото\n" +
            "Можно прикрепить несколько файлов.\n" +
            "После отправки всего необходимого, нажмите 'Завершить':", {
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Завершить', callback_data: 'finish_message'}],
                        [{text: 'Отменить', callback_data: 'doctor_connection'}]
                    ]
                }
            });
    }


    async handleMessageInputRussian(chatId, messageText, fileId = null, fileType = null) {
        if (!this.waitingForMessage.has(chatId) && !this.waitingForAttachment.has(chatId)) return;

        let messageBuffer = this.messageBuffer.get(chatId) || { text: null, files: [] };

        if (messageText) {
            messageBuffer.text = messageText;
        }

        if (fileId && fileType) {
            messageBuffer.files.push({ fileId, fileType });
        }

        this.messageBuffer.set(chatId, messageBuffer);

        if (fileId) {
            const fileTypeText = fileType === 'photo' ? 'Фото' : 'Файл';
            await this.bot.sendMessage(chatId, `${fileTypeText} успешно прикреплен. Можете прикрепить еще или нажать "Завершить"`);
        }
    }

    async handleFinishMessageRussian(chatId) {
        const messageBuffer = this.messageBuffer.get(chatId);
        if (!messageBuffer) return;

        const userResult = await db.query('SELECT doctor_key, name FROM users WHERE chat_id = $1', [chatId]);
        if (userResult.rows.length > 0) {
            const {doctor_key, name} = userResult.rows[0];

            const doctorResult = await db.query('SELECT chat_id FROM doctors WHERE doctor_key = $1', [doctor_key]);
            const doctorChatId = doctorResult.rows[0]?.chat_id;

            if (doctorChatId) {
                if (messageBuffer.text) {
                    await db.query(
                        'INSERT INTO messages (user_id, doctor_key, message_text, message_date) VALUES ($1, $2, $3, NOW())',
                        [chatId, doctor_key, messageBuffer.text]
                    );
                    await this.bot.sendMessage(doctorChatId, `Сообщение от ${name}:\n${messageBuffer.text}`);
                }

                for (const file of messageBuffer.files) {
                    await db.query(
                        'INSERT INTO messages (user_id, doctor_key, file_id, file_type, message_date) VALUES ($1, $2, $3, $4, NOW())',
                        [chatId, doctor_key, file.fileId, file.fileType]
                    );

                    const caption = `${file.fileType === 'photo' ? 'Фото' : 'Файл'} от ${name}`;

                    if (file.fileType === 'photo') {
                        await this.bot.sendPhoto(doctorChatId, file.fileId, { caption });
                    } else {
                        await this.bot.sendDocument(doctorChatId, file.fileId, { caption });
                    }
                }
            }
        }
        this.messageBuffer.delete(chatId);
        this.waitingForMessage.delete(chatId);
        this.waitingForAttachment.delete(chatId);

        await this.bot.sendMessage(chatId, "Сообщение отправлено", {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Написать еще', callback_data: 'send_message'}],
                    [{text: 'Назад', callback_data: 'doctor_connection'}]
                ]
            }
        });
    }

    async handleChangeDoctorRussian(chatId) {
        await db.query('UPDATE users SET doctor_key = NULL, key_valid = FALSE WHERE chat_id = $1', [chatId]);
        await this.requestDoctorKeyRussian(chatId);
    }

    async handleMessageRussian(msg) {
        const chatId = msg.chat.id;
        const messageText = msg.text;

        if (this.isWaitingForInputRussian(chatId)) {
            if (messageText === '/start' || messageText === '/myProfile') {
                return;
            }
        }

        if (this.waitingForKey.has(chatId)) {
            await this.handleKeyInputRussian(chatId, messageText);
        } else if (this.waitingForName.has(chatId)) {
            await this.handleNameInputRussian(chatId, messageText);
        } else if (this.waitingForMessage.has(chatId) || this.waitingForAttachment.has(chatId)) {
            if (messageText) {
                await this.handleMessageInputRussian(chatId, messageText);
            }

            if (msg.photo) {
                const fileId = msg.photo[msg.photo.length - 1].file_id;
                await this.handleMessageInputRussian(chatId, null, fileId, 'photo');
            }

            if (msg.document) {
                await this.handleMessageInputRussian(chatId, null, msg.document.file_id, 'document');
            }
        }
    }

    isWaitingForInputRussian(chatId) {
        return this.waitingForKey.has(chatId) ||
            this.waitingForName.has(chatId) ||
            this.waitingForMessage.has(chatId) ||
            this.waitingForAttachment.has(chatId);
    }

    async handleCallbackRussian(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;

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
            case 'finish_message':
                await this.handleFinishMessageRussian(chatId);
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