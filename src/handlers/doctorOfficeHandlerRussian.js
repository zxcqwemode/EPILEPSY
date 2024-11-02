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

        // Получаем сообщения пациентов
        const patientMessages = await db.query(`
            SELECT * FROM messages 
            WHERE doctor_key = $1 
            AND user_id = $2 
            AND sender_type = 'patient'
            ORDER BY message_date DESC
        `, [doctorKey, patient.chat_id]);

        // Получаем сообщения врача
        const doctorMessages = await db.query(`
            SELECT * FROM doctors_messages 
            WHERE doctor_key = $1 
            AND patient_id = $2
            ORDER BY message_date DESC
        `, [doctorKey, patient.chat_id]);

        // Объединяем все сообщения и сортируем по дате
        const allMessages = [...patientMessages.rows, ...doctorMessages.rows]
            .sort((a, b) => new Date(b.message_date) - new Date(a.message_date));

        let messageText = `История сообщений с пациентом ${patient.name}:\n\n`;

        for (const msg of allMessages) {
            const isPatientMessage = 'sender_type' in msg && msg.sender_type === 'patient';
            const sender = isPatientMessage ? patient.name : "Врач";
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

            // Исправляем формирование callback_data
            const callbackData = `reply_to_${msg.message_id}_${patientIndex}_${patient.chat_id}`;
            console.log('Сформированный callback_data:', callbackData); // Для отладки

            await bot.sendMessage(chatId, messageText, {
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'Ответить', callback_data: callbackData }
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
        console.log('Получены данные callback:', data); // Для отладки

        // Правильно разбираем callback_data
        const parts = data.split('_');
        const originalMessageId = parts[2]; // Теперь берем правильный индекс
        const patientIndex = parts[3];
        const patientChatId = parts[4];

        console.log('Разобранные параметры:', {
            originalMessageId,
            patientIndex,
            patientChatId
        });

        // Проверяем валидность параметров
        if (!originalMessageId || !patientIndex || !patientChatId) {
            throw new Error('Неверные параметры для ответа');
        }

        // Сохраняем информацию для последующей обработки ответа
        replyData.set(chatId, {
            originalMessageId,
            patientIndex,
            userId: patientChatId // Теперь используем правильный chat_id пациента
        });

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
        await bot.sendMessage(chatId, 'Произошла ошибка при подготовке к ответу. Пожалуйста, попробуйте снова.');
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
            if (!replyInfo) {
                throw new Error('Информация для ответа не найдена');
            }

            console.log('Обработка ответа с информацией:', replyInfo);

            // Получаем doctor_key врача
            const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
            const doctorKey = doctorResult.rows[0]?.doctor_key;

            if (!doctorKey) {
                throw new Error('Ключ врача не найден');
            }

            console.log('Параметры запроса:', {
                userId: replyInfo.userId,
                doctorKey: doctorKey
            });

            // Проверяем существование пациента
            const patientResult = await db.query(
                'SELECT chat_id FROM users WHERE chat_id = $1 AND doctor_key = $2',
                [replyInfo.userId, doctorKey]
            );

            if (patientResult.rows.length === 0) {
                throw new Error('Пациент не найден');
            }

            // Отправляем сообщение пациенту
            await bot.sendMessage(replyInfo.userId, `Ответ от врача:\n${messageText}`);

            // Сохраняем ответ врача в таблицу doctors_messages
            await db.query(
                'INSERT INTO doctors_messages (doctor_id, patient_id, message_text, message_date, doctor_key) VALUES ($1, $2, $3, NOW(), $4)',
                [chatId, replyInfo.userId, messageText, doctorKey]
            );

            // Помечаем исходное сообщение пациента как прочитанное
            if (replyInfo.originalMessageId) {
                await db.query(
                    'UPDATE messages SET isRead = TRUE WHERE message_id = $1 AND user_id = $2 AND doctor_key = $3',
                    [replyInfo.originalMessageId, replyInfo.userId, doctorKey]
                );
            }

            // Очищаем состояние ожидания ответа
            waitingForReply.delete(chatId);
            replyData.delete(chatId);

            await bot.sendMessage(chatId, 'Ответ успешно отправлен.');

            // Возвращаем кнопку для навигации обратно к пациенту
            await bot.sendMessage(chatId, 'Вернуться к пациенту', {
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'Назад к пациенту', callback_data: `patient_${replyInfo.patientIndex}` }
                    ]]
                }
            });
        } catch (err) {
            console.error('Ошибка при отправке ответа:', err);
            let errorMessage = 'Произошла ошибка при отправке ответа.';

            if (err.message === 'Пациент не найден') {
                errorMessage = 'Пациент не найден в базе данных.';
            } else if (err.message === 'Ключ врача не найден') {
                errorMessage = 'Ключ врача не найден.';
            } else if (err.message.includes('chat not found')) {
                errorMessage = 'Не удалось отправить сообщение: пациент, возможно, заблокировал бота.';
            }

            await bot.sendMessage(chatId, errorMessage);
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