const db = require('../../config/db');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class DoctorPatientHandlerRussian {
    constructor(bot) {
        this.bot = bot;
        this.waitingForKey = new Set();
        this.waitingForName = new Set();
        this.waitingForMessage = new Set();
        this.waitingForFile = new Set();
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
                    [{text: 'Отправить сообщение', callback_data: 'choose_message_type'}],
                    [{text: 'Сменить врача', callback_data: 'change_doctor'}],
                    [{text: 'Назад в профиль', callback_data: 'back_to_profile'}]
                ]
            }
        });
    }

    async showMessageTypeChoiceRussian(chatId) {
        await this.bot.sendMessage(chatId, "Выберите тип сообщения:", {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Отправить текстовое сообщение', callback_data: 'send_text_message'}],
                    [{text: 'Отправить файл', callback_data: 'send_file'}],
                    [{text: 'Назад', callback_data: 'doctor_connection'}]
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
        SELECT message_text, message_date, 'Вы' AS sender
        FROM messages
        WHERE user_id = $1
        
        UNION ALL
        
        SELECT message_text, message_date, 'Врач' AS sender
        FROM doctors_messages
        WHERE patient_id = $1
        
        ORDER BY message_date DESC
    `, [chatId]);

        let messageText = "";
        if (messages.rows.length > 0) {
            messageText = "История переписки:\n\n";
            for (const msg of messages.rows) {
                messageText += `${msg.sender} (${new Date(msg.message_date).toLocaleString()}):\n`;
                if (msg.message_text) {
                    messageText += `${msg.message_text}\n`;
                }
                messageText += '\n';
            }
        } else {
            messageText = "У вас нет сообщений.";
        }

        await this.bot.sendMessage(chatId, messageText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Назад', callback_data: 'doctor_connection' }]
                ]
            }
        });
    }


    async handleSendTextMessageRussian(chatId) {
        this.waitingForMessage.add(chatId);
        const message = await this.bot.sendMessage(chatId,
            "Напишите ваше сообщение:", {
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Отменить', callback_data: 'doctor_connection'}]
                    ]
                }
            });
        // Сохраняем ID сообщения для последующего удаления клавиатуры
        this.messageToEdit = message.message_id;
    }

    async handleSendFileRussian(chatId) {
        this.waitingForFile.add(chatId);
        const message = await this.bot.sendMessage(chatId,
            "Отправьте файл (документ, фото, видео и т.д.):", {
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Отменить', callback_data: 'doctor_connection'}]
                    ]
                }
            });
        // Сохраняем ID сообщения для последующего удаления клавиатуры
        this.messageToEdit = message.message_id;
    }

    async saveFile(fileId, originalName) {
        const file = await this.bot.getFile(fileId);
        const filePath = file.file_path;
        const fileUrl = `https://api.telegram.org/file/bot${this.bot.token}/${filePath}`;

        // Создаем уникальное имя файла
        const timestamp = Date.now();
        const fileExtension = path.extname(originalName);
        const fileName = `${timestamp}${fileExtension}`;
        const localFilePath = path.join('public', fileName);

        // Скачиваем файл
        const response = await axios({
            method: 'get',
            url: fileUrl,
            responseType: 'stream'
        });

        // Сохраняем файл
        const writer = fs.createWriteStream(localFilePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve({ fileName, filePath: localFilePath }));
            writer.on('error', reject);
        });
    }

    async handleFileMessageRussian(chatId, msg) {
        if (!this.waitingForFile.has(chatId)) return;

        // Удаляем клавиатуру с кнопкой "Отменить"
        if (this.messageToEdit) {
            try {
                await this.bot.editMessageReplyMarkup(
                    { inline_keyboard: [] },
                    {
                        chat_id: chatId,
                        message_id: this.messageToEdit
                    }
                );
            } catch (error) {
                console.error('Error removing keyboard:', error);
            }
        }

        let fileId, originalName;

        if (msg.document) {
            fileId = msg.document.file_id;
            originalName = msg.document.file_name;
        } else if (msg.photo) {
            fileId = msg.photo[msg.photo.length - 1].file_id;
            originalName = 'photo.jpg';
        } else if (msg.video) {
            fileId = msg.video.file_id;
            originalName = msg.video.file_name || 'video.mp4';
        } else {
            await this.bot.sendMessage(chatId, "Формат файла не поддерживается.");
            return;
        }

        try {
            const userResult = await db.query('SELECT doctor_key, name FROM users WHERE chat_id = $1', [chatId]);
            const { doctor_key, name } = userResult.rows[0];

            const { fileName, filePath } = await this.saveFile(fileId, originalName);

            await db.query(
                'INSERT INTO messages (user_id, doctor_key, message_date, isFile, fileName, filePath, isRead, sender_type) VALUES ($1, $2, NOW(), TRUE, $3, $4, FALSE, $5)',
                [chatId, doctor_key, fileName, filePath, 'patient']
            );

            const doctorResult = await db.query('SELECT chat_id FROM doctors WHERE doctor_key = $1', [doctor_key]);
            const doctorChatId = doctorResult.rows[0]?.chat_id;

            if (doctorChatId) {
                if (msg.document) {
                    await this.bot.sendDocument(doctorChatId, fileId, { caption: `Файл от ${name}` });
                } else if (msg.photo) {
                    await this.bot.sendPhoto(doctorChatId, fileId, { caption: `Фото от ${name}` });
                } else if (msg.video) {
                    await this.bot.sendVideo(doctorChatId, fileId, { caption: `Видео от ${name}` });
                }
            }

            this.waitingForFile.delete(chatId);
            this.messageToEdit = null;
            await this.bot.sendMessage(chatId, "Файл успешно отправлен", {
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Отправить еще', callback_data: 'choose_message_type'}],
                        [{text: 'Назад', callback_data: 'doctor_connection'}]
                    ]
                }
            });
        } catch (error) {
            console.error('Error handling file:', error);
            await this.bot.sendMessage(chatId, "Произошла ошибка при отправке файла. Попробуйте еще раз.");
        }
    }


    async handleTextMessageRussian(chatId, messageText) {
        if (!this.waitingForMessage.has(chatId)) return;

        try {
            // Удаляем клавиатуру с кнопкой "Отменить"
            if (this.messageToEdit) {
                try {
                    await this.bot.editMessageReplyMarkup(
                        { inline_keyboard: [] },
                        {
                            chat_id: chatId,
                            message_id: this.messageToEdit
                        }
                    );
                } catch (error) {
                    console.error('Error removing keyboard:', error);
                }
            }

            const userResult = await db.query('SELECT doctor_key, name FROM users WHERE chat_id = $1', [chatId]);
            const { doctor_key, name } = userResult.rows[0];

            await db.query(
                'INSERT INTO messages (user_id, doctor_key, message_text, message_date, isFile, isRead, sender_type) VALUES ($1, $2, $3, NOW(), FALSE, FALSE, $4)',
                [chatId, doctor_key, messageText, 'patient']
            );

            const doctorResult = await db.query('SELECT chat_id FROM doctors WHERE doctor_key = $1', [doctor_key]);
            const doctorChatId = doctorResult.rows[0]?.chat_id;

            if (doctorChatId) {
                await this.bot.sendMessage(doctorChatId, `Сообщение от ${name}:\n${messageText}`);
            }

            this.waitingForMessage.delete(chatId);
            this.messageToEdit = null;
            await this.bot.sendMessage(chatId, "Сообщение отправлено", {
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Отправить еще', callback_data: 'choose_message_type'}],
                        [{text: 'Назад', callback_data: 'doctor_connection'}]
                    ]
                }
            });
        } catch (error) {
            console.error('Error sending message:', error);
            await this.bot.sendMessage(chatId, "Произошла ошибка при отправке сообщения. Попробуйте еще раз.");
        }
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
        } else if (this.waitingForMessage.has(chatId)) {
            await this.handleTextMessageRussian(chatId, messageText);
        } else if (this.waitingForFile.has(chatId)) {
            await this.handleFileMessageRussian(chatId, msg);
        }
    }

    isWaitingForInputRussian(chatId) {
        return this.waitingForKey.has(chatId) ||
            this.waitingForName.has(chatId) ||
            this.waitingForMessage.has(chatId) ||
            this.waitingForFile.has(chatId);
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
            case 'choose_message_type':
                await this.showMessageTypeChoiceRussian(chatId);
                break;
            case 'send_text_message':
                await this.handleSendTextMessageRussian(chatId);
                break;
            case 'send_file':
                await this.handleSendFileRussian(chatId);
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

    async checkAndCreatePublicFolder() {
        const publicPath = path.join(process.cwd(), 'public');
        if (!fs.existsSync(publicPath)) {
            try {
                fs.mkdirSync(publicPath, { recursive: true });
                console.log('Created public folder for file storage');
            } catch (error) {
                console.error('Error creating public folder:', error);
                throw new Error('Failed to create public folder for file storage');
            }
        }
    }

    async init() {
        try {
            await this.checkAndCreatePublicFolder();
        } catch (error) {
            console.error('Initialization error:', error);
            throw error;
        }
    }

    // Метод для очистки состояний ожидания
    clearWaitingStates(chatId) {
        this.waitingForKey.delete(chatId);
        this.waitingForName.delete(chatId);
        this.waitingForMessage.delete(chatId);
        this.waitingForFile.delete(chatId);
    }

    // Метод для обработки ошибок и отправки сообщения пользователю
    async handleError(chatId, error, errorMessage = "Произошла ошибка. Попробуйте еще раз.") {
        console.error('Error:', error);
        this.clearWaitingStates(chatId);
        await this.bot.sendMessage(chatId, errorMessage, {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Назад', callback_data: 'doctor_connection'}]
                ]
            }
        });
    }
}

module.exports = DoctorPatientHandlerRussian;