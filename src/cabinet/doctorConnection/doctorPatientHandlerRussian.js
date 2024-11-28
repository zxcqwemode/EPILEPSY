const db = require('../../config/db');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ExcelJS = require('exceljs'); // Добавляем ExcelJS
const XLSX = require('xlsx');


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
                    [{text: 'Информация о враче', callback_data: 'doctor_info'}],
                    [{text: 'Сменить врача', callback_data: 'change_doctor'}],
                    [{text: 'Назад в профиль', callback_data: 'back_to_profile'}]
                ]
            }
        });
    }


    async requestDoctorKeyRussian(chatId) {
        this.waitingForKey.add(chatId);
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Вернуться в профиль", callback_data: "back_to_profile" }]
                ]
            }
        };
        const message = await this.bot.sendMessage(chatId, "Введите ключ от врача:", options);
        this.keyMessageId = message.message_id; // Сохраняем message_id
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

        // Удаляем кнопку "Вернуться в профиль"
        if (this.keyMessageId) {
            try {
                await this.bot.editMessageReplyMarkup(
                    { inline_keyboard: [] },
                    { chat_id: chatId, message_id: this.keyMessageId }
                );
            } catch (error) {
                console.error('Error removing keyboard:', error);
            }
            this.keyMessageId = null;
        }

        const doctorResult = await db.query('SELECT * FROM doctors WHERE doctor_key = $1', [messageText]);

        if (doctorResult.rows.length > 0) {
            this.waitingForKey.delete(chatId);
            this.waitingForName.add(chatId);
            await db.query('UPDATE users SET doctor_key = $1, key_valid = TRUE WHERE chat_id = $2', [messageText, chatId]);
            await this.bot.sendMessage(chatId,
                "Ключ верный!\n" +
                "Введите пожалуйста свое ФИО.\n" +
                "Например: Иванов Иван Иванович"
            );
        } else {
            await this.showInvalidKeyMenuRussian(chatId);
        }
    }


    async handleNameInputRussian(chatId, messageText) {
        if (!this.waitingForName.has(chatId)) return;

        // Проверяем формат ФИО (должно быть минимум 2 слова)
        const nameParts = messageText.trim().split(/\s+/);
        if (nameParts.length < 2) {
            await this.bot.sendMessage(chatId,
                "Пожалуйста, введите полное ФИО в формате: Фамилия Имя Отчество"
            );
            return;
        }

        try {
            const surname = nameParts[0]; // Берём только фамилию для поля name

            // Обновляем данные пользователя
            await db.query(
                'UPDATE users SET name = $1, fio = $2 WHERE chat_id = $3',
                [surname, messageText, chatId]
            );

            this.waitingForName.delete(chatId);
            await this.showDoctorMenuRussian(chatId);
        } catch (error) {
            console.error('Error updating user data:', error);
            await this.bot.sendMessage(chatId,
                "Произошла ошибка при сохранении данных. Пожалуйста, попробуйте еще раз."
            );
            return;
        }
    }


    async handleDoctorInfoRussian(chatId) {
        try {
            // Получаем doctor_key для текущего пользователя
            const userResult = await db.query('SELECT doctor_key FROM users WHERE chat_id = $1', [chatId]);
            const doctorKey = userResult.rows[0]?.doctor_key;

            if (!doctorKey) {
                await this.bot.sendMessage(chatId, "Информация о враче недоступна.", {
                    reply_markup: {
                        inline_keyboard: [
                            [{text: 'Назад', callback_data: 'doctor_connection'}]
                        ]
                    }
                });
                return;
            }

            // Получаем информацию о враче
            const doctorResult = await db.query('SELECT name, description FROM doctors WHERE doctor_key = $1', [doctorKey]);
            const doctor = doctorResult.rows[0];

            if (!doctor) {
                await this.bot.sendMessage(chatId, "Информация о враче не найдена.", {
                    reply_markup: {
                        inline_keyboard: [
                            [{text: 'Назад', callback_data: 'doctor_connection'}]
                        ]
                    }
                });
                return;
            }

            const message = `Ваш врач: ${doctor.name}\nКраткая информация о враче:\n${doctor.description || 'Информация отсутствует'}`;

            await this.bot.sendMessage(chatId, message, {
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Назад', callback_data: 'doctor_connection'}]
                    ]
                }
            });
        } catch (error) {
            console.error('Error fetching doctor info:', error);
            await this.bot.sendMessage(chatId, "Произошла ошибка при получении информации о враче.", {
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Назад', callback_data: 'doctor_connection'}]
                    ]
                }
            });
        }
    }

    async handleViewMessagesRussian(chatId) {
        // Запрос для получения сообщений из обеих таблиц
        const messages = await db.query(`
        SELECT user_id AS patient_id, doctor_key, message_text, message_date, sender_type
        FROM messages
        WHERE user_id = $1

        UNION ALL

        SELECT patient_id, doctor_key, message_text, message_date, NULL AS sender_type
        FROM doctors_messages
        WHERE patient_id = $1
        ORDER BY message_date DESC
    `, [chatId]);

        if (messages.rows.length > 0) {
            // Формируем данные для Excel
            const excelData = [];
            excelData.push(['Отправитель', 'Текст сообщения', 'Дата отправления']); // Заголовок

            messages.rows.forEach(msg => {
                // Определяем отправителя
                const sender = msg.sender_type === 'patient' ? 'Пациент' : 'Врач';  // Если есть sender_type === 'patient', то пациент
                const date = new Date(msg.message_date).toLocaleString();  // Форматируем дату

                excelData.push([sender, msg.message_text, date]);
            });

            // Создаем рабочий лист Excel
            const ws = XLSX.utils.aoa_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Messages');

            // Применяем стили для таблицы
            const wscols = [
                { wpx: 100 },  // Для столбца 'Отправитель'
                { wpx: 300 },  // Для столбца 'Текст сообщения'
                { wpx: 150 }   // Для столбца 'Дата отправления'
            ];
            ws['!cols'] = wscols;

            // Добавляем стили для фона и границ
            const borderStyle = {
                top: { style: 'thin', color: { rgb: '000000' } },
                left: { style: 'thin', color: { rgb: '000000' } },
                bottom: { style: 'thin', color: { rgb: '000000' } },
                right: { style: 'thin', color: { rgb: '000000' } }
            };

            const fillStyle = {
                fill: {
                    fgColor: { rgb: 'D0EFFF' }  // Нежноголубой цвет фона
                }
            };

            // Применяем стили для заголовков и ячеек
            for (let row = 0; row < excelData.length; row++) {
                for (let col = 0; col < excelData[row].length; col++) {
                    const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];

                    if (!cell) continue;

                    // Добавляем фон только для заголовков
                    if (row === 0) {
                        cell.s = { border: borderStyle, fill: fillStyle, font: { bold: true } };
                    } else {
                        cell.s = { border: borderStyle };
                    }
                }
            }

            // Сохраняем Excel файл в папке 'public'
            const dirPath = path.join(__dirname, '../../../public');
            const filePath = path.join(dirPath, 'messages.xlsx');

            // Отправляем кнопку "Назад" до отправки файла
            await this.bot.sendMessage(chatId, "Вот ваша история сообщений:", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Назад', callback_data: 'doctor_connection' }]
                    ]
                }
            });

            // Записываем файл
            XLSX.writeFile(wb, filePath);

            // Отправляем файл пользователю
            await this.bot.sendDocument(chatId, fs.createReadStream(filePath), {}, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Назад', callback_data: 'doctor_connection' }]
                    ]
                }
            });

            // Удаляем временный файл после отправки
            fs.unlink(filePath, (err) => {
                if (err) console.error('Ошибка при удалении файла:', err);
            });
        } else {
            // Если нет сообщений, отправляем уведомление
            await this.bot.sendMessage(chatId, "У вас нет сообщений.", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Назад', callback_data: 'doctor_connection' }]
                    ]
                }
            });
        }
    }


    async handleSendTextMessageRussian(chatId) {
        // Проверяем бан перед разрешением отправки текстового сообщения
        const isBanned = await this.checkUserBan(chatId);

        if (isBanned) {
            await this.bot.sendMessage(chatId, "Врач запретил вам писать сообщения", {
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Назад', callback_data: 'doctor_connection'}]
                    ]
                }
            });
            return;
        }

        this.waitingForMessage.add(chatId);
        const message = await this.bot.sendMessage(chatId,
            "Напишите ваше сообщение:", {
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Отменить', callback_data: 'doctor_connection'}]
                    ]
                }
            });
        this.messageToEdit = message.message_id;
    }


    async handleSendFileRussian(chatId) {
        // Проверяем бан перед разрешением отправки файла
        const isBanned = await this.checkUserBan(chatId);

        if (isBanned) {
            await this.bot.sendMessage(chatId, "Врач запретил вам писать сообщения", {
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Назад', callback_data: 'doctor_connection'}]
                    ]
                }
            });
            return;
        }

        this.waitingForFile.add(chatId);
        const message = await this.bot.sendMessage(chatId,
            "Отправьте файл (документ, фото, видео и т.д.):", {
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Отменить', callback_data: 'doctor_connection'}]
                    ]
                }
            });
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

    async checkUserBan(chatId) {
        const userResult = await db.query('SELECT doctor_key FROM users WHERE chat_id = $1', [chatId]);
        if (!userResult.rows.length) return false;

        const doctorKey = userResult.rows[0].doctor_key;
        const banResult = await db.query(
            'SELECT * FROM bans WHERE user_id = $1 AND doctor_key = $2',
            [chatId, doctorKey]
        );

        return banResult.rows.length > 0;
    }

    async showMessageTypeChoiceRussian(chatId) {
        // Проверяем бан перед показом меню выбора типа сообщения
        const isBanned = await this.checkUserBan(chatId);

        if (isBanned) {
            await this.bot.sendMessage(chatId, "Врач запретил вам писать сообщения", {
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Назад', callback_data: 'doctor_connection'}]
                    ]
                }
            });
            return;
        }

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
        this.clearWaitingStates(chatId); // Очищаем предыдущие состояния

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
            case 'doctor_info':
                await this.handleDoctorInfoRussian(chatId);
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