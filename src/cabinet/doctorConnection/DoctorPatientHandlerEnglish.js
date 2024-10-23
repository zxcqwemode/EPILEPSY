const db = require('../../config/db');

class DoctorPatientHandlerEnglish {
    constructor(bot) {
        this.bot = bot;
        this.waitingForKey = new Set();
        this.waitingForName = new Set();
        this.waitingForMessage = new Set();
    }

    async handleDoctorConnectionEnglish(chatId) {
        const userResult = await db.query('SELECT doctor_key, key_valid, name FROM users WHERE chat_id = $1', [chatId]);
        const user = userResult.rows[0];

        if (user && user.key_valid) {
            await this.showDoctorMenuEnglish(chatId);
        } else {
            await this.requestDoctorKeyEnglish(chatId);
        }
    }

    async showDoctorMenuEnglish(chatId) {
        await this.bot.sendMessage(chatId, "Choose an action:", {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Message History', callback_data: 'view_messages'}],
                    [{text: 'Send Message', callback_data: 'send_message'}],
                    [{text: 'Change Doctor', callback_data: 'change_doctor'}],
                    [{text: 'Back to Profile', callback_data: 'back_to_profile'}]
                ]
            }
        });
    }

    async requestDoctorKeyEnglish(chatId) {
        this.waitingForKey.add(chatId);
        await this.bot.sendMessage(chatId, "Enter the doctor's key:");
    }

    async showInvalidKeyMenuEnglish(chatId) {
        this.waitingForKey.delete(chatId);
        await this.bot.sendMessage(chatId, "Invalid key.", {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Enter key', callback_data: 'retry_key'}],
                    [{text: 'Back to Profile', callback_data: 'back_to_profile'}]
                ]
            }
        });
    }


    async handleKeyInputEnglish(chatId, messageText) {
        if (!this.waitingForKey.has(chatId)) return;

        const doctorResult = await db.query('SELECT * FROM doctors WHERE doctor_key = $1', [messageText]);

        if (doctorResult.rows.length > 0) {
            this.waitingForKey.delete(chatId);
            this.waitingForName.add(chatId);
            await db.query('UPDATE users SET doctor_key = $1, key_valid = TRUE WHERE chat_id = $2', [messageText, chatId]);
            await this.bot.sendMessage(chatId, "Valid key! Please enter your name:");
        } else {
            await this.showInvalidKeyMenuEnglish(chatId);
        }
    }

    async handleNameInputEnglish(chatId, messageText) {
        if (!this.waitingForName.has(chatId)) return;

        this.waitingForName.delete(chatId);
        await db.query('UPDATE users SET name = $1 WHERE chat_id = $2', [messageText, chatId]);
        await this.showDoctorMenuEnglish(chatId);
    }

    async handleViewMessagesEnglish(chatId) {
        const messages = await db.query('SELECT m.*, u.name FROM messages m JOIN users u ON m.user_id = u.chat_id WHERE user_id = $1 ORDER BY message_date DESC', [chatId]);

        let messageText = messages.rows.length > 0
            ? "Message history:\n\n" + messages.rows.map(msg =>
            `${msg.name} (${new Date(msg.message_date).toLocaleString()}):\n${msg.message_text}\n`
        ).join('\n')
            : "You have no messages.";

        await this.bot.sendMessage(chatId, messageText, {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Back', callback_data: 'doctor_connection'}]
                ]
            }
        });
    }

    async handleSendMessageEnglish(chatId) {
        this.waitingForMessage.add(chatId);
        await this.bot.sendMessage(chatId, "Write your message:", {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Cancel', callback_data: 'doctor_connection'}]
                ]
            }
        });
    }

    async handleMessageInputEnglish(chatId, messageText) {
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
                await this.bot.sendMessage(doctorChatId, `Message from ${name}:\n${messageText}`);
            }

            this.waitingForMessage.delete(chatId);
            await this.bot.sendMessage(chatId, "Message sent", {
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Send Another', callback_data: 'send_message'}],
                        [{text: 'Back', callback_data: 'doctor_connection'}]
                    ]
                }
            });
        }
    }

    async handleChangeDoctorEnglish(chatId) {
        await db.query('UPDATE users SET doctor_key = NULL, key_valid = FALSE WHERE chat_id = $1', [chatId]);
        await this.requestDoctorKeyEnglish(chatId);
    }

    async handleMessageEnglish(msg) {
        const chatId = msg.chat.id;
        const messageText = msg.text;

        if (this.isWaitingForInputEnglish(chatId)) {
            if (messageText === '/start' || messageText === '/myProfile') {
                return;
            }
        }

        if (this.waitingForKey.has(chatId)) {
            await this.handleKeyInputEnglish(chatId, messageText);
        } else if (this.waitingForName.has(chatId)) {
            await this.handleNameInputEnglish(chatId, messageText);
        } else if (this.waitingForMessage.has(chatId)) {
            await this.handleMessageInputEnglish(chatId, messageText);
        }
    }

    isWaitingForInputEnglish(chatId) {
        return this.waitingForKey.has(chatId) ||
            this.waitingForName.has(chatId) ||
            this.waitingForMessage.has(chatId);
    }

    async handleCallbackEnglish(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;

        // Удаляем клавиатуру только для определенных действий
        if (data === 'retry_key' || data === 'back_to_profile') {
            if (callbackQuery.message.reply_markup) {
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
        }

        switch (data) {
            case 'doctor_connection':
                await this.handleDoctorConnectionEnglish(chatId);
                break;
            case 'view_messages':
                await this.handleViewMessagesEnglish(chatId);
                break;
            case 'send_message':
                await this.handleSendMessageEnglish(chatId);
                break;
            case 'change_doctor':
                await this.handleChangeDoctorEnglish(chatId);
                break;
            case 'retry_key':
                await this.requestDoctorKeyEnglish(chatId);
                break;
        }

        try {
            await this.bot.answerCallbackQuery(callbackQuery.id);
        } catch (error) {
            console.error('Error answering callback query:', error);
        }
    }
}

module.exports = DoctorPatientHandlerEnglish;