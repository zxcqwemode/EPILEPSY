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

// Обработчик записи приступа (русский)
async function recordSeizureRussian(bot, chatId, date) {
    const userId = chatId;

    // Преобразуем дату в формат YYYY-MM-DD
    const formattedDate = date.toISOString().split('T')[0]; // Получаем только дату

    await db.query(
        `INSERT INTO calendar (user_id, date, had_seizure, created_at) VALUES ($1, $2, $3, $4)`,
        [userId, formattedDate, true, new Date()]
    );

    await bot.sendMessage(chatId, `Запись успешно добавлена на ${date.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`);
}

// Обработчик начала записи на выбранную дату (русский)
async function startRecording(bot, chatId, date) {

    await bot.sendMessage(chatId, `Начинаем запись на ${date.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n
    У вас был приступ эпилепсии?`, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Да', callback_data: `record_seizure_${date}`},
                    { text: 'Нет', callback_data: `record_no_seizure_${date}`}
                ]
            ]
        }
    });
}

module.exports = {
    seizureCalendarRussian,
    handleChangeMonthRussian,
    handleDayPressRussian,
    recordSeizureRussian,
    startRecording
};
