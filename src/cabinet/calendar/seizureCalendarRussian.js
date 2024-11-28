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
                if (dayRecord.had_seizure) {
                    buttonLabel += ' 🔸';
                } else if (dayRecord.note && !dayRecord.had_seizure) {
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
            const monthGenitive = selectedDate.toLocaleString('ru-RU', { month: 'long' }).replace(/(ь|й|т)$/, 'я').replace(/(а|е)$/, 'а');
            const tt = `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDate.getDate().toString().padStart(2, '0')}`;

            inlineKeyboard.push([
                {
                    text: `Сделать запись на ${selectedDay} ${monthGenitive}`,
                    callback_data: `start_record_${tt}`
                }
            ]);
        }

        inlineKeyboard.push([{ text: 'Назад в профиль', callback_data: 'back_to_profile' }]);

        await bot.editMessageText(
            `Ваш календарь приступов\n\nЕсли в календаре уже есть запись, то значок покажет, был ли у вас приступ:\n🔸 — Был приступ\n✅ — Сделана заметка`,
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
async function handleDayPressRussian(bot, chatId, day, monthOffset, messageId) {
    await seizureCalendarRussian(bot, chatId, messageId, parseInt(monthOffset), parseInt(day));
}

// Обработчик изменения месяца (русский)
async function handleChangeMonthRussian(bot, chatId, monthOffset, messageId) {
    await seizureCalendarRussian(bot, chatId, messageId, parseInt(monthOffset));
}

// Обработчик начала записи на выбранную дату (русский)
async function startRecordingRussian(bot, chatId, date, messageId) {
    const dateObject = new Date(date);
    const formattedDate = `${dateObject.getFullYear()}-${(dateObject.getMonth() + 1).toString().padStart(2, '0')}-${dateObject.getDate().toString().padStart(2, '0')}`;

    const awaitingCustomDescriptionRussian = new Set();
    const awaitingCustomTriggerRussian = new Set();
    const awaitingNoteRussian = new Set();

    try {
        await db.query(
            `INSERT INTO calendar (user_id, date, created_at, had_seizure) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, date) DO NOTHING`,
            [chatId, date, new Date(), null]
        );

        await bot.deleteMessage(chatId, messageId);

        await bot.sendMessage(chatId, `У вас был приступ эпилепсии?`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Да', callback_data: `record_seizure_${formattedDate}` },
                        { text: 'Нет', callback_data: `record_no_seizure_${formattedDate}` }
                    ]
                ]
            }
        });

        const callbackHandlerRussian = async (callbackQuery) => {
            const data = callbackQuery.data;
            const chatId = callbackQuery.message.chat.id;
            const messageId = callbackQuery.message.message_id;

            try {
                if (data === `record_no_seizure_${date}`) {
                    await bot.editMessageText(
                        `Запись на ${dateObject.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}\n\nВопрос: У вас был приступ эпилепсии?\nОтвет: Нет`,
                        {
                            chat_id: chatId,
                            message_id: callbackQuery.message.message_id
                        }
                    );

                    await db.query(
                        `UPDATE calendar 
                         SET had_seizure = $1 
                         WHERE user_id = $2 AND date = $3`,
                        [false, chatId, formattedDate]
                    );

                    await bot.sendMessage(chatId, `Желаете добавить заметку к записи?`, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: 'Да', callback_data: `add_note_no_seizure_${formattedDate}` },
                                    { text: 'Нет', callback_data: `no_note_no_seizure_${formattedDate}` }
                                ]
                            ]
                        }
                    });
                } else if (data === `no_note_no_seizure_${date}`) {
                    await bot.editMessageText(
                        `Заметка не добавлена к записи.`,
                        {
                            chat_id: chatId,
                            message_id: callbackQuery.message.message_id
                        }
                    );

                    await db.query(
                        `UPDATE calendar 
                         SET note = false 
                         WHERE user_id = $1 AND date = $2`,
                        [chatId, formattedDate]
                    );

                    await bot.sendMessage(chatId, 'Запись сохранена.', {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: 'Назад', callback_data: 'back_to_profile' }
                                ]
                            ]
                        }
                    });
                    bot.removeListener('callback_query', callbackHandlerRussian);
                }

                else if (data === `add_note_no_seizure_${date}`) {
                    await bot.editMessageText(
                        `Вопрос: Желаете добавить заметку к записи?\nОтвет: Да\n\nНапишите свою заметку:`,
                        {
                            chat_id: chatId,
                            message_id: callbackQuery.message.message_id
                        }
                    );

                    bot.once('message', async (msg) => {
                        if (msg.chat.id === chatId) {
                            const noteText = msg.text;

                            await db.query(
                                `UPDATE calendar 
                                 SET note = true, note_text = $1 
                                 WHERE user_id = $2 AND date = $3`,
                                [noteText, chatId, formattedDate]
                            );

                            await bot.sendMessage(chatId, `Заметка записана:\n${noteText}`, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: 'Назад', callback_data: 'back_to_profile' }
                                        ]
                                    ]
                                }
                            });
                            bot.removeListener('callback_query', callbackHandlerRussian);
                        }
                    });
                }
                else if (data === `add_note_no_seizure_no_${formattedDate}`) {
                    await bot.editMessageText(
                        `Желаете добавить заметку к записи?\nНет`,
                        { chat_id: chatId, message_id: messageId }
                    );

                    // Удаляем пользователя из множества ожидающих заметку
                    awaitingNoteRussian.delete(chatId);

                    // Завершаем процесс
                    bot.removeListener('callback_query', callbackHandlerRussian);
                }
                else if (data === `record_seizure_${formattedDate}`) {
                    await bot.editMessageText(
                        `У вас был приступ эпилепсии?\nДа`,
                        { chat_id: chatId, message_id: messageId }
                    );

                    await db.query(
                        `UPDATE calendar SET had_seizure = $1 WHERE user_id = $2 AND date = $3`,
                        [true, chatId, formattedDate]
                    );

                    await bot.sendMessage(chatId, "Как выглядел приступ?", {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Судороги', callback_data: `description_seizures_${formattedDate}` }],
                                [{ text: 'Потеря сознания', callback_data: `description_loss_${formattedDate}` }],
                                [{ text: 'Некоординированные движения', callback_data: `description_movement_${formattedDate}` }],
                                [{ text: 'Галлюцинации', callback_data: `description_halluc_${formattedDate}` }],
                                [{ text: 'Свой вариант', callback_data: `description_custom_${formattedDate}` }]
                            ]
                        }
                    });
                } else if (data.startsWith('description_')) {
                    const [_, description, dateString] = data.split('_');
                    const descriptionMap = {
                        'seizures': 'Судороги',
                        'loss': 'Потеря сознания',
                        'movement': 'Некоординированные движения',
                        'halluc': 'Галлюцинации'
                    };

                    const seizureDescription = descriptionMap[description] || description;

                    await bot.editMessageText(
                        `Как выглядел приступ?\n${seizureDescription}`,
                        { chat_id: chatId, message_id: messageId }
                    );

                    if (description === 'custom') {
                        await bot.sendMessage(chatId, "Опишите свой вариант:");
                        awaitingCustomDescriptionRussian.add(chatId);
                    } else {
                        await handleSeizureDescription(seizureDescription, dateString, bot, chatId);
                    }
                } else if (data.startsWith('trigger_')) {
                    const [_, triggerType, dateString] = data.split('_');
                    const triggerMap = {
                        'med': 'Пропуск препарата',
                        'light': 'Яркий свет',
                        'sleep': 'Недостаток сна',
                        'alcohol': 'Алкоголь',
                        'stress': 'Стресс'
                    };

                    const triggerText = triggerMap[triggerType] || triggerType;

                    await bot.editMessageText(
                        `Были ли провокаторы приступа?\n${triggerText}`,
                        { chat_id: chatId, message_id: messageId }
                    );

                    if (triggerType === 'custom') {
                        await bot.sendMessage(chatId, "Опишите свой вариант провокатора:");
                        awaitingCustomTriggerRussian.add(chatId);
                    } else {
                        await handleTriggerDescription(triggerText, dateString, bot, chatId);
                    }
                } else if (data.startsWith('repeated_')) {
                    const [_, count, dateString] = data.split('_');
                    const seizureCount = count === '6plus' ? '6+' : (count === 'no' ? 0 : count);

                    await db.query(
                        `UPDATE calendar SET repeated_seizures = $1 WHERE user_id = $2 AND date = $3`,
                        [seizureCount, chatId, dateString]
                    );

                    await bot.editMessageText(
                        `Количество приступов:\n${seizureCount === 0 ? 'Не было' : seizureCount}`,
                        { chat_id: chatId, message_id: messageId }
                    );

                    await bot.sendMessage(chatId, `Желаете добавить заметку к записи?`, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: 'Да', callback_data: `add_note_${dateString}` },
                                    { text: 'Нет', callback_data: `no_note_${dateString}` }
                                ]
                            ]
                        }
                    });
                } else if (data.startsWith('no_note_')) {
                    const dateString = data.split('_')[2];

                    await bot.editMessageText(
                        `Заметка не добавлена к записи.`,
                        {
                            chat_id: chatId,
                            message_id: callbackQuery.message.message_id
                        }
                    );

                    await db.query(
                        `UPDATE calendar 
         SET note = false 
         WHERE user_id = $1 AND date = $2`,
                        [chatId, formattedDate]
                    );

                    await bot.sendMessage(chatId, 'Запись сохранена.', {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: 'Назад', callback_data: 'back_to_profile' }
                                ]
                            ]
                        }
                    });
                    bot.removeListener('callback_query', callbackHandlerRussian);
                }
                else if (data.startsWith('add_note_')) {
                    const dateString = data.split('_')[2];

                    await bot.editMessageText(
                        `Вопрос: Желаете добавить заметку к записи?\nОтвет: Да\n\nНапишите свою заметку:`,
                        {
                            chat_id: chatId,
                            message_id: callbackQuery.message.message_id
                        }
                    );

                    bot.once('message', async (msg) => {
                        if (msg.chat.id === chatId) {
                            const noteText = msg.text;

                            await db.query(
                                `UPDATE calendar 
                 SET note = true, note_text = $1 
                 WHERE user_id = $2 AND date = $3`,
                                [noteText, chatId, formattedDate]
                            );

                            await bot.sendMessage(chatId, `Заметка записана:\n${noteText}`, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: 'Назад', callback_data: 'back_to_profile' }
                                        ]
                                    ]
                                }
                            });
                            bot.removeListener('callback_query', callbackHandlerRussian);
                        }
                    });
                }

            } catch (error) {
                console.error('Error in callback handler:', error);
            }
        };

        const handleSeizureDescription = async (description, dateString, botInstance, chatId) => {
            try {
                await db.query(
                    'UPDATE calendar SET seizure_description = $1 WHERE user_id = $2 AND date = $3',
                    [description, chatId, dateString]
                );

                await botInstance.sendMessage(chatId, "Были ли провокаторы приступа?", {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Пропуск препарата', callback_data: `trigger_med_${dateString}` }],
                            [{ text: 'Яркий свет', callback_data: `trigger_light_${dateString}` }],
                            [{ text: 'Недостаток сна', callback_data: `trigger_sleep_${dateString}` }],
                            [{ text: 'Алкоголь', callback_data: `trigger_alcohol_${dateString}` }],
                            [{ text: 'Стресс', callback_data: `trigger_stress_${dateString}` }],
                            [{ text: 'Свой вариант', callback_data: `trigger_custom_${dateString}` }]
                        ]
                    }
                });
            } catch (error) {
                console.error('Error in handleSeizureDescription:', error);
                await botInstance.sendMessage(chatId, 'Произошла ошибка при сохранении описания приступа.');
            }
        };

        const handleTriggerDescription = async (trigger, dateString, botInstance, chatId) => {
            try {
                await db.query(
                    'UPDATE calendar SET trigger = $1 WHERE user_id = $2 AND date = $3',
                    [trigger, chatId, dateString]
                );

                await botInstance.sendMessage(chatId, "Сколько было приступов?", {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '1', callback_data: `repeated_1_${dateString}` },
                                { text: '2', callback_data: `repeated_2_${dateString}` },
                                { text: '3', callback_data: `repeated_3_${dateString}` }
                            ],
                            [
                                { text: '4', callback_data: `repeated_4_${dateString}` },
                                { text: '5', callback_data: `repeated_5_${dateString}` },
                                { text: '6+', callback_data: `repeated_6plus_${dateString}` }
                            ],
                            [{ text: 'Не было', callback_data: `repeated_no_${dateString}` }]
                        ]
                    }
                });
            } catch (error) {
                console.error('Error in handleTriggerDescription:', error);
                await botInstance.sendMessage(chatId, 'Произошла ошибка при сохранении провокатора.');
            }
        };

        bot.on('message', async (msg) => {
            if (msg.chat.id === chatId) {
                if (awaitingCustomDescriptionRussian.has(chatId)) {
                    awaitingCustomDescriptionRussian.delete(chatId);
                    if (msg.text && msg.text.trim() !== '') {
                        await handleSeizureDescription(msg.text, formattedDate, bot, chatId);
                    } else {
                        await bot.sendMessage(chatId, "Пожалуйста, введите корректное описание приступа.");
                    }
                }

                if (awaitingCustomTriggerRussian.has(chatId)) {
                    awaitingCustomTriggerRussian.delete(chatId);
                    if (msg.text && msg.text.trim() !== '') {
                        await handleTriggerDescription(msg.text, formattedDate, bot, chatId);
                    } else {
                        await bot.sendMessage(chatId, "Пожалуйста, введите корректный провокатор приступа.");
                    }
                }
                if (awaitingNoteRussian.has(chatId)) {
                    awaitingNoteRussian.delete(chatId);
                    if (msg.text && msg.text.trim() !== '') {
                        await db.query(
                            'UPDATE calendar SET note_text = $1, note = $2 WHERE user_id = $3 AND date = $4',
                            [msg.text, true, chatId, formattedDate]
                        );
                        await bot.sendMessage(chatId, "Заметка сохранена.");
                        // Завершаем процесс
                        bot.removeListener('callback_query', callbackHandlerRussian);
                    } else {
                        await bot.sendMessage(chatId, "Пожалуйста, введите корректную заметку.");
                    }
                }

            }
        });

        bot.on('callback_query', callbackHandlerRussian);

    } catch (error) {
        console.error('Error in startRecordingRussian:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка при создании записи. Пожалуйста, попробуйте еще раз.');
    }
}

module.exports = {
    seizureCalendarRussian,
    handleChangeMonthRussian,
    handleDayPressRussian,
    startRecordingRussian
};