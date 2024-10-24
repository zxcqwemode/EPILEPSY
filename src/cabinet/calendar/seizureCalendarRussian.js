const db = require('../../config/db');

// Функция для рендеринга календаря
async function seizureCalendarRussian(bot, chatId, messageId, monthOffset = 0, selectedDay = null) {
    try {
        const today = new Date();
        let currentMonth = today.getMonth() + monthOffset;
        let currentYear = today.getFullYear();

        if (currentMonth < 0) {
            currentYear--;
            currentMonth = 12 + currentMonth;
        } else if (currentMonth > 11) {
            currentYear++;
            currentMonth = currentMonth - 12;
        }

        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        const result = await db.query(
            `SELECT * FROM calendar WHERE user_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3`,
            [chatId, currentMonth + 1, currentYear]
        );

        const calendarData = result.rows;

        const inlineKeyboard = [];
        let row = [];
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
        const dayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

        inlineKeyboard.push([
            {
                text: `${new Date(currentYear, currentMonth).toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}`,
                callback_data: 'no_action'
            }
        ]);

        const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        inlineKeyboard.push(weekDays.map(day => ({ text: day, callback_data: 'no_action' })));

        for (let i = 0; i < dayOfWeek; i++) {
            row.push({ text: ' ', callback_data: 'no_action' });
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dayRecord = calendarData.find(entry => new Date(entry.date).getDate() === day);
            let buttonLabel = `${day}`;

            if (dayRecord) {
                if (dayRecord.had_seizure && dayRecord.medications) {
                    buttonLabel += ' 🔺';
                } else if (dayRecord.had_seizure && !dayRecord.medications) {
                    buttonLabel += ' 🔸';
                } else if (dayRecord.note) {
                    buttonLabel += ' ✅';
                }
            }

            row.push({
                text: buttonLabel,
                callback_data: `calendar_${day}_${monthOffset}`
            });

            if (row.length === 7) {
                inlineKeyboard.push(row);
                row = [];
            }
        }

        while (row.length < 7) {
            row.push({ text: ' ', callback_data: 'no_action' });
        }
        if (row.length) {
            inlineKeyboard.push(row);
        }

        const navigationRow = [];
        navigationRow.push({ text: '⬅️', callback_data: `change_month_${monthOffset - 1}` });

        if (currentMonth < today.getMonth() || currentYear < today.getFullYear()) {
            navigationRow.push({ text: '➡️', callback_data: `change_month_${monthOffset + 1}` });
        } else {
            navigationRow.push({ text: '➡️', callback_data: 'no_action' });
        }

        inlineKeyboard.push(navigationRow);

        if (selectedDay) {
            const selectedDate = new Date(currentYear, currentMonth, selectedDay);
            const formattedDate = `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDate.getDate().toString().padStart(2, '0')}`;
            inlineKeyboard.push([
                {
                    text: `Сделать запись на ${selectedDay} ${selectedDate.toLocaleString('ru-RU', { month: 'long' })}`,
                    callback_data: `start_record_${formattedDate}`
                }
            ]);
        }

        inlineKeyboard.push([{ text: 'Назад в профиль', callback_data: 'back_to_profile' }]);

        await bot.editMessageText(
            `Ваш календарь приступов\n\nЕсли в календаре уже есть запись, то значок покажет, был ли у вас приступ:\n🔸 — Приступ без приема препаратов\n🔺 — Приступ с препаратами`,
            {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: { inline_keyboard: inlineKeyboard }
            }
        );
    } catch (error) {
        console.error('Ошибка при рендеринге календаря:', error);
    }
}

// Обработчик нажатия на день (русский)
async function handleDayPressRussian(bot, chatId, day, monthOffset) {
    const messageId = bot.userMessageIds[chatId]; // Получаем сохраненный message_id
    await seizureCalendarRussian(bot, chatId, messageId, parseInt(monthOffset), parseInt(day));
}

// Обработчик изменения месяца (русский)
async function handleChangeMonthRussian(bot, chatId, monthOffset, messageId) {
    await seizureCalendarRussian(bot, chatId, messageId, parseInt(monthOffset));
}

// Обработчик начала записи на выбранную дату (русский)
async function startRecordingRussian(bot, chatId, date, messageId) {
    const dateObject = new Date(date);
    const formattedDate = dateObject.toISOString().split('T')[0];

    // Удаляем предыдущие обработчики для этого чата
    if (bot.listeners('callback_query').length > 0) {
        bot.removeAllListeners('callback_query');
    }

    await db.query(
        `INSERT INTO calendar (user_id, date, created_at) VALUES ($1, $2, $3) ON CONFLICT (user_id, date) DO NOTHING`,
        [chatId, formattedDate, new Date()]
    );

    await bot.sendMessage(chatId, `Начинаем запись на ${dateObject.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}\n\nУ вас был приступ эпилепсии?`, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Да', callback_data: `record_seizure_${date}` },
                    { text: 'Нет', callback_data: `record_no_seizure_${date}` }
                ]
            ]
        }
    });

    const callbackHandler = async (callbackQuery) => {
        const data = callbackQuery.data;

        // Обработка кнопок "Календарь" и "Вернуться в профиль"
        if (data === 'seizure_calendar') {
            await bot.deleteMessage(chatId, callbackQuery.message.message_id);
            const message = await bot.sendMessage(chatId, 'Загрузка календаря...');
            bot.userMessageIds[chatId] = message.message_id;
            await seizureCalendarRussian(bot, chatId, message.message_id);
            return;
        }

        else if (data === 'back_to_profile') {
            await bot.deleteMessage(chatId, callbackQuery.message.message_id);
            bot.emit('back_to_profile', chatId);
            return;
        }

        // Обработка ответа "Нет приступа"
        else if (data.startsWith('record_no_seizure_')) {
            const dateString = data.split('record_no_seizure_')[1];
            // Проверяем корректность даты
            if (!Date.parse(dateString)) {
                console.error('Invalid date format:', dateString);
                await bot.sendMessage(chatId, 'Произошла ошибка при сохранении записи. Пожалуйста, попробуйте снова.');
                return;
            }

            await bot.editMessageText(
                `Запись на ${dateObject.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}\n\nВопрос: У вас был приступ эпилепсии?\nОтвет: Нет`,
                {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id
                }
            );

            try {
                await db.query(
                    `UPDATE calendar SET had_seizure = $1 WHERE user_id = $2 AND date = $3`,
                    [false, chatId, dateString]
                );

                await bot.sendMessage(chatId, `Желаете добавить заметку к записи?`, {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'Да', callback_data: `add_note_no_seizure_${dateString}` },
                                { text: 'Нет', callback_data: `no_note_no_seizure_${dateString}` }
                            ]
                        ]
                    }
                });
            } catch (error) {
                console.error('Error updating calendar:', error);
                await bot.sendMessage(chatId, 'Произошла ошибка при сохранении записи. Пожалуйста, попробуйте снова.');
            }
        }

        // Обработка отказа от заметки при отсутствии приступа
        else if (data.startsWith('no_note_no_seizure_')) {
            const dateString = data.split('record_no_seizure_')[1];
            await bot.editMessageText(
                `Вопрос: Желаете добавить заметку к записи?\nОтвет: Нет`,
                {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id
                }
            );

            await bot.sendMessage(chatId, `Запись сохранена!\nДата: ${dateObject.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Календарь', callback_data: 'seizure_calendar' },
                            { text: 'Вернуться в профиль', callback_data: 'back_to_profile' }
                        ]
                    ]
                }
            });

            // Добавляем обработчик для финальных кнопок
            //addFinalButtonsHandler();
        }

        // Обработка добавления заметки при отсутствии приступа
        else if (data.startsWith('add_note_no_seizure_')) {
            const dateString = data.split('_')[3];

            await bot.editMessageText(
                `Вопрос: Желаете добавить заметку к записи?\nОтвет: Да\n\nНапишите свою заметку:`,
                {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id
                }
            );

            const messageHandler = async (msg) => {
                if (msg.chat.id === chatId) {
                    const noteText = msg.text;

                    await bot.sendMessage(
                        chatId,
                        `Заметка записана:\n${noteText}`
                    );

                    await bot.sendMessage(chatId, `Запись сохранена!\nДата: ${dateObject.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: 'Календарь', callback_data: 'seizure_calendar' },
                                    { text: 'Вернуться в профиль', callback_data: 'back_to_profile' }
                                ]
                            ]
                        }
                    });

                    await db.query(
                        `UPDATE calendar SET note = $1, note_text = $2 WHERE user_id = $3 AND date = $4`,
                        [true, noteText, chatId, formattedDate]
                    );

                    bot.removeListener('message', messageHandler);

                    // Добавляем обработчик для финальных кнопок
                    //addFinalButtonsHandler();
                }
            };

            bot.once('message', messageHandler);
        }

        // Существующая логика для случая с приступом
        else if (data.startsWith('record_seizure_')) {
            const dateString = data.split('_')[2];

            await bot.editMessageText(
                `Запись на ${dateObject.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}\n\nВопрос: У вас был приступ эпилепсии?\nОтвет: Да`,
                {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id
                }
            );

            await bot.sendMessage(chatId, `Вы принимали препараты?`, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Да', callback_data: `medications_yes_${dateString}` },
                            { text: 'Нет', callback_data: `medications_no_${dateString}` }
                        ]
                    ]
                }
            });

            await db.query(
                `UPDATE calendar SET had_seizure = $1 WHERE user_id = $2 AND date = $3`,
                [true, chatId, dateString]
            );
        }

        // Обработка ответа о препаратах
        else if (data.startsWith('medications_yes_')) {
            const dateString = data.split('_')[2];

            await bot.editMessageText(
                `Вопрос: Вы принимали препараты?\nОтвет: Да`,
                {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id
                }
            );

            await bot.sendMessage(chatId, `Какие препараты вы принимали? Напишите названия:`);

            const messageHandler = async (msg) => {
                if (msg.chat.id === chatId) {
                    const medications = msg.text;

                    await bot.sendMessage(
                        chatId,
                        `Вопрос: Какие препараты вы принимали?\nОтвет: ${medications}`
                    );

                    await bot.sendMessage(chatId, `Сколько минут длился приступ?`, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: '1', callback_data: `duration_1_${dateString}` },
                                    { text: '2', callback_data: `duration_2_${dateString}` },
                                    { text: '3', callback_data: `duration_3_${dateString}` },
                                    { text: '4', callback_data: `duration_4_${dateString}` },
                                    { text: '5', callback_data: `duration_5_${dateString}` },
                                    { text: 'Больше 5', callback_data: `duration_more_${dateString}` }
                                ]
                            ]
                        }
                    });

                    await db.query(
                        `UPDATE calendar SET medications = $1 WHERE user_id = $2 AND date = $3`,
                        [medications, chatId, dateString]
                    );

                    bot.removeListener('message', messageHandler);
                }
            };

            bot.once('message', messageHandler);
        }

        else if (data.startsWith('medications_no_')) {
            const dateString = data.split('_')[2];

            await bot.editMessageText(
                `Вопрос: Вы принимали препараты?\nОтвет: Нет`,
                {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id
                }
            );

            await bot.sendMessage(chatId, `Сколько минут длился приступ?`, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '1', callback_data: `duration_1_${dateString}` },
                            { text: '2', callback_data: `duration_2_${dateString}` },
                            { text: '3', callback_data: `duration_3_${dateString}` },
                            { text: '4', callback_data: `duration_4_${dateString}` },
                            { text: '5', callback_data: `duration_5_${dateString}` },
                            { text: 'Больше 5', callback_data: `duration_more_${dateString}` }
                        ]
                    ]
                }
            });
        }

        else if (data.startsWith('duration_')) {
            const [_, minutes, dateString] = data.split('_');
            const duration = minutes === 'more' ? 'Больше 5' : minutes;

            await bot.editMessageText(
                `Вопрос: Сколько минут длился приступ?\nОтвет: ${duration} минут`,
                {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id
                }
            );

            await bot.sendMessage(chatId, `Желаете добавить заметку про приступ?`, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Да', callback_data: `add_note_${dateString}` },
                            { text: 'Нет', callback_data: `no_note_${dateString}` }
                        ]
                    ]
                }
            });

            await db.query(
                `UPDATE calendar SET seizure_duration = $1 WHERE user_id = $2 AND date = $3`,
                [minutes === 'more' ? '>5' : minutes, chatId, dateString]
            );
        }

        else if (data.startsWith('no_note_')) {
            const dateString = data.split('_')[2];

            await bot.editMessageText(
                `Вопрос: Желаете добавить заметку про приступ?\nОтвет: Нет`,
                {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id
                }
            );

            await bot.sendMessage(chatId, `Запись сохранена!\nДата: ${dateObject.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Календарь', callback_data: 'seizure_calendar' },
                            { text: 'Вернуться в профиль', callback_data: 'back_to_profile' }
                        ]
                    ]
                }
            });

            // Добавляем обработчик для финальных кнопок
            //addFinalButtonsHandler();
        }

        else if (data.startsWith('add_note_')) {
            const dateString = data.split('_')[2];

            await bot.editMessageText(
                `Вопрос: Желаете добавить заметку про приступ?\nОтвет: Да\n\nНапишите свою заметку:`,
                {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id
                }
            );

            const messageHandler = async (msg) => {
                if (msg.chat.id === chatId) {
                    const noteText = msg.text;

                    await bot.sendMessage(
                        chatId,
                        `Заметка записана:\n${noteText}`
                    );
                    await bot.sendMessage(chatId, `Запись сохранена!\nДата: ${dateObject.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: 'Календарь', callback_data: 'seizure_calendar' },
                                    { text: 'Вернуться в профиль', callback_data: 'back_to_profile' }
                                ]
                            ]
                        }
                    });

                    await db.query(
                        `UPDATE calendar SET note = $1, note_text = $2 WHERE user_id = $3 AND date = $4`,
                        [true, noteText, chatId, dateString]
                    );

                    bot.removeListener('message', messageHandler);

                    // Добавляем обработчик для финальных кнопок
                    //addFinalButtonsHandler();
                }
            };

            bot.once('message', messageHandler);
        }
    };

    // Функция для добавления обработчика финальных кнопок
    // const addFinalButtonsHandler = () => {
    //     const finalButtonsHandler = async (finalQuery) => {
    //         if (finalQuery.data === 'seizure_calendar') {
    //             await bot.deleteMessage(chatId, finalQuery.message.message_id);
    //             const message = await bot.sendMessage(chatId, 'Загрузка календаря...');
    //             bot.userMessageIds[chatId] = message.message_id;
    //             await seizureCalendarRussian(bot, chatId, message.message_id);
    //         } else if (finalQuery.data === 'back_to_profile') {
    //             await bot.deleteMessage(chatId, finalQuery.message.message_id);
    //             bot.emit('return_to_profile', chatId);
    //         }
    //     };
    //     bot.once('callback_query', finalButtonsHandler);
    // };

    // Добавляем основной обработчик
    bot.on('callback_query', callbackHandler);
}

module.exports = {
    seizureCalendarRussian,
    handleChangeMonthRussian,
    handleDayPressRussian,
    startRecordingRussian
};