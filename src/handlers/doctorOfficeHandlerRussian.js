const db = require('../config/db');

const replyData = new Map();
const waitingForReply = new Set();

async function initializeDoctorOfficeRussian(bot, chatId, messageId, doctorKey) {
    try {
        await bot.editMessageText(`Записал, ваша роль: Врач. Все данные как пациента были удалены.`, {
            chat_id: chatId,
            message_id: messageId,
        });

        await showDoctorMainMenu(bot, chatId, doctorKey);
    } catch (err) {
        console.error('Ошибка при инициализации кабинета врача:', err);
        throw err;
    }
}

async function showDoctorMainMenu(bot, chatId, doctorKey) {
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Список пациентов', callback_data: 'patient_list_page_1' }]
            ],
        },
    };

    if (doctorKey) {
        await bot.sendMessage(chatId, `Ваш уникальный ключ: ${doctorKey}. Сообщите его пациентам для подключения.\nДля вызова меню используйте команду /menu.`);
    }
    await bot.sendMessage(chatId, 'Добро пожаловать в кабинет врача!', options);
}

async function handlePatientListPageRussian(bot, chatId, messageId, data) {
    try {
        const page = parseInt(data.split('_').pop(), 10);

        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        if (!doctorKey) {
            await bot.editMessageText("Ошибка: ключ врача не найден.", {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }

        const result = await db.query('SELECT name FROM users WHERE doctor_key = $1', [doctorKey]);
        const patients = result.rows;

        let patientButtons = [];

        if (patients.length > 0) {
            for (let i = 0; i < patients.length; i++) {
                patientButtons.push({
                    text: patients[i].name,
                    callback_data: `patient_${i + 1}`
                });
            }

            for (let i = patients.length; i < 9; i++) {
                patientButtons.push({ text: ' ', callback_data: 'no_action' });
            }
        } else {
            for (let i = 0; i < 9; i++) {
                patientButtons.push({ text: ' ', callback_data: 'no_action' });
            }
        }

        const patientRows = [];
        for (let i = 0; i < patientButtons.length; i += 3) {
            patientRows.push(patientButtons.slice(i, i + 3));
        }

        const navigationButtons = [
            { text: '⬅️ Влево', callback_data: page > 1 ? `patient_list_page_${page - 1}` : 'no_action' },
            { text: 'Вернуться в меню', callback_data: 'doctor_menu' },
            { text: 'Вправо ➡️', callback_data: `patient_list_page_${page + 1}` },
        ];
        patientRows.push(navigationButtons);

        await bot.editMessageText(`Вот список ваших пациентов:`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: patientRows,
            },
        });
    } catch (err) {
        console.error('Ошибка при обработке списка пациентов:', err);
        throw err;
    }
}

async function handlePatientSelectionRussian(bot, chatId, messageId, data) {
    try {
        const patientIndex = data.split('_')[1];
        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        const patientResult = await db.query('SELECT name FROM users WHERE doctor_key = $1 LIMIT 1 OFFSET $2', [doctorKey, patientIndex - 1]);
        const patientName = patientResult.rows[0]?.name;

        await bot.deleteMessage(chatId, messageId);

        await bot.sendMessage(chatId, `Пациент: ${patientName}`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Вернуться назад', callback_data: `patient_list_page_1` },
                        { text: 'Непрочитанные сообщения', callback_data: `unread_messages_patient_${patientIndex}` },
                        { text: 'История переписки', callback_data: `send_history_${patientIndex}` },
                    ],
                ],
            },
        });
    } catch (err) {
        console.error('Ошибка при выборе пациента:', err);
        throw err;
    }
}

async function handleMessageHistoryRequestRussian(bot, chatId, messageId, data) {
    try {
        const patientIndex = data.split('_')[2];
        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        const patientResult = await db.query(
            'SELECT chat_id, name FROM users WHERE doctor_key = $1 LIMIT 1 OFFSET $2',
            [doctorKey, patientIndex - 1]
        );

        if (patientResult.rows.length === 0) {
            await bot.editMessageText("Пациент не найден.", {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }

        const patient = patientResult.rows[0];
        const messages = await db.query(`
            SELECT * FROM messages 
            WHERE doctor_key = $1 
            AND (
                (user_id = $2 AND sender_type = 'patient') 
                OR 
                (user_id = $2 AND sender_type = 'doctor')
            )
            ORDER BY message_date DESC
        `, [doctorKey, patient.chat_id]);

        let messageText = `История сообщений с пациентом ${patient.name}:\n\n`;

        for (const msg of messages.rows) {
            const sender = msg.sender_type === 'doctor' ? "Врач" : patient.name;
            messageText += `${sender} (${new Date(msg.message_date).toLocaleString()}):\n`;
            if (msg.isFile) {
                messageText += `[Файл: ${msg.fileName}]\n`;
            } else {
                messageText += `${msg.message_text}\n`;
            }
            messageText += '-------------------\n';
        }

        await bot.editMessageText(messageText, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Назад к пациенту', callback_data: `patient_${patientIndex}` }]
                ]
            }
        });
    } catch (err) {
        console.error('Ошибка при запросе истории сообщений:', err);
        throw err;
    }
}

async function handleUnreadMessagesForPatient(bot, chatId, messageId, data) {
    try {
        const patientIndex = data.split('_')[3];
        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        const patientResult = await db.query(
            'SELECT chat_id, name FROM users WHERE doctor_key = $1 LIMIT 1 OFFSET $2',
            [doctorKey, patientIndex - 1]
        );

        if (patientResult.rows.length === 0) {
            await bot.sendMessage(chatId, "Пациент не найден.");
            return;
        }

        const patient = patientResult.rows[0];

        const unreadMessages = await db.query(`
            SELECT * FROM messages 
            WHERE user_id = $1 
            AND doctor_key = $2 
            AND isRead = false 
            AND sender_type = 'patient'
            ORDER BY message_date DESC
        `, [patient.chat_id, doctorKey]);

        await bot.deleteMessage(chatId, messageId);

        if (unreadMessages.rows.length === 0) {
            await bot.sendMessage(chatId, `У пациента ${patient.name} нет непрочитанных сообщений`, {
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'Назад к пациенту', callback_data: `patient_${patientIndex}` }
                    ]]
                }
            });
            return;
        }

        for (const msg of unreadMessages.rows) {
            let messageText = `От: ${patient.name}\n`;
            messageText += `Дата: ${new Date(msg.message_date).toLocaleString()}\n`;
            messageText += msg.isFile ? `Файл: ${msg.fileName}\n` : `Сообщение: ${msg.message_text}`;

            await bot.sendMessage(chatId, messageText, {
                reply_markup: {
                    force_reply: true,
                    selective: true,
                    inline_keyboard: [[
                        { text: 'Ответить', callback_data: `reply_to_${msg.message_id}_${patient.chat_id}_${patientIndex}` }
                    ]]
                }
            });
        }

        await bot.sendMessage(chatId, 'Все непрочитанные сообщения', {
            reply_markup: {
                inline_keyboard: [[
                    { text: 'Назад к пациенту', callback_data: `patient_${patientIndex}` }
                ]]
            }
        });
    } catch (err) {
        console.error('Ошибка при получении непрочитанных сообщений:', err);
        throw err;
    }
}

async function handleReplyToMessage(bot, chatId, messageId, data) {
    try {
        const [_, messageId2, userId, patientIndex] = data.split('_');

        replyData.set(chatId, { messageId: messageId2, userId: userId, patientIndex: patientIndex });

        await bot.deleteMessage(chatId, messageId);

        await bot.sendMessage(chatId, 'Напишите ваш ответ:', {
            reply_markup: {
                force_reply: true,
                selective: true
            }
        });

        waitingForReply.add(chatId);
    } catch (err) {
        console.error('Ошибка при подготовке к ответу:', err);
        throw err;
    }
}

async function handleMarkAsRead(bot, chatId, messageId, data) {
    try {
        const messageIdToMark = data.split('_')[2];

        await db.query('UPDATE messages SET isRead = TRUE WHERE message_id = $1', [messageIdToMark]);

        await handleUnreadMessagesForPatient(bot, chatId, messageId, data);
    } catch (err) {
        console.error('Ошибка при отметке сообщения как прочитанного:', err);
        throw err;
    }
}

async function handleDoctorMenuReturnRussian(bot, chatId, messageId) {
    try {
        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        await showDoctorMainMenu(bot, chatId, null);
    } catch (err) {
        console.error('Ошибка при возврате в меню врача:', err);
        throw err;
    }
}

async function handleDoctorCallbackRussian(bot, callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    try {
        if (data.startsWith('patient_list_page_')) {
            await handlePatientListPageRussian(bot, chatId, messageId, data);
        }
        else if (data.startsWith('patient_')) {
            await handlePatientSelectionRussian(bot, chatId, messageId, data);
        }
        else if (data.startsWith('send_history_')) {
            await handleMessageHistoryRequestRussian(bot, chatId, messageId, data);
        }
        else if (data === 'doctor_menu') {
            await handleDoctorMenuReturnRussian(bot, chatId, messageId);
        }
        else if (data.startsWith('unread_messages_patient_')) {
            await handleUnreadMessagesForPatient(bot, chatId, messageId, data);
        }
        else if (data.startsWith('reply_to_')) {
            await handleReplyToMessage(bot, chatId, messageId, data);
        }
        else if (data.startsWith('mark_read_')) {
            await handleMarkAsRead(bot, chatId, messageId, data);
        }
    } catch (err) {
        console.error('Ошибка при обработке callback запроса врача:', err);
        throw err;
    }
}

async function handleDoctorMessage(bot, msg) {
    const chatId = msg.chat.id;
    const messageText = msg.text;

    if (waitingForReply.has(chatId)) {
        try {
            const replyInfo = replyData.get(chatId);
            if (!replyInfo) return;

            const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
            const doctorKey = doctorResult.rows[0]?.doctor_key;

            await db.query(
                'INSERT INTO messages (user_id, message_text, message_date, isRead, doctor_key, sender_type) VALUES ($1, $2, NOW(), TRUE, $3, $4)',
                [replyInfo.userId, messageText, doctorKey, 'doctor']
            );

            await bot.sendMessage(replyInfo.userId, `Ответ от врача:\n${messageText}`);

            waitingForReply.delete(chatId);
            replyData.delete(chatId);

            await bot.sendMessage(chatId, 'Ответ успешно отправлен.');

            await bot.sendMessage(chatId, `Вернуться к пациенту`, {
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'Назад к пациенту', callback_data: `patient_${replyInfo.patientIndex}` }
                    ]]
                }
            });
        } catch (err) {
            console.error('Ошибка при отправке ответа:', err);
            await bot.sendMessage(chatId, 'Произошла ошибка при отправке ответа.');
        }
    }
}

async function handleMenuCommand(bot, msg) {
    const chatId = msg.chat.id;
    try {
        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        if (doctorKey) {
            await showDoctorMainMenu(bot, chatId, null);
        } else {
            await bot.sendMessage(chatId, 'У вас нет доступа к меню врача.');
        }
    } catch (err) {
        console.error('Ошибка при обработке команды меню:', err);
        await bot.sendMessage(chatId, 'Произошла ошибка при обработке команды.');
    }
}

module.exports = {
    initializeDoctorOfficeRussian,
    showDoctorMainMenu,
    handlePatientListPageRussian,
    handlePatientSelectionRussian,
    handleMessageHistoryRequestRussian,
    handleDoctorMenuReturnRussian,
    handleDoctorCallbackRussian,
    handleUnreadMessagesForPatient,
    handleReplyToMessage,
    handleDoctorMessage,
    handleMenuCommand
};